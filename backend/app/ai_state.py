"""AI availability as reported by API-01.

Reflects configuration plus the outcome of the most recent model call. The model
wrapper (app/llm.py) calls record_call_outcome(); reading it never triggers a call.
"""

from app.config import get_settings

_last_call_ok = True


def record_call_outcome(ok: bool) -> None:
    global _last_call_ok
    _last_call_ok = ok


def ai_status() -> dict:
    from app import llm  # local import: llm imports this module

    mode = get_settings().ai_mode
    available = mode == "live" and bool(llm.api_key()) and _last_call_ok
    return {
        "mode": mode,
        "available": available,
        "model": None if mode == "off" else llm.model_id(),
    }
