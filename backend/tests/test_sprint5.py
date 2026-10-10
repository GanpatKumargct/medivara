"""Sprint 5: golden cache (BE-5.7), sharing (API-23–25), access log (API-26), reminders (API-27–30)."""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlmodel import Session, select

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload
from fake_model import response

DOC5 = "rx_lakeview_sep2026.pdf"
CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
P = f"{API}/patients/pat_meera"


def fixture(name):
    return json.loads((CONTRACTS / name).read_text())


def shape(name, body):
    from test_contract_keys import assert_shape

    assert_shape(fixture(name), body)


def doc_detail(client, token, did, patient="pat_meera"):
    return client.get(f"{API}/patients/{patient}/documents/{did}", headers=auth(token)).json()


def set_ai_mode(monkeypatch, mode):
    from app import config

    monkeypatch.setenv("AI_MODE", mode)
    config.get_settings.cache_clear()


def export_cache():
    from app.db import get_engine
    from app.pipeline.golden_cache import export

    with Session(get_engine()) as session:
        return export(session)


def audit_rows(action):
    from app.db import get_engine
    from app.models import AuditEvent

    with Session(get_engine()) as session:
        return session.exec(select(AuditEvent).where(AuditEvent.action == action)).all()


# --- Golden cache (BE-5.7, FR-040, TC-REL-01) -------------------------------------------


def test_cache_only_mode_uses_the_saved_reading(client, fake_model, pdfs, monkeypatch):
    meera = login(client, MEERA)
    upload(client, meera, DOC5, pdfs[DOC5])
    written = export_cache()
    assert len(written) == 1
    set_ai_mode(monkeypatch, "cache_only")
    fake_model.requests.clear()
    ravi = login(client, RAVI)  # same file for another profile: cache is keyed by content
    did = upload(client, ravi, DOC5, pdfs[DOC5], patient_id="pat_ravi").json()["document"]["id"]
    doc = doc_detail(client, ravi, did, "pat_ravi")
    d = doc["document"]
    assert d["status"] == "needs_review" and d["extraction_source"] == "cache"
    assert "cached_extraction" in d["flags"]
    assert any(x["flag"] == "cached_extraction" and x["text"].startswith("The AI service didn't respond") for x in d["flags_detail"])
    assert len(doc["facts"]) == 9 and {f["confidence"] for f in doc["facts"]} == {"high"}
    assert fake_model.requests == []  # no model call in cache_only mode


def test_live_failure_falls_back_to_cache_and_misses_fail(client, fake_model, pdfs, monkeypatch):
    meera = login(client, MEERA)
    upload(client, meera, DOC5, pdfs[DOC5])
    export_cache()
    fake_model.script = [response("")]  # a blocked response with HTTP 200
    karthik = login(client, KARTHIK)
    did = upload(client, karthik, DOC5, pdfs[DOC5], patient_id="pat_karthik").json()["document"]["id"]
    assert doc_detail(client, karthik, did, "pat_karthik")["document"]["extraction_source"] == "cache"

    set_ai_mode(monkeypatch, "off")
    lab = upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"]).json()["document"]["id"]
    d = doc_detail(client, meera, lab)["document"]
    assert d["status"] == "failed" and d["failure_code"] == "AI_UNAVAILABLE"  # not in the cache


def test_exporter_only_writes_manifest_documents(client, fake_model, pdfs):
    import pymupdf

    meera = login(client, MEERA)
    variant = pymupdf.open(stream=pdfs[DOC5], filetype="pdf")
    variant[0].insert_text((50, 800), "variant")
    upload(client, meera, "not-a-sample.pdf", variant.tobytes())
    assert export_cache() == []
    upload(client, meera, DOC5, pdfs[DOC5])
    [name] = export_cache()
    manifest = json.loads((Path(__file__).resolve().parents[2] / "demo-data" / "manifest.json").read_text())
    assert name == next(s["sha256"] for s in manifest["samples"] if s["filename"] == DOC5) + ".json"


def test_reprocess_with_live_ai_clears_the_cache_label(client, fake_model, pdfs, monkeypatch):
    meera = login(client, MEERA)
    ravi = login(client, RAVI)
    upload(client, meera, DOC5, pdfs[DOC5])
    export_cache()
    set_ai_mode(monkeypatch, "cache_only")
    did = upload(client, ravi, DOC5, pdfs[DOC5], patient_id="pat_ravi").json()["document"]["id"]
    set_ai_mode(monkeypatch, "live")
    client.post(f"{API}/patients/pat_ravi/documents/{did}/reprocess", headers=auth(ravi))
    d = doc_detail(client, ravi, did, "pat_ravi")["document"]
    assert d["extraction_source"] == "live" and "cached_extraction" not in d["flags"]


