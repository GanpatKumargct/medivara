"""API-02 login, API-03 logout, API-04 me, API-05 consents."""

from typing import Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app import audit
from app.auth import CurrentUser, current_user, issue_session, verify_password
from app.config import get_settings
from app.consents import latest_consent, onboarding_required
from app.db import get_session
from app.errors import ApiError
from app.models import AuditOutcome, ConsentRecord, ConsentType, PatientProfile, User, iso_z, utcnow
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["auth"])

LOGIN_FAILED = "That email and password don't match a MediVara account."


def user_summary(user: User) -> dict:
    return {"id": user.id, "email": user.email, "display_name": user.display_name, "is_demo": user.is_demo}


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


@router.post("/auth/login")
def login(body: LoginRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    email = body.email.strip().lower()
    user = session.exec(select(User).where(User.email == email)).first()
    if not verify_password(user.password_hash if user else None, body.password):
        audit.write(
            request,
            "auth.login_failed",
            AuditOutcome.denied,
            actor_user_id=user.id if user else None,
        )
        raise ApiError(401, "INVALID_CREDENTIALS", LOGIN_FAILED)

    token, row = issue_session(session, user)
    user.last_login_at = row.created_at
    session.add(user)
    session.commit()
    audit.write(request, "auth.login", actor_user_id=user.id, resource_type="session", resource_id=row.id)
    return {
        "token": token,
        "token_type": "bearer",
        "expires_at": iso_z(row.expires_at),
        "user": user_summary(user),
    }


@router.post("/auth/logout", status_code=204)
def logout(
    request: Request,
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> Response:
    row = current.auth_session
    row.revoked_at = utcnow()
    session.add(row)
    session.commit()
    audit.write(request, "auth.logout", actor_user_id=current.user.id, resource_type="session", resource_id=row.id)
    return Response(status_code=204)


_ME_CONSENT_TYPES = (
    ConsentType.terms_and_disclaimer,
    ConsentType.ai_processing,
    ConsentType.voice_input,
    ConsentType.notifications,
)


@router.get("/me")
def me(current: CurrentUser = Depends(current_user), session: Session = Depends(get_session)) -> dict:
    user = current.user
    owned = session.exec(select(PatientProfile).where(PatientProfile.owner_user_id == user.id)).first()
    consents = {}
    for consent_type in _ME_CONSENT_TYPES:
        record = latest_consent(session, user.id, consent_type)
        consents[consent_type.value] = (
            {"granted": record.granted, "policy_version": record.policy_version, "at": iso_z(record.created_at)}
            if record
            else None
        )
    return {
        "user": user_summary(user),
        "owned_patient_id": owned.id if owned else None,
        "current_policy_version": get_settings().policy_version,
        "onboarding_required": onboarding_required(session, user.id),
        "consents": consents,
    }


class ConsentRequest(BaseModel):
    # `sharing` is recorded only by API-24 (grant access).
    consent_type: Literal["terms_and_disclaimer", "ai_processing", "voice_input", "notifications"]
    granted: bool
    policy_version: str


@router.post("/me/consents", status_code=201)
def record_consent(
    body: ConsentRequest,
    request: Request,
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    if body.policy_version != get_settings().policy_version:
        raise ApiError(
            422,
            "VALIDATION_ERROR",
            "Some fields need attention.",
            {"fields": [{"field": "policy_version", "issue": "must equal the current policy version"}]},
        )
    record = ConsentRecord(
        user_id=current.user.id,
        consent_type=ConsentType(body.consent_type),
        granted=body.granted,
        policy_version=body.policy_version,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    audit.write(
        request,
        "consent.recorded",
        actor_user_id=current.user.id,
        resource_type="consent",
        resource_id=record.id,
        meta={"consent_type": record.consent_type.value, "granted": record.granted},
    )
    return {
        "consent": {
            "id": record.id,
            "consent_type": record.consent_type.value,
            "granted": record.granted,
            "policy_version": record.policy_version,
            "patient_id": record.patient_id,
            "created_at": iso_z(record.created_at),
        }
    }
