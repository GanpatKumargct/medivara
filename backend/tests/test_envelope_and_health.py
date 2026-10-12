import logging

import pytest

from conftest import API


def test_unknown_route_returns_enveloped_404(client):
    response = client.get(f"{API}/does-not-exist")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "NOT_FOUND"
    assert error["request_id"] == response.headers["X-Request-ID"]
    assert error["request_id"].startswith("req_")


def test_validation_error_lists_fields(client):
    response = client.post(f"{API}/auth/login", json={"email": "", "password": "x"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["details"]["fields"][0]["field"] == "email"


def test_malformed_json_is_bad_request(client):
    response = client.post(f"{API}/auth/login", content="{not json", headers={"content-type": "application/json"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


def test_unhandled_exception_is_enveloped_500_without_internals(client):
    @client.app.get(f"{API}/_boom")
    def boom():
        raise RuntimeError("secret document text HbA1c 8.4")

    response = client.get(f"{API}/_boom")
    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "INTERNAL_ERROR"
    assert "HbA1c" not in response.text
    assert response.headers["X-Request-ID"] == body["error"]["request_id"]


def test_logs_contain_only_allow_listed_fields(client, caplog):
    caplog.set_level(logging.INFO, logger="medivara")
    logging.getLogger("medivara").propagate = True
    try:
        client.post(f"{API}/auth/login", json={"email": "meera.demo@medivara.test", "password": "WrongSecret123"})
    finally:
        logging.getLogger("medivara").propagate = False
    # What would actually be written: each record through the allow-list formatter.
    from app.middleware import JsonAllowListFormatter

    text = "\n".join(JsonAllowListFormatter().format(r) for r in caplog.records)
    assert "meera.demo" not in text
    assert "WrongSecret123" not in text
    access = [r for r in caplog.records if r.getMessage() == "request"]
    assert access and access[0].route == "/api/v1/auth/login"


@pytest.mark.parametrize(
    ("mode", "available", "model"),
    [("live", True, "google/gemini-2.5-flash"), ("cache_only", False, "google/gemini-2.5-flash"), ("off", False, None)],
)
def test_health_reflects_ai_mode(client, monkeypatch, mode, available, model):
    from app import config

    monkeypatch.setenv("AI_MODE", mode)
    config.get_settings.cache_clear()
    body = client.get(f"{API}/health").json()
    assert body["ai"] == {"mode": mode, "available": available, "model": model}
    assert body["demo_mode"] is True
    assert body["contract_version"] == "1.6.0"
    assert "key" not in str(body).lower()