# --- Sharing (BE-9.1; TC-FAM-01, 03, 05; TC-ACC-04 to 08) -------------------------------


def grant(client, token, email, scopes=("view_records",), **extra):
    body = {"grantee_email": email, "scopes": list(scopes), "consent_confirmed": True, "policy_version": "2026-10-demo-1"}
    return client.post(f"{P}/access", headers=auth(token), json={**body, **extra})


def test_list_grants(client):
    meera = login(client, MEERA)
    body = client.get(f"{P}/access", headers=auth(meera)).json()
    shape("API-23.200.json", body)
    assert [(g["role"], g["grantee"]["display_name"]) for g in body["grants"]] == [
        ("owner", "Meera Raman"), ("caregiver", "Karthik Raman")
    ]
    karthik = client.get(f"{P}/access", headers=auth(login(client, KARTHIK)))
    assert karthik.status_code == 403 and karthik.json()["error"]["code"] == "OWNER_ONLY"
    assert client.get(f"{P}/access", headers=auth(login(client, RAVI))).json()["error"]["code"] == "ACCESS_DENIED"


def test_grant_gives_scoped_access(client):
    meera, ravi = login(client, MEERA), login(client, RAVI)
    assert client.get(P, headers=auth(ravi)).status_code == 403
    resp = grant(client, meera, "Ravi.Demo@medivara.test ")
    assert resp.status_code == 201
    shape("API-24.201.json", resp.json())
    g = resp.json()["grant"]
    assert g["role"] == "caregiver" and g["scopes"] == ["view_records"]
    profiles = {p["id"]: p for p in client.get(f"{API}/patients", headers=auth(ravi)).json()["items"]}
    assert profiles["pat_meera"]["my_role"] == "caregiver"
    # View-only: can read, cannot upload or manage reminders.
    assert client.get(f"{P}/timeline", headers=auth(ravi)).status_code == 200
    assert client.post(f"{P}/briefs", headers=auth(ravi)).status_code == 201
    r = client.post(f"{P}/reminders", headers=auth(ravi), json={"type": "other", "title": "x", "schedule_kind": "once",
                    "schedule": {"date": (date.today() + timedelta(days=3)).isoformat(), "time": "10:00"}})
    assert r.status_code == 403 and r.json()["error"]["details"] == {"required_scope": "manage_reminders"}

    from app.db import get_engine
    from app.models import ConsentRecord, ConsentType

    with Session(get_engine()) as session:
        consent = session.exec(select(ConsentRecord).where(ConsentRecord.consent_type == ConsentType.sharing,
                                                           ConsentRecord.context["grant_id"].as_string() == g["id"])).first()
    assert consent is not None and consent.patient_id == "pat_meera"
    assert audit_rows("access.granted")[-1].meta == {"grantee_user_id": "usr_ravi", "scopes": ["view_records"]}


def test_grant_validation(client):
    meera = login(client, MEERA)
    assert grant(client, meera, "nobody@medivara.test").json()["error"]["code"] == "USER_NOT_FOUND"
    assert grant(client, meera, KARTHIK).json()["error"]["code"] == "GRANT_EXISTS"
    assert grant(client, meera, RAVI, consent_confirmed=False).status_code == 422
    assert grant(client, meera, MEERA).status_code == 422  # self-grant
    assert grant(client, meera, RAVI, scopes=["upload_documents"]).status_code == 422
    assert grant(client, meera, RAVI, policy_version="old").status_code == 422
    assert grant(client, meera, RAVI, scopes=["view_records", "launch_rockets"]).status_code == 422
    assert grant(client, login(client, KARTHIK), RAVI).json()["error"]["code"] == "OWNER_ONLY"


def test_revoke_takes_effect_on_the_next_request(client):
    meera, karthik = login(client, MEERA), login(client, KARTHIK)
    assert client.get(f"{P}/timeline", headers=auth(karthik)).status_code == 200
    assert client.delete(f"{P}/access/grt_karthik_meera", headers=auth(meera)).status_code == 204
    after = client.get(f"{P}/timeline", headers=auth(karthik))
    assert after.status_code == 403 and after.json()["error"]["code"] == "ACCESS_DENIED"
    assert [p["id"] for p in client.get(f"{API}/patients", headers=auth(karthik)).json()["items"]] == ["pat_karthik"]
    assert audit_rows("access.revoked")[-1].meta == {"grantee_user_id": "usr_karthik", "by": "owner"}
    assert client.delete(f"{P}/access/grt_karthik_meera", headers=auth(meera)).status_code == 409
    assert client.delete(f"{P}/access/grt_meera_owner", headers=auth(meera)).status_code == 409
    assert client.delete(f"{P}/access/grt_ravi_owner", headers=auth(meera)).status_code == 404  # another profile's grant


