"""Sign-in attempt limits (app/ratelimit.py) and security headers (app/middleware.py)."""

from sqlmodel import Session, select

from conftest import API, MEERA, RAVI, auth, login

LOGIN = f"{API}/auth/login"


def attempt(client, email, password="wrong-password", ip=None):
    headers = {"X-Forwarded-For": ip} if ip else {}
    return client.post(LOGIN, json={"email": email, "password": password}, headers=headers)


def test_fifth_failure_locks_the_email_even_for_the_right_password(client):
    for _ in range(5):
        assert attempt(client, MEERA).json()["error"]["code"] == "INVALID_CREDENTIALS"
    blocked = attempt(client, MEERA, "MediVara-Demo-2026")
    assert blocked.status_code == 429
    body = blocked.json()["error"]
    assert body["code"] == "RATE_LIMITED" and body["details"]["retry_after_s"] > 0
    assert int(blocked.headers["Retry-After"]) == body["details"]["retry_after_s"] <= 15 * 60
    # Another account from another address is unaffected.
    assert attempt(client, RAVI, "MediVara-Demo-2026", ip="203.0.113.9").status_code == 200


def test_unknown_and_known_emails_are_limited_the_same_way(client):
    for email in (MEERA, "nobody@medivara.test"):
        for _ in range(5):
            attempt(client, email, ip=f"198.51.100.{len(email)}")
    known, unknown = attempt(client, MEERA, ip="192.0.2.1"), attempt(client, "nobody@medivara.test", ip="192.0.2.2")
    strip = lambda r: {**r.json()["error"], "request_id": None}  # noqa: E731
    assert known.status_code == unknown.status_code == 429 and strip(known) == strip(unknown)


def test_email_case_and_spaces_do_not_bypass_the_limit(client):
    for variant in ("MEERA.demo@medivara.test", " meera.demo@MediVara.test ", MEERA, "Meera.Demo@medivara.test", MEERA):
        attempt(client, variant)
    assert attempt(client, MEERA, "MediVara-Demo-2026").status_code == 429


def test_success_clears_the_email_count(client):
    for _ in range(4):
        attempt(client, MEERA)
    login(client, MEERA)
    for _ in range(4):
        assert attempt(client, MEERA).status_code == 401
    assert login(client, MEERA)


def test_one_ip_spraying_many_emails_is_limited(client):
    for i in range(20):
        assert attempt(client, f"user{i}@medivara.test", ip="203.0.113.50").status_code == 401
    assert attempt(client, RAVI, "MediVara-Demo-2026", ip="203.0.113.50").status_code == 429
    assert attempt(client, RAVI, "MediVara-Demo-2026", ip="203.0.113.51").status_code == 200


def test_window_expiry_allows_sign_in_again(client, monkeypatch):
    from app import ratelimit

    now = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: now[0])
    for _ in range(5):
        attempt(client, MEERA)
    assert attempt(client, MEERA, "MediVara-Demo-2026").status_code == 429
    now[0] += 15 * 60 + 1
    assert attempt(client, MEERA, "MediVara-Demo-2026").status_code == 200


def test_rate_limited_attempts_are_audited_without_the_email(client):
    from app.db import get_engine
    from app.models import AuditEvent

    for _ in range(6):
        attempt(client, MEERA)
    with Session(get_engine()) as session:
        rows = session.exec(select(AuditEvent).where(AuditEvent.action == "auth.rate_limited")).all()
    assert len(rows) == 1 and "meera" not in str(rows[0].model_dump()).lower()


def test_forwarded_for_is_ignored_from_a_non_loopback_peer():
    from starlette.requests import Request

    from app.ratelimit import client_ip

    def request(peer):
        return Request({"type": "http", "headers": [(b"x-forwarded-for", b"6.6.6.6, 10.0.0.7")], "client": (peer, 1)})

    assert client_ip(request("127.0.0.1")) == "10.0.0.7"  # last hop, appended by our proxy
    assert client_ip(request("192.0.2.10")) == "192.0.2.10"


EXPECTED = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "cache-control": "no-store",
}


def test_security_headers_on_success_error_and_unknown_routes(client):
    token = login(client, MEERA)
    responses = {
        "health": client.get(f"{API}/health"),
        "authed": client.get(f"{API}/me", headers=auth(token)),
        "401": client.get(f"{API}/me"),
        "404": client.get(f"{API}/nope"),
        "422": client.post(LOGIN, json={}),
        "413": client.post(f"{API}/patients/pat_meera/documents", headers={"Content-Length": str(50 * 1024 * 1024)}),
    }
    for name, response in responses.items():
        for header, value in EXPECTED.items():
            assert (name, header, response.headers.get(header)) == (name, header, value)
        assert response.headers["content-security-policy"].startswith("default-src 'none'"), name


def test_swagger_ui_still_loads_without_the_json_csp(client):
    docs = client.get(f"{API}/docs")
    assert docs.status_code == 200 and "content-security-policy" not in docs.headers
    assert docs.headers["x-frame-options"] == "DENY"
