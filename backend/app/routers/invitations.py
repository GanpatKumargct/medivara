"""API-54 to API-59: invite a caregiver by email.

Unlike API-24 (direct grant to a known account), an invitation works for any email and never
reveals whether an account exists for it. The invitee signs in (or registers) with that email,
sees the invitation under /me/invitations and accepts it, which creates the caregiver grant.
The invitation ID (uuid4) is the secret in the link; accepting still requires the matching
signed-in email, so a forwarded link is useless to anyone else.
"""

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app import audit, mailer
from app.access import PatientAccess, active_grant, load_owned, require_access
from app.auth import CurrentUser, current_user
from app.config import get_settings
from app.db import get_session
from app.errors import ApiError
from app.ids import new_id
from app.models import (
    ConsentRecord,
    ConsentType,
    Invitation,
    PatientAccessGrant,
    PatientProfile,
    Role,
    User,
    as_utc,
    iso_z,
    utcnow,
)
from app.routers import API_PREFIX
from app.validation import Relationship, email_issue, normalise_email, ordered_scopes, validation_error

router = APIRouter(prefix=API_PREFIX, tags=["invitations"])

INVITATION_DAYS = 14


class InvitationIn(BaseModel):
    email: str
    scopes: list[Literal["view_records", "upload_documents", "manage_reminders"]]
    relationship: Relationship
    consent_confirmed: bool
    policy_version: str


def invite_path(invitation_id: str) -> str:
    return f"/invite/{invitation_id}"


def is_expired(inv: Invitation) -> bool:
    return as_utc(inv.expires_at) <= utcnow()


def shown_status(inv: Invitation) -> str:
    return "expired" if inv.status == "pending" and is_expired(inv) else inv.status


def owner_invitation_out(inv: Invitation) -> dict:
    return {
        "id": inv.id,
        "email": inv.email,
        "relationship": inv.relationship,
        "scopes": list(inv.scopes),
        "status": shown_status(inv),
        "created_at": iso_z(inv.created_at),
        "expires_at": iso_z(inv.expires_at),
        "responded_at": iso_z(inv.responded_at),
        "invite_url": invite_path(inv.id),
    }


def _email_text(inviter: str, patient: str, link: str, expires: str) -> str:
    return (
        "Hello,\n\n"
        f"{inviter} invited you to help look after {patient}'s health records on MediVara.\n\n"
        "To accept, sign in or create a MediVara account with this email address, then open:\n"
        f"{link}\n\n"
        f"The invitation expires on {expires}. If you weren't expecting it, you can ignore this email.\n\n"
        "MediVara is a prototype that uses synthetic (made-up) data only. Please don't upload real "
        "medical records.\n"
    )


# --- Owner side ---------------------------------------------------------------------------


