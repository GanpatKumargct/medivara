"""Processing orchestrator (BE-5.1): AG-01 → AG-02 → AG-03 → AG-04 → AG-05 for one document.

Runs as a background task in a worker thread, so model and file work never block request
handling. Each stage is a short SQLite transaction, so polling (API-11) sees progress.
Every failure ends as `failed` with a failure code and copy-deck text.
"""

import logging
import time

from sqlmodel import Session, delete, select

from app import storage
from app.db import get_engine
from app.models import (
    DocumentPage,
    DocumentStage,
    DocumentStatus,
    DocumentType,
    ExtractedFact,
    FactStatus,
    FactType,
    FailureCode,
    MedicalDocument,
    RecordVersion,
    utcnow,
)
from app.pipeline import extraction, golden_cache, lines, screening, validation
from app.reminders import today_ist

log = logging.getLogger("medivara.pipeline")

FAILURE_MESSAGES = {
    FailureCode.NO_TEXT_LAYER: (
        "This looks like a scanned image. Reading scanned documents isn't available in this prototype yet."
    ),  # COPY-14
    FailureCode.UNREADABLE_PDF: (
        "MediVara couldn't open this PDF. It may be damaged or password-protected."
    ),  # wording pending in the copy deck
    FailureCode.INTERNAL_ERROR: "Something went wrong while reading this document. Try again.",
}
COPY_09C = "MediVara couldn't read this document right now because the AI service didn't respond. Try again in a minute."


class _Failed(Exception):
    def __init__(self, code: FailureCode, stage: DocumentStage | None = None):
        self.code = code
        self.stage = stage


def _update(document_id: str, **changes) -> None:
    with Session(get_engine()) as session:
        doc = session.get(MedicalDocument, document_id)
        for key, value in changes.items():
            setattr(doc, key, value)
        doc.updated_at = utcnow()
        session.add(doc)
        session.commit()


def _store_pages(document_id: str, extracted: lines.ExtractedText) -> list[dict]:
    with Session(get_engine()) as session:
        session.exec(delete(DocumentPage).where(DocumentPage.document_id == document_id))
        for page in extracted.pages:
            session.add(
                DocumentPage(
                    document_id=document_id,
                    page_number=page.page_number,
                    width=page.width,
                    height=page.height,
                    lines=page.lines,
                    char_count=page.char_count,
                )
            )
        session.commit()
    return [line for page in extracted.pages for line in page.lines]


def _store_facts(
    doc: MedicalDocument, result: validation.ValidationResult, model_id: str | None, source: str = "live"
) -> None:
    header = result.header
    with Session(get_engine()) as session:
        # Reprocessing replaces facts that were never reviewed (reviewed ones block reprocess).
        session.exec(
            delete(ExtractedFact).where(
                ExtractedFact.document_id == doc.id, ExtractedFact.status == FactStatus.unverified
            )
        )
        for fact in result.facts:
            values = dict(fact.values)
            fact_type = FactType(values.pop("fact_type"))
            values.pop("source_line_ids", None)
            session.add(
                ExtractedFact(
                    patient_id=doc.patient_id,
                    document_id=doc.id,
                    fact_type=fact_type,
                    **values,
                    event_date=fact.event_date,
                    source_line_ids=fact.source_line_ids,
                    source_page=fact.source_page,
                    confidence=fact.confidence,
                    uncertainty_reasons=fact.uncertainty_reasons,
                    history=[{"at": utcnow().isoformat(), "by_user_id": None, "action": "extracted", "before": None, "after": None}],
                )
            )
        row = session.get(MedicalDocument, doc.id)
        user_fields = set(row.user_edited_fields)
        # Fields the user corrected (API-14) survive reprocessing.
        if "document_type" not in user_fields:
            row.document_type = DocumentType(header.document_type)
            row.document_type_source = "ai"
        if "document_date" in user_fields:
            flags = [f for f in header.flags if f not in ("date_ambiguous", "date_missing")]
            date_details = []
        else:
            row.document_date = header.document_date
            row.document_date_text = header.document_date_text
            row.document_date_source = "ai" if header.document_date_text else None
            row.date_ambiguous = header.date_ambiguous
            flags, date_details = header.flags, header.flags_detail
        if "facility_name" not in user_fields:
            row.facility_name = header.facility_name
        if "clinician_name" not in user_fields:
            row.clinician_name = header.clinician_name
        row.title = validation.build_title(row.document_type.value, row.facility_name, row.document_date)
        if source == "live":
            flags = [f for f in flags if f != "cached_extraction"]
        row.flags = flags
        keep = [d for d in row.flags_detail if d.get("flag") != "date_ambiguous"]
        if source == "live":
            keep = [d for d in keep if d.get("flag") != "cached_extraction"]
        row.flags_detail = keep + date_details
        row.header_sources = header.header_sources
        row.discarded_fact_count = result.discarded
        row.extraction_source = source
        row.model_id = model_id
        row.prompt_version = extraction.PROMPT_VERSION
        # needs_review even with zero facts, so the user sees "nothing could be read reliably".
        row.status = DocumentStatus.needs_review
        row.stage = DocumentStage.done
        row.failure_code = None
        row.failure_message = None
        row.processed_at = utcnow()
        row.updated_at = utcnow()
        session.add(row)
        session.commit()


