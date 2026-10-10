"""Error envelope (API contract §2). Every non-2xx response uses this shape."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict[str, Any] | None = None,
                 headers: dict[str, str] | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}
        self.headers = headers or {}


def envelope(request: Request, status: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    request.state.error_code = code
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": request_id,
            }
        },
    )


_HTTP_CODES = {
    400: ("BAD_REQUEST", "The request could not be read."),
    401: ("UNAUTHENTICATED", "Please sign in."),
    404: ("NOT_FOUND", "We couldn't find that."),
    405: ("NOT_FOUND", "We couldn't find that."),
}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError):
        response = envelope(request, exc.status, exc.code, exc.message, exc.details)
        response.headers.update(exc.headers)
        return response

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        fields = []
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path")]
            fields.append({"field": ".".join(loc) or "body", "issue": err.get("msg", "invalid")})
        if any(e.get("type") == "json_invalid" for e in exc.errors()):
            return envelope(request, 400, "BAD_REQUEST", "The request could not be read.")
        return envelope(request, 422, "VALIDATION_ERROR", "Some fields need attention.", {"fields": fields})

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        code, message = _HTTP_CODES.get(exc.status_code, ("INTERNAL_ERROR", "Something went wrong. Try again."))
        return envelope(request, exc.status_code, code, message)

    # Unhandled exceptions are turned into INTERNAL_ERROR by RequestIdMiddleware,
    # which logs the exception type only (messages may contain document text).
