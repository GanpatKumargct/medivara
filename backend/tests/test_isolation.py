"""BE-3.5 isolation and IDOR suite, plus the permission matrix from the test plan §3.

Rows are endpoints called on pat_meera. Karthik holds the caregiver grant (view_records,
manage_reminders); Ravi has no grant on pat_meera. Every denial must be audited.
"""

from datetime import date, timedelta

import pytest
from sqlmodel import Session, select

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload

P = f"{API}/patients/pat_meera"
POLICY = "2026-10-demo-1"


def _reminder_body():
    return {"type": "other", "title": "Bring reports", "schedule_kind": "once",
            "schedule": {"date": (date.today() + timedelta(days=5)).isoformat(), "time": "10:00"}}


@pytest.fixture
def world(client, fake_model, pdfs):
    """Meera: DOC-1 processed, a brief and a reminder. Ravi: RDOC-1, a brief and a reminder."""
    meera, ravi = login(client, MEERA), login(client, RAVI)
    m_doc = upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"]).json()["document"]["id"]
    m_fact = client.get(f"{P}/documents/{m_doc}", headers=auth(meera)).json()["facts"][0]["id"]
    m_brief = client.post(f"{P}/briefs", headers=auth(meera)).json()["brief"]["id"]
    m_rem = client.post(f"{P}/reminders", headers=auth(meera), json=_reminder_body()).json()["reminder"]["id"]
    RP = f"{API}/patients/pat_ravi"
    r_doc = upload(client, ravi, "lab_citycare_jun2026.pdf", pdfs["lab_citycare_jun2026.pdf"], patient_id="pat_ravi").json()["document"]["id"]
    from fake_model import CANNED  # noqa: F401  (RDOC-1 is answered by the fake model's default)

    r_brief = client.post(f"{RP}/briefs", headers=auth(ravi)).json()["brief"]["id"]
    r_rem = client.post(f"{RP}/reminders", headers=auth(ravi), json=_reminder_body()).json()["reminder"]["id"]
    return {"meera_doc": m_doc, "meera_fact": m_fact, "meera_brief": m_brief, "meera_rem": m_rem,
            "ravi_doc": r_doc, "ravi_brief": r_brief, "ravi_rem": r_rem}


def matrix(w, pdfs):
    """(label, method, path, kwargs, expected for Meera, Karthik, Ravi). Order is safe to run."""
    doc, fact, brief, rem = w["meera_doc"], w["meera_fact"], w["meera_brief"], w["meera_rem"]
    pdf = ("file", ("rx_lakeview_mar2025.pdf", pdfs["rx_lakeview_mar2025.pdf"], "application/pdf"))
    return [
        ("API-07 patient", "GET", P, {}, (200, 200, 403)),
        ("API-08 upload", "POST", f"{P}/documents", {"files": [pdf]}, (202, 403, 403)),
        ("API-10 list", "GET", f"{P}/documents", {}, (200, 200, 403)),
        ("API-11 detail", "GET", f"{P}/documents/{doc}", {}, (200, 200, 403)),
        ("API-12 file", "GET", f"{P}/documents/{doc}/file", {}, (200, 200, 403)),
        ("API-14 document patch", "PATCH", f"{P}/documents/{doc}", {"json": {"clinician_name": "Dr. Arun Kumar"}}, (200, 403, 403)),
        ("API-16 bulk review", "POST", f"{P}/documents/{doc}/review", {"json": {"action": "confirm_high_confidence"}}, (200, 403, 403)),
        ("API-15 fact patch", "PATCH", f"{P}/facts/{fact}", {"json": {"action": "reject"}}, (200, 403, 403)),
        ("API-17 timeline", "GET", f"{P}/timeline", {}, (200, 200, 403)),
        ("API-18 create brief", "POST", f"{P}/briefs", {}, (201, 201, 403)),
        ("API-19 latest brief", "GET", f"{P}/briefs/latest", {}, (200, 200, 403)),
        ("API-20 narrative", "POST", f"{P}/briefs/{brief}/narrative", {}, (200, 200, 403)),
        ("API-21 ask", "POST", f"{P}/ask", {"json": {"question": "What is my blood group?"}}, (200, 200, 403)),
        ("API-27 list reminders", "GET", f"{P}/reminders", {}, (200, 200, 403)),
        ("API-28 create reminder", "POST", f"{P}/reminders", {"json": _reminder_body()}, (201, 201, 403)),
        ("API-29 update reminder", "PATCH", f"{P}/reminders/{rem}", {"json": {"title": "Bring all reports"}}, (200, 200, 403)),
        ("API-30 complete reminder", "POST", f"{P}/reminders/{rem}/complete", {}, (200, 200, 403)),
        ("API-23 access list", "GET", f"{P}/access", {}, (200, 403, 403)),
        ("API-26 audit events", "GET", f"{P}/audit-events", {}, (200, 403, 403)),
        ("API-13 reprocess", "POST", f"{P}/documents/{doc}/reprocess", {}, (409, 403, 403)),  # reviewed → 409 for the owner
        ("API-24 grant", "POST", f"{P}/access",
         {"json": {"grantee_email": "fresh.test@medivara.test", "scopes": ["view_records"], "consent_confirmed": True, "policy_version": POLICY}},
         (201, 403, 403)),
    ]


