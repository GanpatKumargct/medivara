"""API-08 upload, API-10 list, API-11 detail, API-12 file stream."""

import hashlib
import logging
import re
import unicodedata
from datetime import date
from typing import Literal

import filetype
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, delete, func, select

from app import audit, storage
from app.access import PatientAccess, load_owned, require_access
from app.consents import require_ai_consent
from app.db import get_session
from app.errors import ApiError
from app.facts import display_text, effective_fields, fact_sort_key
from app.models import (
    Confidence,
    DocumentPage,
    DocumentStage,
    DocumentStatus,
    DocumentType,
    ExtractedFact,
    FactStatus,
    MedicalDocument,
    Reminder,
    iso_z,
    utcnow,
)
from app.pipeline.lines import UnreadablePdf, count_pages
from app.pipeline.normalize import parse_date
from app.pipeline.orchestrator import process_document
from app.pipeline.validation import build_title, confidence_for
from app.reminders import today_ist
from app.review import REVIEWABLE, append_history, has_reviewed_facts, refresh_document_status
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["documents"])

log = logging.getLogger("medivara.documents")
MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 10
HINT_TYPES = {"prescription", "lab_report", "discharge_summary", "consultation_note", "other"}
STATUS_VALUES = {s.value for s in DocumentStatus}
TYPE_VALUES = {t.value for t in DocumentType}


# --- Serialisation ---------------------------------------------------------------------


def _fact_counts(session: Session, document_ids: list[str]) -> dict[str, dict]:
    counts = {doc_id: {"total": 0, "unverified": 0, "low_confidence": 0} for doc_id in document_ids}
    if not document_ids:
        return counts
    rows = session.exec(
        select(ExtractedFact.document_id, ExtractedFact.status, ExtractedFact.confidence, func.count())
        .where(ExtractedFact.document_id.in_(document_ids), ExtractedFact.status != FactStatus.rejected)
        .group_by(ExtractedFact.document_id, ExtractedFact.status, ExtractedFact.confidence)
    ).all()
    for doc_id, status, confidence, n in rows:
        c = counts[doc_id]
        c["total"] += n
        if status == FactStatus.unverified:
            c["unverified"] += n
        if confidence == Confidence.low:
            c["low_confidence"] += n
    return counts


def document_summary(doc: MedicalDocument, fact_counts: dict) -> dict:
    return {
        "id": doc.id,
        "patient_id": doc.patient_id,
        "title": doc.title,
        "document_type": doc.document_type.value,
        "document_date": doc.document_date.isoformat() if doc.document_date else None,
        "date_ambiguous": doc.date_ambiguous,
        "facility_name": doc.facility_name,
        "clinician_name": doc.clinician_name,
        "status": doc.status.value,
        "stage": doc.stage.value,
        "failure_code": doc.failure_code.value if doc.failure_code else None,
        "failure_message": doc.failure_message,
        "flags": list(doc.flags),
        "is_sample": doc.is_sample,
        "extraction_source": doc.extraction_source,
        "page_count": doc.page_count,
        "fact_counts": fact_counts,
        "created_at": iso_z(doc.created_at),
        "processed_at": iso_z(doc.processed_at),
    }


def fact_out(fact: ExtractedFact, lines_by_id: dict[str, dict], document_date=None) -> dict:
    fields = effective_fields(fact)
    # A fact without its own date takes the document's date (contract API-11), computed on
    # read so a corrected document date (API-14) carries through.
    event_date = fact.event_date or document_date
    return {
        "id": fact.id,
        "document_id": fact.document_id,
        "fact_type": fact.fact_type.value,
        "display_text": display_text(fact.fact_type.value, fields),
        "fields": fields,
        "event_date": event_date.isoformat() if event_date else None,
        "source": {
            "page": fact.source_page,
            "line_ids": list(fact.source_line_ids),
            "lines": [
                {"line_id": i, "text": lines_by_id[i]["text"]} for i in fact.source_line_ids if i in lines_by_id
            ],
        },
        "confidence": fact.confidence.value,
        "uncertainty_reasons": list(fact.uncertainty_reasons),
        "status": fact.status.value,
        "corrected_fields": fact.corrected_fields,
        "extraction_note": fact.extraction_note,
        "reviewed_at": iso_z(fact.reviewed_at),
    }


