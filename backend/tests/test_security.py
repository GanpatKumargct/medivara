"""BE-14.1 and BE-14.3: log hygiene over a full flow (TC-SEC-04), secrets (TC-SEC-05),
private storage and upload hardening (TC-SEC-01 to 03)."""

import logging
import re
import subprocess
from datetime import date, timedelta
from pathlib import Path

from conftest import API, KARTHIK, MEERA, RAVI, auth, login, upload
from fake_model import statement

REPO = Path(__file__).resolve().parents[2]
P = f"{API}/patients/pat_meera"

# TC-SEC-04 search list: synthetic names, medicine names, values, document text, question text.
PHI = ["Meera", "Karthik", "Ravi Menon", "Metformin", "Amlodipine", "HbA1c", "Haemoglobin", "Sulfa", "Lakeview",
       "Sunrise", "Greenfield", "8.4", "7.6", "12.1", "1000 mg", "fasting glucose", "What was my most recent",
       "chest pain", "Should I stop", "medivara.test", "MediVara-Demo-2026", "mvs_", "rx_lakeview", "Ignore all previous"]


def test_full_flow_logs_contain_no_phi(client, fake_model, pdfs, caplog):
    from app.middleware import JsonAllowListFormatter

    caplog.set_level(logging.INFO, logger="medivara")
    logging.getLogger("medivara").propagate = True
    try:
        meera, karthik, ravi = login(client, MEERA), login(client, KARTHIK), login(client, RAVI)
        ids = {n: upload(client, meera, n, pdfs[n]).json()["document"]["id"] for n in
               ("lab_sunrise_mar2025.pdf", "lab_sunrise_may2026.pdf", "rx_lakeview_sep2026.pdf", "note_lakeview_sep2026.pdf",
                "scanned_prescription.pdf")}
        upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"])  # duplicate
        rx = client.get(f"{P}/documents/{ids['rx_lakeview_sep2026.pdf']}", headers=auth(meera)).json()
        client.post(f"{P}/documents/{ids['rx_lakeview_sep2026.pdf']}/review", headers=auth(meera), json={"action": "confirm_high_confidence"})
        lab = client.get(f"{P}/documents/{ids['lab_sunrise_may2026.pdf']}", headers=auth(meera)).json()
        client.patch(f"{P}/facts/{lab['facts'][0]['id']}", headers=auth(meera), json={"action": "correct", "corrected_fields": {"value": "7.7"}})
        client.patch(f"{P}/documents/{ids['lab_sunrise_may2026.pdf']}", headers=auth(meera), json={"document_date": "2026-05-04"})
        client.get(f"{P}/documents/{ids['lab_sunrise_mar2025.pdf']}/file", headers=auth(meera))
        client.get(f"{P}/timeline", headers=auth(meera))
        brief = client.post(f"{P}/briefs", headers=auth(meera), json={"visit_reason": "Routine diabetes review"}).json()["brief"]["id"]
        fake_model.narrate = lambda inp: {"status": "answered", "statements": [
            statement("record_fact", "Your HbA1c was 8.4 % on 18 Mar 2025.", inp, "HbA1c (Glycated haemoglobin)   8.4")],
            "questions_for_doctor": []}
        client.post(f"{P}/briefs/{brief}/narrative", headers=auth(meera))
        for q in ("What was my most recent HbA1c?", "I have chest pain", "Should I stop Metformin?", "What is my blood group?"):
            client.post(f"{P}/ask", headers=auth(meera), json={"question": q})
        follow = next(f for f in rx["facts"] if f["fact_type"] == "follow_up")
        rem = client.post(f"{P}/reminders", headers=auth(karthik), json={"type": "follow_up", "title": "Review with fasting glucose report",
                          "schedule_kind": "once", "schedule": {"date": (date.today() + timedelta(days=9)).isoformat(), "time": "10:00"},
                          "source_fact_id": follow["id"]}).json()["reminder"]["id"]
        client.post(f"{P}/reminders/{rem}/complete", headers=auth(meera))
        client.post(f"{P}/access", headers=auth(meera), json={"grantee_email": RAVI, "scopes": ["view_records"],
                    "consent_confirmed": True, "policy_version": "2026-10-demo-1"})
        client.delete(f"{P}/access/grt_karthik_meera", headers=auth(meera))
        client.get(P, headers=auth(karthik))
        client.get(f"{P}/audit-events", headers=auth(meera))
        client.post(f"{API}/auth/login", json={"email": MEERA, "password": "wrong-password"})
        client.post(f"{API}/auth/logout", headers=auth(ravi))
    finally:
        logging.getLogger("medivara").propagate = False
    lines = [JsonAllowListFormatter().format(r) for r in caplog.records]
    assert len(lines) > 40
    text = "\n".join(lines)
    hits = [term for term in PHI if term in text]  # literal search, as TC-SEC-04 should be run
    assert not hits, hits
    assert any('"event": "model_call"' in line for line in lines)


