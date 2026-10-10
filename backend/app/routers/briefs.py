"""API-18 create brief, API-19 latest brief, API-20 brief narrative."""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app import audit
from app.access import PatientAccess, load_owned, require_access
from app.answer.service import narrative, narrative_object
from app.db import get_session
from app.errors import ApiError
from app.models import AIOutput, ConsultationBrief, Reminder, ReminderStatus, User, iso_z
from app.organise.brief import build_brief, fingerprint
from app.organise.records import load_records
from app.organise.rules import run_rules
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["briefs"])


class BriefCreate(BaseModel):
    include_unverified: bool = True
    visit_reason: str | None = Field(None, max_length=300)


def brief_out(session: Session, brief: ConsultationBrief) -> dict:
    body = brief.sections
    creator = session.get(User, brief.created_by_user_id)
    narrative_status, narrative_body = "not_requested", None
    if brief.narrative_output_id and (output := session.get(AIOutput, brief.narrative_output_id)):
        narrative_status = output.status
        if output.status == "ready":
            narrative_body = narrative_object(output, body["templated_text"])
    return {
        "brief": {
            "id": brief.id,
            "patient_id": brief.patient_id,
            "created_at": iso_z(brief.created_at),
            "created_by": {"user_id": brief.created_by_user_id, "display_name": creator.display_name if creator else None},
            "include_unverified": brief.include_unverified,
            "visit_reason": brief.visit_reason,
            # Computed on every read: any document or fact change since creation makes it stale.
            "stale": fingerprint(session, brief.patient_id) != brief.fingerprint,
            "header": body["header"],
            "overview": {
                "templated_text": body["templated_text"],
                "narrative_status": narrative_status,
                "narrative": narrative_body,
            },
            "sections": body["sections"],
            "evidence": brief.evidence,
            "sources": body["sources"],
            "disclaimer": body["disclaimer"],
        }
    }


@router.post("/patients/{patient_id}/briefs", status_code=201)
def create_brief(
    request: Request,
    body: BriefCreate | None = None,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    body = body or BriefCreate()
    reason = (body.visit_reason or "").strip() or None
    records = load_records(session, access.patient.id, include_unverified=body.include_unverified)
    reminder_facts = set(
        session.exec(
            select(Reminder.source_fact_id).where(
                Reminder.patient_id == access.patient.id,
                Reminder.source_fact_id.is_not(None),
                Reminder.status != ReminderStatus.dismissed,
            )
        ).all()
    )
    built = build_brief(records, access.patient, reason, run_rules(records, reminder_fact_ids=reminder_facts))
    brief = ConsultationBrief(
        patient_id=access.patient.id,
        created_by_user_id=access.current.user.id,
        include_unverified=body.include_unverified,
        visit_reason=reason,
        sections={k: v for k, v in built.items() if k != "evidence"},
        evidence=built["evidence"],
        fingerprint=fingerprint(session, access.patient.id),
    )
    session.add(brief)
    session.commit()
    session.refresh(brief)
    audit.write(
        request,
        "brief.created",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="brief",
        resource_id=brief.id,
        meta={"documents": built["header"]["documents_count"], "include_unverified": body.include_unverified},
    )
    return brief_out(session, brief)


@router.get("/patients/{patient_id}/briefs/latest")
def latest_brief(
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    brief = session.exec(
        select(ConsultationBrief)
        .where(ConsultationBrief.patient_id == access.patient.id)
        .order_by(ConsultationBrief.created_at.desc())
    ).first()
    if brief is None:
        raise ApiError(404, "NOT_FOUND", "No brief has been created yet.")
    return brief_out(session, brief)


@router.post("/patients/{patient_id}/briefs/{brief_id}/narrative")
def brief_narrative(
    brief_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    brief = load_owned(session, ConsultationBrief, brief_id, access.patient.id)
    output = narrative(session, brief, access.current.user.id)
    audit.write(
        request,
        "brief.narrative_generated",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="brief",
        resource_id=brief.id,
        meta={"status": output.status, "ai_output_id": output.id},
    )
    return {"brief_id": brief.id, "narrative": narrative_object(output, brief.sections["templated_text"])}
