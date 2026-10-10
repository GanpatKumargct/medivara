"""Sprint 3: injection screening, review actions, reprocess, document patch, timeline, AG-07 rules."""

import json
from pathlib import Path

import pytest
from sqlmodel import Session, select

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload

DOC1, DOC2, DOC3, DOC4, DOC5, DOC6, DOC7 = (
    "lab_sunrise_mar2025.pdf",
    "rx_lakeview_mar2025.pdf",
    "discharge_greenfield_jul2025.pdf",
    "lab_sunrise_may2026.pdf",
    "rx_lakeview_sep2026.pdf",
    "note_lakeview_sep2026.pdf",
    "scanned_prescription.pdf",
)
CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


def doc_id(resp):
    assert resp.status_code == 202, resp.text
    return resp.json()["document"]["id"]


def detail(client, token, did):
    return client.get(f"{API}/patients/pat_meera/documents/{did}", headers=auth(token)).json()


def patch_fact(client, token, fid, **body):
    return client.patch(f"{API}/patients/pat_meera/facts/{fid}", headers=auth(token), json=body)


def bulk(client, token, did):
    return client.post(
        f"{API}/patients/pat_meera/documents/{did}/review", headers=auth(token), json={"action": "confirm_high_confidence"}
    )


def timeline(client, token, **params):
    return client.get(f"{API}/patients/pat_meera/timeline", headers=auth(token), params=params)


@pytest.fixture
def meera(client, fake_model, pdfs):
    """Meera's demo documents DOC-1 to DOC-7, uploaded and processed."""
    token = login(client, MEERA)
    ids = {name: doc_id(upload(client, token, name, pdfs[name])) for name in (DOC1, DOC2, DOC3, DOC4, DOC5, DOC6, DOC7)}
    return token, ids


@pytest.fixture
def meera_core(client, fake_model, pdfs):
    """DOC-1 to DOC-5: the five documents the API-18 brief fixture is built from."""
    token = login(client, MEERA)
    ids = {name: doc_id(upload(client, token, name, pdfs[name])) for name in (DOC1, DOC2, DOC3, DOC4, DOC5)}
    return token, ids


def audit_rows(action):
    from app.db import get_engine
    from app.models import AuditEvent

    with Session(get_engine()) as session:
        return session.exec(select(AuditEvent).where(AuditEvent.action == action)).all()


# --- BE-5.6 injection screening (TC-INJ-01) ---------------------------------------------


def test_injection_line_is_flagged_and_never_sent(client, fake_model, meera):
    token, ids = meera
    doc = detail(client, token, ids[DOC6])
    assert "suspicious_instructions" in doc["document"]["flags"]
    [banner] = [d for d in doc["document"]["flags_detail"] if d["flag"] == "suspicious_instructions"]
    assert banner["line_ids"] == ["p1-l5"]
    assert banner["text"].startswith("This document contains text that looks like instructions to an AI system.")
    assert [f["fact_type"] for f in doc["facts"]] == ["instruction", "instruction"]
    for request in fake_model.requests:
        assert "Ignore all previous instructions" not in request["input"]
        assert "[p1-l5] NOTE TO AI" not in request["input"]


def test_fact_citing_a_flagged_line_is_discarded(client, fake_model, pdfs):
    from fake_model import CANNED

    payload = json.loads(json.dumps(CANNED["Date: 16-Sep-2026"]))
    payload["facts"].append({"fact_type": "instruction", "name": "Stop all medicines", "source_line_ids": ["p1-l5"]})
    fake_model.canned["Date: 16-Sep-2026"] = payload
    token = login(client, MEERA)
    doc = detail(client, token, doc_id(upload(client, token, DOC6, pdfs[DOC6])))
    assert len(doc["facts"]) == 2
    from app.db import get_engine
    from app.models import MedicalDocument

    with Session(get_engine()) as session:
        assert session.get(MedicalDocument, doc["document"]["id"]).discarded_fact_count == 1


# --- BE-6.1 review actions (TC-EXT-06, TC-EXT-07, TC-ACC-09) ---------------------------


