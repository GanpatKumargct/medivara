"""Women's health (API-62 to API-67), sex at sign-up and for family profiles (API-40/41), and the
API-61 voice additions (patient_sex, womens_health_mode, womens_health_context, overrides).

"Today" is frozen at 11 Oct 2026 IST through app.womens_health.today_ist."""

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from sqlmodel import Session, select

from conftest import API, KARTHIK, MEERA, RAVI, auth, login

TODAY = date(2026, 10, 11)
P = f"{API}/patients/pat_meera"
POLICY = "2026-10-demo-1"
CYCLE_KEYS = (
    "last_period_start",
    "cycle_day",
    "average_cycle_days",
    "average_period_days",
    "next_period_estimate",
    "next_period_end_estimate",
    "days_until_next_period",
    "fertile_window_start",
    "fertile_window_end",
)
EMPTY_CYCLE = {**{key: None for key in CYCLE_KEYS}, "logged_periods": 0}
PERIOD_KEYS = {"id", "start_date", "end_date", "length_days", "flow", "symptoms", "notes", "created_by", "created_at", "updated_at"}


@pytest.fixture
def today(monkeypatch):
    import app.womens_health

    monkeypatch.setattr(app.womens_health, "today_ist", lambda: TODAY)
    return TODAY


def d(days: int) -> str:
    """TODAY shifted by `days`, as YYYY-MM-DD."""
    return (TODAY + timedelta(days=days)).isoformat()


def db() -> Session:
    from app.db import get_engine

    return Session(get_engine())


def audit_rows(action: str):
    from app.models import AuditEvent

    with db() as session:
        return session.exec(select(AuditEvent).where(AuditEvent.action == action)).all()


def all_audit_meta() -> str:
    from app.models import AuditEvent

    with db() as session:
        return str([e.meta for e in session.exec(select(AuditEvent)).all()])


def fields(response) -> set[str]:
    assert response.status_code == 422, response.text
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    return {f["field"] for f in error["details"]["fields"]}


def code(response) -> str:
    return response.json()["error"]["code"]


def put_wh(client, headers, patient="pat_meera", **body):
    return client.put(f"{API}/patients/{patient}/womens-health", headers=headers, json=body)


