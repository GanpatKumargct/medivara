"""Consent state helpers (FR-003). The latest record per (user, type, patient) wins."""

from sqlmodel import Session, select

from app.config import get_settings
from app.errors import ApiError
from app.models import ConsentRecord, ConsentType, PatientProfile


def latest_consent(
    session: Session, user_id: str, consent_type: ConsentType, patient_id: str | None = None
) -> ConsentRecord | None:
    return session.exec(
        select(ConsentRecord)
        .where(
            ConsentRecord.user_id == user_id,
            ConsentRecord.consent_type == consent_type,
            ConsentRecord.patient_id == patient_id,
        )
        .order_by(ConsentRecord.created_at.desc(), ConsentRecord.id.desc())
    ).first()


def has_current_consent(session: Session, user_id: str, consent_type: ConsentType) -> bool:
    record = latest_consent(session, user_id, consent_type)
    return bool(record and record.granted and record.policy_version == get_settings().policy_version)


def onboarding_required(session: Session, user_id: str) -> bool:
    return not (
        has_current_consent(session, user_id, ConsentType.terms_and_disclaimer)
        and has_current_consent(session, user_id, ConsentType.ai_processing)
    )


def require_ai_consent(session: Session, patient: PatientProfile) -> None:
    """Uploads need the profile owner's current AI-processing consent (used by API-08)."""
    if not has_current_consent(session, patient.owner_user_id, ConsentType.ai_processing):
        raise ApiError(
            403,
            "CONSENT_REQUIRED",
            "The profile owner hasn't agreed to AI processing yet.",
            {"consent_type": ConsentType.ai_processing.value},
        )
