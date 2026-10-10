"""Sprint 2: upload, processing, documents API, file stream (TC-DOC, TC-EXT, TC-SEC, TC-ACC-02/03)."""

import io

import pymupdf
from sqlmodel import Session, select

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload
from fake_model import response

DOC1, DOC2, DOC4, DOC5, DOC7 = (
    "lab_sunrise_mar2025.pdf",
    "rx_lakeview_mar2025.pdf",
    "lab_sunrise_may2026.pdf",
    "rx_lakeview_sep2026.pdf",
    "scanned_prescription.pdf",
)


def detail(client, token, doc_id, patient_id="pat_meera"):
    return client.get(f"{API}/patients/{patient_id}/documents/{doc_id}", headers=auth(token))


def uploaded_id(resp) -> str:
    assert resp.status_code == 202, resp.text
    return resp.json()["document"]["id"]


# TC-DOC-01, E2E-01 (backend part)
def test_upload_returns_queued_then_reaches_needs_review(client, fake_model, pdfs):
    token = login(client, MEERA)
    resp = upload(client, token, DOC1, pdfs[DOC1])
    body = resp.json()["document"]
    assert body["status"] == "queued" and body["stage"] == "queued"
    assert body["title"] == f"Uploaded document · {DOC1}"
    assert body["extraction_source"] == "none"
    # TestClient runs background tasks before returning, so processing has finished.
    doc = detail(client, token, body["id"]).json()
    assert doc["document"]["status"] == "needs_review"
    assert doc["document"]["stage"] == "done"
    assert doc["document"]["title"] == "Lab report · Sunrise Diagnostics · 18 Mar 2025"
    assert doc["document"]["document_date"] == "2025-03-18"
    assert len(doc["facts"]) == 4
    assert all(f["confidence"] == "high" and f["status"] == "unverified" for f in doc["facts"])
    first = doc["facts"][0]
    assert first["source"] == {
        "page": 1,
        "line_ids": ["p1-l6"],
        "lines": [{"line_id": "p1-l6", "text": "HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H"}],
    }
    assert first["display_text"] == "HbA1c (Glycated haemoglobin): 8.4 % (ref 4.0 - 5.6) H"
    assert doc["document"]["header_sources"]["document_date"]["line_ids"] == ["p1-l3"]
    assert fake_model.requests[0]["no_retention"] is True


# TC-EXT-03, TC-EXT-04
def test_ambiguous_date_and_missing_range_are_flagged(client, fake_model, pdfs):
    token = login(client, MEERA)
    doc = detail(client, token, uploaded_id(upload(client, token, DOC4, pdfs[DOC4]))).json()
    d = doc["document"]
    assert d["document_date"] == "2026-05-04" and d["date_ambiguous"] is True
    assert "date_ambiguous" in d["flags"]
    assert d["flags_detail"] == [
        {"flag": "date_ambiguous", "text": "The date 04/05/2026 was read as 04 May 2026 (day first). Please check it."}
    ]
    facts = {f["fields"]["name"]: f for f in doc["facts"]}
    assert facts["HbA1c (Glycated haemoglobin)"]["confidence"] == "medium"
    assert facts["HbA1c (Glycated haemoglobin)"]["uncertainty_reasons"] == ["date_ambiguous"]
    assert facts["Haemoglobin"]["uncertainty_reasons"] == ["missing_reference_range", "date_ambiguous"]
    assert facts["Haemoglobin"]["display_text"] == "Haemoglobin: 12.1 g/dL"
    assert d["fact_counts"] == {"total": 5, "unverified": 5, "low_confidence": 0}


def test_prescription_facts_are_high_confidence(client, fake_model, pdfs):
    token = login(client, MEERA)
    doc = detail(client, token, uploaded_id(upload(client, token, DOC5, pdfs[DOC5]))).json()
    assert len(doc["facts"]) == 9
    assert {f["confidence"] for f in doc["facts"]} == {"high"}
    assert [f["fact_type"] for f in doc["facts"]][:3] == ["medication"] * 3
    metformin = doc["facts"][0]
    assert metformin["fields"] == {
        "name": "Metformin", "strength": "1000 mg", "dose": "1 tablet", "frequency": "twice daily",
        "route": None, "duration": "90 days", "timing": "after meals", "event_date_text": None,
    }
    assert doc["document"]["clinician_name"] == "Dr. Arun Kumar"