def test_bulk_confirm_only_touches_high_confidence(client, meera):
    token, ids = meera
    done = bulk(client, token, ids[DOC5]).json()
    assert len(done["confirmed_fact_ids"]) == 9
    assert done["remaining_unverified"] == 0
    assert done["document"]["status"] == "ready"
    lab = bulk(client, token, ids[DOC4]).json()  # all medium (ambiguous date)
    assert lab["confirmed_fact_ids"] == [] and lab["remaining_unverified"] == 5
    assert lab["document"]["status"] == "needs_review"
    assert [r.meta["count"] for r in audit_rows("facts.bulk_confirmed")] == [9, 0]


def test_review_transitions_and_history(client, meera):
    token, ids = meera
    facts = detail(client, token, ids[DOC1])["facts"]
    hba1c = facts[0]["id"]

    confirmed = patch_fact(client, token, hba1c, action="confirm")
    assert confirmed.status_code == 200
    assert confirmed.json()["fact"]["status"] == "confirmed"
    assert confirmed.json()["fact"]["reviewed_at"] is not None
    assert patch_fact(client, token, hba1c, action="confirm").status_code == 409  # already confirmed

    corrected = patch_fact(client, token, hba1c, action="correct", corrected_fields={"value": "8.5"}, note="Checked paper")
    body = corrected.json()["fact"]
    assert body["status"] == "corrected"
    assert body["fields"]["value"] == "8.5" and body["corrected_fields"] == {"value": "8.5"}
    assert body["display_text"] == "HbA1c (Glycated haemoglobin): 8.5 % (ref 4.0 - 5.6) H"
    assert body["source"]["lines"][0]["text"].startswith("HbA1c (Glycated haemoglobin)   8.4")  # original kept

    assert patch_fact(client, token, hba1c, action="reject").json()["fact"]["status"] == "rejected"
    assert patch_fact(client, token, hba1c, action="undo_reject").json()["fact"]["status"] == "unverified"

    from app.db import get_engine
    from app.models import ExtractedFact

    with Session(get_engine()) as session:
        history = session.get(ExtractedFact, hba1c).history
    assert [h["action"] for h in history] == ["extracted", "confirm", "correct", "reject", "undo_reject"]
    assert history[2]["note"] == "Checked paper"
    assert history[2]["before"]["fields"]["value"] == "8.4"
    assert len(audit_rows("fact.corrected")) == 1
    assert audit_rows("fact.corrected")[0].meta == {"document_id": ids[DOC1], "fact_type": "lab_result", "fields": ["value"]}


def test_review_validation(client, meera):
    token, ids = meera
    fid = detail(client, token, ids[DOC1])["facts"][0]["id"]
    bad_key = patch_fact(client, token, fid, action="correct", corrected_fields={"strength": "5 mg"})
    assert bad_key.status_code == 422
    assert bad_key.json()["error"]["details"]["fields"][0]["field"] == "corrected_fields.strength"
    assert patch_fact(client, token, fid, action="correct", corrected_fields={"value": "  "}).status_code == 422
    assert patch_fact(client, token, fid, action="correct").status_code == 422
    assert patch_fact(client, token, fid, action="explode").status_code == 422


def test_document_becomes_ready_when_all_reviewed(client, meera):
    token, ids = meera
    facts = detail(client, token, ids[DOC1])["facts"]
    statuses = [patch_fact(client, token, f["id"], action="confirm").json()["document"]["status"] for f in facts]
    assert statuses == ["needs_review"] * 3 + ["ready"]


def test_review_access_rules(client, meera):
    token, ids = meera
    fid = detail(client, token, ids[DOC1])["facts"][0]["id"]
    karthik = login(client, KARTHIK)
    denied = client.patch(f"{API}/patients/pat_meera/facts/{fid}", headers=auth(karthik), json={"action": "confirm"})
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "SCOPE_REQUIRED"
    ravi = login(client, RAVI)
    # TC-ACC-09: Meera's fact through Ravi's own path is not found.
    cross = client.patch(f"{API}/patients/pat_ravi/facts/{fid}", headers=auth(ravi), json={"action": "confirm"})
    assert cross.status_code == 404


