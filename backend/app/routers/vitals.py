"""API-44 list, API-45 record and API-46 delete self-recorded vitals.

Ranges are plausibility checks against typing mistakes only. MediVara never labels a
reading as normal or abnormal, here or anywhere else.
"""

import math
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app import audit
from app.access import PatientAccess, load_owned, require_access
from app.db import get_session
from app.models import User, VitalReading, as_utc, iso_z, utcnow
from app.routers import API_PREFIX
from app.validation import validation_error

router = APIRouter(prefix=API_PREFIX, tags=["vitals"])

Kind = Literal["blood_pressure", "blood_sugar", "weight", "heart_rate", "spo2", "temperature"]
# kind → {unit: (min, max)} for `value`.
UNITS: dict[str, dict[str, tuple[float, float]]] = {
    "blood_pressure": {"mmHg": (50, 260)},
    "blood_sugar": {"mg/dL": (20, 600)},
    "weight": {"kg": (1, 300)},
    "heart_rate": {"bpm": (20, 250)},
    "spo2": {"%": (50, 100)},
    "temperature": {"°C": (30, 45), "°F": (86, 113)},
}
DIASTOLIC = (30, 160)
SUGAR_CONTEXTS = ("fasting", "post_meal", "random")
MAX_NOTES = 200
FUTURE_SLACK = timedelta(minutes=5)


class VitalIn(BaseModel):
    kind: Kind
    value: float
    value2: float | None = None
    unit: str
    measured_at: datetime
    context: str | None = None
    notes: str | None = None


def _num(value: float) -> str:
    return f"{value:g}"


def _in_range(value: float, bounds: tuple[float, float]) -> bool:
    return math.isfinite(value) and bounds[0] <= value <= bounds[1]


def _check(body: VitalIn) -> dict:
    problems: list[tuple[str, str]] = []
    units = UNITS[body.kind]
    bounds = units.get(body.unit)
    if bounds is None:
        problems.append(("unit", f"must be {' or '.join(units)} for {body.kind}"))
    elif not _in_range(body.value, bounds):
        problems.append(("value", f"must be between {_num(bounds[0])} and {_num(bounds[1])} {body.unit}"))

    if body.kind == "blood_pressure":
        if body.value2 is None:
            problems.append(("value2", "is required for blood_pressure (the diastolic value)"))
        elif not _in_range(body.value2, DIASTOLIC):
            problems.append(("value2", f"must be between {DIASTOLIC[0]} and {DIASTOLIC[1]} mmHg"))
    elif body.value2 is not None:
        problems.append(("value2", "is only used for blood_pressure"))

    context = (body.context or "").strip() or None
    if context is not None:
        if body.kind != "blood_sugar":
            problems.append(("context", "is only used for blood_sugar"))
        elif context not in SUGAR_CONTEXTS:
            problems.append(("context", f"must be one of: {', '.join(SUGAR_CONTEXTS)}"))

    notes = (body.notes or "").strip() or None
    if notes is not None and len(notes) > MAX_NOTES:
        problems.append(("notes", f"must be {MAX_NOTES} characters or fewer"))

    measured_at = body.measured_at
    if measured_at.tzinfo is None or measured_at.utcoffset() is None:
        problems.append(("measured_at", "must include a timezone offset or Z"))
    elif as_utc(measured_at) > utcnow() + FUTURE_SLACK:
        problems.append(("measured_at", "can't be in the future"))

    if problems:
        raise validation_error(problems)
    return {"context": context, "notes": notes, "measured_at": as_utc(measured_at)}


def vital_out(v: VitalReading, names: dict[str, str]) -> dict:
    return {
        "id": v.id,
        "kind": v.kind,
        "value": v.value,
        "value2": v.value2,
        "unit": v.unit,
        "context": v.context,
        "notes": v.notes,
        "measured_at": iso_z(v.measured_at),
        "created_by": {"user_id": v.created_by_user_id, "display_name": names.get(v.created_by_user_id)},
        "created_at": iso_z(v.created_at),
    }


def _names(session: Session, user_ids: set[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    return {u.id: u.display_name for u in session.exec(select(User).where(User.id.in_(list(user_ids)))).all()}


@router.get("/patients/{patient_id}/vitals")
def list_vitals(
    kind: Kind | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    where = [VitalReading.patient_id == access.patient.id]
    if kind is not None:
        where.append(VitalReading.kind == kind)
    total = session.exec(select(func.count()).select_from(VitalReading).where(*where)).one()
    rows = session.exec(
        select(VitalReading)
        .where(*where)
        .order_by(VitalReading.measured_at.desc(), VitalReading.created_at.desc(), VitalReading.id.desc())
        .limit(limit)
    ).all()
    names = _names(session, {r.created_by_user_id for r in rows})
    return {"items": [vital_out(r, names) for r in rows], "total": total}


@router.post("/patients/{patient_id}/vitals", status_code=201)
def record_vital(
    body: VitalIn,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    clean = _check(body)
    user = access.current.user
    vital = VitalReading(
        patient_id=access.patient.id,
        kind=body.kind,
        value=body.value,
        value2=body.value2 if body.kind == "blood_pressure" else None,
        unit=body.unit,
        context=clean["context"],
        notes=clean["notes"],
        measured_at=clean["measured_at"],
        created_by_user_id=user.id,
    )
    session.add(vital)
    session.commit()
    session.refresh(vital)
    # The kind only: never the value, unit or notes.
    audit.write(
        request,
        "vital.recorded",
        actor_user_id=user.id,
        patient_id=access.patient.id,
        resource_type="vital",
        resource_id=vital.id,
        meta={"kind": vital.kind},
    )
    return {"vital": vital_out(vital, {user.id: user.display_name})}


@router.delete("/patients/{patient_id}/vitals/{vital_id}", status_code=204)
def delete_vital(
    vital_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> Response:
    vital = load_owned(session, VitalReading, vital_id, access.patient.id)
    kind = vital.kind
    session.delete(vital)
    session.commit()
    audit.write(
        request,
        "vital.deleted",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="vital",
        resource_id=vital_id,
        meta={"kind": kind},
    )
    return Response(status_code=204)
