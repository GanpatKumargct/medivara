"""Women's health calculations (API-62 to API-67, and the API-61 voice context).

Everything here is arithmetic on dates the user entered: a period tracker, a pregnancy tracker
and an after-birth tracker. The results are estimates, never medical advice, and nothing is
labelled normal or abnormal.

"Today" is always `today_ist()`, looked up at call time, so tests can freeze it with
`monkeypatch.setattr(app.womens_health, "today_ist", lambda: date(2026, 10, 11))`. Callers
in other modules must call `womens_health.today_ist()` (not a `from … import` copy).
"""

from collections.abc import Sequence
from datetime import date, datetime, timedelta
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from app.models import PeriodLog, WomensHealthSettings, iso_z

IST = ZoneInfo("Asia/Kolkata")

MODES = ("off", "cycle", "pregnancy", "postpartum")
FLOWS = ("light", "medium", "heavy")
# Canonical order: stored symptoms are deduplicated and kept in this order.
SYMPTOMS = (
    "cramps",
    "headache",
    "bloating",
    "mood_changes",
    "fatigue",
    "acne",
    "back_pain",
    "tender_breasts",
    "nausea",
)

PREGNANCY_DAYS = 280  # due date = LMP + 280 days
LUTEAL_DAYS = 14  # ovulation estimate = next period - 14 days
GAP_RANGE = (15, 60)  # gaps between period starts outside this are ignored
RECENT = 6  # averages use the last 6 gaps / lengths
OPEN_PERIOD_DAYS = 6  # a log without an end date covers start + 6 days for overlap checks
TRIMESTERS = ("first", "second", "third")


def today_ist() -> date:
    """Today's date in India, independent of the server's own timezone."""
    return datetime.now(IST).date()


def spoken_date(value: date) -> str:
    """"04 May 2026"."""
    return value.strftime("%d %b %Y")


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" if abs(n) == 1 else f"{n} {word}s"


class _Span(Protocol):
    start_date: date
    end_date: date | None


def period_length(log: _Span) -> int | None:
    """Days from start to end, both included; None while the end isn't recorded."""
    return (log.end_date - log.start_date).days + 1 if log.end_date else None


def covered_until(log: _Span) -> date:
    """Last day a log covers for overlap checks (an open log covers start + 6 days)."""
    return log.end_date or log.start_date + timedelta(days=OPEN_PERIOD_DAYS)


def overlaps(start: date, end: date | None, other: _Span) -> bool:
    last = end or start + timedelta(days=OPEN_PERIOD_DAYS)
    return start <= covered_until(other) and other.start_date <= last


# --- Summaries -------------------------------------------------------------------------


def cycle_summary(
    logs: Sequence[_Span],
    cycle_length_days: int | None,
    period_length_days: int | None,
    today: date,
) -> dict[str, Any]:
    """Computed from the logs whatever the mode. With no logs, everything but the count is null."""
    ordered = sorted(logs, key=lambda log: log.start_date)
    out: dict[str, Any] = {
        "last_period_start": None,
        "cycle_day": None,
        "average_cycle_days": None,
        "average_period_days": None,
        "next_period_estimate": None,
        "next_period_end_estimate": None,
        "days_until_next_period": None,
        "fertile_window_start": None,
        "fertile_window_end": None,
        "logged_periods": len(ordered),
    }
    if not ordered:
        return out

    last_start = ordered[-1].start_date
    gaps = [(b.start_date - a.start_date).days for a, b in zip(ordered, ordered[1:])]
    kept = [gap for gap in gaps if GAP_RANGE[0] <= gap <= GAP_RANGE[1]][-RECENT:]
    average_cycle = round(sum(kept) / len(kept)) if kept else cycle_length_days
    lengths = [n for n in (period_length(log) for log in ordered) if n is not None][-RECENT:]
    average_period = round(sum(lengths) / len(lengths)) if lengths else period_length_days

    out.update(
        last_period_start=last_start.isoformat(),
        cycle_day=(today - last_start).days + 1,
        average_cycle_days=average_cycle,
        average_period_days=average_period,
    )
    if average_cycle:
        next_start = last_start + timedelta(days=average_cycle)
        ovulation = next_start - timedelta(days=LUTEAL_DAYS)
        out.update(
            next_period_estimate=next_start.isoformat(),
            next_period_end_estimate=(
                (next_start + timedelta(days=average_period - 1)).isoformat() if average_period else None
            ),
            days_until_next_period=(next_start - today).days,
            fertile_window_start=(ovulation - timedelta(days=5)).isoformat(),
            fertile_window_end=(ovulation + timedelta(days=1)).isoformat(),
        )
    return out