# --- BE-4.4 document patch and reprocess (FR-020, FR-012 retry) ------------------------


def test_setting_the_date_clears_ambiguity(client, meera):
    token, ids = meera
    resp = client.patch(
        f"{API}/patients/pat_meera/documents/{ids[DOC4]}", headers=auth(token), json={"document_date": "2026-05-04"}
    )
    assert resp.status_code == 200
    d = resp.json()["document"]
    assert d["date_ambiguous"] is False and "date_ambiguous" not in d["flags"]
    full = detail(client, token, ids[DOC4])
    assert full["document"]["flags_detail"] == []
    reasons = {f["fields"]["name"]: f["uncertainty_reasons"] for f in full["facts"]}
    assert reasons["HbA1c (Glycated haemoglobin)"] == []
    assert reasons["Haemoglobin"] == ["missing_reference_range"]
    # Now four facts are high confidence, so bulk confirm picks them up.
    assert len(bulk(client, token, ids[DOC4]).json()["confirmed_fact_ids"]) == 4
    assert audit_rows("document.updated")[0].meta == {"fields": ["document_date"]}


def test_document_patch_validation_and_title(client, meera):
    token, ids = meera
    url = f"{API}/patients/pat_meera/documents/{ids[DOC1]}"
    assert client.patch(url, headers=auth(token), json={}).status_code == 422
    assert client.patch(url, headers=auth(token), json={"document_date": "2099-01-01"}).status_code == 422
    assert client.patch(url, headers=auth(token), json={"facility_name": ""}).status_code == 422
    ok = client.patch(url, headers=auth(token), json={"facility_name": "Sunrise Labs Annex", "document_date": "2025-03-17"})
    assert ok.json()["document"]["title"] == "Lab report · Sunrise Labs Annex · 17 Mar 2025"


def test_reprocess_after_ai_failure(client, fake_model, pdfs, monkeypatch):
    from app import config

    token = login(client, MEERA)
    monkeypatch.setenv("AI_MODE", "off")
    config.get_settings.cache_clear()
    did = doc_id(upload(client, token, DOC1, pdfs[DOC1]))
    assert detail(client, token, did)["document"]["failure_code"] == "AI_UNAVAILABLE"

    monkeypatch.setenv("AI_MODE", "live")
    config.get_settings.cache_clear()
    again = client.post(f"{API}/patients/pat_meera/documents/{did}/reprocess", headers=auth(token))
    assert again.status_code == 202 and again.json()["document"]["status"] == "queued"
    doc = detail(client, token, did)
    assert doc["document"]["status"] == "needs_review" and len(doc["facts"]) == 4
    assert len(audit_rows("document.reprocessed")) == 1


def test_reprocess_blocked_once_reviewed_and_keeps_user_date(client, meera):
    token, ids = meera
    url = f"{API}/patients/pat_meera/documents/{ids[DOC4]}"
    client.patch(url, headers=auth(token), json={"document_date": "2026-04-05"})
    assert client.post(f"{url}/reprocess", headers=auth(token)).status_code == 202
    after = detail(client, token, ids[DOC4])["document"]
    assert after["document_date"] == "2026-04-05" and after["date_ambiguous"] is False  # user's date survives

    fid = detail(client, token, ids[DOC4])["facts"][0]["id"]
    patch_fact(client, token, fid, action="confirm")
    blocked = client.post(f"{url}/reprocess", headers=auth(token))
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "INVALID_STATE"


# --- BE-6.2 timeline (TC-TL-01 to 04) ---------------------------------------------------


