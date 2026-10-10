"""Request IDs and allow-list structured logging (FR-105, NFR-PRIV-03).

Logs contain only: request_id, method, route, status, duration_ms, error_code.
Never bodies, query strings, tokens, document text, prompts or questions.
"""

import json
import logging
import secrets
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

log = logging.getLogger("medivara.access")

# 10 MB upload limit plus room for the multipart envelope and form fields.
MAX_BODY_BYTES = 10 * 1024 * 1024 + 64 * 1024

ALLOWED_LOG_FIELDS = (
    "request_id",
    "method",
    "route",
    "status",
    "duration_ms",
    "error_code",
    "exc_type",
    # Model calls (app/llm.py) and document processing (app/pipeline).
    "stage",
    "model_id",
    "outcome",
    "attempts",
    "latency_ms",
    "input_tokens",
    "output_tokens",
    "document_id",
    "failure_code",
)


# On every API response (SRD 12 threat model). JSON responses also get a CSP that allows nothing,
# since they never need to load or frame anything. Not on Swagger UI (/docs loads scripts from a
# CDN) or on the PDF file route (a strict CSP can stop the browser's built-in PDF viewer).
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cache-Control": "no-store",
}
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


def apply_security_headers(request: Request, response) -> None:
    for name, value in SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)  # a route's own value (e.g. Cache-Control) wins
    is_json = response.headers.get("content-type", "").startswith("application/json")
    if is_json and not request.url.path.endswith(_DOCS_PATHS):
        response.headers.setdefault("Content-Security-Policy", API_CSP)


def new_request_id() -> str:
    return "req_" + secrets.token_hex(13).upper()


class JsonAllowListFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname, "event": record.getMessage()}
        for key in ALLOWED_LOG_FIELDS:
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        return json.dumps(payload)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonAllowListFormatter())
    root = logging.getLogger("medivara")
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    root.propagate = False


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = new_request_id()
        request.state.error_code = None
        start = time.perf_counter()
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > MAX_BODY_BYTES:
            # Refused before Starlette spools the body to disk (uploads are capped at 10 MB).
            from app.errors import envelope

            response = envelope(request, 413, "FILE_TOO_LARGE", "This file is larger than 10 MB. Please choose a smaller file.")
            response.headers["X-Request-ID"] = request.state.request_id
            apply_security_headers(request, response)
            log.info("request", extra={"request_id": request.state.request_id, "method": request.method,
                                       "route": "unmatched", "status": 413, "duration_ms": 0, "error_code": "FILE_TOO_LARGE"})
            return response
        try:
            response = await call_next(request)
        except Exception as exc:  # noqa: BLE001
            # Handled here so the 500 still carries the request ID and is logged.
            from app.errors import envelope

            log.error("unhandled_exception", extra={"request_id": request.state.request_id, "exc_type": type(exc).__name__})
            response = envelope(request, 500, "INTERNAL_ERROR", "Something went wrong. Try again.")
        response.headers["X-Request-ID"] = request.state.request_id
        apply_security_headers(request, response)
        route = request.scope.get("route")
        log.info(
            "request",
            extra={
                "request_id": request.state.request_id,
                "method": request.method,
                # Route template (e.g. /patients/{patient_id}), not the raw path.
                "route": getattr(route, "path", "unmatched"),
                "status": response.status_code,
                # Whole milliseconds: decimals like 18.4 would match lab values in TC-SEC-04 log searches.
                "duration_ms": int((time.perf_counter() - start) * 1000),
                "error_code": request.state.error_code,
            },
        )
        return response
