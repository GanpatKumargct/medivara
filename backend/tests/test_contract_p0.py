"""BE-15.1 contract key test: every P0 fixture (API-01 to API-21) against a real response.

Real responses must contain at least the fixture's keys, with the same JSON types. A guard
test fails if a P0 fixture file exists that no producer below exercises.
"""

import re
from pathlib import Path

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload
from fake_model import statement
from test_contract_keys import assert_shape, fixture

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
P = f"{API}/patients/pat_meera"
NOT_BUILT = {"API-09.202.json"}  # P1 sample import, not built
P0 = re.compile(r"^API-(0\d|1\d|2[01])\.")


def p0_fixtures() -> set[str]:
    return {p.name for p in CONTRACTS.glob("API-*.json") if P0.match(p.name)} - NOT_BUILT


def build(client, fake_model, pdfs, monkeypatch) -> dict[str, dict]:
    """Produce one real response per P0 fixture file."""
    from app import config
    from app.db import get_engine
    from app.pipeline.golden_cache import export
    from sqlmodel import Session

    out: dict[str, dict] = {}
    meera, ravi = login(client, MEERA), login(client, RAVI)
    out["API-01.200.json"] = client.get(f"{API}/health").json()
    out["API-02.200.json"] = client.post(f"{API}/auth/login", json={"email": KARTHIK, "password": "MediVara-Demo-2026"}).json()
    out["API-02.401.json"] = client.post(f"{API}/auth/login", json={"email": KARTHIK, "password": "wrong"}).json()
    out["API-04.200.json"] = client.get(f"{API}/me", headers=auth(meera)).json()
    out["API-05.201.json"] = client.post(f"{API}/me/consents", headers=auth(meera), json={
        "consent_type": "ai_processing", "granted": True, "policy_version": "2026-10-demo-1"}).json()
    out["API-06.200.json"] = client.get(f"{API}/patients", headers=auth(login(client, KARTHIK))).json()
    out["API-07.200.json"] = client.get(P, headers=auth(meera)).json()
    out["API-07.403.json"] = client.get(P, headers=auth(ravi)).json()

    def up(name, token=meera, patient="pat_meera"):
        return upload(client, token, name, pdfs[name], patient_id=patient)

    lab = up("lab_sunrise_may2026.pdf")
    out["API-08.202.json"] = lab.json()
    lab_id = lab.json()["document"]["id"]
    out["API-08.409.json"] = up("lab_sunrise_may2026.pdf").json()
    lab1 = up("lab_sunrise_mar2025.pdf").json()["document"]["id"]
    for name in ("rx_lakeview_mar2025.pdf", "discharge_greenfield_jul2025.pdf"):
        up(name)
    up("rx_lakeview_sep2026.pdf")
    note = up("note_lakeview_sep2026.pdf").json()["document"]["id"]
    scan = up("scanned_prescription.pdf").json()["document"]["id"]

    def detail(did, token=meera, patient="pat_meera"):
        return client.get(f"{API}/patients/{patient}/documents/{did}", headers=auth(token)).json()

    out["API-10.200.json"] = client.get(f"{P}/documents", headers=auth(meera)).json()
    out["API-11.200.needs-review.json"] = detail(lab_id)
    out["API-11.200.suspicious.json"] = detail(note)
    out["API-11.200.failed-no-text-layer.json"] = detail(scan)
    # DOC-1 (lab report, all high confidence) matches the lab-report fixtures field for field.
    out["API-16.200.json"] = client.post(f"{P}/documents/{lab1}/review", headers=auth(meera),
                                         json={"action": "confirm_high_confidence"}).json()
    out["API-11.200.ready.json"] = detail(lab1)
    fact = out["API-11.200.needs-review.json"]["facts"][0]["id"]
    out["API-15.200.json"] = client.patch(f"{P}/facts/{fact}", headers=auth(meera), json={"action": "confirm"}).json()
    out["API-17.200.json"] = client.get(f"{P}/timeline", headers=auth(meera)).json()

    # API-11 processing: a document mid-pipeline, observed from inside the model call.
    from unittest import mock

    from app import llm
    from app.pipeline.orchestrator import process_document

    karthik = login(client, KARTHIK)
    with mock.patch("app.routers.documents.process_document"):  # queue now, process below
        kid = up("lab_sunrise_feb2026.pdf", karthik, "pat_karthik").json()["document"]["id"]
    seen = {}

    def peek(request, timeout):
        seen["detail"] = detail(kid, karthik, "pat_karthik")
        return fake_model(request, timeout)

    llm.set_transport(peek)
    try:
        process_document(kid)
    finally:
        llm.set_transport(fake_model)
    out["API-11.200.processing.json"] = seen["detail"]

    # API-11 cached: export the golden cache, then read the same file in cache_only mode.
    with Session(get_engine()) as session:
        export(session)
    monkeypatch.setenv("AI_MODE", "cache_only")
    config.get_settings.cache_clear()
    cached = up("lab_sunrise_mar2025.pdf", ravi, "pat_ravi").json()["document"]["id"]
    out["API-11.200.cached.json"] = detail(cached, ravi, "pat_ravi")
    monkeypatch.setenv("AI_MODE", "live")
    config.get_settings.cache_clear()

    brief = client.post(f"{P}/briefs", headers=auth(meera), json={"include_unverified": True}).json()
    out["API-18.201.json"] = brief
    fake_model.narrate = lambda inp: {"status": "answered", "statements": [
        statement("record_fact", "Your HbA1c was 8.4 % on 18 Mar 2025 and 7.6 % on 04 May 2026.", inp,
                  "HbA1c (Glycated haemoglobin)   8.4", "HbA1c (Glycated haemoglobin)   7.6")], "questions_for_doctor": []}
    bid = brief["brief"]["id"]
    out["API-20.200.ready.json"] = client.post(f"{P}/briefs/{bid}/narrative", headers=auth(meera)).json()
    out["API-19.200.json"] = client.get(f"{P}/briefs/latest", headers=auth(meera)).json()

    def ask(q):
        return client.post(f"{P}/ask", headers=auth(meera), json={"question": q}).json()

    fake_model.ask = lambda inp: {"status": "answered", "statements": [
        statement("record_fact", "Your most recent HbA1c was 7.6 % on 04 May 2026.", inp, "HbA1c (Glycated haemoglobin)   7.6")],
        "questions_for_doctor": ["When should I repeat my HbA1c test?"]}
    out["API-21.200.answered.json"] = ask("What was my most recent HbA1c?")
    out["API-21.200.advice-redirect.json"] = ask("Should I stop taking metformin?")
    out["API-21.200.emergency.json"] = ask("I have chest pain")
    fake_model.ask = lambda inp: {"status": "not_found", "statements": [], "questions_for_doctor": []}
    out["API-21.200.not-found.json"] = ask("What is my blood group?")
    fake_model.ask = lambda inp: {"status": "out_of_scope", "statements": [], "questions_for_doctor": []}
    out["API-21.200.out-of-scope.json"] = ask("Write a poem")
    fake_model.ask = lambda inp: {"status": "answered", "statements": [
        statement("record_fact", "Your HbA1c was 9.9 %.", inp, "HbA1c (Glycated haemoglobin)   7.6")], "questions_for_doctor": []}
    out["API-21.200.withheld.json"] = ask("What was my most recent HbA1c?")

    monkeypatch.setenv("AI_MODE", "off")
    config.get_settings.cache_clear()
    out["API-01.200.ai-off.json"] = client.get(f"{API}/health").json()
    out["API-20.200.unavailable.json"] = client.post(f"{P}/briefs/{bid}/narrative", headers=auth(meera)).json()
    out["API-21.200.degraded.json"] = ask("What was my most recent HbA1c?")
    return out


