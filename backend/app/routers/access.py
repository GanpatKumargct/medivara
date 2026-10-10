"""API-23 list grants, API-24 grant, API-25 revoke or leave, API-26 access log (FR-080 to FR-084).

Grants are checked on every request and never cached, so a revoke takes effect on the
caregiver's very next call (403 plus an `access.denied` audit event).
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app import audit
from app.access import PatientAccess, active_grant, effective_scopes, require_access
from app.config import get_settings
from app.db import get_session
from app.errors import ApiError
from app.models import (
    AuditEvent,
    ConsentRecord,
    ConsentType,
    GrantStatus,
    PatientAccessGrant,
    Role,
    User,
    iso_z,
    utcnow,
)
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["access"])


def _field_error(field: str, issue: str) -> ApiError:
    return ApiError(422, "VALIDATION_ERROR", "Some fields need attention.", {"fields": [{"field": field, "issue": issue}]})


def grant_out(session: Session, grant: PatientAccessGrant) -> dict:
    user = session.get(User, grant.grantee_user_id)
    return {
        "id": grant.id,
        "grantee": {"user_id": user.id, "display_name": user.display_name, "email": user.email},
        "role": grant.role.value,
        "scopes": effective_scopes(grant),
        "status": grant.status.value,
        "granted_at": iso_z(grant.created_at),
        "revoked_at": iso_z(grant.revoked_at),
    }


@router.get("/patients/{patient_id}/access")
def list_grants(
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    grants = session.exec(select(PatientAccessGrant).where(PatientAccessGrant.patient_id == access.patient.id)).all()
    # Owner first, then active caregivers, then revoked, each oldest first.
    grants = sorted(grants, key=lambda g: (g.role != Role.owner, g.status != GrantStatus.active, g.created_at))
    return {"grants": [grant_out(session, g) for g in grants]}


class GrantRequest(BaseModel):
    grantee_email: str
    scopes: list[Literal["view_records", "upload_documents", "manage_reminders"]]
    consent_confirmed: bool
    policy_version: str


@router.post("/patients/{patient_id}/access", status_code=201)
def grant_access(
    body: GrantRequest,
    request: Request,
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    if "view_records" not in body.scopes:
        raise _field_error("scopes", "must include view_records")
    if not body.consent_confirmed:
        raise _field_error("consent_confirmed", "the owner must confirm the sharing consent")
    if body.policy_version != get_settings().policy_version:
        raise _field_error("policy_version", "must equal the current policy version")
    grantee = session.exec(select(User).where(User.email == body.grantee_email.strip().lower())).first()
    if grantee is None:
        # Prototype only: production uses invitations so it never reveals which emails have accounts.
        raise ApiError(404, "USER_NOT_FOUND", "No MediVara account uses this email.")
    if grantee.id == access.patient.owner_user_id:
        raise _field_error("grantee_email", "you can't share a profile with yourself")
    if active_grant(session, access.patient.id, grantee.id):
        raise ApiError(409, "GRANT_EXISTS", "This person already has access to this profile.")

    scopes = [s for s in ("view_records", "upload_documents", "manage_reminders") if s in body.scopes]
    consent = ConsentRecord(
        user_id=access.current.user.id,
        patient_id=access.patient.id,
        consent_type=ConsentType.sharing,
        granted=True,
        policy_version=body.policy_version,
    )
    session.add(consent)
    session.flush()
    grant = PatientAccessGrant(
        patient_id=access.patient.id,
        grantee_user_id=grantee.id,
        role=Role.caregiver,
        scopes=scopes,
        granted_by_user_id=access.current.user.id,
        consent_record_id=consent.id,
    )
    session.add(grant)
    session.flush()
    consent.context = {"grant_id": grant.id}
    session.add(consent)
    session.commit()
    session.refresh(grant)
    audit.write(
        request,
        "access.granted",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="grant",
        resource_id=grant.id,
        meta={"grantee_user_id": grantee.id, "scopes": scopes},
    )
    return {"grant": grant_out(session, grant)}


@router.delete("/patients/{patient_id}/access/{grant_id}", status_code=204)
def revoke_access(
    grant_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access(None)),
    session: Session = Depends(get_session),
) -> Response:
    grant = session.exec(
        select(PatientAccessGrant).where(
            PatientAccessGrant.id == grant_id, PatientAccessGrant.patient_id == access.patient.id
        )
    ).first()
    if grant is None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that.")
    user_id = access.current.user.id
    is_owner = access.role == Role.owner
    if not is_owner and grant.grantee_user_id != user_id:
        raise ApiError(403, "OWNER_ONLY", "Only the profile owner can do this.")
    if grant.role == Role.owner:
        raise ApiError(409, "INVALID_STATE", "The owner's own access can't be removed.")
    if grant.status != GrantStatus.active:
        raise ApiError(409, "INVALID_STATE", "This access was already removed.")
    grant.status = GrantStatus.revoked
    grant.revoked_at = utcnow()
    grant.revoked_by_user_id = user_id
    session.add(grant)
    session.commit()
    audit.write(
        request,
        "access.revoked",
        actor_user_id=user_id,
        patient_id=access.patient.id,
        resource_type="grant",
        resource_id=grant.id,
        meta={"grantee_user_id": grant.grantee_user_id, "by": "owner" if is_owner else "grantee"},
    )
    return Response(status_code=204)


# --- Access log (API-26) ----------------------------------------------------------------

_LABELS = {
    "consent.recorded": "Recorded a consent",
    "document.uploaded": "Uploaded a document",
    "document.imported": "Imported a sample document",
    "document.file_viewed": "Viewed an original document",
    "document.reprocessed": "Asked MediVara to read a document again",
    "document.updated": "Corrected document details",
    "document.deleted": "Deleted a document",
    "fact.confirmed": "Confirmed an item",
    "fact.corrected": "Corrected an item",
    "facts.bulk_confirmed": "Confirmed high-confidence items",
    "brief.created": "Created a Consultation Brief",
    "brief.narrative_generated": "Generated the brief summary",
    "ask.answered": "Asked a question",
    "reminder.created": "Created a reminder",
    "reminder.updated": "Changed a reminder",
    "reminder.completed": "Completed a reminder",
    "appointment.simulated_booked": "Made a simulated booking",
    "auth.registered": "Created the account",
    "patient.created": "Created this profile",
    "profile.details_updated": "Updated the Medical ID",
    "vital.recorded": "Recorded a health reading",
    "vital.deleted": "Deleted a health reading",
    "chat.deleted": "Deleted a chat",
    "invitation.created": "Sent an invitation",
    "invitation.cancelled": "Cancelled an invitation",
    "invitation.accepted": "Accepted an invitation",
    "invitation.declined": "Declined an invitation",
    "voice.session_started": "Started a voice conversation",
}


def action_label(session: Session, event: AuditEvent, names: dict[str, str]) -> str:
    """Human-readable label from IDs and codes only; never medical content."""
    meta = event.meta or {}
    if event.action == "fact.rejected":
        return "Restored an item" if meta.get("undo") else "Marked an item as wrong"
    if event.action == "facts.bulk_confirmed" and "count" in meta:
        return f"Confirmed {meta['count']} high-confidence items"
    if event.action == "access.granted":
        return f"Shared access with {names.get(meta.get('grantee_user_id'), 'someone')}"
    if event.action == "access.revoked":
        grantee = names.get(meta.get("grantee_user_id"), "someone")
        return f"{grantee} left the shared profile" if meta.get("by") == "grantee" else f"Revoked {grantee}'s access"
    if event.action == "access.denied":
        had_access = session.exec(
            select(PatientAccessGrant.id).where(
                PatientAccessGrant.patient_id == event.patient_id,
                PatientAccessGrant.grantee_user_id == event.actor_user_id,
                PatientAccessGrant.status == GrantStatus.revoked,
                PatientAccessGrant.revoked_at <= event.at,
            )
        ).first()
        return "Access denied after revoke" if had_access else "Access denied"
    return _LABELS.get(event.action, event.action)


@router.get("/patients/{patient_id}/audit-events")
def list_audit_events(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    where = AuditEvent.patient_id == access.patient.id
    total = session.exec(select(func.count()).select_from(AuditEvent).where(where)).one()
    events = session.exec(
        select(AuditEvent).where(where).order_by(AuditEvent.at.desc(), AuditEvent.id.desc()).offset(offset).limit(limit)
    ).all()
    user_ids = {e.actor_user_id for e in events} | {(e.meta or {}).get("grantee_user_id") for e in events}
    users = session.exec(select(User).where(User.id.in_([u for u in user_ids if u]))).all()
    names = {u.id: u.display_name for u in users}
    return {
        "items": [
            {
                "id": e.id,
                "at": iso_z(e.at),
                "actor": {"user_id": e.actor_user_id, "display_name": names.get(e.actor_user_id)} if e.actor_user_id else None,
                "action": e.action,
                "action_label": action_label(session, e, names),
                "resource_type": e.resource_type,
                "resource_id": e.resource_id,
                "outcome": e.outcome.value,
            }
            for e in events
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
