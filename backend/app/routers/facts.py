"""API-15 PATCH /patients/{patient_id}/facts/{fact_id} — confirm, correct, reject, undo."""

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app import audit, versions
from app.access import PatientAccess, load_owned, require_access
from app.db import get_session
from app.errors import ApiError
from app.facts import FIELDS_BY_TYPE, effective_fields
from app.models import DocumentPage, ExtractedFact, MedicalDocument, utcnow
from app.pipeline.normalize import parse_date
from app.review import REVIEWABLE, TRANSITIONS, append_history, refresh_document_status
from app.routers import API_PREFIX
from app.routers.documents import fact_out, require_editable

router = APIRouter(prefix=API_PREFIX, tags=["facts"])

AUDIT_ACTIONS = {
    "confirm": "fact.confirmed",
    "correct": "fact.corrected",
    "reject": "fact.rejected",
    # The audit list has no separate undo action; recorded as fact.rejected with undo=true.
    "undo_reject": "fact.rejected",
}


class FactPatch(BaseModel):
    action: Literal["confirm", "correct", "reject", "undo_reject"]
    corrected_fields: dict[str, str] | None = None
    note: str | None = Field(None, max_length=200)


FACT_VERSION_ACTIONS = {"confirm": "fact_confirmed", "correct": "fact_corrected", "reject": "fact_rejected",
                        "undo_reject": "fact_unrejected"}


def _field_error(field: str, issue: str) -> ApiError:
    return ApiError(422, "VALIDATION_ERROR", "Some fields need attention.", {"fields": [{"field": field, "issue": issue}]})


@router.patch("/patients/{patient_id}/facts/{fact_id}")
def patch_fact(
    fact_id: str,
    body: FactPatch,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    fact = load_owned(session, ExtractedFact, fact_id, access.patient.id)
    doc = session.get(MedicalDocument, fact.document_id)
    require_editable(doc)
    if doc.status not in REVIEWABLE:
        raise ApiError(409, "INVALID_STATE", "This document is still being read.")

    allowed_from, target = TRANSITIONS[body.action]
    if fact.status not in allowed_from:
        raise ApiError(409, "INVALID_STATE", "That change isn't possible for this item right now.")

    before = {"status": fact.status.value, "fields": effective_fields(fact)}
    if body.action == "correct":
        changes = body.corrected_fields or {}
        if not changes:
            raise _field_error("corrected_fields", "required when correcting")
        allowed = set(FIELDS_BY_TYPE[fact.fact_type.value])
        for key, value in changes.items():
            if key not in allowed:
                raise _field_error(f"corrected_fields.{key}", "not a field of this item")
            if not 1 <= len(value.strip()) <= 200:
                raise _field_error(f"corrected_fields.{key}", "must be between 1 and 200 characters")
        fact.corrected_fields = {**(fact.corrected_fields or {}), **{k: v.strip() for k, v in changes.items()}}
        if "event_date_text" in changes:
            parsed = parse_date(changes["event_date_text"])
            if parsed is None:
                raise _field_error("corrected_fields.event_date_text", "must contain a date, for example 20-Mar-2025")
            fact.event_date = parsed.value
    elif body.corrected_fields:
        raise _field_error("corrected_fields", "only allowed when correcting")

    fact.status = target
    now = utcnow()
    fact.updated_at = now
    fact.reviewed_by_user_id = access.current.user.id
    fact.reviewed_at = now
    append_history(
        fact,
        access.current.user.id,
        body.action,
        before,
        {"status": target.value, "fields": effective_fields(fact)},
        body.note,
    )
    session.add(fact)
    session.flush()
    refresh_document_status(session, doc)
    versions.record_change(session, doc, FACT_VERSION_ACTIONS[body.action], user_id=access.current.user.id,
                           session_id=access.current.auth_session.id)
    session.commit()
    session.refresh(fact)
    session.refresh(doc)

    meta = {"document_id": doc.id, "fact_type": fact.fact_type.value}
    if body.action == "correct":
        meta["fields"] = sorted((body.corrected_fields or {}).keys())  # names only, never values
    if body.action == "undo_reject":
        meta["undo"] = True
    audit.write(
        request,
        AUDIT_ACTIONS[body.action],
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="fact",
        resource_id=fact.id,
        meta=meta,
    )

    pages = session.exec(select(DocumentPage).where(DocumentPage.document_id == doc.id)).all()
    lines_by_id = {line["line_id"]: line for page in pages for line in page.lines}
    return {"fact": fact_out(fact, lines_by_id, doc.document_date), "document": {"id": doc.id, "status": doc.status.value}}