def test_caregiver_can_leave_but_not_remove_others(client):
    meera, ravi = login(client, MEERA), login(client, RAVI)
    ravi_grant = grant(client, meera, RAVI).json()["grant"]["id"]
    karthik = login(client, KARTHIK)
    denied = client.delete(f"{P}/access/{ravi_grant}", headers=auth(karthik))
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "OWNER_ONLY"
    assert client.delete(f"{P}/access/{ravi_grant}", headers=auth(ravi)).status_code == 204
    assert audit_rows("access.revoked")[-1].meta["by"] == "grantee"
    assert client.get(P, headers=auth(ravi)).status_code == 403


# --- Access log (BE-9.2; TC-FAM-04, TC-SEC-06) ------------------------------------------


def test_access_log_labels_without_medical_content(client, fake_model, pdfs):
    meera, karthik = login(client, MEERA), login(client, KARTHIK)
    upload(client, meera, DOC5, pdfs[DOC5])
    grant(client, meera, RAVI)
    client.delete(f"{P}/access/grt_karthik_meera", headers=auth(meera))
    client.get(f"{P}/timeline", headers=auth(karthik))
    body = client.get(f"{P}/audit-events", headers=auth(meera)).json()
    shape("API-26.200.json", body)
    labels = [i["action_label"] for i in body["items"]]
    assert labels[:3] == ["Access denied after revoke", "Revoked Karthik Raman's access", "Shared access with Ravi Menon"]
    assert "Uploaded a document" in labels
    assert body["items"][0]["outcome"] == "denied"
    text = json.dumps(body)
    for phi in ("Metformin", "HbA1c", "Lakeview", "rx_lakeview", "1000 mg"):
        assert phi not in text
    assert client.get(f"{P}/audit-events", headers=auth(login(client, RAVI))).status_code == 403  # caregiver now
    assert client.get(f"{P}/audit-events?limit=2", headers=auth(meera)).json()["limit"] == 2


# --- Reminders (BE-10.1; TC-REM-01 to 03, TC-ACC-10, E2E-07) ----------------------------


def in_days(n):
    return (date.today() + timedelta(days=n)).isoformat()


def create(client, token, patient="pat_meera", **body):
    payload = {"type": "other", "title": "Bring reports", "schedule_kind": "once",
               "schedule": {"date": in_days(17), "time": "10:00"}, "timezone": "Asia/Kolkata", **body}
    return client.post(f"{API}/patients/{patient}/reminders", headers=auth(token), json=payload)


def test_reminder_from_follow_up_clears_the_brief_gap(client, fake_model, pdfs):
    meera = login(client, MEERA)
    did = upload(client, meera, DOC5, pdfs[DOC5]).json()["document"]["id"]
    follow_up = next(f for f in doc_detail(client, meera, did)["facts"] if f["fact_type"] == "follow_up")
    rules = lambda: {f["rule_id"] for f in client.post(f"{P}/briefs", headers=auth(meera)).json()["brief"]["sections"]["missing_information"]}  # noqa: E731
    assert "RULE-FOLLOWUP-NO-APPT" in rules()

    resp = create(client, meera, type="follow_up", title="Review with Dr. Arun Kumar (bring fasting glucose report)",
                  source_fact_id=follow_up["id"])
    assert resp.status_code == 201
    r = resp.json()["reminder"]
    shape("API-27.200.json", {"items": [r], "total": 1, "limit": 50, "offset": 0})
    assert r["next_due_at"].endswith("T04:30:00Z")  # TC-REM-03: 10:00 IST
    day = date.fromisoformat(in_days(17))
    assert r["next_due_local"] == f"{day.day:02d} {day:%b} {day.year}, 10:00 IST"
    assert r["source_fact_id"] == follow_up["id"] and r["schedule"]["times"] is None
    assert "RULE-FOLLOWUP-NO-APPT" not in rules()  # E2E-07: gap gone in a new brief

    done = client.post(f"{P}/reminders/{r['id']}/complete", headers=auth(meera)).json()["reminder"]
    assert done["status"] == "completed" and done["last_completed_at"]
    assert client.get(f"{P}/reminders", headers=auth(meera)).json()["total"] == 0
    assert client.get(f"{P}/reminders?status=completed", headers=auth(meera)).json()["total"] == 1
    assert client.post(f"{P}/reminders/{r['id']}/complete", headers=auth(meera)).status_code == 409
    assert [e.meta for e in audit_rows("reminder.created")] == [{"type": "follow_up", "from_document": True}]


