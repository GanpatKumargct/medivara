"""BE-15.3 regression tests for the Sprint 6 code-review findings (one test per finding)."""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlmodel import Session

from app.answer import gate
from app.answer.validator import check_statement, validate
from conftest import API, MEERA, auth, login, upload
from test_validator_gate import CTX, MEDICINES

P = f"{API}/patients/pat_meera"


def reason(kind, text, keys):
    return check_statement({"kind": kind, "text": text, "evidence_keys": keys}, "answered", CTX, MEDICINES)[0]


# 1. Imperative medicine advice (high)
@pytest.mark.parametrize("text", [
    "Stop Metformin now.",
    "Skip Metformin 1000 mg tomorrow.",
    "It is best to stop Metformin.",
    "Consider stopping Metformin.",
    "Taking Metformin is no longer needed.",
    "Double your Metformin.",
])
def test_imperative_advice_is_rejected(text):
    assert reason("record_fact", text, ["L002"]) == "prescriptive"


@pytest.mark.parametrize("text", [
    "Your prescription says to take Metformin 1000 mg twice daily after meals.",
    "Metformin 1000 mg is listed with 1 tablet twice daily.",
])
def test_quoting_the_prescription_still_passes(text):
    assert reason("record_fact", text, ["L002"]) is None


# 2. Emergency phrasings (medium)
@pytest.mark.parametrize("text", [
    "I think I'm having a heart attack",
    "I want to die",
    "My dad is not breathing",
    "My chest hurts badly",
    "I took double my metformin dose by mistake",
])
def test_more_emergency_phrasings(text):
    assert gate.classify(text, MEDICINES).route == "emergency"


# 3. questions_for_doctor (medium)
def test_unsafe_or_ungrounded_questions_are_dropped():
    good = {"kind": "record_fact", "text": "Your HbA1c was 7.6 %.", "evidence_keys": ["L001"]}
    out = validate({"status": "answered", "statements": [good], "questions_for_doctor": [
        "Should I take 1000 mg of Insulin instead?", "Is my Metformin dose too high?", "What does my HbA1c mean for my care?"]},
        CTX, MEDICINES, "answer")
    assert out.questions == ["What does my HbA1c mean for my care?"]


# 4. Explanations naming the patient's medicines (medium)
def test_explanation_cannot_name_patient_medicines_even_when_cited():
    assert reason("explanation", "Metformin is a medicine that lowers blood sugar.", ["L002"]) is not None


# 5. Correcting a fact's date (medium)
def test_corrected_event_date_moves_the_fact(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"]).json()["document"]["id"]
    fid = client.get(f"{P}/documents/{did}", headers=auth(meera)).json()["facts"][0]["id"]
    body = client.patch(f"{P}/facts/{fid}", headers=auth(meera), json={
        "action": "correct", "corrected_fields": {"event_date_text": "20-Mar-2025"}}).json()["fact"]
    assert body["event_date"] == "2025-03-20"
    events = [e for g in client.get(f"{P}/timeline", headers=auth(meera)).json()["groups"] for e in g["events"]]
    assert next(e for e in events if e["fact_id"] == fid)["date"] == "2025-03-20"


# 6. Corrected medicine names (low)
def test_patient_medicines_use_corrected_names(client, fake_model, pdfs):
    from app.answer.service import patient_medicines
    from app.db import get_engine

    meera = login(client, MEERA)
    did = upload(client, meera, "rx_lakeview_mar2025.pdf", pdfs["rx_lakeview_mar2025.pdf"]).json()["document"]["id"]
    fid = next(f for f in client.get(f"{P}/documents/{did}", headers=auth(meera)).json()["facts"] if f["fact_type"] == "medication")["id"]
    client.patch(f"{P}/facts/{fid}", headers=auth(meera), json={"action": "correct", "corrected_fields": {"name": "Metformin XR"}})
    with Session(get_engine()) as session:
        assert "Metformin XR" in patient_medicines(session, "pat_meera")


# 7. "Today" is the IST date (low)
def test_today_is_ist_not_server_local():
    from app.reminders import today_local

    late_utc = datetime(2026, 10, 9, 20, 0, tzinfo=timezone.utc)  # 10 Oct 2026, 01:30 IST
    assert today_local(late_utc) == date(2026, 10, 10)


def test_document_patch_uses_the_ist_date(client, fake_model, pdfs, monkeypatch):
    from app.routers import documents

    meera = login(client, MEERA)
    did = upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"]).json()["document"]["id"]
    url = f"{P}/documents/{did}"
    monkeypatch.setattr(documents, "today_ist", lambda: date(2026, 5, 3))
    assert client.patch(url, headers=auth(meera), json={"document_date": "2026-05-04"}).status_code == 422
    monkeypatch.setattr(documents, "today_ist", lambda: date(2026, 5, 4))  # IST already 04 May
    assert client.patch(url, headers=auth(meera), json={"document_date": "2026-05-04"}).status_code == 200


# 8. Reprocess with reminders pointing at its facts (low)
def test_reprocess_blocked_when_a_reminder_uses_its_facts(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, "rx_lakeview_sep2026.pdf", pdfs["rx_lakeview_sep2026.pdf"]).json()["document"]["id"]
    follow = next(f for f in client.get(f"{P}/documents/{did}", headers=auth(meera)).json()["facts"] if f["fact_type"] == "follow_up")
    client.post(f"{P}/reminders", headers=auth(meera), json={"type": "follow_up", "title": "Review", "schedule_kind": "once",
                "schedule": {"date": (date.today() + timedelta(days=9)).isoformat(), "time": "10:00"}, "source_fact_id": follow["id"]})
    resp = client.post(f"{P}/documents/{did}/reprocess", headers=auth(meera))
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "INVALID_STATE"


# 9. Oversized uploads are refused before the body is read (low)
def test_oversized_request_rejected_by_content_length(client):
    meera = login(client, MEERA)
    resp = client.post(f"{P}/documents", headers={**auth(meera), "content-length": str(50 * 1024 * 1024),
                       "content-type": "multipart/form-data; boundary=x"}, content=b"--x--")
    assert resp.status_code == 413 and resp.json()["error"]["code"] == "FILE_TOO_LARGE"


# 10. Withdrawn AI consent stops Ask and the narrative sending records to Gemini (low)
def test_withdrawn_consent_means_no_model_call(client, fake_model, pdfs):
    meera = login(client, MEERA)
    upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"])
    brief = client.post(f"{P}/briefs", headers=auth(meera)).json()["brief"]["id"]
    client.post(f"{API}/me/consents", headers=auth(meera), json={"consent_type": "ai_processing", "granted": False,
                "policy_version": "2026-10-demo-1"})
    before = len(fake_model.requests)
    ans = client.post(f"{P}/ask", headers=auth(meera), json={"question": "What was my HbA1c?"}).json()
    assert ans["status"] == "degraded" and ans["evidence"] and ans["notices"][0]["code"] == "consent_required"
    nar = client.post(f"{P}/briefs/{brief}/narrative", headers=auth(meera)).json()["narrative"]
    assert nar["status"] == "unavailable" and nar["notices"][0]["code"] == "consent_required"
    assert client.post(f"{P}/ask", headers=auth(meera), json={"question": "I have chest pain"}).json()["status"] == "emergency"
    assert len(fake_model.requests) == before
