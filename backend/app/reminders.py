"""Reminder schedules (FR-070 to FR-074). Local wall-clock values plus an IANA timezone;
the server computes `next_due_at` in UTC. The MVP accepts only Asia/Kolkata (IST)."""

import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.errors import ApiError
from app.models import Reminder, as_utc
from app.pipeline.normalize import display_date

TIMEZONE = "Asia/Kolkata"
TZ = ZoneInfo(TIMEZONE)
TZ_LABEL = "IST"
HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_DAILY_TIMES = 4
SCHEDULE_KEYS = ("date", "time", "times", "start_date", "end_date")


def field_error(field: str, issue: str) -> ApiError:
    return ApiError(422, "VALIDATION_ERROR", "Some fields need attention.", {"fields": [{"field": field, "issue": issue}]})


def today_local(now: datetime) -> date:
    return now.astimezone(TZ).date()


def today_ist() -> date:
    """Today's date in India, independent of the server's own timezone."""
    return today_local(datetime.now(timezone.utc))


def _parse_date(value, field: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise field_error(field, "must be a date (YYYY-MM-DD)") from None


def _parse_time(value, field: str) -> time:
    if not isinstance(value, str) or not HHMM.match(value):
        raise field_error(field, "must be a time in HH:MM")
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def normalise_schedule(kind: str, raw: dict, now: datetime) -> dict:
    """Validate and return a schedule with every key present (null when not used)."""
    raw = raw or {}
    out = {key: None for key in SCHEDULE_KEYS}
    if kind == "once":
        if not raw.get("date") or not raw.get("time"):
            raise field_error("schedule", "a one-off reminder needs a date and a time")
        day = _parse_date(raw["date"], "schedule.date")
        _parse_time(raw["time"], "schedule.time")
        if day < today_local(now):
            raise field_error("schedule.date", "must be today or later")
        out.update(date=day.isoformat(), time=raw["time"])
    elif kind == "daily":
        times = raw.get("times")
        if not isinstance(times, list) or not 1 <= len(times) <= MAX_DAILY_TIMES:
            raise field_error("schedule.times", f"must list 1 to {MAX_DAILY_TIMES} times")
        for t in times:
            _parse_time(t, "schedule.times")
        if len(set(times)) != len(times):
            raise field_error("schedule.times", "must not repeat a time")
        if not raw.get("start_date"):
            raise field_error("schedule.start_date", "is required for a daily reminder")
        start = _parse_date(raw["start_date"], "schedule.start_date")
        end = _parse_date(raw["end_date"], "schedule.end_date") if raw.get("end_date") else None
        if end and end < start:
            raise field_error("schedule.end_date", "must not be before the start date")
        out.update(times=sorted(times), start_date=start.isoformat(), end_date=end.isoformat() if end else None)
    else:
        raise field_error("schedule_kind", "must be once or daily")
    return out


def _local(day: date, hhmm: str) -> datetime:
    hours, minutes = hhmm.split(":")
    return datetime.combine(day, time(int(hours), int(minutes)), tzinfo=TZ)


def next_due(kind: str, schedule: dict, after: datetime, inclusive: bool = True) -> datetime | None:
    """The next scheduled moment (UTC) at or after `after` (strictly after when not inclusive)."""
    if kind == "once":
        return _local(date.fromisoformat(schedule["date"]), schedule["time"]).astimezone(timezone.utc)
    start = date.fromisoformat(schedule["start_date"])
    end = date.fromisoformat(schedule["end_date"]) if schedule.get("end_date") else None
    day = max(start, after.astimezone(TZ).date())
    for _ in range(366 * 2):
        if end and day > end:
            return None
        for hhmm in schedule["times"]:
            moment = _local(day, hhmm)
            if moment > after or (inclusive and moment == after):
                return moment.astimezone(timezone.utc)
        day += timedelta(days=1)
    return None


def local_label(moment: datetime | None) -> str | None:
    """"27 Oct 2026, 10:00 IST"."""
    if moment is None:
        return None
    local = as_utc(moment).astimezone(TZ)
    return f"{display_date(local.date())}, {local:%H:%M} {TZ_LABEL}"


def is_upcoming(reminder: Reminder) -> bool:
    return reminder.status.value == "active" and reminder.next_due_at is not None