def get_wh(client, headers, patient="pat_meera") -> dict:
    response = client.get(f"{API}/patients/{patient}/womens-health", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["womens_health"]


def log_period(client, headers, start, end=None, patient="pat_meera", **extra):
    body = {"start_date": start, **({"end_date": end} if end else {}), **extra}
    return client.post(f"{API}/patients/{patient}/periods", headers=headers, json=body)


def logged(client, headers, start, end=None, **extra) -> dict:
    response = log_period(client, headers, start, end, **extra)
    assert response.status_code == 201, response.text
    return response.json()["period"]


def span(start: str, end: str | None = None):
    return SimpleNamespace(start_date=date.fromisoformat(start), end_date=date.fromisoformat(end) if end else None)


# --- API-62/63 settings --------------------------------------------------------------------


def test_defaults_without_settings(client, today):
    meera = auth(login(client, MEERA))
    assert get_wh(client, meera) == {
        "patient_id": "pat_meera",
        "mode": "off",
        "cycle_length_days": None,
        "period_length_days": None,
        "lmp_date": None,
        "due_date": None,
        "delivery_date": None,
        "updated_at": None,
        "summary": {"cycle": EMPTY_CYCLE, "pregnancy": None, "postpartum": None, "voice_context": "Not in use."},
    }
    karthik = auth(login(client, KARTHIK))
    assert get_wh(client, karthik)["mode"] == "off"
    denied = client.get(f"{P}/womens-health", headers=auth(login(client, RAVI)))
    assert denied.status_code == 403 and code(denied) == "ACCESS_DENIED"


def test_put_saves_replaces_and_audits(client, today):
    meera = auth(login(client, MEERA))
    response = put_wh(client, meera, mode=" Cycle ", cycle_length_days=28, period_length_days=5, lmp_date=d(-10))
    assert response.status_code == 200, response.text
    saved = response.json()["womens_health"]
    assert (saved["mode"], saved["cycle_length_days"], saved["period_length_days"]) == ("cycle", 28, 5)
    assert saved["lmp_date"] == d(-10) and saved["due_date"] is None and saved["delivery_date"] is None
    assert saved["updated_at"].endswith("Z")
    # No logs yet, so the cycle summary stays empty even though settings exist.
    assert saved["summary"]["cycle"] == EMPTY_CYCLE
    assert saved["summary"]["voice_context"] == "Period tracker is on, but no periods have been logged yet."
    assert get_wh(client, meera) == saved

    # A PUT replaces every field: what's missing becomes null, a missing mode "off".
    cleared = put_wh(client, meera).json()["womens_health"]
    assert cleared["mode"] == "off" and cleared["cycle_length_days"] is None and cleared["lmp_date"] is None
    assert cleared["updated_at"] is not None

    events = audit_rows("womens_health.updated")
    assert [e.meta for e in events] == [{"mode": "cycle"}, {"mode": "off"}]
    assert all(e.patient_id == "pat_meera" and e.actor_user_id == "usr_meera" for e in events)


def test_put_needs_upload_documents(client, today):
    karthik, ravi = auth(login(client, KARTHIK)), auth(login(client, RAVI))
    denied = put_wh(client, karthik, mode="cycle")
    assert denied.status_code == 403 and code(denied) == "SCOPE_REQUIRED"
    assert denied.json()["error"]["details"] == {"required_scope": "upload_documents"}
    assert code(put_wh(client, ravi, mode="cycle")) == "ACCESS_DENIED"
    assert get_wh(client, auth(login(client, MEERA)))["updated_at"] is None


@pytest.mark.parametrize(
    "body, bad",
    [
        ({"mode": "menopause"}, "mode"),
        ({"cycle_length_days": 20}, "cycle_length_days"),
        ({"cycle_length_days": 46}, "cycle_length_days"),
        ({"cycle_length_days": "often"}, "cycle_length_days"),
        ({"period_length_days": 1}, "period_length_days"),
        ({"period_length_days": 11}, "period_length_days"),
        ({"lmp_date": d(1)}, "lmp_date"),
        ({"lmp_date": d(-301)}, "lmp_date"),
        ({"lmp_date": "2026-13-01"}, "lmp_date"),
        ({"due_date": d(-31)}, "due_date"),
        ({"due_date": d(301)}, "due_date"),
        ({"delivery_date": d(1)}, "delivery_date"),
        ({"delivery_date": d(-731)}, "delivery_date"),
        ({"mode": "pregnancy"}, "lmp_date"),
        ({"mode": "pregnancy", "delivery_date": d(-5)}, "lmp_date"),
        ({"mode": "postpartum"}, "delivery_date"),
        ({"mode": "postpartum", "lmp_date": d(-5)}, "delivery_date"),
    ],
)
def test_put_validation(client, today, body, bad):
    assert fields(put_wh(client, auth(login(client, MEERA)), **body)) == {bad}


def test_put_validation_messages_and_edges(client, today):
    meera = auth(login(client, MEERA))
    pregnant = put_wh(client, meera, mode="pregnancy").json()["error"]["details"]["fields"]
    assert pregnant == [{"field": "lmp_date", "issue": "pregnancy mode needs lmp_date or due_date"}]
    postpartum = put_wh(client, meera, mode="postpartum").json()["error"]["details"]["fields"]
    assert postpartum == [{"field": "delivery_date", "issue": "postpartum mode needs delivery_date"}]
    # An out-of-range LMP is reported once, as a range problem.
    assert len(put_wh(client, meera, mode="pregnancy", lmp_date=d(5)).json()["error"]["details"]["fields"]) == 1

    every = put_wh(
        client, meera, mode="sometimes", cycle_length_days=50, period_length_days=0,
        lmp_date=d(1), due_date=d(400), delivery_date=d(3),
    )
    assert fields(every) == {"mode", "cycle_length_days", "period_length_days", "lmp_date", "due_date", "delivery_date"}
    assert get_wh(client, meera)["updated_at"] is None  # nothing saved

    for body in (
        {"mode": "cycle", "cycle_length_days": 21, "period_length_days": 2},
        {"mode": "cycle", "cycle_length_days": 45, "period_length_days": 10},
        {"mode": "pregnancy", "lmp_date": d(0), "due_date": d(300)},
        {"mode": "pregnancy", "lmp_date": d(-300), "due_date": d(-30)},
        {"mode": "postpartum", "delivery_date": d(0)},
        {"mode": "postpartum", "delivery_date": d(-730)},
        {"mode": "off", "lmp_date": d(-20), "delivery_date": d(-100)},
    ):
        assert put_wh(client, meera, **body).status_code == 200, body


# --- Cycle maths ---------------------------------------------------------------------------


def test_cycle_summary_from_three_logs(client, today):
    meera = auth(login(client, MEERA))
    logged(client, meera, "2026-08-04", "2026-08-08")  # 5 days
    logged(client, meera, "2026-09-02", "2026-09-07")  # 6 days, 29 days after the last start
    logged(client, meera, "2026-10-01", "2026-10-04")  # 4 days, 29 days after the last start
    put_wh(client, meera, mode="cycle", cycle_length_days=35, period_length_days=8)  # the logs win
    summary = get_wh(client, meera)["summary"]
    assert summary["cycle"] == {
        "last_period_start": "2026-10-01",
        "cycle_day": 11,
        "average_cycle_days": 29,
        "average_period_days": 5,
        "next_period_estimate": "2026-10-30",
        "next_period_end_estimate": "2026-11-03",
        "days_until_next_period": 19,
        "fertile_window_start": "2026-10-11",
        "fertile_window_end": "2026-10-17",
        "logged_periods": 3,
    }
    assert summary["pregnancy"] is None and summary["postpartum"] is None
    assert summary["voice_context"] == (
        "Period tracker: cycle day 11. Last period started 01 Oct 2026. Next period estimated around "
        "30 Oct 2026 (in 19 days). Average cycle 29 days. "
        "These are estimates from dates the user entered, not medical advice."
    )
    # The cycle summary is computed whatever the mode; only the voice context depends on it.
    put_wh(client, meera, mode="off")
    off = get_wh(client, meera)["summary"]
    assert off["cycle"] == summary["cycle"] and off["voice_context"] == "Not in use."


def test_cycle_falls_back_to_settings(client, today):
    meera = auth(login(client, MEERA))
    logged(client, meera, "2026-09-20")  # open: no end date, so no length
    put_wh(client, meera, mode="cycle", cycle_length_days=30, period_length_days=4)
    cycle = get_wh(client, meera)["summary"]["cycle"]
    assert (cycle["average_cycle_days"], cycle["average_period_days"], cycle["cycle_day"]) == (30, 4, 22)
    assert cycle["next_period_estimate"] == "2026-10-20" and cycle["next_period_end_estimate"] == "2026-10-23"
    assert (cycle["fertile_window_start"], cycle["fertile_window_end"]) == ("2026-10-01", "2026-10-07")
    assert cycle["days_until_next_period"] == 9 and cycle["logged_periods"] == 1

    # Without a period length anywhere, the end estimate is null; the rest still works.
    put_wh(client, meera, mode="cycle", cycle_length_days=30)
    cycle = get_wh(client, meera)["summary"]["cycle"]
    assert cycle["average_period_days"] is None and cycle["next_period_end_estimate"] is None
    assert cycle["next_period_estimate"] == "2026-10-20"


def test_cycle_without_an_average(client, today):
    meera = auth(login(client, MEERA))
    logged(client, meera, "2026-10-02", "2026-10-06")
    put_wh(client, meera, mode="cycle")
    summary = get_wh(client, meera)["summary"]
    assert summary["cycle"] == {
        **EMPTY_CYCLE,
        "last_period_start": "2026-10-02",
        "cycle_day": 10,
        "average_period_days": 5,
        "logged_periods": 1,
    }
    assert summary["voice_context"] == (
        "Period tracker: cycle day 10. Last period started 02 Oct 2026. "
        "There isn't enough information yet to estimate the next period."
    )


def test_cycle_late_period(client, today):
    meera = auth(login(client, MEERA))
    logged(client, meera, "2026-09-01", "2026-09-05")
    put_wh(client, meera, mode="cycle", cycle_length_days=28)
    summary = get_wh(client, meera)["summary"]
    assert summary["cycle"]["next_period_estimate"] == "2026-09-29"
    assert summary["cycle"]["days_until_next_period"] == -12 and summary["cycle"]["cycle_day"] == 41
    assert "Next period estimated around 29 Sep 2026 (12 days late)." in summary["voice_context"]


def test_cycle_gaps_outside_15_to_60_days_are_ignored():
    from app.womens_health import cycle_summary

    logs = [
        span("2026-03-01"),
        span("2026-05-10"),  # 70 days: ignored
        span("2026-06-07"),  # 28
        span("2026-06-17"),  # 10: ignored
        span("2026-07-19"),  # 32
    ]
    cycle = cycle_summary(logs, 40, None, TODAY)
    assert cycle["average_cycle_days"] == 30 and cycle["last_period_start"] == "2026-07-19"
    # Only out-of-range gaps: the setting is used.
    assert cycle_summary([span("2026-01-01"), span("2026-05-01")], 31, None, TODAY)["average_cycle_days"] == 31
    assert cycle_summary([span("2026-01-01"), span("2026-05-01")], None, None, TODAY)["next_period_estimate"] is None


def test_cycle_averages_use_the_last_six_and_python_rounding():
    from app.womens_health import cycle_summary

    starts = [date(2026, 1, 1)]
    for gap in (45, 45, 28, 28, 28, 28, 28, 29):  # the two 45-day gaps are older than the last six
        starts.append(starts[-1] + timedelta(days=gap))
    logs = [SimpleNamespace(start_date=s, end_date=None) for s in starts]
    assert round((28 * 5 + 29) / 6) == 28
    assert cycle_summary(logs, None, None, starts[-1])["average_cycle_days"] == 28
    # 28.5 rounds to 28 with Python's round (half to even); 29.5 rounds to 30.
    assert cycle_summary([span("2026-08-01"), span("2026-08-29"), span("2026-09-27")], None, None, TODAY)["average_cycle_days"] == 28
    assert cycle_summary([span("2026-08-01"), span("2026-08-30"), span("2026-09-29")], None, None, TODAY)["average_cycle_days"] == 30

    # Period length: the last six logs that have an end date (here 4, 4, 4, 4, 4, 6 → 4.33 → 4).
    lengths = [9, 4, 4, 4, 4, 4, 6]
    with_ends = [span(f"2026-0{i + 1}-01", f"2026-0{i + 1}-{n:02d}") for i, n in enumerate(lengths)]
    assert cycle_summary([*with_ends, span("2026-08-01")], None, None, TODAY)["average_period_days"] == 4


def test_cycle_without_logs_ignores_settings():
    from app.womens_health import cycle_summary

    assert cycle_summary([], 28, 5, TODAY) == EMPTY_CYCLE


@pytest.mark.parametrize(
    "last_start, phrase",
    [
        ("2026-09-14", "(in 1 day)"),
        ("2026-09-13", "(today)"),
        ("2026-09-12", "(1 day late)"),
        ("2026-09-10", "(3 days late)"),
        ("2026-09-20", "(in 7 days)"),
    ],
)
def test_cycle_voice_context_wording(last_start, phrase):
    from app.womens_health import cycle_summary, voice_context

    cycle = cycle_summary([span(last_start)], 28, None, TODAY)
    assert phrase in voice_context("cycle", cycle, None, None)


# --- Pregnancy and postpartum --------------------------------------------------------------

PREGNANCY = {"due_date": "2027-04-07", "lmp_date": "2026-07-01", "weeks": 14, "days": 4, "trimester": 2, "days_to_go": 178}
PREGNANCY_TEXT = (
    "Pregnancy tracker: week 14 and 4 days (second trimester). Due date 07 Apr 2027, 178 days to go. "
    "Calculated from dates the user entered."
)


def test_pregnancy_from_lmp_only(client, today):
    meera = auth(login(client, MEERA))
    saved = put_wh(client, meera, mode="pregnancy", lmp_date="2026-07-01").json()["womens_health"]
    assert saved["lmp_date"] == "2026-07-01" and saved["due_date"] is None  # settings stay as entered
    assert saved["summary"]["pregnancy"] == PREGNANCY
    assert saved["summary"]["postpartum"] is None
    assert saved["summary"]["voice_context"] == PREGNANCY_TEXT


def test_pregnancy_from_due_date_only(client, today):
    meera = auth(login(client, MEERA))
    saved = put_wh(client, meera, mode="pregnancy", due_date="2027-04-07").json()["womens_health"]
    assert saved["lmp_date"] is None and saved["due_date"] == "2027-04-07"
    assert saved["summary"]["pregnancy"] == PREGNANCY
    assert saved["summary"]["voice_context"] == PREGNANCY_TEXT


def test_pregnancy_summary_only_in_pregnancy_mode(client, today):
    meera = auth(login(client, MEERA))
    put_wh(client, meera, mode="cycle", lmp_date="2026-07-01", delivery_date="2026-01-01")
    summary = get_wh(client, meera)["summary"]
    assert summary["pregnancy"] is None and summary["postpartum"] is None


@pytest.mark.parametrize("weeks, trimester", [(0, 1), (12, 1), (13, 2), (26, 2), (27, 3), (40, 3)])
def test_trimester_boundaries(weeks, trimester):
    from app.womens_health import pregnancy_summary

    summary = pregnancy_summary(TODAY - timedelta(days=weeks * 7 + 6), None, TODAY)
    assert (summary["weeks"], summary["days"], summary["trimester"]) == (weeks, 6, trimester)


def test_pregnancy_before_lmp_counts_from_zero():
    from app.womens_health import pregnancy_summary

    summary = pregnancy_summary(TODAY + timedelta(days=3), None, TODAY)
    assert (summary["weeks"], summary["days"], summary["trimester"], summary["days_to_go"]) == (0, 0, 1, 283)


def test_pregnancy_overdue_and_singular_wording(client, today):
    meera = auth(login(client, MEERA))
    overdue = put_wh(client, meera, mode="pregnancy", due_date=d(-3)).json()["womens_health"]["summary"]
    assert overdue["pregnancy"] == {
        "due_date": "2026-10-08", "lmp_date": "2026-01-01", "weeks": 40, "days": 3, "trimester": 3, "days_to_go": -3,
    }
    assert overdue["voice_context"] == (
        "Pregnancy tracker: week 40 and 3 days (third trimester). Due date 08 Oct 2026 has passed. "
        "Calculated from dates the user entered."
    )
    # Both dates set: each is used as entered.
    one = put_wh(client, meera, mode="pregnancy", lmp_date=d(-141), due_date=d(1)).json()["womens_health"]["summary"]
    assert (one["pregnancy"]["weeks"], one["pregnancy"]["days"], one["pregnancy"]["days_to_go"]) == (20, 1, 1)
    assert one["voice_context"] == (
        "Pregnancy tracker: week 20 and 1 day (second trimester). Due date 12 Oct 2026, 1 day to go. "
        "Calculated from dates the user entered."
    )


def test_postpartum(client, today):
    meera = auth(login(client, MEERA))
    saved = put_wh(client, meera, mode="postpartum", delivery_date="2026-08-26").json()["womens_health"]
    assert saved["summary"]["postpartum"] == {"delivery_date": "2026-08-26", "days_since_delivery": 46, "weeks_since_delivery": 6}
    assert saved["summary"]["pregnancy"] is None
    assert saved["summary"]["voice_context"] == "After-birth tracker: 6 weeks since delivery on 26 Aug 2026."
    week = put_wh(client, meera, mode="postpartum", delivery_date=d(-7)).json()["womens_health"]["summary"]
    assert week["voice_context"] == "After-birth tracker: 1 week since delivery on 04 Oct 2026."
    days = put_wh(client, meera, mode="postpartum", delivery_date=d(-3)).json()["womens_health"]["summary"]
    assert days["postpartum"]["weeks_since_delivery"] == 0
    assert days["voice_context"] == "After-birth tracker: 0 weeks since delivery on 08 Oct 2026."


def test_voice_context_never_mentions_fertility_symptoms_or_notes(client, today):
    meera = auth(login(client, MEERA))
    logged(client, meera, "2026-09-02", "2026-09-06", symptoms=["cramps", "nausea"], notes="Skipped the gym")
    logged(client, meera, "2026-10-01", "2026-10-05", flow="heavy", symptoms=["acne"], notes="Felt tired")
    put_wh(client, meera, mode="cycle")
    wh = get_wh(client, meera)
    text = wh["summary"]["voice_context"]
    cycle = wh["summary"]["cycle"]
    assert (cycle["fertile_window_start"], cycle["fertile_window_end"]) == ("2026-10-11", "2026-10-17")
    for word in ("fertile", "ovulat", "11 Oct", "17 Oct", "cramps", "nausea", "acne", "heavy", "gym", "tired"):
        assert word not in text


# --- API-64 to 67 period log ---------------------------------------------------------------


def test_period_log_create_list_update_delete(client, today):
    meera = auth(login(client, MEERA))
    first = log_period(
        client, meera, "2026-09-02", "2026-09-06", flow=" Medium ",
        symptoms=["nausea", "cramps", "Cramps", " bloating "], notes="  Mild  ",
    )
    assert first.status_code == 201, first.text
    period = first.json()["period"]
    assert set(period) == PERIOD_KEYS and period["id"].startswith("per_")
    assert (period["start_date"], period["end_date"], period["length_days"]) == ("2026-09-02", "2026-09-06", 5)
    assert period["flow"] == "medium" and period["symptoms"] == ["cramps", "bloating", "nausea"]
    assert period["notes"] == "Mild"
    assert period["created_by"] == {"user_id": "usr_meera", "display_name": "Meera Raman"}
    assert period["created_at"].endswith("Z") and period["updated_at"].endswith("Z")

    second = logged(client, meera, "2026-10-01")
    assert second["end_date"] is None and second["length_days"] is None
    assert (second["flow"], second["symptoms"], second["notes"]) == (None, [], None)

    listing = client.get(f"{P}/periods", headers=meera).json()
    assert listing["total"] == 2 and [p["id"] for p in listing["items"]] == [second["id"], period["id"]]
    assert listing["items"][1] == period
    page = client.get(f"{P}/periods?limit=1", headers=meera).json()
    assert page["total"] == 2 and [p["id"] for p in page["items"]] == [second["id"]]
    for limit in (0, 201):
        assert fields(client.get(f"{P}/periods?limit={limit}", headers=meera)) == {"limit"}

    # PATCH: only the keys sent change.
    ended = client.patch(f"{P}/periods/{second['id']}", headers=meera, json={"end_date": "2026-10-05"})
    assert ended.status_code == 200, ended.text
    assert ended.json()["period"]["end_date"] == "2026-10-05" and ended.json()["period"]["length_days"] == 5
    noted = client.patch(f"{P}/periods/{period['id']}", headers=meera, json={"notes": "Better by day 3"}).json()["period"]
    assert noted["notes"] == "Better by day 3" and noted["flow"] == "medium" and noted["symptoms"] == period["symptoms"]
    # Explicit nulls clear; symptoms null is [].
    cleared = client.patch(
        f"{P}/periods/{period['id']}", headers=meera, json={"end_date": None, "flow": None, "symptoms": None, "notes": None}
    ).json()["period"]
    assert (cleared["end_date"], cleared["length_days"], cleared["flow"], cleared["symptoms"], cleared["notes"]) == (
        None, None, None, [], None,
    )
    assert cleared["start_date"] == "2026-09-02" and cleared["created_at"] == period["created_at"]
    moved = client.patch(f"{P}/periods/{period['id']}", headers=meera, json={"start_date": "2026-09-03", "end_date": "2026-09-08"})
    assert moved.status_code == 200 and moved.json()["period"]["length_days"] == 6
    assert fields(client.patch(f"{P}/periods/{period['id']}", headers=meera, json={"start_date": None})) == {"start_date"}

    deleted = client.delete(f"{P}/periods/{period['id']}", headers=meera)
    assert deleted.status_code == 204
    assert [p["id"] for p in client.get(f"{P}/periods", headers=meera).json()["items"]] == [second["id"]]
    again = client.delete(f"{P}/periods/{period['id']}", headers=meera)
    assert again.status_code == 404 and code(again) == "NOT_FOUND"
    assert code(client.patch(f"{P}/periods/per_missing", headers=meera, json={"notes": "x"})) == "NOT_FOUND"

    assert [e.meta for e in audit_rows("period.logged")] == [{"period_id": period["id"]}, {"period_id": second["id"]}]
    assert len(audit_rows("period.updated")) == 4 and len(audit_rows("period.deleted")) == 1
    assert all(e.meta == {"period_id": e.resource_id} for e in audit_rows("period.updated"))


def test_period_overlap(client, today):
    meera = auth(login(client, MEERA))
    closed = logged(client, meera, "2026-10-01", "2026-10-05")
    clash = log_period(client, meera, "2026-10-05")
    assert clash.status_code == 409 and code(clash) == "PERIOD_OVERLAP"
    assert clash.json()["error"]["message"] == "This overlaps a period you've already logged."
    assert log_period(client, meera, "2026-09-28", "2026-10-01").status_code == 409
    # A missing end date covers start + 6 days.
    assert log_period(client, meera, "2026-09-25").status_code == 409  # 25 Sep to 01 Oct
    opened = logged(client, meera, "2026-09-01")  # covers 01 to 07 Sep
    assert log_period(client, meera, "2026-09-07", "2026-09-09").status_code == 409
    assert log_period(client, meera, "2026-08-27", "2026-09-01").status_code == 409
    assert log_period(client, meera, "2026-09-08", "2026-09-10").status_code == 201
    assert log_period(client, meera, "2026-10-06").status_code == 201

    # PATCH checks overlaps against the others, never against itself.
    assert client.patch(f"{P}/periods/{closed['id']}", headers=meera, json={"end_date": "2026-10-04"}).status_code == 200
    moved = client.patch(f"{P}/periods/{opened['id']}", headers=meera, json={"start_date": "2026-09-09"})
    assert moved.status_code == 409 and code(moved) == "PERIOD_OVERLAP"
    assert client.get(f"{P}/periods", headers=meera).json()["total"] == 4

    # Another profile's logs never clash.
    karthik = auth(login(client, KARTHIK))
    assert log_period(client, karthik, "2026-10-01", patient="pat_karthik").status_code == 201


@pytest.mark.parametrize(
    "body, bad",
    [
        ({"start_date": d(1)}, {"start_date"}),
        ({"start_date": "yesterday"}, {"start_date"}),
        ({}, {"start_date"}),
        ({"start_date": d(-5), "end_date": d(-6)}, {"end_date"}),
        ({"start_date": d(-20), "end_date": d(-5)}, {"end_date"}),  # 16 days
        ({"start_date": d(-1), "end_date": d(1)}, {"end_date"}),
        ({"start_date": d(-5), "flow": "spotting"}, {"flow"}),
        ({"start_date": d(-5), "symptoms": ["cramps", "migraine"]}, {"symptoms"}),
        ({"start_date": d(-5), "symptoms": "cramps"}, {"symptoms"}),
        ({"start_date": d(-5), "notes": "x" * 201}, {"notes"}),
        (
            {"start_date": d(2), "flow": "lots", "symptoms": ["hiccups"], "notes": "y" * 300},
            {"start_date", "flow", "symptoms", "notes"},
        ),
    ],
)
def test_period_validation(client, today, body, bad):
    meera = auth(login(client, MEERA))
    assert fields(client.post(f"{P}/periods", headers=meera, json=body)) == bad
    assert client.get(f"{P}/periods", headers=meera).json()["total"] == 0


def test_period_validation_edges_and_patch(client, today):
    meera = auth(login(client, MEERA))
    longest = logged(client, meera, d(-30), d(-16), notes="z" * 200, symptoms=list(reversed([
        "cramps", "headache", "bloating", "mood_changes", "fatigue", "acne", "back_pain", "tender_breasts", "nausea"])))
    assert longest["length_days"] == 15 and len(longest["notes"]) == 200
    assert longest["symptoms"][0] == "cramps" and longest["symptoms"][-1] == "nausea"
    assert logged(client, meera, d(0), d(0))["length_days"] == 1
    # PATCH validates the resulting record.
    url = f"{P}/periods/{longest['id']}"
    assert fields(client.patch(url, headers=meera, json={"end_date": d(-31)})) == {"end_date"}
    assert fields(client.patch(url, headers=meera, json={"start_date": d(-31)})) == {"end_date"}  # now 16 days
    assert fields(client.patch(url, headers=meera, json={"flow": "x", "symptoms": ["y"]})) == {"flow", "symptoms"}
    assert client.patch(url, headers=meera, json={"start_date": d(-29)}).json()["period"]["length_days"] == 14


def test_period_scopes_and_isolation(client, today):
    meera, karthik, ravi = auth(login(client, MEERA)), auth(login(client, KARTHIK)), auth(login(client, RAVI))
    mine = logged(client, meera, "2026-10-01")
    # Karthik on pat_meera: view_records + manage_reminders only.
    assert client.get(f"{P}/periods", headers=karthik).json()["total"] == 1
    for response in (
        log_period(client, karthik, "2026-09-01"),
        client.patch(f"{P}/periods/{mine['id']}", headers=karthik, json={"notes": "x"}),
        client.delete(f"{P}/periods/{mine['id']}", headers=karthik),
    ):
        assert response.status_code == 403 and code(response) == "SCOPE_REQUIRED"
    for response in (client.get(f"{P}/periods", headers=ravi), log_period(client, ravi, "2026-09-01")):
        assert response.status_code == 403 and code(response) == "ACCESS_DENIED"

    # A period ID from another profile is 404 through this profile's path.
    theirs = log_period(client, karthik, "2026-10-01", patient="pat_karthik").json()["period"]
    assert code(client.patch(f"{P}/periods/{theirs['id']}", headers=meera, json={"notes": "x"})) == "NOT_FOUND"
    assert code(client.delete(f"{P}/periods/{theirs['id']}", headers=meera)) == "NOT_FOUND"
    assert client.get(f"{API}/patients/pat_karthik/periods", headers=karthik).json()["total"] == 1


def test_audit_meta_has_no_dates_symptoms_or_notes(client, today):
    meera = auth(login(client, MEERA))
    period = logged(client, meera, "2026-09-02", "2026-09-06", flow="heavy", symptoms=["cramps"], notes="Private note")
    client.patch(f"{P}/periods/{period['id']}", headers=meera, json={"symptoms": ["back_pain"], "notes": "Another note"})
    put_wh(client, meera, mode="pregnancy", lmp_date="2026-07-01", due_date="2027-04-07")
    put_wh(client, meera, mode="postpartum", delivery_date="2026-08-26")
    client.delete(f"{P}/periods/{period['id']}", headers=meera)
    text = all_audit_meta()
    for secret in ("2026-09-02", "2026-09-06", "2026-07-01", "2027-04-07", "2026-08-26", "heavy", "cramps",
                   "back_pain", "Private note", "Another note"):
        assert secret not in text
    labels = {e["action"]: e["action_label"] for e in client.get(f"{P}/audit-events", headers=meera).json()["items"]}
    assert labels["womens_health.updated"] == "Updated women's health settings"
    assert labels["period.logged"] == "Logged a period"
    assert labels["period.updated"] == "Changed a period entry"
    assert labels["period.deleted"] == "Deleted a period entry"


# --- API-40/41 sex -------------------------------------------------------------------------


def register(client, **body):
    body = {"email": "asha@example.com", "password": "correct-horse-battery", "display_name": "Asha Iyer", **body}
    return client.post(f"{API}/auth/register", json=body)


def own_details(client, token: str) -> dict:
    headers = auth(token)
    patient_id = client.get(f"{API}/me", headers=headers).json()["owned_patient_id"]
    return client.get(f"{API}/patients/{patient_id}/details", headers=headers).json()["details"]


def test_register_stores_sex_in_details(client):
    response = register(client, sex=" Female ")
    assert response.status_code == 201, response.text
    assert set(response.json()) == {"token", "token_type", "expires_at", "user"}
    details = own_details(client, response.json()["token"])
    assert details["sex"] == "female" and details["relationship"] == "self"

    for i, sex in enumerate((None, "")):
        created = register(client, email=f"user{i}@example.com", sex=sex)
        assert created.status_code == 201 and own_details(client, created.json()["token"])["sex"] is None
    no_key = register(client, email="nokey@example.com")
    assert no_key.status_code == 201 and own_details(client, no_key.json()["token"])["sex"] is None


def test_register_rejects_an_unknown_sex(client):
    from app.models import User

    assert fields(register(client, sex="unknown")) == {"sex"}
    assert fields(register(client, sex=1)) == {"sex"}
    assert fields(register(client, email="nope", password="short", sex="x")) == {"email", "password", "sex"}
    with db() as session:
        assert session.exec(select(User).where(User.email == "asha@example.com")).first() is None


def test_family_profile_stores_sex(client):
    meera = auth(login(client, MEERA))

    def create(**body):
        return client.post(f"{API}/patients", headers=meera, json={"display_name": "Lakshmi", "relationship": "parent", **body})

    created = create(sex="FEMALE")
    assert created.status_code == 201, created.text
    patient = created.json()["patient"]
    assert "sex" not in patient  # the response shape is unchanged
    details = client.get(f"{API}/patients/{patient['id']}/details", headers=meera).json()["details"]
    assert (details["sex"], details["relationship"]) == ("female", "parent")
    other = create(sex="other").json()["patient"]["id"]
    assert client.get(f"{API}/patients/{other}/details", headers=meera).json()["details"]["sex"] == "other"
    unset = create().json()["patient"]["id"]
    assert client.get(f"{API}/patients/{unset}/details", headers=meera).json()["details"]["sex"] is None

    assert fields(create(sex="woman")) == {"sex"}
    assert fields(create(sex="woman", display_name=" ")) == {"sex", "display_name"}
    assert client.get(f"{API}/patients", headers=meera).json()["total"] == 4


# --- API-61 voice additions ----------------------------------------------------------------


def voice_ready(client, monkeypatch, headers, female_voice=""):
    from app import config

    monkeypatch.setenv("ELEVENLABS_AGENT_ID", "agent_public_1")
    monkeypatch.setenv("ELEVENLABS_FEMALE_VOICE_ID", female_voice)
    config.get_settings.cache_clear()
    consent = client.post(f"{API}/me/consents", headers=headers,
                          json={"consent_type": "voice_input", "granted": True, "policy_version": POLICY})
    assert consent.status_code == 201


def session_for(client, headers, patient="pat_meera") -> dict:
    response = client.post(f"{API}/patients/{patient}/voice/session", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_voice_variables_carry_sex_and_womens_health(client, monkeypatch, today):
    meera = auth(login(client, MEERA))
    voice_ready(client, monkeypatch, meera)
    body = session_for(client, meera)
    assert body["overrides"] is None
    variables = body["dynamic_variables"]
    assert (variables["patient_sex"], variables["womens_health_mode"], variables["womens_health_context"]) == (
        "not recorded", "off", "Not in use.",
    )

    assert client.put(f"{P}/details", headers=meera, json={"sex": "female"}).status_code == 200
    put_wh(client, meera, mode="pregnancy", lmp_date="2026-07-01")
    body = session_for(client, meera)
    variables = body["dynamic_variables"]
    assert all(isinstance(value, str) for value in variables.values())
    assert variables["patient_sex"] == "female" and variables["womens_health_mode"] == "pregnancy"
    assert variables["womens_health_context"] == PREGNANCY_TEXT
    assert body["overrides"] is None  # no female voice configured

    put_wh(client, meera, mode="cycle")
    logged(client, meera, "2026-09-02", "2026-09-06", symptoms=["cramps"], notes="Private note")
    logged(client, meera, "2026-10-01", "2026-10-05")
    variables = session_for(client, meera)["dynamic_variables"]
    assert variables["womens_health_mode"] == "cycle"
    assert variables["womens_health_context"].startswith("Period tracker: cycle day 11. Last period started 01 Oct 2026.")
    text = " ".join(variables.values())
    for secret in ("cramps", "Private note", "fertile"):
        assert secret not in text


def test_voice_female_override(client, monkeypatch, today):
    meera, karthik = auth(login(client, MEERA)), auth(login(client, KARTHIK))
    voice_ready(client, monkeypatch, meera, female_voice="voice_female_1")
    voice_ready(client, monkeypatch, karthik, female_voice="voice_female_1")
    # Sex not recorded: no override.
    assert session_for(client, meera)["overrides"] is None

    client.put(f"{P}/details", headers=meera, json={"sex": "female"})
    expected = {"tts": {"voiceId": "voice_female_1"}}
    assert session_for(client, meera)["overrides"] == expected
    # The profile's sex decides, not the speaker's: Karthik talking about Meera gets it too.
    assert session_for(client, karthik)["overrides"] == expected

    client.put(f"{API}/patients/pat_karthik/details", headers=karthik, json={"sex": "male"})
    own = session_for(client, karthik, patient="pat_karthik")
    assert own["overrides"] is None and own["dynamic_variables"]["patient_sex"] == "male"
    client.put(f"{P}/details", headers=meera, json={"sex": "other"})
    assert session_for(client, meera)["overrides"] is None

    # Without the setting, never an override.
    voice_ready(client, monkeypatch, meera, female_voice="")
    client.put(f"{P}/details", headers=meera, json={"sex": "female"})
    assert session_for(client, meera)["overrides"] is None
    assert "voice_female_1" not in all_audit_meta()
