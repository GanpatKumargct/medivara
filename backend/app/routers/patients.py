"""API-06 GET /patients, API-07 GET /patients/{patient_id} and API-41 POST /patients."""

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import case
from sqlmodel import Session, func, select

from app import audit
from app.access import PatientAccess, effective_scopes, require_access
from app.auth import CurrentUser, current_user
from app.db import get_session
from app.errors import ApiError
from app.models import (
    ALL_SCOPES,
    ConsultationBrief,
    DocumentStatus,
    GrantStatus,
    MedicalDocument,
    PatientAccessGrant,
    PatientProfile,
    ProfileDetails,
    Reminder,
    ReminderStatus,
    Role,
    User,
    iso_z,
)
from app.routers import API_PREFIX
from app.validation import SEX_ISSUE, SEXES, Relationship, clean_name, clean_sex, validation_error

MAX_OWNED_PROFILES = 10

router = APIRouter(prefix=API_PREFIX, tags=["patients"])


def patient_stats(session: Session, patient_id: str) -> dict:
    by_status = dict(
        session.exec(
            select(MedicalDocument.status, func.count())
            .where(MedicalDocument.patient_id == patient_id)
            .group_by(MedicalDocument.status)
        ).all()
    )
    upcoming = session.exec(
        select(func.count()).select_from(Reminder).where(
            Reminder.patient_id == patient_id,
            Reminder.status == ReminderStatus.active,
            Reminder.next_due_at.is_not(None),
        )
    ).one()
    latest_brief = session.exec(
        select(func.max(ConsultationBrief.created_at)).where(ConsultationBrief.patient_id == patient_id)
    ).one()
    return {
        "documents_total": sum(by_status.values()),
        "documents_needs_review": by_status.get(DocumentStatus.needs_review, 0),
        "documents_processing": by_status.get(DocumentStatus.queued, 0) + by_status.get(DocumentStatus.processing, 0),
        "documents_failed": by_status.get(DocumentStatus.failed, 0),
        "upcoming_reminders": upcoming,
        "latest_brief_at": iso_z(latest_brief),
    }


def patient_summary(session: Session, patient: PatientProfile, grant: PatientAccessGrant) -> dict:
    owner = session.get(User, patient.owner_user_id)
    return {
        "id": patient.id,
        "display_name": patient.display_name,
        "age_years": patient.age_years,
        "is_synthetic": patient.is_synthetic,
        "my_role": grant.role.value,
        "scopes": effective_scopes(grant),
        "owner_display_name": owner.display_name if owner else None,
        "stats": patient_stats(session, patient.id),
    }


@router.get("/patients")
def list_patients(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    where = (
        PatientAccessGrant.grantee_user_id == current.user.id,
        PatientAccessGrant.status == GrantStatus.active,
    )
    total = session.exec(select(func.count()).select_from(PatientAccessGrant).where(*where)).one()
    rows = session.exec(
        select(PatientAccessGrant, PatientProfile)
        .join(PatientProfile, PatientProfile.id == PatientAccessGrant.patient_id)
        .where(*where)
        # Own profile first, then shared profiles by name. Explicit CASE: Postgres sorts native
        # enums by declaration order, SQLite by text, so "role DESC" differs between them.
        .order_by(case((PatientAccessGrant.role == Role.owner, 0), else_=1), PatientProfile.display_name)
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "items": [patient_summary(session, patient, grant) for grant, patient in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/patients/{patient_id}")
def get_patient(
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    return {
        **patient_summary(session, access.patient, access.grant),
        "created_at": iso_z(access.patient.created_at),
    }


class PatientCreate(BaseModel):
    display_name: str
    age_years: int | None = Field(None, ge=0, le=130)
    relationship: Relationship
    # Stored in the profile's Medical ID; optional.
    sex: str | None = None


@router.post("/patients", status_code=201)
def create_patient(
    body: PatientCreate,
    request: Request,
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    """API-41: a family member's profile, owned and managed by the current user."""
    display_name = clean_name(body.display_name)
    sex = clean_sex(body.sex)
    problems: list[tuple[str, str]] = []
    if not 1 <= len(display_name) <= 80:
        problems.append(("display_name", "must be between 1 and 80 characters"))
    if sex is not None and sex not in SEXES:
        problems.append(("sex", SEX_ISSUE))
    if problems:
        raise validation_error(problems)
    user = current.user
    owned = session.exec(
        select(func.count()).select_from(PatientProfile).where(PatientProfile.owner_user_id == user.id)
    ).one()
    if owned >= MAX_OWNED_PROFILES:
        raise ApiError(409, "PROFILE_LIMIT", f"You can manage up to {MAX_OWNED_PROFILES} profiles.")
    patient = PatientProfile(
        owner_user_id=user.id, display_name=display_name, age_years=body.age_years, is_synthetic=True
    )
    session.add(patient)
    session.flush()
    grant = PatientAccessGrant(
        patient_id=patient.id,
        grantee_user_id=user.id,
        role=Role.owner,
        scopes=list(ALL_SCOPES),
        granted_by_user_id=user.id,
    )
    session.add(grant)
    session.add(
        ProfileDetails(patient_id=patient.id, relationship=body.relationship, sex=sex, updated_by_user_id=user.id)
    )
    session.commit()
    session.refresh(patient)
    session.refresh(grant)
    audit.write(
        request,
        "patient.created",
        actor_user_id=user.id,
        patient_id=patient.id,
        resource_type="patient",
        resource_id=patient.id,
    )
    return {"patient": {**patient_summary(session, patient, grant), "created_at": iso_z(patient.created_at)}}