def test_timeline_order_and_content(client, meera):
    token, ids = meera
    body = timeline(client, token).json()
    dates = [g["date"] for g in body["groups"]]
    assert dates == sorted(dates, reverse=True)
    assert dates[0] == "2026-09-16" and dates[-1] == "2025-03-18"
    assert body["undated"] == []  # the failed scan (DOC-7) is not a processed document
    sep15 = next(g for g in body["groups"] if g["date"] == "2026-09-15")["events"]
    assert sep15[0]["event_type"] == "document"
    assert sep15[0]["title"] == "Prescription · Lakeview Family Clinic"
    assert sep15[0]["summary"] == "Dr. Arun Kumar · 3 medicines · follow-up advice"
    assert sep15[0]["source"] == {"page": 1, "line_ids": ["p1-l1", "p1-l3"]}
    metformin = sep15[1]
    assert (metformin["title"], metformin["summary"]) == ("Metformin 1000 mg", "1 tablet · twice daily · after meals · 90 days")
    assert metformin["source"] == {"page": 1, "line_ids": ["p1-l8"]} and metformin["document_id"] == ids[DOC5]
    lab = next(g for g in body["groups"] if g["date"] == "2026-05-04")["events"][1]
    assert (lab["title"], lab["summary"]) == ("HbA1c (Glycated haemoglobin) 7.6 %", "Reference 4.0 - 5.6 · marked H on the report")
    assert body["counts"]["documents"] == 6
    asc = timeline(client, token, order="asc").json()
    assert [g["date"] for g in asc["groups"]] == list(reversed(dates))


def test_timeline_filters_rejected_and_unverified(client, meera):
    token, ids = meera
    facts = detail(client, token, ids[DOC1])["facts"]
    patch_fact(client, token, facts[0]["id"], action="reject")
    patch_fact(client, token, facts[1]["id"], action="confirm")
    all_ids = {e["fact_id"] for g in timeline(client, token).json()["groups"] for e in g["events"]}
    assert facts[0]["id"] not in all_ids and facts[1]["id"] in all_ids
    reviewed = timeline(client, token, include_unverified="false").json()
    fact_events = [e for g in reviewed["groups"] for e in g["events"] if e["fact_id"]]
    assert [e["fact_id"] for e in fact_events] == [facts[1]["id"]]
    assert reviewed["counts"]["unverified"] == 0
    meds = timeline(client, token, types="medication").json()
    assert {e["event_type"] for g in meds["groups"] for e in g["events"]} == {"medication"}
    ranged = timeline(client, token, **{"from": "2025-07-01", "to": "2025-12-31"}).json()
    assert [g["date"] for g in ranged["groups"]] == ["2025-07-31"]
    assert timeline(client, token, types="banana").status_code == 422


def test_timeline_follows_date_correction(client, meera):
    token, ids = meera
    client.patch(f"{API}/patients/pat_meera/documents/{ids[DOC4]}", headers=auth(token), json={"document_date": "2026-04-05"})
    dates = [g["date"] for g in timeline(client, token).json()["groups"]]
    assert "2026-04-05" in dates and "2026-05-04" not in dates


def test_timeline_isolation(client, meera):
    ravi = login(client, RAVI)
    assert client.get(f"{API}/patients/pat_meera/timeline", headers=auth(ravi)).status_code == 403
    assert client.get(f"{API}/patients/pat_ravi/timeline", headers=auth(ravi)).json()["groups"] == []


# --- BE-7.1 consistency and gap rules (TC-BRF-02 backend part) ---------------------------


def _findings(client, include_unverified=True):
    from app.db import get_engine
    from app.organise.records import load_records
    from app.organise.rules import run_rules

    with Session(get_engine()) as session:
        return run_rules(load_records(session, "pat_meera", include_unverified))


def test_planted_findings_match_the_brief_fixture(client, meera_core):
    meera = meera_core
    findings = _findings(client)
    by_rule = {f.rule_id: f for f in findings}
    assert set(by_rule) == {"RULE-MED-DOSE-DIFF", "RULE-ALLERGY-CONFLICT", "RULE-FOLLOWUP-NO-APPT", "RULE-LAB-NO-RANGE"}
    brief = json.loads((CONTRACTS / "API-18.201.json").read_text())["brief"]["sections"]
    expected = {f["rule_id"]: f for f in brief["points_to_clarify"] + brief["missing_information"]}
    for rule_id, finding in by_rule.items():
        assert finding.text == expected[rule_id]["text"], rule_id
        assert finding.suggested_question == expected[rule_id]["suggested_question"], rule_id
    dose = by_rule["RULE-MED-DOSE-DIFF"]
    assert [(e.line_ids, e.document_id) for e in dose.evidence] == [
        (["p1-l8"], meera[1][DOC2]),
        (["p1-l10"], meera[1][DOC3]),
        (["p1-l8"], meera[1][DOC5]),
    ]
    # Points to clarify come before missing information.
    assert [f.kind for f in findings] == ["points_to_clarify"] * 2 + ["missing_information"] * 2


