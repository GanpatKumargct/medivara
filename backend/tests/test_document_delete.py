"""API-22 delete document (BE-4.6, FR-023, TC-DOC-08)."""

from datetime import date, timedelta

from sqlmodel import Session, select

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload

P = f"{API}/patients/pat_meera"
DOC5 = "rx_lakeview_sep2026.pdf"
DOC4 = "lab_sunrise_may2026.pdf"


def rows(model, **where):
    from app.db import get_engine

    with Session(get_engine()) as session:
        query = select(model)
        for field, value in where.items():
            query = query.where(getattr(model, field) == value)
        return session.exec(query).all()


def test_owner_deletes_file_pages_and_facts_and_the_brief_goes_stale(client, fake_model, pdfs):
    from app import storage
    from app.models import AuditEvent, DocumentPage, ExtractedFact, MedicalDocument

    meera = login(client, MEERA)
    keep = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    did = upload(client, meera, DOC5, pdfs[DOC5]).json()["document"]["id"]
    [doc] = rows(MedicalDocument, id=did)
    assert storage.path_for(doc.storage_key).exists() and rows(ExtractedFact, document_id=did)
    client.post(f"{P}/briefs", headers=auth(meera))
    assert client.get(f"{P}/briefs/latest", headers=auth(meera)).json()["brief"]["stale"] is False

    response = client.delete(f"{P}/documents/{did}", headers=auth(meera))
    assert response.status_code == 204 and response.content == b""

    assert not storage.path_for(doc.storage_key).exists()
    assert rows(MedicalDocument, id=did) == [] and rows(ExtractedFact, document_id=did) == []
    assert rows(DocumentPage, document_id=did) == []
    assert client.get(f"{P}/documents/{did}", headers=auth(meera)).status_code == 404
    listed = [d["id"] for d in client.get(f"{P}/documents", headers=auth(meera)).json()["items"]]
    assert listed == [keep]
    timeline = client.get(f"{P}/timeline", headers=auth(meera)).text
    assert did not in timeline
    assert client.get(f"{P}/briefs/latest", headers=auth(meera)).json()["brief"]["stale"] is True
    [event] = rows(AuditEvent, action="document.deleted")
    assert (event.resource_id, event.patient_id, event.actor_user_id) == (did, "pat_meera", "usr_meera")
    # The same file can be uploaded again afterwards (no duplicate left behind).
    assert upload(client, meera, DOC5, pdfs[DOC5]).status_code == 202


def test_only_the_owner_can_delete(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    caregiver = client.delete(f"{P}/documents/{did}", headers=auth(login(client, KARTHIK)))
    assert (caregiver.status_code, caregiver.json()["error"]["code"]) == (403, "OWNER_ONLY")
    stranger = client.delete(f"{P}/documents/{did}", headers=auth(login(client, RAVI)))
    assert (stranger.status_code, stranger.json()["error"]["code"]) == (403, "ACCESS_DENIED")
    assert client.delete(f"{P}/documents/{did}").status_code == 401
    assert client.get(f"{P}/documents/{did}", headers=auth(meera)).status_code == 200


def test_document_of_another_patient_is_not_found(client, fake_model, pdfs):
    ravi = login(client, RAVI)
    ravi_doc = upload(client, ravi, DOC4, pdfs[DOC4], patient_id="pat_ravi").json()["document"]["id"]
    # Meera owns pat_meera, but the document belongs to pat_ravi.
    response = client.delete(f"{P}/documents/{ravi_doc}", headers=auth(login(client, MEERA)))
    assert (response.status_code, response.json()["error"]["code"]) == (404, "NOT_FOUND")
    assert client.get(f"{API}/patients/pat_ravi/documents/{ravi_doc}", headers=auth(ravi)).status_code == 200
    assert client.delete(f"{P}/documents/doc_missing", headers=auth(login(client, MEERA))).status_code == 404


def test_not_while_processing(client, pdfs):
    from app.db import get_engine
    from app.models import DocumentStatus, MedicalDocument

    meera = login(client, MEERA)
    did = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    with Session(get_engine()) as session:
        doc = session.get(MedicalDocument, did)
        doc.status = DocumentStatus.processing
        session.add(doc)
        session.commit()
    response = client.delete(f"{P}/documents/{did}", headers=auth(meera))
    assert (response.status_code, response.json()["error"]["code"]) == (409, "INVALID_STATE")


def test_reminders_from_the_document_are_kept_but_unlinked(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, DOC5, pdfs[DOC5]).json()["document"]["id"]
    follow_up = next(f for f in client.get(f"{P}/documents/{did}", headers=auth(meera)).json()["facts"]
                     if f["fact_type"] == "follow_up")
    day = (date.today() + timedelta(days=17)).isoformat()
    reminder = client.post(f"{P}/reminders", headers=auth(meera), json={
        "type": "follow_up", "title": "Review visit", "schedule_kind": "once",
        "schedule": {"date": day, "time": "10:00"}, "timezone": "Asia/Kolkata", "source_fact_id": follow_up["id"],
    }).json()["reminder"]

    assert client.delete(f"{P}/documents/{did}", headers=auth(meera)).status_code == 204
    [kept] = client.get(f"{P}/reminders", headers=auth(meera)).json()["items"]
    assert kept["id"] == reminder["id"] and kept["source_fact_id"] is None


def test_missing_file_still_deletes_the_record(client, fake_model, pdfs):
    from app import storage
    from app.models import MedicalDocument

    meera = login(client, MEERA)
    did = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    [doc] = rows(MedicalDocument, id=did)
    storage.path_for(doc.storage_key).unlink()
    assert client.delete(f"{P}/documents/{did}", headers=auth(meera)).status_code == 204
    assert rows(MedicalDocument, id=did) == []
