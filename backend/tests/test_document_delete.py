"""API-22 delete document (BE-4.6, FR-023, TC-DOC-08; DEC-27: Recently deleted, then permanent)."""

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


def test_delete_hides_at_once_and_permanent_delete_removes_everything(client, fake_model, pdfs):
    from app import storage
    from app.models import AuditEvent, DocumentPage, ExtractedFact, MedicalDocument, RecordVersion

    meera = login(client, MEERA)
    keep = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    did = upload(client, meera, DOC5, pdfs[DOC5]).json()["document"]["id"]
    [doc] = rows(MedicalDocument, id=did)
    client.post(f"{P}/briefs", headers=auth(meera))
    assert client.get(f"{P}/briefs/latest", headers=auth(meera)).json()["brief"]["stale"] is False

    # Default: Recently deleted. Gone from Records, the timeline and briefs at once; data kept.
    response = client.delete(f"{P}/documents/{did}", headers=auth(meera))
    assert response.status_code == 204 and response.content == b""
    listed = [d["id"] for d in client.get(f"{P}/documents", headers=auth(meera)).json()["items"]]
    assert listed == [keep]
    assert did not in client.get(f"{P}/timeline", headers=auth(meera)).text
    assert client.get(f"{P}/briefs/latest", headers=auth(meera)).json()["brief"]["stale"] is True
    assert storage.path_for(doc.storage_key).exists() and rows(ExtractedFact, document_id=did)
    deleted = client.get(f"{P}/documents/deleted", headers=auth(meera)).json()
    assert [d["id"] for d in deleted["items"]] == [did] and deleted["retention_days"] == 30
    assert deleted["items"][0]["deleted_by"]["id"] == "usr_meera"

    # Permanent: file, pages, facts and history removed (TC-DOC-08).
    assert client.delete(f"{P}/documents/{did}?permanent=true", headers=auth(meera)).status_code == 204
    assert not storage.path_for(doc.storage_key).exists()
    assert rows(MedicalDocument, id=did) == [] and rows(ExtractedFact, document_id=did) == []
    assert rows(DocumentPage, document_id=did) == [] and rows(RecordVersion, series_id=did) == []
    assert client.get(f"{P}/documents/{did}", headers=auth(meera)).status_code == 404
    assert client.get(f"{P}/documents/deleted", headers=auth(meera)).json()["items"] == []
    assert [e.action for e in rows(AuditEvent, resource_id=did) if e.action.startswith("document.")][-2:] == [
        "document.deleted", "document.purged"]
    # The same file can be uploaded again afterwards (nothing left behind).
    assert upload(client, meera, DOC5, pdfs[DOC5]).status_code == 202


def test_undelete_brings_the_document_back(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    client.delete(f"{P}/documents/{did}", headers=auth(meera))
    again = upload(client, meera, DOC4, pdfs[DOC4])
    assert again.status_code == 409 and again.json()["error"]["details"] == {"existing_document_id": did, "deleted": True}
    edit = client.patch(f"{P}/documents/{did}", headers=auth(meera), json={"facility_name": "X"})
    assert (edit.status_code, edit.json()["error"]["code"]) == (409, "INVALID_STATE")
    restored = client.post(f"{P}/documents/{did}/undelete", headers=auth(meera))
    assert restored.status_code == 200 and restored.json()["document"]["deleted_at"] is None
    assert [d["id"] for d in client.get(f"{P}/documents", headers=auth(meera)).json()["items"]] == [did]
    assert client.post(f"{P}/documents/{did}/undelete", headers=auth(meera)).status_code == 409


def test_recently_deleted_is_purged_after_30_days(client, fake_model, pdfs):
    from datetime import timedelta

    from app.db import get_engine
    from app.models import MedicalDocument, utcnow

    meera = login(client, MEERA)
    did = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    client.delete(f"{P}/documents/{did}", headers=auth(meera))
    with Session(get_engine()) as session:
        doc = session.get(MedicalDocument, did)
        doc.deleted_at = utcnow() - timedelta(days=31)
        session.add(doc)
        session.commit()
    assert client.get(f"{P}/documents/deleted", headers=auth(meera)).json()["items"] == []
    assert rows(MedicalDocument, id=did) == []


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


def test_reminders_are_unlinked_only_when_the_document_is_removed_for_good(client, fake_model, pdfs):
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
    assert kept["source_fact_id"] == follow_up["id"]  # still recoverable
    assert client.delete(f"{P}/documents/{did}?permanent=true", headers=auth(meera)).status_code == 204
    [kept] = client.get(f"{P}/reminders", headers=auth(meera)).json()["items"]
    assert kept["id"] == reminder["id"] and kept["source_fact_id"] is None


def test_missing_file_still_deletes_the_record(client, fake_model, pdfs):
    from app import storage
    from app.models import MedicalDocument

    meera = login(client, MEERA)
    did = upload(client, meera, DOC4, pdfs[DOC4]).json()["document"]["id"]
    [doc] = rows(MedicalDocument, id=did)
    storage.path_for(doc.storage_key).unlink()
    assert client.delete(f"{P}/documents/{did}?permanent=true", headers=auth(meera)).status_code == 204
    assert rows(MedicalDocument, id=did) == []