def _record_version(document_id: str) -> None:
    """Save the result of reading as a version (app/versions.py). A new file of an existing
    document becomes current only if it was read; otherwise the previous file stays."""
    from app import versions

    try:
        with Session(get_engine()) as session:
            doc = session.get(MedicalDocument, document_id)
            if doc is None:
                return
            if not doc.is_current:
                versions.finish_new_file(session, doc)
                return
            earlier = session.exec(
                select(RecordVersion.id).where(RecordVersion.series_id == doc.series_id,
                                               RecordVersion.action.in_(["read", "read_again"]))
            ).first()
            action = "read_failed" if doc.status == DocumentStatus.failed else ("read_again" if earlier else "read")
            versions.record_change(session, doc, action)
            session.commit()
    except Exception as exc:  # noqa: BLE001  history must never break processing
        log.error("version_record_error", extra={"document_id": document_id, "exc_type": type(exc).__name__})


def process_document(document_id: str) -> None:
    start = time.perf_counter()
    code: FailureCode | None = None
    try:
        with Session(get_engine()) as session:
            doc = session.get(MedicalDocument, document_id)
            if doc is None:
                return
            session.expunge(doc)

        _update(document_id, status=DocumentStatus.processing, stage=DocumentStage.reading_text)
        try:
            extracted = lines.extract_lines(storage.read(doc.storage_key))
        except lines.UnreadablePdf:
            raise _Failed(FailureCode.UNREADABLE_PDF)
        if not extracted.has_text:
            raise _Failed(FailureCode.NO_TEXT_LAYER, DocumentStage.no_text_layer)
        all_lines = _store_pages(document_id, extracted)
        if extracted.low_density and "low_text_density" not in doc.flags:
            doc.flags = [*doc.flags, "low_text_density"]
            _update(document_id, flags=doc.flags)

        _update(document_id, stage=DocumentStage.screening)
        model_lines, flagged = screening.screen_lines(all_lines)
        flags = [f for f in doc.flags if f != "suspicious_instructions"]
        details = [d for d in doc.flags_detail if d.get("flag") != "suspicious_instructions"]
        if flagged:
            flags.append("suspicious_instructions")
            details.append(
                {
                    "flag": "suspicious_instructions",
                    "text": screening.COPY_13,
                    "line_ids": [line["line_id"] for line in flagged],
                }
            )
        doc.flags, doc.flags_detail = flags, details
        _update(document_id, flags=flags, flags_detail=details)

        _update(document_id, stage=DocumentStage.extracting)
        source = "live"
        try:
            result = extraction.extract(model_lines, doc.document_type_hint)
        except extraction.ExtractionFailed as exc:
            # Golden cache: a saved, validated reading of this exact file (by SHA-256), labelled.
            result = golden_cache.lookup(doc.sha256)
            if result is None:
                raise _Failed(exc.code)
            source = "cache"
            doc.flags = [*[f for f in doc.flags if f != "cached_extraction"], "cached_extraction"]
            doc.flags_detail = [
                *[d for d in doc.flags_detail if d.get("flag") != "cached_extraction"],
                {"flag": "cached_extraction", "text": golden_cache.COPY_11},
            ]
            _update(document_id, flags=doc.flags, flags_detail=doc.flags_detail)

        _update(document_id, stage=DocumentStage.validating)
        # Facts may cite only lines the model was shown; flagged lines are never valid sources.
        validated = validation.validate(result.document, result.facts, model_lines, doc.flags, today_ist())
        _store_facts(doc, validated, result.model_id, source)
    except _Failed as failure:
        code = failure.code
        changes = {"status": DocumentStatus.failed, "failure_code": code, "processed_at": utcnow()}
        changes["failure_message"] = FAILURE_MESSAGES.get(code, COPY_09C)
        if failure.stage is not None:
            changes["stage"] = failure.stage
        _update(document_id, **changes)
    except Exception as exc:  # noqa: BLE001  never leave a document stuck in `processing`
        code = FailureCode.INTERNAL_ERROR
        log.error("document_processing_error", extra={"document_id": document_id, "exc_type": type(exc).__name__})
        _update(
            document_id,
            status=DocumentStatus.failed,
            failure_code=code,
            failure_message=FAILURE_MESSAGES[code],
            processed_at=utcnow(),
        )
    _record_version(document_id)
    log.info(
        "document_processed",
        extra={
            "document_id": document_id,
            "outcome": "failed" if code else "needs_review",
            "failure_code": code.value if code else None,
            "latency_ms": int((time.perf_counter() - start) * 1000),
        },
    )