EXPECTED_CODES = {403: {"ACCESS_DENIED", "SCOPE_REQUIRED", "OWNER_ONLY"}}


@pytest.mark.parametrize("who", ["meera", "karthik", "ravi"])
def test_permission_matrix(client, world, pdfs, who):
    token = login(client, {"meera": MEERA, "karthik": KARTHIK, "ravi": RAVI}[who])
    column = ["meera", "karthik", "ravi"].index(who)
    failures = []
    for label, method, path, kwargs, expected in matrix(world, pdfs):
        resp = client.request(method, path, headers=auth(token), **kwargs)
        want = expected[column]
        if resp.status_code != want:
            failures.append(f"{label}: {resp.status_code} != {want} ({resp.text[:120]})")
        elif want == 403 and resp.json()["error"]["code"] not in EXPECTED_CODES[403]:
            failures.append(f"{label}: unexpected code {resp.json()['error']['code']}")
        if who == "karthik" and label in ("API-08 upload", "API-15 fact patch", "API-16 bulk review", "API-14 document patch"):
            if resp.status_code == 403 and resp.json()["error"]["code"] != "SCOPE_REQUIRED":
                failures.append(f"{label}: caregiver should get SCOPE_REQUIRED")
        if who == "karthik" and label in ("API-23 access list", "API-24 grant", "API-26 audit events"):
            if resp.status_code == 403 and resp.json()["error"]["code"] != "OWNER_ONLY":
                failures.append(f"{label}: caregiver should get OWNER_ONLY")
    assert not failures, "\n".join(failures)


def test_every_denial_is_audited(client, world, pdfs):
    from app.db import get_engine
    from app.models import AuditEvent

    ravi = login(client, RAVI)
    rows = matrix(world, pdfs)
    for _, method, path, kwargs, _ in rows:
        client.request(method, path, headers=auth(ravi), **kwargs)
    with Session(get_engine()) as session:
        denied = session.exec(
            select(AuditEvent).where(AuditEvent.action == "access.denied", AuditEvent.actor_user_id == "usr_ravi")
        ).all()
    assert len(denied) == len(rows)
    assert all(d.patient_id == "pat_meera" and d.outcome.value == "denied" for d in denied)


def test_revoke_rows(client, world):
    meera, karthik, ravi = login(client, MEERA), login(client, KARTHIK), login(client, RAVI)
    # Karthik may only remove his own grant; Ravi has no access at all.
    assert client.delete(f"{P}/access/grt_meera_owner", headers=auth(karthik)).status_code == 403
    assert client.delete(f"{P}/access/grt_karthik_meera", headers=auth(ravi)).status_code == 403
    assert client.delete(f"{P}/access/grt_karthik_meera", headers=auth(karthik)).status_code == 204
    assert client.get(P, headers=auth(karthik)).status_code == 403
    assert client.get(P, headers=auth(meera)).status_code == 200


def test_resource_binding(client, world):
    """A resource ID from another patient is never found, whichever path it is used under."""
    meera, ravi = login(client, MEERA), login(client, RAVI)
    RP = f"{API}/patients/pat_ravi"
    w = world
    meera_side = [  # Ravi's IDs under Meera's path, as Meera
        ("GET", f"{P}/documents/{w['ravi_doc']}", {}),
        ("GET", f"{P}/documents/{w['ravi_doc']}/file", {}),
        ("PATCH", f"{P}/documents/{w['ravi_doc']}", {"json": {"clinician_name": "x"}}),
        ("POST", f"{P}/documents/{w['ravi_doc']}/review", {"json": {"action": "confirm_high_confidence"}}),
        ("POST", f"{P}/documents/{w['ravi_doc']}/reprocess", {}),
        ("POST", f"{P}/briefs/{w['ravi_brief']}/narrative", {}),
        ("PATCH", f"{P}/reminders/{w['ravi_rem']}", {"json": {"title": "x"}}),
        ("POST", f"{P}/reminders/{w['ravi_rem']}/complete", {}),
    ]
    ravi_side = [  # Meera's IDs under Ravi's own path, as Ravi
        ("GET", f"{RP}/documents/{w['meera_doc']}", {}),
        ("GET", f"{RP}/documents/{w['meera_doc']}/file", {}),
        ("PATCH", f"{RP}/facts/{w['meera_fact']}", {"json": {"action": "confirm"}}),
        ("POST", f"{RP}/briefs/{w['meera_brief']}/narrative", {}),
        ("PATCH", f"{RP}/reminders/{w['meera_rem']}", {"json": {"title": "x"}}),
        ("POST", f"{RP}/reminders/{w['meera_rem']}/complete", {}),
        ("DELETE", f"{RP}/access/grt_karthik_meera", {}),
    ]
    for token, calls in ((meera, meera_side), (ravi, ravi_side)):
        for method, path, kwargs in calls:
            resp = client.request(method, path, headers=auth(token), **kwargs)
            assert resp.status_code == 404, (method, path, resp.status_code)
            assert resp.json()["error"]["code"] == "NOT_FOUND"