def test_no_secrets_in_the_repository():
    ignored = (REPO / ".gitignore").read_text().splitlines()
    assert ".env" in ignored
    tracked = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=REPO,
                             capture_output=True, text=True, check=True).stdout.split()
    assert "backend/.env" not in tracked
    key = re.compile(r"AIza[0-9A-Za-z_\-]{30,}")
    offenders = [f for f in tracked if (REPO / f).is_file() and (REPO / f).stat().st_size < 2_000_000
                 and key.search((REPO / f).read_text(errors="ignore"))]
    assert offenders == []
    example = (REPO / "backend" / ".env.example").read_text()
    assert re.search(r"^GEMINI_API_KEY=$", example, re.MULTILINE)


def test_no_route_serves_storage_directly(client, fake_model, pdfs):
    meera = login(client, MEERA)
    upload(client, meera, "lab_sunrise_mar2025.pdf", pdfs["lab_sunrise_mar2025.pdf"])
    from app import storage
    from app.db import get_engine
    from app.models import MedicalDocument
    from sqlmodel import Session, select

    with Session(get_engine()) as session:
        key = session.exec(select(MedicalDocument.storage_key)).first()
    for path in (f"/storage/{key}", f"/files/{key}", f"{API}/storage/{key}", f"/{key}", f"{API}/files/{key}"):
        assert client.get(path, headers=auth(meera)).status_code == 404
    # Only API-12 returns document bytes; nothing is mounted as static files.
    assert not [r for r in client.app.routes if type(r).__name__ in ("Mount", "StaticFiles")]
    for bad in ("../x", "abc/../../etc", "", "ZZZ"):
        try:
            storage.path_for(bad)
            raise AssertionError(f"accepted {bad!r}")
        except ValueError:
            pass


def test_type_comes_from_content_not_name(client, fake_model, pdfs):
    meera = login(client, MEERA)
    real_pdf = client.post(f"{P}/documents", headers=auth(meera),
                           files={"file": ("notes.txt", pdfs["lab_sunrise_mar2025.pdf"], "text/plain")})
    assert real_pdf.status_code == 202
    assert real_pdf.json()["document"]["title"] == "Uploaded document · notes.txt"
    html = client.post(f"{P}/documents", headers=auth(meera),
                       files={"file": ("report.pdf", b"<html><script>alert(1)</script></html>", "application/pdf")})
    assert html.status_code == 415
    png = client.post(f"{P}/documents", headers=auth(meera),
                      files={"file": ("scan.pdf", b"\x89PNG\r\n\x1a\n" + b"0" * 100, "application/pdf")})
    assert png.status_code == 415  # images only once FR-024 ships


def test_control_characters_and_long_names_are_sanitised(client, fake_model, pdfs):
    meera = login(client, MEERA)
    name = "..\\..\\evil\x00\x1f" + "a" * 300 + ".pdf"
    did = client.post(f"{P}/documents", headers=auth(meera), files={"file": (name, pdfs["lab_sunrise_mar2025.pdf"], "application/pdf")}).json()["document"]["id"]
    detail = client.get(f"{P}/documents/{did}", headers=auth(meera)).json()["document"]
    assert "\x00" not in detail["original_filename"] and "\\" not in detail["original_filename"]
    assert len(detail["original_filename"]) <= 120
    header = client.get(f"{P}/documents/{did}/file", headers=auth(meera)).headers["content-disposition"]
    assert header.startswith('inline; filename="') and "\n" not in header
