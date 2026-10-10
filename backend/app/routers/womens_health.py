"""API-62/63 women's health settings and API-64 to 67 period log.

Self-reported dates only. The summary is date arithmetic from app.womens_health: estimates,
never medical advice, and nothing is labelled normal or abnormal. Audit metadata holds the
mode or the period ID only, never dates, symptoms or notes.
"""

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app import audit
from app import womens_health as wh
from app.access import PatientAccess, load_owned, require_access
from app.db import get_session
from app.errors import ApiError
from app.models import PeriodLog, User, WomensHealthSettings, iso_z, utcnow
from app.routers import API_PREFIX
from app.validation import validation_error

router = APIRouter(prefix=API_PREFIX, tags=["womens-health"])

CYCLE_LENGTH = (21, 45)
PERIOD_LENGTH = (2, 10)
LMP_MAX_AGE_DAYS = 300
DUE_PAST_DAYS = 30
DUE_AHEAD_DAYS = 300
DELIVERY_MAX_AGE_DAYS = 730
MAX_PERIOD_DAYS = 14  # end_date at most start_date + 14 days
MAX_NOTES = 200
PERIOD_OVERLAP = "This overlaps a period you've already logged."


# --- API-62/63 settings ----------------------------------------------------------------


class SettingsIn(BaseModel):
    """A PUT replaces every field: a missing field is stored as null, a missing mode as "off"."""

    mode: str | None = None
    cycle_length_days: int | None = None
    period_length_days: int | None = None
    lmp_date: date | None = None
    due_date: date | None = None
    delivery_date: date | None = None


def _between(value: int | None, bounds: tuple[int, int]) -> bool:
    return value is None or bounds[0] <= value <= bounds[1]


def _check_settings(body: SettingsIn, today: date) -> dict[str, Any]:
    problems: list[tuple[str, str]] = []
    mode = (body.mode or "").strip().lower() or "off"
    if mode not in wh.MODES:
        problems.append(("mode", f"must be one of: {', '.join(wh.MODES)}"))
    if not _between(body.cycle_length_days, CYCLE_LENGTH):
        problems.append(("cycle_length_days", f"must be between {CYCLE_LENGTH[0]} and {CYCLE_LENGTH[1]}"))
    if not _between(body.period_length_days, PERIOD_LENGTH):
        problems.append(("period_length_days", f"must be between {PERIOD_LENGTH[0]} and {PERIOD_LENGTH[1]}"))
    if body.lmp_date is not None and not today - timedelta(days=LMP_MAX_AGE_DAYS) <= body.lmp_date <= today:
        problems.append(("lmp_date", f"must be within the last {LMP_MAX_AGE_DAYS} days and not in the future"))
    if body.due_date is not None and not (
        today - timedelta(days=DUE_PAST_DAYS) <= body.due_date <= today + timedelta(days=DUE_AHEAD_DAYS)
    ):
        problems.append(
            ("due_date", f"must be between {DUE_PAST_DAYS} days ago and {DUE_AHEAD_DAYS} days from today")
        )
    if body.delivery_date is not None and not (
        today - timedelta(days=DELIVERY_MAX_AGE_DAYS) <= body.delivery_date <= today
    ):
        problems.append(
            ("delivery_date", f"must be within the last {DELIVERY_MAX_AGE_DAYS} days and not in the future")
        )
    if mode == "pregnancy" and body.lmp_date is None and body.due_date is None:
        problems.append(("lmp_date", "pregnancy mode needs lmp_date or due_date"))
    if mode == "postpartum" and body.delivery_date is None:
        problems.append(("delivery_date", "postpartum mode needs delivery_date"))
    if problems:
        raise validation_error(problems)
    return {
        "mode": mode,
        "cycle_length_days": body.cycle_length_days,
        "period_length_days": body.period_length_days,
        "lmp_date": body.lmp_date,
        "due_date": body.due_date,
        "delivery_date": body.delivery_date,
    }


