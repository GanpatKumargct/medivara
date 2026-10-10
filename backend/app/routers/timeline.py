"""API-17 GET /patients/{patient_id}/timeline."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.access import PatientAccess, require_access
from app.db import get_session
from app.errors import ApiError
from app.models import iso_z, utcnow
from app.organise.changes import change_markers
from app.organise.records import load_records
from app.organise.timeline import EVENT_TYPES, build_timeline
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["timeline"])


@router.get("/patients/{patient_id}/timeline")
def get_timeline(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    types: str | None = Query(None),
    include_unverified: bool = Query(True),
    order: Literal["desc", "asc"] = Query("desc"),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    type_list = [t.strip() for t in types.split(",") if t.strip()] if types else None
    if type_list and (bad := [t for t in type_list if t not in EVENT_TYPES]):
        raise ApiError(
            422, "VALIDATION_ERROR", "Some fields need attention.",
            {"fields": [{"field": "types", "issue": f"unknown value: {', '.join(bad)}"}]},
        )
    if date_from and date_to and date_from > date_to:
        raise ApiError(
            422, "VALIDATION_ERROR", "Some fields need attention.",
            {"fields": [{"field": "from", "issue": "must not be after 'to'"}]},
        )
    records = load_records(session, access.patient.id, include_unverified=include_unverified)
    timeline = build_timeline(
        records,
        types=type_list,
        date_from=date_from,
        date_to=date_to,
        descending=order == "desc",
        changes=change_markers(records),
    )
    return {**timeline, "generated_at": iso_z(utcnow())}
