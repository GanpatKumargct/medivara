"""Per-patient access guard (FR-005, SRD 07 §4).

Order on every patient-scoped request:
1. active grant for (patient in the path, current user), looked up per request and never cached;
2. required scope, or the owner-only rule;
3. child resources loaded through load_owned(), filtered by both their ID and the patient ID.
Every denial writes an `access.denied` audit event.
"""

from dataclasses import dataclass
from typing import TypeVar

from fastapi import Depends, Request
from sqlmodel import Session, SQLModel, select

from app import audit
from app.auth import CurrentUser, current_user
from app.db import get_session
from app.errors import ApiError
from app.models import ALL_SCOPES, AuditOutcome, GrantStatus, PatientAccessGrant, PatientProfile, Role

M = TypeVar("M", bound=SQLModel)


@dataclass
class PatientAccess:
    current: CurrentUser
    patient: PatientProfile
    grant: PatientAccessGrant

    @property
    def role(self) -> Role:
        return self.grant.role

    @property
    def scopes(self) -> list[str]:
        return effective_scopes(self.grant)


def effective_scopes(grant: PatientAccessGrant) -> list[str]:
    return list(ALL_SCOPES) if grant.role == Role.owner else list(grant.scopes)


def active_grant(session: Session, patient_id: str, user_id: str) -> PatientAccessGrant | None:
    return session.exec(
        select(PatientAccessGrant).where(
            PatientAccessGrant.patient_id == patient_id,
            PatientAccessGrant.grantee_user_id == user_id,
            PatientAccessGrant.status == GrantStatus.active,
        )
    ).first()


def _deny(request: Request, user_id: str, patient_id: str, status: int, code: str, message: str, details: dict | None = None):
    audit.write(
        request,
        "access.denied",
        AuditOutcome.denied,
        actor_user_id=user_id,
        patient_id=patient_id,
        resource_type="patient",
        resource_id=patient_id,
        meta={"code": code, **(details or {})},
    )
    raise ApiError(status, code, message, details)


def require_access(scope: str | None = "view_records", owner_only: bool = False):
    """Dependency factory for routes with a `{patient_id}` path parameter."""

    def dependency(
        patient_id: str,
        request: Request,
        current: CurrentUser = Depends(current_user),
        session: Session = Depends(get_session),
    ) -> PatientAccess:
        user_id = current.user.id
        grant = active_grant(session, patient_id, user_id)
        patient = session.get(PatientProfile, patient_id) if grant else None
        # A missing profile is reported like a missing grant, so IDs can't be probed.
        if grant is None or patient is None:
            _deny(request, user_id, patient_id, 403, "ACCESS_DENIED", "You don't have access to this profile.")
        if owner_only and grant.role != Role.owner:
            _deny(request, user_id, patient_id, 403, "OWNER_ONLY", "Only the profile owner can do this.")
        if scope is not None and scope not in effective_scopes(grant):
            _deny(
                request,
                user_id,
                patient_id,
                403,
                "SCOPE_REQUIRED",
                "You don't have permission to do this on this profile.",
                {"required_scope": scope},
            )
        return PatientAccess(current=current, patient=patient, grant=grant)

    return dependency


def load_owned(session: Session, model: type[M], resource_id: str, patient_id: str) -> M:
    """Load a child resource only if it belongs to the patient in the path (404 otherwise)."""
    row = session.exec(
        select(model).where(model.id == resource_id, model.patient_id == patient_id)  # type: ignore[attr-defined]
    ).first()
    if row is None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that.")
    return row
