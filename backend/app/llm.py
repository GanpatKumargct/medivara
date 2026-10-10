"""Model client wrapper (BE-5.3, AI design §12). Every model call goes through here.

Providers (LLM_PROVIDER):
- `openrouter` (default): OpenRouter chat completions, model OPENROUTER_MODEL
  (default google/gemini-2.5-flash). Privacy: `provider.data_collection = "deny"` routes only to
  providers that don't store or train on prompts (the equivalent of Gemini's store=false), and
  `require_parameters` routes only to providers that honour the JSON-schema response format.
- `gemini`: Google's Interactions API directly, with store=False (the original design).

Safeguards, whichever provider: stateless calls with no history; JSON-schema responses parsed
and checked here; blocked, filtered or empty output is a failure even with HTTP 200; one call
in flight; one retry with backoff for timeout, quota, server errors and invalid output (none for
blocks); AI_MODE `off` / `cache_only` make no calls; logs carry model, latency, tokens and
outcome only, never prompts or outputs.
"""

import hashlib
import json
import logging
import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from app.ai_state import record_call_outcome
from app.config import get_settings

log = logging.getLogger("medivara.ai")

Outcome = Literal["ok", "timeout", "quota", "server", "blocked", "invalid", "unavailable", "disabled"]
RETRYABLE: frozenset[str] = frozenset({"timeout", "quota", "server", "invalid"})


@dataclass
class Reply:
    """A provider's answer, normalised. `status` is "completed", or why it isn't."""

    status: str
    text: str | None
    tokens: dict[str, int] = field(default_factory=dict)


# A transport takes the provider-neutral request and a timeout and returns a Reply (or any
# object with .status / .output_text / .usage, as recorded test doubles do).
Transport = Callable[[dict[str, Any], float], Any]

_call_lock = threading.Lock()
_transport: Transport | None = None


@dataclass
class ModelResult:
    outcome: Outcome
    data: dict[str, Any] | None = None
    model_id: str | None = None
    latency_ms: int = 0
    attempts: int = 0
    tokens: dict[str, int] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.outcome == "ok"


class InvalidOutput(Exception):
    """Raised by a caller's validate() when parsed JSON doesn't fit the expected shape."""


class ProviderError(Exception):
    """An HTTP-level failure from the provider, carrying its status code."""

    def __init__(self, status_code: int, message: str = ""):
        super().__init__(message or f"provider returned {status_code}")
        self.status_code = status_code


def set_transport(transport: Transport | None) -> None:
    """Replace the network transport (tests, recorded responses). None restores the default."""
    global _transport
    _transport = transport


def provider() -> str:
    return get_settings().llm_provider


def model_id() -> str:
    settings = get_settings()
    return settings.openrouter_model if settings.llm_provider == "openrouter" else settings.gemini_model


def api_key() -> str:
    settings = get_settings()
    return settings.openrouter_api_key if settings.llm_provider == "openrouter" else settings.gemini_api_key


# --- OpenRouter -------------------------------------------------------------------------


def openrouter_payload(request: dict[str, Any]) -> dict[str, Any]:
    """Chat-completions body for one stateless call (system + one user message, no history)."""
    settings = get_settings()
    body: dict[str, Any] = {
        "model": request["model"],
        "messages": [
            {"role": "system", "content": request["system_instruction"]},
            {"role": "user", "content": request["input"]},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": request.get("schema_name", "medivara_response"), "strict": False, "schema": request["schema"]},
        },
        "provider": {"data_collection": "deny", "require_parameters": True},
        "stream": False,
    }
    if settings.openrouter_reasoning_effort:
        body["reasoning"] = {"effort": settings.openrouter_reasoning_effort}
    return body


def parse_openrouter(status_code: int, body: Any) -> Reply:
    """Map an OpenRouter HTTP response to a Reply, or raise ProviderError for HTTP failures."""
    if status_code >= 400:
        raise ProviderError(status_code)
    if not isinstance(body, dict):
        return Reply(status="invalid", text=None)
    if isinstance(body.get("error"), dict):  # errors can arrive with HTTP 200
        code = body["error"].get("code")
        if code == 403:  # moderation refusal
            return Reply(status="failed", text=None)
        raise ProviderError(code if isinstance(code, int) else 502)
    choices = body.get("choices") or []
    usage = body.get("usage") or {}
    tokens = {k: v for k, v in (("input_tokens", usage.get("prompt_tokens")), ("output_tokens", usage.get("completion_tokens"))) if isinstance(v, int)}
    if not choices:
        return Reply(status="failed", text=None, tokens=tokens)
    choice = choices[0]
    finish = choice.get("finish_reason") or choice.get("native_finish_reason")
    text = (choice.get("message") or {}).get("content")
    if finish in ("content_filter", "safety", "SAFETY", "blocked"):
        return Reply(status="failed", text=None, tokens=tokens)
    if finish in ("length", "MAX_TOKENS"):
        return Reply(status="incomplete", text=text, tokens=tokens)
    return Reply(status="completed", text=text, tokens=tokens)


