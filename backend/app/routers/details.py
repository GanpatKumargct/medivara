"""API-42 GET and API-43 PUT /patients/{patient_id}/details — the profile's Medical ID.

Self-reported and owner-maintained. Nothing here is checked against the documents or
interpreted. A missing row reads as all nulls, so existing profiles need no migration.
"""

import math
import re
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlmodel import Session

from app import audit
from app.access import PatientAccess, require_access
from app.db import get_session
from app.models import ProfileDetails, iso_z, utcnow
from app.reminders import today_ist
from app.routers import API_PREFIX
from app.validation import RELATIONSHIPS, validation_error

router = APIRouter(prefix=API_PREFIX, tags=["details"])

BLOOD_GROUPS = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
SEXES = ("female", "male", "other")
PHONE = re.compile(r"^[0-9+()\- ]+$")
MAX_CONTACTS = 5
MAX_NOTE = 500
NOTE_FIELDS = ("allergies_note", "conditions_note", "medications_note")


class ContactIn(BaseModel):
    name: str | None = None
    phone: str | None = None
    relation: str | None = None


class DetailsIn(BaseModel):
    """A PUT replaces every field; a missing field is stored as null (or [] for contacts)."""

    relationship: str | None = None
    date_of_birth: date | None = None
    sex: str | None = None
    blood_group: str | None = None
    height_cm: float | None = None
    emergency_contacts: list[ContactIn] | None = None
    allergies_note: str | None = None
    conditions_note: str | None = None
    medications_note: str | None = None
    organ_donor: bool | None = None


def details_out(patient_id: str, row: ProfileDetails | None) -> dict:
    if row is None:
        return {
            "patient_id": patient_id,
            "relationship": None,
            "date_of_birth": None,
            "sex": None,
            "blood_group": None,
            "height_cm": None,
            "emergency_contacts": [],
            "allergies_note": None,
            "conditions_note": None,
            "medications_note": None,
            "organ_donor": None,
            "updated_at": None,
        }
    return {
        "patient_id": patient_id,
        "relationship": row.relationship,
        "date_of_birth": row.date_of_birth.isoformat() if row.date_of_birth else None,
        "sex": row.sex,
        "blood_group": row.blood_group,
        "height_cm": row.height_cm,
        "emergency_contacts": list(row.emergency_contacts or []),
        "allergies_note": row.allergies_note,
        "conditions_note": row.conditions_note,
        "medications_note": row.medications_note,
        "organ_donor": row.organ_donor,
        "updated_at": iso_z(row.updated_at),
    }


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _check(body: DetailsIn) -> dict[str, Any]:
    """Validate every field and return the cleaned values, or raise one 422 listing all problems."""
    problems: list[tuple[str, str]] = []
    clean: dict[str, Any] = {}

    relationship = _blank_to_none(body.relationship)
    if relationship is not None:
        relationship = relationship.lower()
        if relationship not in RELATIONSHIPS:
            problems.append(("relationship", f"must be one of: {', '.join(RELATIONSHIPS)}"))
    clean["relationship"] = relationship

    if body.date_of_birth is not None and body.date_of_birth > today_ist():
        problems.append(("date_of_birth", "can't be in the future"))
    clean["date_of_birth"] = body.date_of_birth

    sex = _blank_to_none(body.sex)
    if sex is not None:
        sex = sex.lower()
        if sex not in SEXES:
            problems.append(("sex", f"must be one of: {', '.join(SEXES)}"))
    clean["sex"] = sex

    blood_group = _blank_to_none(body.blood_group)
    if blood_group is not None:
        blood_group = blood_group.upper().replace(" ", "")
        if blood_group not in BLOOD_GROUPS:
            problems.append(("blood_group", f"must be one of: {' '.join(BLOOD_GROUPS)}"))
    clean["blood_group"] = blood_group

    height = body.height_cm
    if height is not None and not (math.isfinite(height) and 30 <= height <= 250):
        problems.append(("height_cm", "must be between 30 and 250"))
    clean["height_cm"] = height

    contacts = body.emergency_contacts or []
    if len(contacts) > MAX_CONTACTS:
        problems.append(("emergency_contacts", f"can have at most {MAX_CONTACTS} contacts"))
    clean_contacts = []
    for i, contact in enumerate(contacts[:MAX_CONTACTS]):
        name = " ".join((contact.name or "").split())
        phone = (contact.phone or "").strip()
        relation = " ".join((contact.relation or "").split())
        if not 1 <= len(name) <= 80:
            problems.append((f"emergency_contacts.{i}.name", "must be between 1 and 80 characters"))
        if not (3 <= len(phone) <= 20 and PHONE.match(phone)):
            problems.append(
                (f"emergency_contacts.{i}.phone", "must be 3 to 20 characters: digits, spaces, + - ( )")
            )
        if len(relation) > 40:
            problems.append((f"emergency_contacts.{i}.relation", "must be 40 characters or fewer"))
        clean_contacts.append({"name": name, "phone": phone, "relation": relation})
    clean["emergency_contacts"] = clean_contacts

    for field in NOTE_FIELDS:
        note = _blank_to_none(getattr(body, field))
        if note is not None and len(note) > MAX_NOTE:
            problems.append((field, f"must be {MAX_NOTE} characters or fewer"))
        clean[field] = note

    clean["organ_donor"] = body.organ_donor
    if problems:
        raise validation_error(problems)
    return clean


@router.get("/patients/{patient_id}/details")
def get_details(
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    row = session.get(ProfileDetails, access.patient.id)
    return {"details": details_out(access.patient.id, row)}


@router.put("/patients/{patient_id}/details")
def put_details(
    body: DetailsIn,
    request: Request,
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    clean = _check(body)
    row = session.get(ProfileDetails, access.patient.id) or ProfileDetails(patient_id=access.patient.id)
    for field, value in clean.items():
        setattr(row, field, value)
    row.updated_at = utcnow()
    row.updated_by_user_id = access.current.user.id
    session.add(row)
    session.commit()
    session.refresh(row)
    audit.write(
        request,
        "profile.details_updated",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="profile_details",
        resource_id=access.patient.id,
    )
    return {"details": details_out(access.patient.id, row)}