# TC-DOC-06
def test_scanned_pdf_fails_with_no_text_layer(client, fake_model, pdfs):
    token = login(client, MEERA)
    d = detail(client, token, uploaded_id(upload(client, token, DOC7, pdfs[DOC7]))).json()["document"]
    assert (d["status"], d["stage"], d["failure_code"]) == ("failed", "no_text_layer", "NO_TEXT_LAYER")
    assert d["failure_message"].startswith("This looks like a scanned image.")
    assert fake_model.requests == []  # never sent to the model


# TC-DOC-05
def test_duplicate_upload_is_rejected(client, fake_model, pdfs):
    token = login(client, MEERA)
    first = uploaded_id(upload(client, token, DOC1, pdfs[DOC1]))
    again = upload(client, token, "renamed.pdf", pdfs[DOC1])
    assert again.status_code == 409
    error = again.json()["error"]
    assert error["code"] == "DUPLICATE_DOCUMENT"
    assert error["details"] == {"existing_document_id": first}
    assert error["message"] == "This file is already in Meera Raman's records."


# TC-DOC-02, 03, 04
def test_upload_limits(client, fake_model, pdfs):
    token = login(client, MEERA)
    big = pdfs[DOC1] + b"0" * (10 * 1024 * 1024)
    assert upload(client, token, "big.pdf", big).json()["error"]["code"] == "FILE_TOO_LARGE"
    disguised = upload(client, token, "notes.pdf", b"just some text, not a pdf")
    assert disguised.status_code == 415 and disguised.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
    many = pymupdf.open()
    for _ in range(11):
        many.new_page().insert_text((50, 50), "SYNTHETIC")
    resp = upload(client, token, "long.pdf", many.tobytes())
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "TOO_MANY_PAGES"
    assert client.get(f"{API}/patients/pat_meera/documents", headers=auth(token)).json()["total"] == 0


# TC-SEC-03
def test_corrupt_and_encrypted_pdfs_fail_safely(client, fake_model, pdfs):
    token = login(client, MEERA)
    corrupt = detail(client, token, uploaded_id(upload(client, token, "bad.pdf", b"%PDF-1.7\n" + b"x" * 500))).json()
    assert corrupt["document"]["failure_code"] == "UNREADABLE_PDF"

    locked = pymupdf.open(stream=pdfs[DOC1], filetype="pdf")
    out = io.BytesIO()
    locked.save(out, encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="secret", owner_pw="owner")
    resp = upload(client, token, "locked.pdf", out.getvalue())
    assert detail(client, token, uploaded_id(resp)).json()["document"]["failure_code"] == "UNREADABLE_PDF"
    assert client.get(f"{API}/health").status_code == 200


# TC-SEC-01, TC-SEC-02
def test_file_stream_headers_and_sanitised_name(client, fake_model, pdfs):
    from app.db import get_engine
    from app.models import AuditEvent, MedicalDocument

    token = login(client, MEERA)
    doc_id = uploaded_id(upload(client, token, "../../evil.pdf", pdfs[DOC1]))
    resp = client.get(f"{API}/patients/pat_meera/documents/{doc_id}/file", headers=auth(token))
    assert resp.status_code == 200
    assert resp.content == pdfs[DOC1]
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["cache-control"] == "no-store"
    assert resp.headers["content-disposition"] == 'inline; filename="evil.pdf"'
    with Session(get_engine()) as session:
        doc = session.get(MedicalDocument, doc_id)
        assert doc.original_filename == "evil.pdf"
        assert "evil" not in doc.storage_key and len(doc.storage_key) == 32
        viewed = session.exec(select(AuditEvent).where(AuditEvent.action == "document.file_viewed")).all()
        assert len(viewed) == 1


# TC-ACC-02, TC-ACC-03 and scope / consent checks
def test_document_access_rules(client, fake_model, pdfs):
    meera = login(client, MEERA)
    doc_id = uploaded_id(upload(client, meera, DOC1, pdfs[DOC1]))
    ravi = login(client, RAVI)
    assert detail(client, ravi, doc_id, patient_id="pat_ravi").status_code == 404
    assert client.get(f"{API}/patients/pat_ravi/documents/{doc_id}/file", headers=auth(ravi)).status_code == 404
    assert client.get(f"{API}/patients/pat_meera/documents/{doc_id}/file", headers=auth(ravi)).status_code == 403

    karthik = login(client, KARTHIK)
    assert detail(client, karthik, doc_id).status_code == 200  # caregiver can read
    denied = upload(client, karthik, DOC2, pdfs[DOC2])
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "SCOPE_REQUIRED"


