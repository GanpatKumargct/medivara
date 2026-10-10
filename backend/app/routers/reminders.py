"""API-27 list, API-28 create, API-29 edit or dismiss, API-30 complete (FR-070 to FR-074)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from app import audit
from app.access import PatientAccess, load_owned, require_access
from app.db import get_session
from app.errors import ApiError
from app.models import ExtractedFact, FactStatus, Reminder, ReminderStatus, ReminderType, User, as_utc, iso_z, utcnow
from app.reminders import TIMEZONE, field_error, local_label, next_due, normalise_schedule
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["reminders"])


class Schedule(BaseModel):
    date: str | None = None
    time: str | None = None
    times: list[str] | None = None
    start_date: str | None = None
    end_date: str | None = None


class ReminderCreate(BaseModel):
    type: Literal["appointment", "medication", "follow_up", "other"]
    title: str = Field(min_length=1, max_length=120)
    notes: str | None = Field(None, max_length=500)
    schedule_kind: Literal["once", "daily"]
    schedule: Schedule
    timezone: str = TIMEZONE
    source_fact_id: str | None = None
    medication_schedule_attested: bool = False


class ReminderPatch(BaseModel):
    type: Literal["appointment", "medication", "follow_up", "other"] | None = None
    title: str | None = Field(None, min_length=1, max_length=120)
    notes: str | None = Field(None, max_length=500)
    schedule_kind: Literal["once", "daily"] | None = None
    schedule: Schedule | None = None
    timezone: str | None = None
    source_fact_id: str | None = None
    medication_schedule_attested: bool | None = None
    status: Literal["dismissed", "active"] | None = None


def reminder_out(session: Session, r: Reminder) -> dict:
    creator = session.get(User, r.created_by_user_id)
    return {
        "id": r.id,
        "type": r.type.value,
        "title": r.title,
        "notes": r.notes,
        "schedule_kind": r.schedule_kind,
        "schedule": r.schedule,
        "timezone": r.timezone,
        "next_due_at": iso_z(r.next_due_at),
        "next_due_local": local_label(r.next_due_at),
        "last_completed_at": iso_z(r.last_completed_at),
        "status": r.status.value,
        "source_fact_id": r.source_fact_id,
        "medication_schedule_attested": r.medication_schedule_attested,
        "created_by": {"user_id": r.created_by_user_id, "display_name": creator.display_name if creator else None},
        "created_at": iso_z(r.created_at),
    }


def _check_rules(session: Session, patient_id: str, data: dict) -> None:
    if data["timezone"] != TIMEZONE:
        raise field_error("timezone", f"only {TIMEZONE} is supported in this prototype")
    title = (data["title"] or "").strip()
    if not 1 <= len(title) <= 120:
        raise field_error("title", "must be between 1 and 120 characters")
    data["title"] = title
    if data["type"] == "medication" and not data["medication_schedule_attested"]:
        # COPY-24: the user enters the schedule exactly as their doctor or pharmacist told them.
        raise field_error("medication_schedule_attested", "must be confirmed for a medication reminder")
    if data.get("source_fact_id"):
        fact = session.exec(
            select(ExtractedFact).where(
                ExtractedFact.id == data["source_fact_id"],
                ExtractedFact.patient_id == patient_id,
                ExtractedFact.status != FactStatus.rejected,
            )
        ).first()
        if fact is None:
            raise field_error("source_fact_id", "must be an item from this profile's documents")


def _audit(request, access: PatientAccess, action: str, reminder: Reminder, **meta) -> None:
    audit.write(
        request,
        action,
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="reminder",
        resource_id=reminder.id,
        meta={"type": reminder.type.value, **meta},
    )


@router.get("/patients/{patient_id}/reminders")
def list_reminders(
    status: Literal["active", "completed", "dismissed", "all"] = Query("active"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    where = [Reminder.patient_id == access.patient.id]
    if status != "all":
        where.append(Reminder.status == ReminderStatus(status))
    total = session.exec(select(func.count()).select_from(Reminder).where(*where)).one()
    rows = session.exec(
        select(Reminder)
        .where(*where)
        .order_by(Reminder.next_due_at.is_(None), Reminder.next_due_at, Reminder.created_at)
        .offset(offset)
        .limit(limit)
    ).all()
    return {"items": [reminder_out(session, r) for r in rows], "total": total, "limit": limit, "offset": offset}


@router.post("/patients/{patient_id}/reminders", status_code=201)
def create_reminder(
    body: ReminderCreate,
    request: Request,
    access: PatientAccess = Depends(require_access("manage_reminders")),
    session: Session = Depends(get_session),
) -> dict:
    data = body.model_dump()
    _check_rules(session, access.patient.id, data)
    now = utcnow()
    schedule = normalise_schedule(data["schedule_kind"], data["schedule"], now)
    reminder = Reminder(
        patient_id=access.patient.id,
        created_by_user_id=access.current.user.id,
        type=ReminderType(data["type"]),
        title=data["title"],
        notes=(data["notes"] or "").strip() or None,
        schedule_kind=data["schedule_kind"],
        schedule=schedule,
        timezone=data["timezone"],
        next_due_at=next_due(data["schedule_kind"], schedule, now),
        source_fact_id=data["source_fact_id"],
        medication_schedule_attested=data["medication_schedule_attested"],
    )
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    _audit(request, access, "reminder.created", reminder, from_document=bool(reminder.source_fact_id))
    return {"reminder": reminder_out(session, reminder)}


@router.patch("/patients/{patient_id}/reminders/{reminder_id}")
def update_reminder(
    reminder_id: str,
    body: ReminderPatch,
    request: Request,
    access: PatientAccess = Depends(require_access("manage_reminders")),
    session: Session = Depends(get_session),
) -> dict:
    reminder = load_owned(session, Reminder, reminder_id, access.patient.id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise field_error("body", "at least one field is required")
    if reminder.status == ReminderStatus.completed:
        raise ApiError(409, "INVALID_STATE", "A completed reminder can't be changed.")
    current = {
        "type": reminder.type.value,
        "title": reminder.title,
        "notes": reminder.notes,
        "schedule_kind": reminder.schedule_kind,
        "schedule": reminder.schedule,
        "timezone": reminder.timezone,
        "source_fact_id": reminder.source_fact_id,
        "medication_schedule_attested": reminder.medication_schedule_attested,
    }
    status = changes.pop("status", None)
    merged = {**current, **{k: v for k, v in changes.items()}}
    if merged["schedule"] is None:
        raise field_error("schedule", "is required")
    _check_rules(session, access.patient.id, merged)
    now = utcnow()
    schedule_changed = "schedule" in changes or "schedule_kind" in changes
    schedule = normalise_schedule(merged["schedule_kind"], merged["schedule"], now) if schedule_changed else reminder.schedule

    reminder.type = ReminderType(merged["type"])
    reminder.title = merged["title"]
    reminder.notes = (merged["notes"] or "").strip() or None
    reminder.schedule_kind = merged["schedule_kind"]
    reminder.schedule = schedule
    reminder.timezone = merged["timezone"]
    reminder.source_fact_id = merged["source_fact_id"]
    reminder.medication_schedule_attested = merged["medication_schedule_attested"]
    if status:
        reminder.status = ReminderStatus(status)
    if schedule_changed or status == "active":
        reminder.next_due_at = next_due(reminder.schedule_kind, schedule, now)
    reminder.updated_at = now
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    _audit(request, access, "reminder.updated", reminder, fields=sorted(changes) + (["status"] if status else []))
    return {"reminder": reminder_out(session, reminder)}


@router.post("/patients/{patient_id}/reminders/{reminder_id}/complete")
def complete_reminder(
    reminder_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access("manage_reminders")),
    session: Session = Depends(get_session),
) -> dict:
    reminder = load_owned(session, Reminder, reminder_id, access.patient.id)
    if reminder.status != ReminderStatus.active:
        raise ApiError(409, "INVALID_STATE", "Only an active reminder can be marked done.")
    now = utcnow()
    reminder.last_completed_at = now
    if reminder.schedule_kind == "once" or reminder.next_due_at is None:
        reminder.status = ReminderStatus.completed
    else:
        # Daily: move on to the next scheduled time after the one just completed.
        following = next_due("daily", reminder.schedule, as_utc(reminder.next_due_at), inclusive=False)
        reminder.next_due_at = following
        if following is None:
            reminder.status = ReminderStatus.completed
    reminder.updated_at = now
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    _audit(request, access, "reminder.completed", reminder)
    return {"reminder": reminder_out(session, reminder)}