def document_detail(session: Session, doc: MedicalDocument) -> dict:
    pages = session.exec(select(DocumentPage).where(DocumentPage.document_id == doc.id)).all()
    lines_by_id = {line["line_id"]: line for page in pages for line in page.lines}
    facts = session.exec(select(ExtractedFact).where(ExtractedFact.document_id == doc.id)).all()
    # Rejected facts are included so the user can undo; ordered by type, then first source line.
    facts = sorted(facts, key=fact_sort_key)
    header_sources = {key: doc.header_sources.get(key) for key in ("document_type", "document_date", "facility_name", "clinician_name")}
    # Contract 1.1.0 (additive): the extracted page lines, so the review screen can show the
    # document text and highlight each fact's source line. Flagged instruction-like lines are
    # shown to the user (it is their document) but never sent to the model.
    page_views = [
        {"page": p.page_number, "lines": [{"line_id": line["line_id"], "text": line["text"]} for line in p.lines]}
        for p in sorted(pages, key=lambda p: p.page_number)
    ]
    return {
        "document": {
            **document_summary(doc, _fact_counts(session, [doc.id])[doc.id]),
            "original_filename": doc.original_filename,
            "mime_type": doc.mime_type,
            "size_bytes": doc.size_bytes,
            "header_sources": header_sources,
            "flags_detail": list(doc.flags_detail),
            "pages": page_views,
        },
        "facts": [fact_out(f, lines_by_id, doc.document_date) for f in facts],
    }


# --- Upload helpers --------------------------------------------------------------------


def sanitize_filename(name: str | None) -> str:
    """Drop path parts and control characters; at most 120 characters."""
    base = re.split(r"[\\/]", name or "")[-1]
    base = "".join(c for c in base if unicodedata.category(c)[0] != "C").strip().strip(".")
    base = base[:120]
    return base or "document.pdf"


def _split_filter(raw: str | None, allowed: set[str], field: str) -> list[str]:
    if not raw:
        return []
    values = [v.strip() for v in raw.split(",") if v.strip()]
    bad = [v for v in values if v not in allowed]
    if bad:
        raise ApiError(
            422,
            "VALIDATION_ERROR",
            "Some fields need attention.",
            {"fields": [{"field": field, "issue": f"unknown value: {', '.join(bad)}"}]},
        )
    return values


# --- Endpoints -------------------------------------------------------------------------