def test_clinic_note_after_the_prescription_counts_as_a_later_document(client, meera):
    """Rule as written: DOC-6 (16 Sep 2026) is later than DOC-5's follow-up advice (15 Sep 2026),
    so the follow-up gap is not reported once DOC-6 is processed. The demo starting state includes
    DOC-6, which conflicts with the planted finding; see the Sprint 3 checklist (open decision)."""
    rules = {f.rule_id for f in _findings(client)}
    assert "RULE-FOLLOWUP-NO-APPT" not in rules
    assert {"RULE-MED-DOSE-DIFF", "RULE-ALLERGY-CONFLICT", "RULE-LAB-NO-RANGE"} <= rules


def test_no_false_frequency_finding_for_at_night(client, meera):
    from app.organise.rules import norm_frequency

    assert norm_frequency("at night") == norm_frequency("once daily") == norm_frequency("OD")
    assert all(f.rule_id != "RULE-MED-FREQ-DIFF" for f in _findings(client))


def test_gap_rules_on_small_records(client, fake_model, pdfs):
    from fake_model import CANNED

    token = login(client, MEERA)
    doc_id(upload(client, token, DOC1, pdfs[DOC1]))
    rules = [f.rule_id for f in _findings(client)]
    assert rules == ["RULE-ALLERGY-MISSING"]  # DOC-1 alone: no allergy facts, all labs have ranges

    undated = json.loads(json.dumps(CANNED["Date: 21-Mar-2025"]))
    undated["document"]["document_date_text"] = None
    fake_model.canned["Date: 21-Mar-2025"] = undated
    doc_id(upload(client, token, DOC2, pdfs[DOC2]))
    findings = {f.rule_id: f for f in _findings(client)}
    assert findings["RULE-DOC-UNDATED"].text == "Prescription · Lakeview Family Clinic · Undated has no date we could read."
    assert "RULE-ALLERGY-MISSING" not in findings


def test_follow_up_cleared_by_a_later_document(client, meera_core, pdfs):
    from fake_model import CANNED

    # A document dated after DOC-5's follow-up advice counts as a later visit.
    token = meera_core[0]
    assert any(f.rule_id == "RULE-FOLLOWUP-NO-APPT" for f in _findings(client))
    later = json.loads(json.dumps(CANNED["Sample collected: 18-Mar-2025"]))
    later["document"]["document_date_text"] = "01-Oct-2026"
    import pymupdf

    pdf = pymupdf.open(stream=pdfs[DOC1], filetype="pdf")
    pdf[0].insert_text((50, 790), "Sample collected: 01-Oct-2026")
    from app import llm
    from fake_model import FakeModel

    llm.set_transport(FakeModel(extra={"Sample collected: 01-Oct-2026": later}))
    doc_id(upload(client, token, "later.pdf", pdf.tobytes()))
    assert all(f.rule_id != "RULE-FOLLOWUP-NO-APPT" for f in _findings(client))


# --- Contract keys for API-15, 16, 17 ---------------------------------------------------


def test_contract_shapes(client, meera):
    from test_contract_keys import assert_shape, fixture

    token, ids = meera
    fid = detail(client, token, ids[DOC4])["facts"][0]["id"]
    assert_shape(fixture("API-15.200.json"), patch_fact(client, token, fid, action="confirm").json())
    assert_shape(fixture("API-16.200.json"), bulk(client, token, ids[DOC5]).json())
    assert_shape(fixture("API-17.200.json"), timeline(client, token).json())