def pregnancy_summary(lmp_date: date | None, due_date: date | None, today: date) -> dict[str, Any] | None:
    if lmp_date is None and due_date is None:
        return None
    due = due_date or lmp_date + timedelta(days=PREGNANCY_DAYS)
    lmp = lmp_date or due - timedelta(days=PREGNANCY_DAYS)
    gestation = max(0, (today - lmp).days)
    weeks = gestation // 7
    return {
        "due_date": due.isoformat(),
        "lmp_date": lmp.isoformat(),
        "weeks": weeks,
        "days": gestation % 7,
        "trimester": 1 if weeks < 13 else 2 if weeks < 27 else 3,
        "days_to_go": (due - today).days,
    }


def postpartum_summary(delivery_date: date | None, today: date) -> dict[str, Any] | None:
    if delivery_date is None:
        return None
    days = max(0, (today - delivery_date).days)
    return {"delivery_date": delivery_date.isoformat(), "days_since_delivery": days, "weeks_since_delivery": days // 7}


def voice_context(mode: str, cycle: dict, pregnancy: dict | None, postpartum: dict | None) -> str:
    """One plain-English line for the voice agent. Never the fertile window, symptoms or notes."""
    if mode == "cycle":
        if not cycle["logged_periods"]:
            return "Period tracker is on, but no periods have been logged yet."
        head = (
            f"Period tracker: cycle day {cycle['cycle_day']}. "
            f"Last period started {spoken_date(date.fromisoformat(cycle['last_period_start']))}."
        )
        if cycle["next_period_estimate"] is None:
            return f"{head} There isn't enough information yet to estimate the next period."
        days = cycle["days_until_next_period"]
        when = "today" if days == 0 else f"in {_plural(days, 'day')}" if days > 0 else f"{_plural(-days, 'day')} late"
        return (
            f"{head} Next period estimated around {spoken_date(date.fromisoformat(cycle['next_period_estimate']))} "
            f"({when}). Average cycle {cycle['average_cycle_days']} days. "
            "These are estimates from dates the user entered, not medical advice."
        )
    if mode == "pregnancy" and pregnancy is not None:
        due = spoken_date(date.fromisoformat(pregnancy["due_date"]))
        to_go = pregnancy["days_to_go"]
        due_text = f"Due date {due} has passed." if to_go < 0 else f"Due date {due}, {_plural(to_go, 'day')} to go."
        return (
            f"Pregnancy tracker: week {pregnancy['weeks']} and {_plural(pregnancy['days'], 'day')} "
            f"({TRIMESTERS[pregnancy['trimester'] - 1]} trimester). {due_text} "
            "Calculated from dates the user entered."
        )
    if mode == "postpartum" and postpartum is not None:
        delivered = spoken_date(date.fromisoformat(postpartum["delivery_date"]))
        return f"After-birth tracker: {_plural(postpartum['weeks_since_delivery'], 'week')} since delivery on {delivered}."
    return "Not in use."


def summarise(row: WomensHealthSettings | None, logs: Sequence[_Span], today: date) -> dict[str, Any]:
    mode = row.mode if row else "off"
    cycle = cycle_summary(logs, row.cycle_length_days if row else None, row.period_length_days if row else None, today)
    pregnancy = pregnancy_summary(row.lmp_date, row.due_date, today) if row and mode == "pregnancy" else None
    postpartum = postpartum_summary(row.delivery_date, today) if row and mode == "postpartum" else None
    return {
        "cycle": cycle,
        "pregnancy": pregnancy,
        "postpartum": postpartum,
        "voice_context": voice_context(mode, cycle, pregnancy, postpartum),
    }


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


def womens_health_out(
    patient_id: str, row: WomensHealthSettings | None, logs: Sequence[_Span], today: date | None = None
) -> dict[str, Any]:
    """The WH object (contract §5b, API-62). A missing row reads as mode "off" with nulls."""
    today = today or today_ist()
    return {
        "patient_id": patient_id,
        "mode": row.mode if row else "off",
        "cycle_length_days": row.cycle_length_days if row else None,
        "period_length_days": row.period_length_days if row else None,
        "lmp_date": _iso(row.lmp_date) if row else None,
        "due_date": _iso(row.due_date) if row else None,
        "delivery_date": _iso(row.delivery_date) if row else None,
        "updated_at": iso_z(row.updated_at) if row else None,
        "summary": summarise(row, logs, today),
    }


def load(session: Session, patient_id: str) -> tuple[WomensHealthSettings | None, list[PeriodLog]]:
    row = session.get(WomensHealthSettings, patient_id)
    logs = session.exec(select(PeriodLog).where(PeriodLog.patient_id == patient_id)).all()
    return row, list(logs)


def state(session: Session, patient_id: str) -> dict[str, Any]:
    """Load and summarise one profile's women's health data."""
    row, logs = load(session, patient_id)
    return womens_health_out(patient_id, row, logs)