def test_medication_reminders_need_attestation_and_daily_advances(client):
    meera = login(client, MEERA)
    sched = {"times": ["08:00", "20:00"], "start_date": in_days(1)}
    no = create(client, meera, type="medication", title="Metformin", schedule_kind="daily", schedule=sched)
    assert no.status_code == 422 and no.json()["error"]["details"]["fields"][0]["field"] == "medication_schedule_attested"
    yes = create(client, meera, type="medication", title="Metformin", schedule_kind="daily", schedule=sched,
                 medication_schedule_attested=True).json()["reminder"]
    first = datetime.fromisoformat(yes["next_due_at"].replace("Z", "+00:00"))
    assert first.astimezone().utcoffset() is not None and yes["next_due_local"].endswith("08:00 IST")
    done = client.post(f"{P}/reminders/{yes['id']}/complete", headers=auth(meera)).json()["reminder"]
    assert done["status"] == "active" and done["next_due_local"].endswith("20:00 IST")
    again = client.post(f"{P}/reminders/{yes['id']}/complete", headers=auth(meera)).json()["reminder"]
    assert again["next_due_local"].endswith("08:00 IST") and again["next_due_at"] > done["next_due_at"]


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"timezone": "Europe/London"}, "timezone"),
        ({"schedule": {"date": "2020-01-01", "time": "10:00"}}, "schedule.date"),
        ({"schedule": {"date": in_days(3), "time": "25:00"}}, "schedule.time"),
        ({"schedule": {"date": in_days(3)}}, "schedule"),
        ({"schedule_kind": "daily", "schedule": {"times": ["08:00"] * 2, "start_date": in_days(1)}}, "schedule.times"),
        ({"schedule_kind": "daily", "schedule": {"times": ["06:00", "08:00", "12:00", "18:00", "22:00"], "start_date": in_days(1)}}, "schedule.times"),
        ({"schedule_kind": "daily", "schedule": {"times": ["08:00"], "start_date": in_days(5), "end_date": in_days(2)}}, "schedule.end_date"),
        ({"title": "   "}, "title"),
        ({"source_fact_id": "fct_not_here"}, "source_fact_id"),
    ],
)
def test_reminder_validation(client, body, field):
    resp = create(client, login(client, MEERA), **body)
    assert resp.status_code == 422
    assert resp.json()["error"]["details"]["fields"][0]["field"] == field


def test_dismiss_restore_and_access(client):
    meera, karthik, ravi = login(client, MEERA), login(client, KARTHIK), login(client, RAVI)
    rid = create(client, karthik).json()["reminder"]["id"]  # caregiver with manage_reminders
    assert create(client, ravi).status_code == 403
    dismissed = client.patch(f"{P}/reminders/{rid}", headers=auth(meera), json={"status": "dismissed"}).json()["reminder"]
    assert dismissed["status"] == "dismissed"
    assert client.post(f"{P}/reminders/{rid}/complete", headers=auth(meera)).status_code == 409
    restored = client.patch(f"{P}/reminders/{rid}", headers=auth(meera), json={"status": "active", "title": "Bring all reports"})
    assert restored.json()["reminder"]["status"] == "active" and restored.json()["reminder"]["title"] == "Bring all reports"
    other = create(client, ravi, patient="pat_ravi").json()["reminder"]["id"]
    # TC-ACC-10: another patient's reminder under Meera's path is not found.
    assert client.patch(f"{P}/reminders/{other}", headers=auth(meera), json={"title": "x"}).status_code == 404
    stats = client.get(P, headers=auth(meera)).json()["stats"]
    assert stats["upcoming_reminders"] == 1


def test_next_due_schedule_logic():
    from app.reminders import local_label, next_due

    sched = {"times": ["08:00", "20:00"], "start_date": "2026-10-24", "end_date": "2026-10-25"}
    before = datetime(2026, 10, 23, 0, 0, tzinfo=timezone.utc)
    first = next_due("daily", sched, before)
    assert local_label(first) == "24 Oct 2026, 08:00 IST" and first.isoformat() == "2026-10-24T02:30:00+00:00"
    assert local_label(next_due("daily", sched, first, inclusive=False)) == "24 Oct 2026, 20:00 IST"
    last = datetime(2026, 10, 25, 14, 30, tzinfo=timezone.utc)  # 25 Oct 20:00 IST
    assert next_due("daily", sched, last, inclusive=False) is None  # past the end date
    once = next_due("once", {"date": "2026-10-27", "time": "10:00"}, before)
    assert once.isoformat() == "2026-10-27T04:30:00+00:00"
