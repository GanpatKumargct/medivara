"""API-06 GET /patients and API-07 GET /patients/{patient_id}."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case
from sqlmodel import Session, func, select

from app.access import PatientAccess, effective_scopes, require_access
from app.auth import CurrentUser, current_user
from app.db import get_session
from app.models import (
    ConsultationBrief,
    DocumentStatus,
    GrantStatus,
    MedicalDocument,
    PatientAccessGrant,
    PatientProfile,
    Reminder,
    ReminderStatus,
    Role,
    User,
    iso_z,
)
from app.routers import API_PREFIX

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