# The six named BE-3.5 cases, for the release notes.
def test_be35_named_cases(client, world, fake_model, pdfs):
    meera, karthik, ravi = login(client, MEERA), login(client, KARTHIK), login(client, RAVI)
    # 1. Ravi reads Meera's profile.
    assert client.get(P, headers=auth(ravi)).json()["error"]["code"] == "ACCESS_DENIED"
    # 2. Ravi reads Meera's document through Ravi's patient path.
    assert client.get(f"{API}/patients/pat_ravi/documents/{world['meera_doc']}", headers=auth(ravi)).status_code == 404
    # 3. Fact PATCH across patients.
    assert client.patch(f"{API}/patients/pat_ravi/facts/{world['meera_fact']}", headers=auth(ravi),
                        json={"action": "confirm"}).status_code == 404
    # 4. Karthik uploads to Meera.
    up = upload(client, karthik, "rx_lakeview_mar2025.pdf", pdfs["rx_lakeview_mar2025.pdf"])
    assert up.status_code == 403 and up.json()["error"]["code"] == "SCOPE_REQUIRED"
    # 5. Karthik grants access on Meera's profile.
    g = client.post(f"{P}/access", headers=auth(karthik), json={"grantee_email": RAVI, "scopes": ["view_records"],
                    "consent_confirmed": True, "policy_version": POLICY})
    assert g.json()["error"]["code"] == "OWNER_ONLY"
    # 6. The Ask context for Ravi contains none of Meera's lines (and vice versa for Karthik's).
    client.post(f"{API}/patients/pat_ravi/ask", headers=auth(ravi), json={"question": "What is my HbA1c?"})
    ravi_input = [r["input"] for r in fake_model.requests if "QUESTION_START" in r["input"]][-1]
    evidence = ravi_input.split("EVIDENCE_END")[0]
    assert "Meera" not in evidence and "HbA1c" not in evidence and "SUNRISE" not in evidence

    karthik_own = login(client, KARTHIK)
    upload(client, karthik_own, "lab_sunrise_feb2026.pdf", pdfs["lab_sunrise_feb2026.pdf"], patient_id="pat_karthik")
    client.post(f"{P}/ask", headers=auth(meera), json={"question": "What is Karthik's vitamin D level?"})
    meera_input = [r["input"] for r in fake_model.requests if "QUESTION_START" in r["input"]][-1]
    assert "Vitamin D" not in meera_input.split("EVIDENCE_END")[0]  # X-02


# --- FR-006 snapshot save and restore (TC-REL-03) -----------------------------------------


def test_snapshot_round_trip(client, fake_model, pdfs, tmp_path, monkeypatch):
    from app import config, db, snapshot

    monkeypatch.setenv("SNAPSHOT_DIR", str(tmp_path / "snaps"))
    config.get_settings.cache_clear()
    meera = login(client, MEERA)
    upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"])
    snapshot.save("demo")  # while the app is "running"

    upload(client, meera, "rx_lakeview_mar2025.pdf", pdfs["rx_lakeview_mar2025.pdf"])
    client.delete(f"{P}/access/grt_karthik_meera", headers=auth(meera))
    assert client.get(f"{P}/documents", headers=auth(meera)).json()["total"] == 2

    db.reset_engine()  # "stop the backend"
    seconds = snapshot.restore("demo")
    assert seconds < 120
    meera = login(client, MEERA)
    docs = client.get(f"{P}/documents", headers=auth(meera)).json()
    assert docs["total"] == 1
    did = docs["items"][0]["id"]
    assert client.get(f"{P}/documents/{did}/file", headers=auth(meera)).content == pdfs["lab_sunrise_mar2025.pdf"]
    assert client.get(f"{P}/timeline", headers=auth(login(client, KARTHIK))).status_code == 200  # grant restored
    assert [s["name"] for s in snapshot.list_snapshots()] == ["demo"]


def test_snapshot_restore_refuses_outside_demo_mode(client, tmp_path, monkeypatch):
    from app import config, snapshot

    monkeypatch.setenv("SNAPSHOT_DIR", str(tmp_path / "snaps"))
    config.get_settings.cache_clear()
    snapshot.save("x")
    monkeypatch.setenv("DEMO_MODE", "false")
    config.get_settings.cache_clear()
    with pytest.raises(SystemExit):
        snapshot.restore("x")
    with pytest.raises(SystemExit):
        snapshot.save("../escape")