@router.post("/patients/{patient_id}/documents", status_code=202)
def upload_document(
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    document_type_hint: str | None = Form(None),
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    require_ai_consent(session, access.patient)
    if document_type_hint is not None and document_type_hint not in HINT_TYPES:
        raise ApiError(
            422,
            "VALIDATION_ERROR",
            "Some fields need attention.",
            {"fields": [{"field": "document_type_hint", "issue": "unknown document type"}]},
        )

    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ApiError(413, "FILE_TOO_LARGE", "This file is larger than 10 MB. Please choose a smaller file.")
    kind = filetype.guess(data)
    if kind is None or kind.mime != "application/pdf":
        raise ApiError(415, "UNSUPPORTED_FILE_TYPE", "Only PDF files can be added in this prototype.")
    try:
        pages = count_pages(data)
    except UnreadablePdf:
        # Stored and failed by the pipeline with UNREADABLE_PDF, so the user sees why.
        pages = 0
    if pages > MAX_PAGES:
        raise ApiError(422, "TOO_MANY_PAGES", "This PDF has more than 10 pages. Please split it into smaller files.")

    digest = hashlib.sha256(data).hexdigest()
    existing = session.exec(
        select(MedicalDocument).where(MedicalDocument.patient_id == access.patient.id, MedicalDocument.sha256 == digest)
    ).first()
    if existing is not None:
        raise ApiError(
            409,
            "DUPLICATE_DOCUMENT",
            f"This file is already in {access.patient.display_name}'s records.",
            {"existing_document_id": existing.id},
        )

    filename = sanitize_filename(file.filename)
    doc = MedicalDocument(
        patient_id=access.patient.id,
        uploaded_by_user_id=access.current.user.id,
        original_filename=filename,
        mime_type=kind.mime,
        size_bytes=len(data),
        sha256=digest,
        storage_key=storage.save(data),
        page_count=pages,
        title=f"Uploaded document · {filename}",
        document_type_hint=document_type_hint,
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)
    audit.write(
        request,
        "document.uploaded",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="document",
        resource_id=doc.id,
        meta={"page_count": pages, "size_bytes": len(data)},
    )
    # Queued only after the row is committed.
    background.add_task(process_document, doc.id)
    return {"document": document_summary(doc, {"total": 0, "unverified": 0, "low_confidence": 0})}


@router.get("/patients/{patient_id}/documents")
def list_documents(
    status: str | None = Query(None),
    document_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    where = [MedicalDocument.patient_id == access.patient.id]
    if statuses := _split_filter(status, STATUS_VALUES, "status"):
        where.append(MedicalDocument.status.in_([DocumentStatus(s) for s in statuses]))
    if types := _split_filter(document_type, TYPE_VALUES, "document_type"):
        where.append(MedicalDocument.document_type.in_([DocumentType(t) for t in types]))
    total = session.exec(select(func.count()).select_from(MedicalDocument).where(*where)).one()
    docs = session.exec(
        select(MedicalDocument)
        .where(*where)
        # Newest document date first, undated last, then newest upload.
        .order_by(
            MedicalDocument.document_date.is_(None),
            MedicalDocument.document_date.desc(),
            MedicalDocument.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    counts = _fact_counts(session, [d.id for d in docs])
    return {
        "items": [document_summary(d, counts[d.id]) for d in docs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/patients/{patient_id}/documents/{document_id}")
def get_document(
    document_id: str,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    return document_detail(session, doc)


@router.get("/patients/{patient_id}/documents/{document_id}/file")
def get_document_file(
    document_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> FileResponse:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    path = storage.path_for(doc.storage_key)
    if not path.exists():
        raise ApiError(404, "NOT_FOUND", "We couldn't find that.")
    audit.write(
        request,
        "document.file_viewed",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="document",
        resource_id=doc.id,
    )
    ascii_name = doc.original_filename.encode("ascii", "replace").decode().replace('"', "")
    return FileResponse(
        path,
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{ascii_name}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
        },
    )


# --- Review of a document (API-13, API-14, API-16) --------------------------------------


@router.post("/patients/{patient_id}/documents/{document_id}/reprocess", status_code=202)
def reprocess_document(
    document_id: str,
    request: Request,
    background: BackgroundTasks,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    retryable = doc.status == DocumentStatus.failed or (
        doc.status == DocumentStatus.needs_review and not has_reviewed_facts(session, doc.id)
    )
    if not retryable:
        raise ApiError(409, "INVALID_STATE", "This document can't be read again because items in it were already reviewed.")
    fact_ids = select(ExtractedFact.id).where(ExtractedFact.document_id == doc.id)
    if session.exec(select(Reminder.id).where(Reminder.patient_id == access.patient.id, Reminder.source_fact_id.in_(fact_ids))).first():
        # Re-reading would delete the facts these reminders link back to.
        raise ApiError(409, "INVALID_STATE", "This document can't be read again because a reminder was created from it.")
    require_ai_consent(session, access.patient)
    doc.status = DocumentStatus.queued
    doc.stage = DocumentStage.queued
    doc.failure_code = None
    doc.failure_message = None
    doc.processed_at = None
    doc.updated_at = utcnow()
    session.add(doc)
    session.commit()
    session.refresh(doc)
    audit.write(
        request,
        "document.reprocessed",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="document",
        resource_id=doc.id,
    )
    background.add_task(process_document, doc.id)
    return {"document": document_summary(doc, _fact_counts(session, [doc.id])[doc.id])}


@router.delete("/patients/{patient_id}/documents/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    request: Request,
    access: PatientAccess = Depends(require_access(None, owner_only=True)),
    session: Session = Depends(get_session),
) -> Response:
    """API-22 (BE-4.6, FR-023): removes the file, pages and facts. Briefs that used the document
    turn stale through the fingerprint. Reminders made from its facts are kept, unlinked."""
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    if doc.status in (DocumentStatus.queued, DocumentStatus.processing):
        raise ApiError(409, "INVALID_STATE", "This document is still being read. Try again when it has finished.")
    fact_ids = select(ExtractedFact.id).where(ExtractedFact.document_id == doc.id)
    for reminder in session.exec(
        select(Reminder).where(Reminder.patient_id == access.patient.id, Reminder.source_fact_id.in_(fact_ids))
    ).all():
        reminder.source_fact_id = None
        reminder.updated_at = utcnow()
        session.add(reminder)
    session.exec(delete(ExtractedFact).where(ExtractedFact.document_id == doc.id))
    session.exec(delete(DocumentPage).where(DocumentPage.document_id == doc.id))
    storage_key = doc.storage_key
    session.delete(doc)
    session.commit()
    try:
        storage.path_for(storage_key).unlink(missing_ok=True)
    except (OSError, ValueError) as exc:
        # The database delete stands; the orphaned file is noted for clean-up (IDs only).
        log.error("document_file_not_removed", extra={"document_id": document_id, "exc_type": type(exc).__name__})
    audit.write(
        request,
        "document.deleted",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="document",
        resource_id=document_id,
    )
    return Response(status_code=204)


class DocumentPatch(BaseModel):
    document_type: Literal["prescription", "lab_report", "discharge_summary", "consultation_note", "other"] | None = None
    document_date: date | None = None
    facility_name: str | None = Field(None, min_length=1, max_length=120)
    clinician_name: str | None = Field(None, min_length=1, max_length=120)


def _recheck_dates(fact: ExtractedFact, document_date: date, today: date) -> None:
    """After the user sets the document date, drop date reasons that came from it."""
    own = parse_date(fact.event_date_text)
    reasons = list(fact.uncertainty_reasons)
    if not (own and own.ambiguous):
        reasons = [r for r in reasons if r != "date_ambiguous"]
    if document_date <= today and not (fact.event_date and fact.event_date > today):
        reasons = [r for r in reasons if r != "date_in_future"]
    if reasons != fact.uncertainty_reasons:
        fact.uncertainty_reasons = reasons
        fact.confidence = confidence_for(reasons)
        fact.updated_at = utcnow()


@router.patch("/patients/{patient_id}/documents/{document_id}")
def patch_document(
    document_id: str,
    body: DocumentPatch,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise ApiError(
            422, "VALIDATION_ERROR", "Some fields need attention.",
            {"fields": [{"field": "body", "issue": "at least one field is required"}]},
        )
    if doc.status not in REVIEWABLE:
        raise ApiError(409, "INVALID_STATE", "This document is still being read.")
    today = today_ist()
    if "document_date" in changes and changes["document_date"] > today:
        raise ApiError(
            422, "VALIDATION_ERROR", "Some fields need attention.",
            {"fields": [{"field": "document_date", "issue": "must not be in the future"}]},
        )

    if "document_type" in changes:
        doc.document_type = DocumentType(changes["document_type"])
        doc.document_type_source = "user"
    if "document_date" in changes:
        doc.document_date = changes["document_date"]
        doc.document_date_source = "user"
        doc.date_ambiguous = False
        doc.flags = [f for f in doc.flags if f not in ("date_ambiguous", "date_missing")]
        doc.flags_detail = [d for d in doc.flags_detail if d.get("flag") != "date_ambiguous"]
        for fact in session.exec(select(ExtractedFact).where(ExtractedFact.document_id == doc.id)).all():
            _recheck_dates(fact, doc.document_date, today)
            session.add(fact)
    for key in ("facility_name", "clinician_name"):
        if key in changes:
            setattr(doc, key, changes[key].strip())
    doc.user_edited_fields = sorted(set(doc.user_edited_fields) | set(changes))
    doc.title = build_title(doc.document_type.value, doc.facility_name, doc.document_date)
    doc.updated_at = utcnow()
    session.add(doc)
    session.commit()
    session.refresh(doc)
    audit.write(
        request,
        "document.updated",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="document",
        resource_id=doc.id,
        meta={"fields": sorted(changes)},  # names only, never values
    )
    return {"document": document_summary(doc, _fact_counts(session, [doc.id])[doc.id])}


class BulkReview(BaseModel):
    action: Literal["confirm_high_confidence"]


@router.post("/patients/{patient_id}/documents/{document_id}/review")
def bulk_review(
    document_id: str,
    body: BulkReview,
    request: Request,
    access: PatientAccess = Depends(require_access("upload_documents")),
    session: Session = Depends(get_session),
) -> dict:
    doc = load_owned(session, MedicalDocument, document_id, access.patient.id)
    if doc.status not in REVIEWABLE:
        raise ApiError(409, "INVALID_STATE", "This document is still being read.")
    user_id = access.current.user.id
    eligible = session.exec(
        select(ExtractedFact).where(
            ExtractedFact.document_id == doc.id,
            ExtractedFact.status == FactStatus.unverified,
            ExtractedFact.confidence == Confidence.high,
        )
    ).all()
    eligible = sorted(eligible, key=fact_sort_key)
    now = utcnow()
    for fact in eligible:
        append_history(fact, user_id, "bulk_confirm", {"status": "unverified"}, {"status": "confirmed"})
        fact.status = FactStatus.confirmed
        fact.reviewed_by_user_id = user_id
        fact.reviewed_at = now
        fact.updated_at = now
        session.add(fact)
    session.flush()
    refresh_document_status(session, doc)
    session.commit()
    session.refresh(doc)
    remaining = _fact_counts(session, [doc.id])[doc.id]["unverified"]
    audit.write(
        request,
        "facts.bulk_confirmed",
        actor_user_id=user_id,
        patient_id=access.patient.id,
        resource_type="document",
        resource_id=doc.id,
        meta={"count": len(eligible)},
    )
    return {
        "confirmed_fact_ids": [f.id for f in eligible],
        "remaining_unverified": remaining,
        "document": {"id": doc.id, "status": doc.status.value},
    }