@router.get("/patients/{patient_id}/womens-health")
def get_womens_health(
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    return {"womens_health": wh.state(session, access.patient.id)}


@router.put("/patients/{patient_id}/womens-health")
def put_womens_health(
    body: SettingsIn,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    clean = _check_settings(body, wh.today_ist())
    patient_id = access.patient.id
    row = session.get(WomensHealthSettings, patient_id) or WomensHealthSettings(patient_id=patient_id)
    for field, value in clean.items():
        setattr(row, field, value)
    row.updated_at = utcnow()
    row.updated_by_user_id = access.current.user.id
    session.add(row)
    session.commit()
    audit.write(
        request,
        "womens_health.updated",
        actor_user_id=access.current.user.id,
        patient_id=patient_id,
        resource_type="womens_health",
        resource_id=patient_id,
        meta={"mode": clean["mode"]},
    )
    return {"womens_health": wh.state(session, patient_id)}


# --- API-64 to 67 period log -------------------------------------------------------------


class PeriodIn(BaseModel):
    start_date: date
    end_date: date | None = None
    flow: str | None = None
    symptoms: list[str] | None = None
    notes: str | None = None


class PeriodPatch(BaseModel):
    """Only the keys present change. Explicit null clears end_date, flow and notes; symptoms null is []."""

    start_date: date | None = None
    end_date: date | None = None
    flow: str | None = None
    symptoms: list[str] | None = None
    notes: str | None = None


def _blank_to_none(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _check_period(
    session: Session,
    patient_id: str,
    values: dict[str, Any],
    problems: list[tuple[str, str]],
    exclude_id: str | None = None,
) -> dict[str, Any]:
    """Validate a whole period record (after a PATCH is applied), then check overlaps (409)."""
    today = wh.today_ist()
    start: date | None = values["start_date"]
    end: date | None = values["end_date"]

    flow = _blank_to_none(values["flow"])
    if flow is not None:
        flow = flow.lower()
        if flow not in wh.FLOWS:
            problems.append(("flow", f"must be one of: {', '.join(wh.FLOWS)}"))

    wanted = {(s or "").strip().lower() for s in values["symptoms"] or []}
    if wanted - set(wh.SYMPTOMS):
        problems.append(("symptoms", f"must only contain: {', '.join(wh.SYMPTOMS)}"))
    symptoms = [s for s in wh.SYMPTOMS if s in wanted]

    notes = _blank_to_none(values["notes"])
    if notes is not None and len(notes) > MAX_NOTES:
        problems.append(("notes", f"must be {MAX_NOTES} characters or fewer"))

    if start is not None and start > today:
        problems.append(("start_date", "can't be in the future"))
    if end is not None and start is not None:
        if end < start:
            problems.append(("end_date", "must not be before start_date"))
        elif end > start + timedelta(days=MAX_PERIOD_DAYS):
            problems.append(("end_date", f"must be within {MAX_PERIOD_DAYS} days of start_date"))
        elif end > today:
            problems.append(("end_date", "can't be in the future"))
    if problems:
        raise validation_error(problems)

    others = session.exec(
        select(PeriodLog).where(PeriodLog.patient_id == patient_id, PeriodLog.id != (exclude_id or ""))
    ).all()
    if any(wh.overlaps(start, end, other) for other in others):
        raise ApiError(409, "PERIOD_OVERLAP", PERIOD_OVERLAP)
    return {"start_date": start, "end_date": end, "flow": flow, "symptoms": symptoms, "notes": notes}


def period_out(log: PeriodLog, names: dict[str, str]) -> dict:
    return {
        "id": log.id,
        "start_date": log.start_date.isoformat(),
        "end_date": log.end_date.isoformat() if log.end_date else None,
        "length_days": wh.period_length(log),
        "flow": log.flow,
        "symptoms": list(log.symptoms or []),
        "notes": log.notes,
        "created_by": {"user_id": log.created_by_user_id, "display_name": names.get(log.created_by_user_id)},
        "created_at": iso_z(log.created_at),
        "updated_at": iso_z(log.updated_at),
    }


def _names(session: Session, user_ids: set[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    return {u.id: u.display_name for u in session.exec(select(User).where(User.id.in_(list(user_ids)))).all()}


def _audit(request: Request, access: PatientAccess, action: str, period_id: str) -> None:
    audit.write(
        request,
        action,
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="period",
        resource_id=period_id,
        meta={"period_id": period_id},
    )


@router.get("/patients/{patient_id}/periods")
def list_periods(
    limit: int = Query(24, ge=1, le=200),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    where = PeriodLog.patient_id == access.patient.id
    total = session.exec(select(func.count()).select_from(PeriodLog).where(where)).one()
    rows = session.exec(
        select(PeriodLog)
        .where(where)
        .order_by(PeriodLog.start_date.desc(), PeriodLog.created_at.desc(), PeriodLog.id.desc())
        .limit(limit)
    ).all()
    names = _names(session, {r.created_by_user_id for r in rows})
    return {"items": [period_out(r, names) for r in rows], "total": total}


@router.post("/patients/{patient_id}/periods", status_code=201)
def log_period(
    body: PeriodIn,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    clean = _check_period(session, access.patient.id, body.model_dump(), [])
    user = access.current.user
    log = PeriodLog(patient_id=access.patient.id, created_by_user_id=user.id, **clean)
    session.add(log)
    session.commit()
    session.refresh(log)
    _audit(request, access, "period.logged", log.id)
    return {"period": period_out(log, {user.id: user.display_name})}


@router.patch("/patients/{patient_id}/periods/{period_id}")
def update_period(
    period_id: str,
    body: PeriodPatch,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    log = load_owned(session, PeriodLog, period_id, access.patient.id)
    values: dict[str, Any] = {
        "start_date": log.start_date,
        "end_date": log.end_date,
        "flow": log.flow,
        "symptoms": list(log.symptoms or []),
        "notes": log.notes,
    }
    sent = body.model_dump(include=body.model_fields_set)
    problems: list[tuple[str, str]] = []
    if "start_date" in sent and sent["start_date"] is None:
        problems.append(("start_date", "is required"))
        sent.pop("start_date")
    values.update(sent)
    clean = _check_period(session, access.patient.id, values, problems, exclude_id=log.id)
    for field, value in clean.items():
        setattr(log, field, value)
    log.updated_at = utcnow()
    session.add(log)
    session.commit()
    session.refresh(log)
    _audit(request, access, "period.updated", log.id)
    return {"period": period_out(log, _names(session, {log.created_by_user_id}))}


@router.delete("/patients/{patient_id}/periods/{period_id}", status_code=204)
def delete_period(
    period_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> Response:
    log = load_owned(session, PeriodLog, period_id, access.patient.id)
    session.delete(log)
    session.commit()
    _audit(request, access, "period.deleted", period_id)
    return Response(status_code=204)