def _openrouter_transport(request: dict[str, Any], timeout: float) -> Reply:
    import httpx

    settings = get_settings()
    response = httpx.post(
        f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "X-Title": "MediVara (hackathon prototype, synthetic data)",
        },
        json=openrouter_payload(request),
        timeout=timeout,
    )
    try:
        body = response.json()
    except ValueError:
        body = None
    return parse_openrouter(response.status_code, body)


# --- Gemini (direct) --------------------------------------------------------------------


def _gemini_transport(request: dict[str, Any], timeout: float) -> Any:
    from google import genai

    client = genai.Client(api_key=get_settings().gemini_api_key)
    return client.interactions.create(
        model=request["model"],
        input=request["input"],
        system_instruction=request["system_instruction"],
        store=False,  # never background or previous_interaction_id
        response_mime_type="application/json",
        response_format={"type": "text", "mime_type": "application/json", "schema": request["schema"]},
        generation_config={"thinking_level": request["thinking_level"]},
        timeout=timeout,
    )


# --- Shared call logic ------------------------------------------------------------------


def _classify_exception(exc: Exception) -> Outcome:
    if isinstance(exc, TimeoutError) or "timeout" in type(exc).__name__.lower():
        return "timeout"
    status = getattr(exc, "status_code", None)
    if status == 429:
        return "quota"
    if isinstance(status, int) and status >= 500:
        return "server"
    if isinstance(status, int):
        return "unavailable"  # 4xx: bad key, unknown model, no endpoint; retrying won't help
    return "server"  # network errors and the like


def _tokens(response: Any) -> dict[str, int]:
    if isinstance(response, Reply):
        return dict(response.tokens)
    usage = getattr(response, "usage", None)
    if usage is None:
        return {}
    keys = {"input_tokens": "total_input_tokens", "output_tokens": "total_output_tokens"}
    return {k: v for k, attr in keys.items() if isinstance(v := getattr(usage, attr, None), int)}


def _parse(response: Any, validate: Callable[[dict], None] | None) -> tuple[Outcome, dict | None]:
    status = getattr(response, "status", None)
    text = response.text if isinstance(response, Reply) else getattr(response, "output_text", None)
    if status in ("failed", "cancelled") or not text or not str(text).strip():
        return "blocked", None
    if status not in (None, "completed"):
        return "invalid", None  # incomplete, budget_exceeded, …
    raw = str(text).strip()
    if raw.startswith("```"):  # some models wrap JSON in a code fence despite the schema
        raw = raw.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return "invalid", None
    if not isinstance(data, dict):
        return "invalid", None
    if validate is not None:
        try:
            validate(data)
        except InvalidOutput:
            return "invalid", None
    return "ok", data


def _dev_cache_path(request: dict[str, Any]) -> Path:
    digest = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()
    return Path(get_settings().storage_dir).parent / "dev_cache" / f"{digest}.json"


def generate_json(
    *,
    stage: str,
    system_instruction: str,
    input_text: str,
    schema: dict[str, Any],
    timeout_s: float,
    validate: Callable[[dict], None] | None = None,
    model: str | None = None,
) -> ModelResult:
    settings = get_settings()
    chosen = model or model_id()
    if settings.ai_mode != "live":
        return ModelResult(outcome="disabled")
    if not api_key() and _transport is None:
        record_call_outcome(False)
        return ModelResult(outcome="unavailable")

    # Provider-neutral request: one stateless call, nothing retained by the provider.
    request: dict[str, Any] = {
        "provider": settings.llm_provider,
        "model": chosen,
        "system_instruction": system_instruction,
        "input": input_text,
        "schema": schema,
        "schema_name": f"medivara_{stage}",
        "thinking_level": settings.gemini_thinking_level,
        "no_retention": True,
    }

    cache_path = _dev_cache_path(request) if settings.dev_response_cache else None
    if cache_path is not None and cache_path.exists():
        return ModelResult(outcome="ok", data=json.loads(cache_path.read_text()), model_id=chosen)

    transport = _transport or (_openrouter_transport if settings.llm_provider == "openrouter" else _gemini_transport)
    result = ModelResult(outcome="server", model_id=chosen)
    start = time.perf_counter()
    with _call_lock:
        for attempt in (1, 2):
            result.attempts = attempt
            try:
                response = transport(request, timeout_s)
                result.tokens = _tokens(response)
                result.outcome, result.data = _parse(response, validate)
            except Exception as exc:  # noqa: BLE001  mapped to typed outcomes
                result.outcome, result.data = _classify_exception(exc), None
            if result.outcome not in RETRYABLE or attempt == 2:
                break
            time.sleep(settings.gemini_retry_backoff_s + random.uniform(0, settings.gemini_retry_backoff_s / 2))
    result.latency_ms = int((time.perf_counter() - start) * 1000)

    record_call_outcome(result.ok)
    log.info(
        "model_call",
        extra={
            "stage": stage,
            "model_id": chosen,
            "outcome": result.outcome,
            "attempts": result.attempts,
            "latency_ms": result.latency_ms,
            **result.tokens,
        },
    )
    if result.ok and cache_path is not None:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(result.data))
    return result