def test_upload_requires_owner_ai_consent(client, fake_model, pdfs):
    token = login(client, MEERA)
    client.post(
        f"{API}/me/consents",
        headers=auth(token),
        json={"consent_type": "ai_processing", "granted": False, "policy_version": "2026-10-demo-1"},
    )
    resp = upload(client, token, DOC1, pdfs[DOC1])
    assert resp.status_code == 403
    assert resp.json()["error"] == {**resp.json()["error"], "code": "CONSENT_REQUIRED", "details": {"consent_type": "ai_processing"}}


def test_document_list_sort_filters_and_stats(client, fake_model, pdfs):
    token = login(client, MEERA)
    for name in (DOC1, DOC4, DOC7):
        uploaded_id(upload(client, token, name, pdfs[name]))
    listing = client.get(f"{API}/patients/pat_meera/documents", headers=auth(token)).json()
    # Newest document date first; the undated scan last.
    assert [d["document_date"] for d in listing["items"]] == ["2026-05-04", "2025-03-18", None]
    failed = client.get(f"{API}/patients/pat_meera/documents?status=failed", headers=auth(token)).json()
    assert [d["failure_code"] for d in failed["items"]] == ["NO_TEXT_LAYER"]
    labs = client.get(f"{API}/patients/pat_meera/documents?document_type=lab_report,prescription", headers=auth(token))
    assert labs.json()["total"] == 2
    bad = client.get(f"{API}/patients/pat_meera/documents?status=weird", headers=auth(token))
    assert bad.status_code == 422
    stats = client.get(f"{API}/patients/pat_meera", headers=auth(token)).json()["stats"]
    assert stats["documents_total"] == 3 and stats["documents_needs_review"] == 2 and stats["documents_failed"] == 1


# TC-DOC-07 (failure part) and AI failure mapping
def test_ai_off_fails_with_retryable_message(client, pdfs, monkeypatch):
    from app import config

    monkeypatch.setenv("AI_MODE", "off")
    config.get_settings.cache_clear()
    token = login(client, MEERA)
    d = detail(client, token, uploaded_id(upload(client, token, DOC1, pdfs[DOC1]))).json()["document"]
    assert d["status"] == "failed" and d["failure_code"] == "AI_UNAVAILABLE"
    assert d["failure_message"].startswith("MediVara couldn't read this document right now")


def test_model_failures_map_to_failure_codes(client, fake_model, pdfs):
    token = login(client, MEERA)
    cases = [
        ([response("", status="completed")], "AI_BLOCKED", 1),
        ([response("not json"), response("still not json")], "AI_INVALID_OUTPUT", 2),
        ([TimeoutError(), TimeoutError()], "AI_TIMEOUT", 2),
    ]
    for i, (script, code, calls) in enumerate(cases):
        fake_model.requests.clear()
        fake_model.script = list(script)
        pdf = pymupdf.open(stream=pdfs[DOC1], filetype="pdf")
        pdf[0].insert_text((50, 800), f"variant {i}")  # different hash, so not a duplicate
        d = detail(client, token, uploaded_id(upload(client, token, f"v{i}.pdf", pdf.tobytes()))).json()["document"]
        assert d["failure_code"] == code, (code, d)
        assert len(fake_model.requests) == calls
    assert client.get(f"{API}/health").json()["ai"]["available"] is False


def test_retry_after_one_invalid_response_succeeds(client, fake_model, pdfs):
    from fake_model import CANNED

    fake_model.script = [response("not json"), response(CANNED["Sample collected: 18-Mar-2025"])]
    token = login(client, MEERA)
    d = detail(client, token, uploaded_id(upload(client, token, DOC1, pdfs[DOC1]))).json()
    assert d["document"]["status"] == "needs_review" and len(d["facts"]) == 4


def test_logs_have_no_document_text(client, fake_model, pdfs, caplog):
    import logging

    caplog.set_level(logging.INFO, logger="medivara")
    logging.getLogger("medivara").propagate = True
    try:
        token = login(client, MEERA)
        doc_id = uploaded_id(upload(client, token, DOC1, pdfs[DOC1]))
        detail(client, token, doc_id)
    finally:
        logging.getLogger("medivara").propagate = False
    # What would actually be written: each record through the allow-list formatter.
    from app.middleware import JsonAllowListFormatter

    text = "\n".join(JsonAllowListFormatter().format(r) for r in caplog.records)
    for secret in ("Meera", "HbA1c", "8.4", "Sunrise", "lab_sunrise"):
        assert secret not in text, secret
    assert any(r.getMessage() == "model_call" for r in caplog.records)
