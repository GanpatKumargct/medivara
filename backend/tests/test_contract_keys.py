"""Early BE-15.1: real responses contain at least the fixture keys, with the same JSON types."""

import json
from pathlib import Path

from conftest import API, KARTHIK, MEERA, auth, login

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


def fixture(name: str):
    return json.loads((CONTRACTS / name).read_text())


def assert_shape(expected, actual, path="$"):
    if expected is None or actual is None:
        return  # nullable values may be null on either side
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path}: expected object"
        for key, value in expected.items():
            assert key in actual, f"{path}.{key} missing"
            assert_shape(value, actual[key], f"{path}.{key}")
    elif isinstance(expected, list):
        assert isinstance(actual, list), f"{path}: expected array"
        if expected and actual:
            assert_shape(expected[0], actual[0], f"{path}[0]")
    elif isinstance(expected, bool):
        assert isinstance(actual, bool), f"{path}: expected boolean"
    elif isinstance(expected, (int, float)):
        assert isinstance(actual, (int, float)) and not isinstance(actual, bool), f"{path}: expected number"
    else:
        assert isinstance(actual, type(expected)), f"{path}: expected {type(expected).__name__}"


def test_api_01_health(client):
    assert_shape(fixture("API-01.200.json"), client.get(f"{API}/health").json())


def test_api_02_login_and_401(client):
    ok = client.post(f"{API}/auth/login", json={"email": MEERA, "password": "MediVara-Demo-2026"})
    assert_shape(fixture("API-02.200.json"), ok.json())
    bad = client.post(f"{API}/auth/login", json={"email": MEERA, "password": "x"})
    assert_shape(fixture("API-02.401.json"), bad.json())
    assert bad.json()["error"]["message"] == fixture("API-02.401.json")["error"]["message"]


def test_api_04_me(client):
    assert_shape(fixture("API-04.200.json"), client.get(f"{API}/me", headers=auth(login(client, MEERA))).json())


def test_api_05_consent(client):
    response = client.post(
        f"{API}/me/consents",
        headers=auth(login(client, MEERA)),
        json={"consent_type": "ai_processing", "granted": True, "policy_version": "2026-10-demo-1"},
    )
    assert_shape(fixture("API-05.201.json"), response.json())


def test_api_06_and_07_patients(client):
    token = auth(login(client, KARTHIK))
    assert_shape(fixture("API-06.200.json"), client.get(f"{API}/patients", headers=token).json())
    assert_shape(fixture("API-07.200.json"), client.get(f"{API}/patients/pat_meera", headers=token).json())


def test_api_07_403(client):
    ravi = auth(login(client, "ravi.demo@medivara.test"))
    response = client.get(f"{API}/patients/pat_meera", headers=ravi)
    assert_shape(fixture("API-07.403.json"), response.json())
    assert response.json()["error"]["message"] == fixture("API-07.403.json")["error"]["message"]


def test_api_08_10_11_documents(client, fake_model, pdfs):
    from conftest import upload

    token = login(client, MEERA)
    created = upload(client, token, "lab_sunrise_may2026.pdf", pdfs["lab_sunrise_may2026.pdf"])
    assert_shape(fixture("API-08.202.json"), created.json())
    upload(client, token, "scanned_prescription.pdf", pdfs["scanned_prescription.pdf"])
    listing = client.get(f"{API}/patients/pat_meera/documents", headers=auth(token)).json()
    assert_shape(fixture("API-10.200.json"), listing)
    doc_id = created.json()["document"]["id"]
    detail = client.get(f"{API}/patients/pat_meera/documents/{doc_id}", headers=auth(token)).json()
    assert_shape(fixture("API-11.200.needs-review.json"), detail)
    # The Haemoglobin fact matches the fixture field for field (except IDs and timestamps).
    expected = fixture("API-11.200.needs-review.json")["facts"][1]
    actual = next(f for f in detail["facts"] if f["fields"]["name"] == "Haemoglobin")
    for key in ("fact_type", "display_text", "fields", "event_date", "source", "confidence", "uncertainty_reasons", "status"):
        assert actual[key] == expected[key], key
    duplicate = upload(client, token, "again.pdf", pdfs["lab_sunrise_may2026.pdf"])
    assert_shape(fixture("API-08.409.json"), duplicate.json())
