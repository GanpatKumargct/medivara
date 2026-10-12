"""API-02 login, API-03 logout, API-04 me, API-05 consents, API-40 register."""

from typing import Literal

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app import audit, ratelimit
from app.auth import CurrentUser, current_user, hash_password, issue_session, verify_password
from app.config import get_settings
from app.consents import latest_consent, onboarding_required
from app.db import get_session
from app.errors import ApiError
from app.models import (
    ALL_SCOPES,
    AuditOutcome,
    AuthSession,
    ConsentRecord,
    ConsentType,
    PatientAccessGrant,
    PatientProfile,
    ProfileDetails,
    Role,
    User,
    iso_z,
    utcnow,
)
from app.routers import API_PREFIX
from app.validation import SEX_ISSUE, SEXES, clean_name, clean_sex, email_issue, normalise_email, validation_error

router = APIRouter(prefix=API_PREFIX, tags=["auth"])

LOGIN_FAILED = "That email and password don't match a MediVara account."
RATE_LIMITED = "Too many sign-in attempts. Please wait a few minutes and try again."
REGISTER_RATE_LIMITED = "Too many accounts were created from this network. Please wait a few minutes and try again."
EMAIL_TAKEN = "An account already uses this email. Sign in instead."


def user_summary(user: User) -> dict:
    return {"id": user.id, "email": user.email, "display_name": user.display_name, "is_demo": user.is_demo}


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


@router.post("/auth/login")
def login(body: LoginRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    email = body.email.strip().lower()
    ip = ratelimit.client_ip(request)
    # Checked before the user lookup, so the answer is the same for known and unknown emails.
    wait = ratelimit.retry_after_s(email, ip)
    if wait is not None:
        audit.write(request, "auth.rate_limited", AuditOutcome.denied)
        raise ApiError(429, "RATE_LIMITED", RATE_LIMITED, {"retry_after_s": wait}, headers={"Retry-After": str(wait)})
    user = session.exec(select(User).where(User.email == email)).first()
    if not verify_password(user.password_hash if user else None, body.password):
        ratelimit.record_failure(email, ip)
        audit.write(
            request,
            "auth.login_failed",
            AuditOutcome.denied,
            actor_user_id=user.id if user else None,
        )
        raise ApiError(401, "INVALID_CREDENTIALS", LOGIN_FAILED)

    ratelimit.record_success(email)
    token, row = issue_session(session, user)
    user.previous_login_at = user.last_login_at  # "since your last visit" (API-39)
    user.last_login_at = row.created_at
    session.add(user)
    session.commit()
    audit.write(request, "auth.login", actor_user_id=user.id, resource_type="session", resource_id=row.id)
    return session_response(token, row, user)


def session_response(token: str, row: AuthSession, user: User) -> dict:
    """API-02 and API-40 answer with the same shape."""
    return {
        "token": token,
        "token_type": "bearer",
        "expires_at": iso_z(row.expires_at),
        "user": user_summary(user),
    }


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str
    # Stored in the new profile's Medical ID; optional.
    sex: str | None = None


@router.post("/auth/register", status_code=201)
def register(body: RegisterRequest, request: Request, session: Session = Depends(get_session)) -> dict:
    """API-40: create an account with its own profile, then sign in exactly like API-02."""
    ip = ratelimit.client_ip(request)
    wait = ratelimit.registration_retry_after_s(ip)
    if wait is not None:
        audit.write(request, "auth.rate_limited", AuditOutcome.denied, meta={"route": "register"})
        raise ApiError(
            429, "RATE_LIMITED", REGISTER_RATE_LIMITED, {"retry_after_s": wait}, headers={"Retry-After": str(wait)}
        )

    email = normalise_email(body.email)
    display_name = clean_name(body.display_name)
    sex = clean_sex(body.sex)
    problems: list[tuple[str, str]] = []
    if issue := email_issue(email):
        problems.append(("email", issue))
    if not 10 <= len(body.password) <= 128:
        problems.append(("password", "must be between 10 and 128 characters"))
    if not 1 <= len(display_name) <= 80:
        problems.append(("display_name", "must be between 1 and 80 characters"))
    if sex is not None and sex not in SEXES:
        problems.append(("sex", SEX_ISSUE))
    if problems:
        raise validation_error(problems)

    ratelimit.record_registration(ip)
    if session.exec(select(User.id).where(User.email == email)).first() is not None:
        raise ApiError(409, "EMAIL_TAKEN", EMAIL_TAKEN)
    user = User(email=email, password_hash=hash_password(body.password), display_name=display_name, is_demo=False)
    session.add(user)
    try:
        session.flush()
    except IntegrityError:  # registered by a concurrent request
        session.rollback()
        raise ApiError(409, "EMAIL_TAKEN", EMAIL_TAKEN) from None
    # Flush parents first: without ORM relationships, inserts aren't ordered by foreign key.
    patient = PatientProfile(owner_user_id=user.id, display_name=display_name, is_synthetic=True)
    session.add(patient)
    session.flush()
    session.add(
        PatientAccessGrant(
            patient_id=patient.id,
            grantee_user_id=user.id,
            role=Role.owner,
            scopes=list(ALL_SCOPES),
            granted_by_user_id=user.id,
        )
    )
    session.add(ProfileDetails(patient_id=patient.id, relationship="self", sex=sex, updated_by_user_id=user.id))
    token, row = issue_session(session, user)
    user.last_login_at = row.created_at
    session.add(user)
    session.commit()
    session.refresh(user)
    session.refresh(row)
    audit.write(
        request,
        "auth.registered",
        actor_user_id=user.id,
        patient_id=patient.id,
        resource_type="user",
        resource_id=user.id,
    )
    return session_response(token, row, user)


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
    ConsentType.camera_input,
)


@router.get("/me")
def me(current: CurrentUser = Depends(current_user), session: Session = Depends(get_session)) -> dict:
    user = current.user
    # The user's own (first-created) profile; family profiles from API-41 come later.
    owned = session.exec(
        select(PatientProfile)
        .where(PatientProfile.owner_user_id == user.id)
        .order_by(PatientProfile.created_at, PatientProfile.id)
    ).first()
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
        "preferred_language": user.preferred_language,
    }


# Interface languages (DEC-29). Keep in step with Frontend/src/lib/i18n.ts.
LANGUAGES = ("en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "or", "pa")


class PreferencesPatch(BaseModel):
    preferred_language: Literal["en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "or", "pa"]


@router.patch("/me/preferences")
def update_preferences(
    body: PreferencesPatch,
    request: Request,
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    """API-69: the signed-in user's own preferences. Language only for now."""
    user = current.user
    user.preferred_language = body.preferred_language
    session.add(user)
    session.commit()
    audit.write(request, "me.preferences_updated", actor_user_id=user.id, meta={"preferred_language": body.preferred_language})
    return {"preferred_language": user.preferred_language}


class ConsentRequest(BaseModel):
    # `sharing` is recorded only by API-24 (grant access).
    consent_type: Literal["terms_and_disclaimer", "ai_processing", "voice_input", "notifications", "camera_input"]
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
