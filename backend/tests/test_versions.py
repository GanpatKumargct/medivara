"""Document history and versions (DEC-27): API-34 to API-40 and the Alembic start-up path."""

from datetime import timedelta

from sqlmodel import Session, select

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload

P = f"{API}/patients/pat_meera"
LAB_MAR = "lab_sunrise_mar2025.pdf"
LAB_MAY = "lab_sunrise_may2026.pdf"
RX = "rx_lakeview_sep2026.pdf"
SCAN = "scanned_prescription.pdf"


def history(client, token, did):
    return client.get(f"{P}/documents/{did}/history", headers=auth(token)).json()


def facts(client, token, did):
    return client.get(f"{P}/documents/{did}", headers=auth(token)).json()["facts"]


def same_pdf_new_bytes(data: bytes) -> bytes:
    """The same document with different bytes (a re-exported copy): same text, new SHA-256."""
    return data + b"\n% re-exported copy\n"


def test_every_change_is_one_numbered_version(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    assert [v["action"] for v in history(client, meera, did)["versions"]] == ["read", "uploaded"]

    first, second = facts(client, meera, did)[:2]
    client.patch(f"{API}/patients/pat_meera/facts/{first['id']}", headers=auth(meera), json={"action": "confirm"})
    client.patch(f"{API}/patients/pat_meera/facts/{second['id']}", headers=auth(meera),
                 json={"action": "correct", "corrected_fields": {"name": "Corrected name"}})
    client.patch(f"{P}/documents/{did}", headers=auth(meera), json={"facility_name": "Lakeview Clinic (edited)"})
    client.post(f"{P}/documents/{did}/review", headers=auth(meera), json={"action": "confirm_high_confidence"})

    h = history(client, meera, did)
    assert [v["action"] for v in h["versions"]] == [
        "bulk_confirmed", "details_edited", "fact_corrected", "fact_confirmed", "read", "uploaded"]
    assert [v["version_no"] for v in h["versions"]] == [6, 5, 4, 3, 2, 1] and h["latest_version"] == 6
    by_action = {v["action"]: v for v in h["versions"]}
    assert by_action["fact_confirmed"]["summary"][0]["kind"] == "fact_status"
    assert by_action["fact_confirmed"]["actor"] == {"id": "usr_meera", "display_name": "Meera Raman"}
    assert by_action["fact_confirmed"]["by_me"] is True and by_action["read"]["actor"] is None
    corrected = by_action["fact_corrected"]["summary"]
    assert {"kind": "fact_corrected", "field": "name", "to": "Corrected name"}.items() <= corrected[-1].items()
    header = by_action["details_edited"]["summary"][0]
    assert header["kind"] == "header" and header["field"] == "facility_name"
    assert header["to"] == "Lakeview Clinic (edited)" and header["from"] != header["to"]
    # A request that changes nothing saves no version.
    client.post(f"{P}/documents/{did}/review", headers=auth(meera), json={"action": "confirm_high_confidence"})
    assert history(client, meera, did)["latest_version"] == 6


def test_view_and_restore_a_version_without_rewriting_history(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    target = facts(client, meera, did)[0]
    client.patch(f"{API}/patients/pat_meera/facts/{target['id']}", headers=auth(meera),
                 json={"action": "correct", "corrected_fields": {"name": "Wrong"}})
    client.patch(f"{API}/patients/pat_meera/facts/{target['id']}", headers=auth(meera), json={"action": "reject"})

    v2 = client.get(f"{P}/documents/{did}/history/2", headers=auth(meera)).json()
    assert v2["version"]["action"] == "read"
    assert next(f for f in v2["state"]["facts"] if f["id"] == target["id"])["status"] == "unverified"

    restored = client.post(f"{P}/documents/{did}/history/2/restore", headers=auth(meera))
    assert restored.status_code == 200
    after = next(f for f in facts(client, meera, did) if f["id"] == target["id"])
    assert after["status"] == "unverified" and after["fields"]["name"] == target["fields"]["name"]
    h = history(client, meera, did)
    assert [v["action"] for v in h["versions"]][:3] == ["restored", "fact_rejected", "fact_corrected"]
    assert h["versions"][0]["summary"][0] == {"kind": "restored_from", "version": 2}
    assert h["latest_version"] == 5  # 1-4 kept as they were
    assert client.get(f"{P}/documents/{did}/history/9", headers=auth(meera)).status_code == 404


def test_restore_brings_back_facts_replaced_by_reading_again(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    before = {f["id"] for f in facts(client, meera, did)}
    assert client.post(f"{P}/documents/{did}/reprocess", headers=auth(meera)).status_code == 202
    replaced = {f["id"] for f in facts(client, meera, did)}
    assert replaced and not (replaced & before)
    assert history(client, meera, did)["versions"][0]["action"] == "read_again"
    client.post(f"{P}/documents/{did}/history/2/restore", headers=auth(meera))
    assert {f["id"] for f in facts(client, meera, did)} == before


def test_new_file_version_replaces_the_old_one_and_carries_identical_reviews(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    old_facts = facts(client, meera, did)
    client.patch(f"{API}/patients/pat_meera/facts/{old_facts[0]['id']}", headers=auth(meera), json={"action": "confirm"})

    response = client.post(f"{P}/documents/{did}/versions", headers=auth(meera),
                           files={"file": ("rx_v2.pdf", same_pdf_new_bytes(pdfs[RX]), "application/pdf")})
    assert response.status_code == 202
    new = response.json()["document"]
    assert new["file_version"] == 2 and new["series_id"] == did

    listed = client.get(f"{P}/documents", headers=auth(meera)).json()["items"]
    assert [(d["id"], d["is_current"]) for d in listed] == [(new["id"], True)]
    new_facts = facts(client, meera, new["id"])
    statuses = [f["status"] for f in new_facts]
    assert statuses.count("confirmed") == 1 and statuses.count("unverified") == len(new_facts) - 1
    h = history(client, meera, new["id"])
    assert h["versions"][0]["action"] == "new_file_version"
    assert {"kind": "carried_over", "count": 1} in h["versions"][0]["summary"]
    assert [(f["file_version"], f["is_current"]) for f in h["files"]] == [(1, False), (2, True)]

    # The old file is read-only; its exact bytes count as a duplicate of an older version.
    old_edit = client.patch(f"{P}/documents/{did}", headers=auth(meera), json={"facility_name": "X"})
    assert (old_edit.status_code, old_edit.json()["error"]["code"]) == (409, "INVALID_STATE")
    dup = upload(client, meera, RX, pdfs[RX])
    assert dup.status_code == 409 and dup.json()["error"]["details"]["older_version"] is True
    # Restoring version 2 (file 1) makes the old file current again.
    client.post(f"{P}/documents/{did}/history/2/restore", headers=auth(meera))
    assert [d["id"] for d in client.get(f"{P}/documents", headers=auth(meera)).json()["items"]] == [did]


def test_only_the_current_file_reaches_the_timeline(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, LAB_MAR, pdfs[LAB_MAR]).json()["document"]["id"]
    assert "8.4" in client.get(f"{P}/timeline", headers=auth(meera)).text
    client.post(f"{P}/documents/{did}/versions", headers=auth(meera),
                files={"file": ("lab.pdf", pdfs[LAB_MAY], "application/pdf")})
    timeline = client.get(f"{P}/timeline", headers=auth(meera)).text
    assert "7.6" in timeline and "8.4" not in timeline


def test_a_new_file_that_cannot_be_read_leaves_the_old_one_current(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    response = client.post(f"{P}/documents/{did}/versions", headers=auth(meera),
                           files={"file": ("scan.pdf", pdfs[SCAN], "application/pdf")})
    assert response.status_code == 202
    assert [d["id"] for d in client.get(f"{P}/documents", headers=auth(meera)).json()["items"]] == [did]
    top = history(client, meera, did)["versions"][0]
    assert top["action"] == "new_file_failed"
    assert top["summary"][0] == {"kind": "file_failed", "file_version": 2, "failure_code": "NO_TEXT_LAYER"}


def test_changes_since_last_visit_are_per_user(client, fake_model, pdfs):
    meera = login(client, MEERA)
    first = client.get(f"{P}/changes", headers=auth(meera)).json()
    assert first == {"since": None, "items": [], "counts": {"documents": 0, "changes": 0}}  # first visit
    karthik = login(client, KARTHIK)
    # Karthik can't upload for Meera, so Meera uploads in another session, then signs in again.
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    meera_again = login(client, MEERA)
    meera_view = client.get(f"{P}/changes", headers=auth(meera_again)).json()
    assert meera_view["since"] is not None and meera_view["counts"]["documents"] == 1
    [item] = meera_view["items"]
    assert item["document"]["id"] == did and item["document"]["is_new"] is True
    assert [c["action"] for c in item["changes"]] == ["read", "uploaded"]
    assert item["changes"][1]["by_me"] is True
    assert not any(c["this_session"] for c in item["changes"])  # made in an earlier sign-in
    # A change in the current sign-in (and the automatic step it causes) is marked as such.
    client.post(f"{P}/documents/{did}/versions", headers=auth(meera_again),
                files={"file": ("rx2.pdf", pdfs[RX] + b"\n% copy\n", "application/pdf")})
    [item] = client.get(f"{P}/changes", headers=auth(meera_again)).json()["items"]
    assert item["changes"][0]["action"] == "new_file_version" and item["changes"][0]["this_session"] is True
    # Karthik's last visit is his own: he signed in before the upload, so he sees it too.
    karthik_again = login(client, KARTHIK)
    assert client.get(f"{P}/changes", headers=auth(karthik_again)).json()["counts"]["documents"] == 1
    assert client.get(f"{P}/changes", headers=auth(karthik)).json()["counts"]["documents"] == 1
    bad = client.get(f"{P}/changes?since=yesterday", headers=auth(meera_again))
    assert bad.status_code == 422


def test_records_as_of_an_earlier_sign_in(client, fake_model, pdfs):
    from app.db import get_engine
    from app.models import RecordVersion

    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    fid = facts(client, meera, did)[0]["id"]
    client.patch(f"{API}/patients/pat_meera/facts/{fid}", headers=auth(meera), json={"action": "confirm"})
    with Session(get_engine()) as session:
        rows = session.exec(select(RecordVersion).where(RecordVersion.series_id == did)).all()
        for v in rows:  # spread the versions out in time: v1 2h ago, v2 1h ago, v3 now
            v.at = v.at - timedelta(hours=3 - v.version_no) if v.version_no < 3 else v.at
            session.add(v)
        session.commit()
        between = rows[0].at + timedelta(minutes=90)
    then = client.get(f"{P}/records-as-of", params={"at": between.isoformat()}, headers=auth(meera)).json()
    [doc] = then["documents"]
    assert doc["version_no"] == 2 and next(f for f in doc["facts"] if f["id"] == fid)["status"] == "unverified"
    logins = client.get(f"{API}/me/logins", headers=auth(meera)).json()["items"]
    assert logins[0]["current"] is True and len(logins) == 1


def test_access_rules(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    karthik, ravi = login(client, KARTHIK), login(client, RAVI)
    # Caregiver with view_records only: can read history, can't restore or upload versions.
    assert client.get(f"{P}/documents/{did}/history", headers=auth(karthik)).status_code == 200
    restore = client.post(f"{P}/documents/{did}/history/1/restore", headers=auth(karthik))
    assert (restore.status_code, restore.json()["error"]["code"]) == (403, "SCOPE_REQUIRED")
    deleted = client.get(f"{P}/documents/deleted", headers=auth(karthik))
    assert (deleted.status_code, deleted.json()["error"]["code"]) == (403, "OWNER_ONLY")
    # No grant at all.
    for path in (f"/documents/{did}/history", f"/documents/{did}/history/1", "/changes"):
        assert client.get(P + path, headers=auth(ravi)).status_code == 403
    # Another patient's document is not found under this patient.
    ravi_doc = upload(client, ravi, RX, pdfs[RX], patient_id="pat_ravi").json()["document"]["id"]
    assert client.get(f"{P}/documents/{ravi_doc}/history", headers=auth(meera)).status_code == 404


def test_versions_hold_no_data_in_logs(client, fake_model, pdfs, caplog):
    import logging

    caplog.set_level(logging.INFO, logger="medivara")
    meera = login(client, MEERA)
    did = upload(client, meera, RX, pdfs[RX]).json()["document"]["id"]
    client.get(f"{P}/documents/{did}/history/2", headers=auth(meera))
    assert "Metformin" not in caplog.text and "Lakeview" not in caplog.text.replace("rx_lakeview", "")


def test_pre_alembic_database_is_upgraded_and_backfilled(tmp_path, monkeypatch):
    """A database made before Alembic (baseline schema, no alembic_version) keeps its data,
    gets the new columns and a version 1 for each existing document."""
    from alembic import command
    from sqlalchemy import create_engine, text

    from app import config, db

    path = tmp_path / "old.db"
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("DATABASE_PATH", str(path))
    config.get_settings.cache_clear()
    db.reset_engine()
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as conn:
        command.upgrade(db._alembic_config(conn), "0001")
        conn.execute(text("INSERT INTO user (id, email, password_hash, display_name, is_demo, created_at) "
                          "VALUES ('usr_x', 'x@x', 'h', 'X', 1, '2026-01-01 00:00:00')"))
        conn.execute(text("INSERT INTO patient_profile (id, owner_user_id, display_name, is_synthetic, created_at) "
                          "VALUES ('pat_x', 'usr_x', 'X', 1, '2026-01-01 00:00:00')"))
        conn.execute(text(
            "INSERT INTO medical_document (id, patient_id, uploaded_by_user_id, original_filename, mime_type, "
            "size_bytes, sha256, storage_key, page_count, title, document_type, date_ambiguous, status, stage, flags, "
            "flags_detail, header_sources, user_edited_fields, is_sample, extraction_source, discarded_fact_count, "
            "created_at, updated_at) VALUES ('doc_x', 'pat_x', 'usr_x', 'a.pdf', 'application/pdf', 1, 'abc', "
            "'0f', 1, 'Old doc', 'other', 0, 'ready', 'done', '[]', '[]', '{}', '[]', 0, 'none', 0, "
            "'2026-01-01 00:00:00', '2026-01-01 00:00:00')"))
        conn.execute(text("DROP TABLE alembic_version"))
    engine.dispose()

    db.init_db()
    with db.get_engine().connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0006"
        doc = conn.execute(text("SELECT series_id, file_version, is_current FROM medical_document")).one()
        assert tuple(doc) == ("doc_x", 1, 1)
        version = conn.execute(text("SELECT version_no, action, at FROM record_version WHERE series_id='doc_x'")).one()
        assert tuple(version)[:2] == (1, "existing")
        assert str(version[2]).startswith("2026-01-01")  # dated like the document, not "now"
    db.init_db()  # running again changes nothing
    with db.get_engine().connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM record_version")).scalar() == 1
    db.reset_engine()
    config.get_settings.cache_clear()
