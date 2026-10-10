"""Sign-in attempt limits (NFR-SEC-01 hardening, threat model "no rate limiting on login").

Failed sign-ins are counted per email and per client IP over a sliding window. When either
count reaches its limit, API-02 answers 429 RATE_LIMITED before checking the password, the same
way for known and unknown emails. A successful sign-in clears that email's count.

In memory and per process: enough for the single-process demo server (PM2 runs one). Several
workers or servers would need a shared store such as Redis.
"""

import threading
import time
from collections import deque

from starlette.requests import Request

from app.config import get_settings

_LOOPBACK = {"127.0.0.1", "::1"}
_lock = threading.Lock()
_failures: dict[str, deque[float]] = {}
_MAX_KEYS = 10_000  # bounds memory if many different emails or IPs are tried


def client_ip(request: Request) -> str:
    """The caller's IP. X-Forwarded-For is trusted only from a loopback peer (the local Vite
    proxy, which appends the address it saw as the last entry); the API binds to 127.0.0.1."""
    peer = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if peer in _LOOPBACK and forwarded:
        return forwarded.split(",")[-1].strip() or peer
    return peer


def _keys(email: str, ip: str) -> list[tuple[str, int]]:
    settings = get_settings()
    return [(f"email:{email}", settings.login_max_failures_per_email), (f"ip:{ip}", settings.login_max_failures_per_ip)]


def _recent(key: str, now: float, window: float) -> deque[float]:
    times = _failures.setdefault(key, deque())
    while times and times[0] <= now - window:
        times.popleft()
    return times


def retry_after_s(email: str, ip: str) -> int | None:
    """Seconds until another attempt is allowed, or None if the attempt may go ahead."""
    window = get_settings().login_window_minutes * 60
    now = time.monotonic()
    wait = 0.0
    with _lock:
        for key, limit in _keys(email, ip):
            times = _recent(key, now, window)
            if len(times) >= limit:
                wait = max(wait, times[len(times) - limit] + window - now)
    return max(1, int(wait) + 1) if wait > 0 else None


def record_failure(email: str, ip: str) -> None:
    window = get_settings().login_window_minutes * 60
    now = time.monotonic()
    with _lock:
        for key, _limit in _keys(email, ip):
            _recent(key, now, window).append(now)
        if len(_failures) > _MAX_KEYS:
            for key in [k for k in _failures if not _recent(k, now, window)]:
                del _failures[key]


def record_success(email: str) -> None:
    with _lock:
        _failures.pop(f"email:{email}", None)


def reset() -> None:
    with _lock:
        _failures.clear()