def test_every_p0_fixture_matches_a_real_response(client, fake_model, pdfs, monkeypatch):
    real = build(client, fake_model, pdfs, monkeypatch)
    missing = p0_fixtures() - set(real)
    assert not missing, f"P0 fixtures without a producer: {sorted(missing)}"
    failures = []
    for name in sorted(p0_fixtures()):
        try:
            assert_shape(fixture(name), real[name])
        except AssertionError as exc:
            failures.append(f"{name}: {exc}")
        expected_status = fixture(name).get("status")
        if name.startswith("API-21") and expected_status != real[name].get("status"):
            failures.append(f"{name}: status {real[name].get('status')} != {expected_status}")
        if name.startswith("API-11") and fixture(name)["document"]["status"] != real[name]["document"]["status"]:
            failures.append(f"{name}: document status {real[name]['document']['status']}")
    assert not failures, "\n".join(failures)


def test_shared_error_fixtures(client):
    meera, ravi = login(client, MEERA), login(client, RAVI)
    assert_shape(fixture("errors/ACCESS_DENIED.json"), client.get(P, headers=auth(ravi)).json())
    bad = client.post(f"{P}/ask", headers=auth(meera), json={"question": ""}).json()
    assert_shape(fixture("errors/VALIDATION_ERROR.json"), bad)
    assert bad["error"]["details"]["fields"][0]["field"] == "question"


def test_api_03_and_api_12_shapes(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"]).json()["document"]["id"]
    resp = client.get(f"{P}/documents/{did}/file", headers=auth(meera))
    assert resp.status_code == 200
    assert {"content-type", "content-disposition", "x-content-type-options", "cache-control"} <= set(resp.headers)
    out = client.post(f"{API}/auth/logout", headers=auth(meera))
    assert out.status_code == 204 and out.content == b""
    assert client.post(f"{API}/auth/logout", headers=auth(meera)).json()["error"]["code"] == "SESSION_EXPIRED"


def test_api_13_and_14_return_document_summaries(client, fake_model, pdfs, monkeypatch):
    from app import config

    meera = login(client, MEERA)
    monkeypatch.setenv("AI_MODE", "off")
    config.get_settings.cache_clear()
    did = upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"]).json()["document"]["id"]
    monkeypatch.setenv("AI_MODE", "live")
    config.get_settings.cache_clear()
    summary = fixture("API-08.202.json")
    assert_shape(summary, client.post(f"{P}/documents/{did}/reprocess", headers=auth(meera)).json())
    assert_shape(summary, client.patch(f"{P}/documents/{did}", headers=auth(meera), json={"clinician_name": "Dr. Arun Kumar"}).json())