@router.post("/patients/{patient_id}/invitations", status_code=201)
def create_invitation(
    body: InvitationIn,
    request: Request,
    background: BackgroundTasks,
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    # Same rules as API-24, plus the email format and the relationship.
    if "view_records" not in body.scopes:
        raise validation_error([("scopes", "must include view_records")])
    if not body.consent_confirmed:
        raise validation_error([("consent_confirmed", "the owner must confirm the sharing consent")])
    if body.policy_version != get_settings().policy_version:
        raise validation_error([("policy_version", "must equal the current policy version")])
    email = normalise_email(body.email)
    if issue := email_issue(email):
        raise validation_error([("email", issue)])
    patient = access.patient
    owner = session.get(User, patient.owner_user_id)
    if owner is not None and owner.email == email:
        raise validation_error([("email", "you can't invite yourself to your own profile")])

    pending = session.exec(
        select(Invitation).where(
            Invitation.patient_id == patient.id, Invitation.email == email, Invitation.status == "pending"
        )
    ).all()
    if any(not is_expired(inv) for inv in pending):
        raise ApiError(409, "INVITATION_EXISTS", "This email already has a pending invitation to this profile.")
    invitee = session.exec(select(User).where(User.email == email)).first()
    if invitee is not None and active_grant(session, patient.id, invitee.id):
        raise ApiError(409, "GRANT_EXISTS", "This person already has access to this profile.")

    user = access.current.user
    scopes = ordered_scopes(body.scopes)
    invitation_id = new_id("inv")
    consent = ConsentRecord(
        user_id=user.id,
        patient_id=patient.id,
        consent_type=ConsentType.sharing,
        granted=True,
        policy_version=body.policy_version,
        context={"invitation_id": invitation_id},
    )
    session.add(consent)
    session.flush()
    now = utcnow()
    invitation = Invitation(
        id=invitation_id,
        patient_id=patient.id,
        email=email,
        relationship=body.relationship,
        scopes=scopes,
        invited_by_user_id=user.id,
        consent_record_id=consent.id,
        created_at=now,
        expires_at=now + timedelta(days=INVITATION_DAYS),
    )
    session.add(invitation)
    session.commit()
    session.refresh(invitation)

    email_sent = mailer.configured()
    if email_sent:
        settings = get_settings()
        link = settings.app_base_url.rstrip("/") + invite_path(invitation.id)
        expires = as_utc(invitation.expires_at).strftime("%d %b %Y")
        background.add_task(
            mailer.send_email,
            email,
            f"{user.display_name} invited you to MediVara",
            _email_text(user.display_name, patient.display_name, link, expires),
        )
    # No email address in the audit trail: the invitation ID identifies it.
    audit.write(
        request,
        "invitation.created",
        actor_user_id=user.id,
        patient_id=patient.id,
        resource_type="invitation",
        resource_id=invitation.id,
        meta={"invitation_id": invitation.id, "scopes": scopes},
    )
    return {"invitation": owner_invitation_out(invitation), "invite_url": invite_path(invitation.id), "email_sent": email_sent}


@router.get("/patients/{patient_id}/invitations")
def list_invitations(
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> dict:
    rows = session.exec(
        select(Invitation)
        .where(Invitation.patient_id == access.patient.id)
        .order_by(Invitation.created_at.desc(), Invitation.id.desc())
    ).all()
    return {"invitations": [owner_invitation_out(inv) for inv in rows]}


@router.delete("/patients/{patient_id}/invitations/{invitation_id}", status_code=204)
def cancel_invitation(
    invitation_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> Response:
    invitation = load_owned(session, Invitation, invitation_id, access.patient.id)
    if shown_status(invitation) != "pending":
        raise ApiError(409, "INVALID_STATE", "This invitation is no longer pending.")
    invitation.status = "cancelled"
    invitation.responded_at = utcnow()
    session.add(invitation)
    session.commit()
    audit.write(
        request,
        "invitation.cancelled",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="invitation",
        resource_id=invitation.id,
        meta={"invitation_id": invitation.id},
    )
    return Response(status_code=204)


# --- Invitee side -------------------------------------------------------------------------


def _my_pending(session: Session, invitation_id: str, user: User) -> Invitation:
    """A pending, unexpired invitation for my email. Every other case is the same 404."""
    invitation = session.get(Invitation, invitation_id)
    if (
        invitation is None
        or invitation.status != "pending"
        or is_expired(invitation)
        or invitation.email != user.email.lower()
    ):
        raise ApiError(404, "NOT_FOUND", "We couldn't find that.")
    return invitation


@router.get("/me/invitations")
def my_invitations(current: CurrentUser = Depends(current_user), session: Session = Depends(get_session)) -> dict:
    rows = session.exec(
        select(Invitation)
        .where(Invitation.email == current.user.email.lower(), Invitation.status == "pending")
        .order_by(Invitation.created_at.desc(), Invitation.id.desc())
    ).all()
    items = []
    for inv in rows:
        if is_expired(inv):
            continue
        patient = session.get(PatientProfile, inv.patient_id)
        inviter = session.get(User, inv.invited_by_user_id)
        if patient is None:
            continue
        items.append(
            {
                "id": inv.id,
                "patient": {"id": patient.id, "display_name": patient.display_name},
                "invited_by": {"display_name": inviter.display_name if inviter else None},
                "relationship": inv.relationship,
                "scopes": list(inv.scopes),
                "created_at": iso_z(inv.created_at),
                "expires_at": iso_z(inv.expires_at),
            }
        )
    return {"invitations": items}


@router.post("/me/invitations/{invitation_id}/accept")
def accept_invitation(
    invitation_id: str,
    request: Request,
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    user = current.user
    invitation = _my_pending(session, invitation_id, user)
    patient = session.get(PatientProfile, invitation.patient_id)
    if patient is None:
        raise ApiError(404, "NOT_FOUND", "We couldn't find that.")
    if patient.owner_user_id == user.id:
        raise validation_error([("invitation_id", "you already own this profile")])

    patient_id, scopes = patient.id, list(invitation.scopes)
    grant = None
    if active_grant(session, patient_id, user.id) is None:
        grant = PatientAccessGrant(
            patient_id=patient_id,
            grantee_user_id=user.id,
            role=Role.caregiver,
            scopes=scopes,
            granted_by_user_id=invitation.invited_by_user_id,
            consent_record_id=invitation.consent_record_id,
        )
        session.add(grant)
    invitation.status = "accepted"
    invitation.responded_at = utcnow()
    invitation.accepted_user_id = user.id
    session.add(invitation)
    try:
        session.commit()
    except IntegrityError:
        # A concurrent request created the active grant first (uq_active_grant); keep that one.
        session.rollback()
        grant = None
        invitation = session.get(Invitation, invitation_id)
        invitation.status = "accepted"
        invitation.responded_at = utcnow()
        invitation.accepted_user_id = user.id
        session.add(invitation)
        session.commit()
    if grant is not None:
        session.refresh(grant)
        consent = session.get(ConsentRecord, invitation.consent_record_id) if invitation.consent_record_id else None
        if consent is not None:
            consent.context = {**(consent.context or {}), "grant_id": grant.id}
            session.add(consent)
            session.commit()

    audit.write(
        request,
        "invitation.accepted",
        actor_user_id=user.id,
        patient_id=patient_id,
        resource_type="invitation",
        resource_id=invitation_id,
        meta={"invitation_id": invitation_id},
    )
    if grant is not None:
        audit.write(
            request,
            "access.granted",
            actor_user_id=user.id,
            patient_id=patient_id,
            resource_type="grant",
            resource_id=grant.id,
            meta={"grantee_user_id": user.id, "scopes": scopes, "invitation_id": invitation_id},
        )
    return {"patient_id": patient_id}


@router.post("/me/invitations/{invitation_id}/decline", status_code=204)
def decline_invitation(
    invitation_id: str,
    request: Request,
    current: CurrentUser = Depends(current_user),
    session: Session = Depends(get_session),
) -> Response:
    invitation = _my_pending(session, invitation_id, current.user)
    invitation.status = "declined"
    invitation.responded_at = utcnow()
    session.add(invitation)
    session.commit()
    audit.write(
        request,
        "invitation.declined",
        actor_user_id=current.user.id,
        patient_id=invitation.patient_id,
        resource_type="invitation",
        resource_id=invitation.id,
        meta={"invitation_id": invitation.id},
    )
    return Response(status_code=204)
