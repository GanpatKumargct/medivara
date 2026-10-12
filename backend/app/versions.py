"""Document version history (DEC-27).

Every change to a document is saved as a numbered version of its *series* (one logical
document; each uploaded file is a row in the series). A version stores the full state after
the change (`snapshot`) and what changed (`summary`), so any version can be viewed, compared
and restored. Restoring writes a new version; history is never rewritten.

Only the current, non-deleted row of a series is used by Records, the timeline, briefs and Ask
(`visible()`). Snapshots hold record content, like facts: patient-scoped and never logged.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import and_, func
from sqlmodel import Session, select

from app.facts import FIELDS_BY_TYPE, display_text, effective_fields, fact_sort_key
from app.models import (
    Confidence,
    DocumentStatus,
    DocumentType,
    ExtractedFact,
    FactStatus,
    FactType,
    MedicalDocument,
    RecordVersion,
    Reminder,
    utcnow,
)
from app.review import append_history, refresh_document_status

RAW_FIELDS = sorted({key for keys in FIELDS_BY_TYPE.values() for key in keys})
HEADER_FIELDS = ("document_type", "document_date", "document_date_text", "facility_name", "clinician_name", "title")
RETENTION_DAYS = 30  # "Recently deleted" keeps a document this long before it is purged


class VersionError(Exception):
    def __init__(self, message: str):
        self.message = message


# --- What counts as "the record" ------------------------------------------------------


def visible():
    """SQL condition for document rows that make up the record now."""
    return and_(MedicalDocument.is_current.is_(True), MedicalDocument.deleted_at.is_(None))


def visible_document_ids(patient_id: str):
    return select(MedicalDocument.id).where(MedicalDocument.patient_id == patient_id, visible())


def series_rows(session: Session, series_id: str) -> list[MedicalDocument]:
    rows = session.exec(select(MedicalDocument).where(MedicalDocument.series_id == series_id)).all()
    return sorted(rows, key=lambda d: d.file_version)


def current_row(session: Session, series_id: str) -> MedicalDocument | None:
    return next((d for d in series_rows(session, series_id) if d.is_current), None)


# --- Snapshots and differences ----------------------------------------------------------


def _iso(value: date | datetime | None) -> str | None:
    return value.isoformat() if value else None


def _fact_snapshot(fact: ExtractedFact) -> dict:
    return {
        "id": fact.id,
        "fact_type": fact.fact_type.value,
        "status": fact.status.value,
        "confidence": fact.confidence.value,
        "fields": {key: getattr(fact, key) for key in RAW_FIELDS},
        "corrected_fields": fact.corrected_fields,
        "event_date": _iso(fact.event_date),
        "source_line_ids": list(fact.source_line_ids),
        "source_page": fact.source_page,
        "uncertainty_reasons": list(fact.uncertainty_reasons),
        "extraction_note": fact.extraction_note,
        # For display only; recomputed from fields when restoring.
        "text": display_text(fact.fact_type.value, effective_fields(fact)),
    }


def snapshot(session: Session, doc: MedicalDocument) -> dict:
    facts = session.exec(select(ExtractedFact).where(ExtractedFact.document_id == doc.id)).all()
    return {
        "document_id": doc.id,
        "file_version": doc.file_version,
        "original_filename": doc.original_filename,
        "page_count": doc.page_count,
        "status": doc.status.value,
        "deleted": doc.deleted_at is not None,
        "header": {
            "document_type": doc.document_type.value,
            "document_date": _iso(doc.document_date),
            "document_date_text": doc.document_date_text,
            "facility_name": doc.facility_name,
            "clinician_name": doc.clinician_name,
            "title": doc.title,
        },
        "facts": [_fact_snapshot(f) for f in sorted(facts, key=fact_sort_key)],
    }


def diff(before: dict | None, after: dict) -> list[dict]:
    """What changed between two snapshots, as display-ready items (values as written)."""
    if before is None:
        return [{"kind": "created", "facts": len(after["facts"])}]
    out: list[dict] = []
    if before["document_id"] != after["document_id"]:
        out.append({"kind": "file", "from": before["file_version"], "to": after["file_version"]})
    if before["deleted"] != after["deleted"]:
        out.append({"kind": "deleted" if after["deleted"] else "undeleted"})
    for field in HEADER_FIELDS:
        if field != "title" and before["header"].get(field) != after["header"].get(field):
            out.append({"kind": "header", "field": field, "from": before["header"].get(field),
                        "to": after["header"].get(field)})
    if before["status"] != after["status"]:
        out.append({"kind": "status", "from": before["status"], "to": after["status"]})
    old = {f["id"]: f for f in before["facts"]}
    new = {f["id"]: f for f in after["facts"]}
    if before["document_id"] != after["document_id"]:
        # A different file: compare by count rather than by item.
        if len(old) != len(new):
            out.append({"kind": "facts_count", "from": len(old), "to": len(new)})
        return out
    for fid, fact in new.items():
        if fid not in old:
            out.append({"kind": "fact_added", "fact": fact["text"], "fact_type": fact["fact_type"]})
            continue
        prev = old[fid]
        if prev["status"] != fact["status"]:
            out.append({"kind": "fact_status", "fact": fact["text"], "fact_type": fact["fact_type"],
                        "from": prev["status"], "to": fact["status"]})
        prev_c, new_c = prev.get("corrected_fields") or {}, fact.get("corrected_fields") or {}
        for key in sorted(set(prev_c) | set(new_c)):
            if prev_c.get(key) != new_c.get(key):
                original = fact["fields"].get(key)
                out.append({"kind": "fact_corrected", "fact": fact["text"], "fact_type": fact["fact_type"],
                            "field": key, "from": prev_c.get(key, original), "to": new_c.get(key, original)})
    for fid, fact in old.items():
        if fid not in new:
            out.append({"kind": "fact_removed", "fact": fact["text"], "fact_type": fact["fact_type"]})
    return out


# --- Writing versions -------------------------------------------------------------------


def latest(session: Session, series_id: str) -> RecordVersion | None:
    return session.exec(
        select(RecordVersion).where(RecordVersion.series_id == series_id).order_by(RecordVersion.version_no.desc())
    ).first()


def record_change(
    session: Session,
    doc: MedicalDocument,
    action: str,
    *,
    user_id: str | None = None,
    session_id: str | None = None,
    note: dict | None = None,
    at: datetime | None = None,
) -> RecordVersion | None:
    """Save the document's state after a change as the next version of its series.

    Call before committing, in the same transaction as the change. Returns None (and saves
    nothing) when the state did not change and there is no note to record.
    """
    session.flush()
    previous = latest(session, doc.series_id)
    state = snapshot(session, doc)
    changes = diff(previous.snapshot if previous else None, state)
    if note:
        changes = [note, *changes]
    if previous is not None and not changes:
        return None
    version = RecordVersion(
        patient_id=doc.patient_id,
        series_id=doc.series_id,
        document_id=doc.id,
        version_no=(previous.version_no + 1) if previous else 1,
        action=action,
        actor_user_id=user_id,
        session_id=session_id,
        snapshot=state,
        summary=changes,
    )
    if at is not None:
        version.at = at
    session.add(version)
    return version


def backfill(session: Session) -> int:
    """Version 1 ("existing") for document series that predate history. Idempotent."""
    have = select(RecordVersion.series_id).distinct()
    docs = session.exec(
        select(MedicalDocument).where(MedicalDocument.is_current.is_(True), MedicalDocument.series_id.not_in(have))
    ).all()
    for doc in docs:
        # Dated when the document last changed, not now: it isn't news since anyone's last visit.
        record_change(session, doc, "existing", user_id=doc.uploaded_by_user_id, at=doc.updated_at)
    session.commit()
    return len(docs)


# --- Restoring --------------------------------------------------------------------------


def _unlink_reminders(session: Session, patient_id: str, fact_ids: list[str]) -> None:
    if not fact_ids:
        return
    for reminder in session.exec(
        select(Reminder).where(Reminder.patient_id == patient_id, Reminder.source_fact_id.in_(fact_ids))
    ).all():
        reminder.source_fact_id = None
        reminder.updated_at = utcnow()
        session.add(reminder)


def make_current(session: Session, series_id: str, doc: MedicalDocument) -> None:
    now = utcnow()
    for row in series_rows(session, series_id):
        if row.id != doc.id and row.is_current:
            row.is_current = False
            row.superseded_at = now
            row.updated_at = now
            session.add(row)
    doc.is_current = True
    doc.superseded_at = None
    doc.updated_at = now
    session.add(doc)


def restore(session: Session, series_id: str, version_no: int, user_id: str, session_id: str | None) -> MedicalDocument:
    target = session.exec(
        select(RecordVersion).where(RecordVersion.series_id == series_id, RecordVersion.version_no == version_no)
    ).first()
    if target is None:
        raise VersionError("That version doesn't exist.")
    rows = {d.id: d for d in series_rows(session, series_id)}
    if any(d.deleted_at for d in rows.values()):
        raise VersionError("This document is in Recently deleted. Restore it from there first.")
    if any(d.status in (DocumentStatus.queued, DocumentStatus.processing) for d in rows.values()):
        raise VersionError("A file in this document is still being read. Try again when it has finished.")
    state = target.snapshot
    doc = rows.get(state["document_id"])
    if doc is None:
        raise VersionError("The file for that version is no longer stored.")
    make_current(session, series_id, doc)

    header = state["header"]
    doc.document_type = DocumentType(header["document_type"])
    doc.document_date = date.fromisoformat(header["document_date"]) if header["document_date"] else None
    doc.document_date_text = header["document_date_text"]
    doc.facility_name = header["facility_name"]
    doc.clinician_name = header["clinician_name"]
    doc.title = header["title"]

    wanted = {f["id"]: f for f in state["facts"]}
    existing = {f.id: f for f in session.exec(select(ExtractedFact).where(ExtractedFact.document_id == doc.id)).all()}
    gone = [fid for fid in existing if fid not in wanted]
    _unlink_reminders(session, doc.patient_id, gone)
    for fid in gone:
        session.delete(existing[fid])
    now = utcnow()
    for fid, saved in wanted.items():
        fact = existing.get(fid) or ExtractedFact(id=fid, patient_id=doc.patient_id, document_id=doc.id,
                                                  fact_type=FactType(saved["fact_type"]))
        before = {"status": fact.status.value} if fid in existing else None
        for key in RAW_FIELDS:
            setattr(fact, key, saved["fields"].get(key))
        fact.status = FactStatus(saved["status"])
        fact.confidence = Confidence(saved["confidence"])
        fact.corrected_fields = saved["corrected_fields"]
        fact.event_date = date.fromisoformat(saved["event_date"]) if saved["event_date"] else None
        fact.source_line_ids = saved["source_line_ids"]
        fact.source_page = saved["source_page"]
        fact.uncertainty_reasons = saved["uncertainty_reasons"]
        fact.extraction_note = saved["extraction_note"]
        fact.updated_at = now
        append_history(fact, user_id, "restored", before, {"status": fact.status.value}, f"version {version_no}")
        session.add(fact)
    session.flush()
    refresh_document_status(session, doc)
    doc.updated_at = now
    session.add(doc)
    record_change(session, doc, "restored", user_id=user_id, session_id=session_id,
                  note={"kind": "restored_from", "version": version_no})
    return doc


# --- New file versions --------------------------------------------------------------------


def carry_over_reviews(session: Session, new_doc: MedicalDocument, old_doc: MedicalDocument) -> int:
    """Copy review decisions from the previous file when an item is identical (same type and
    the same fields as written). Labelled in each fact's history."""
    old_facts = session.exec(
        select(ExtractedFact).where(
            ExtractedFact.document_id == old_doc.id,
            ExtractedFact.status.in_([FactStatus.confirmed, FactStatus.corrected, FactStatus.rejected]),
        )
    ).all()
    by_key = {(f.fact_type, tuple(getattr(f, k) for k in RAW_FIELDS)): f for f in old_facts}
    carried = 0
    for fact in session.exec(select(ExtractedFact).where(ExtractedFact.document_id == new_doc.id)).all():
        match = by_key.get((fact.fact_type, tuple(getattr(fact, k) for k in RAW_FIELDS)))
        if match is None or fact.status != FactStatus.unverified:
            continue
        fact.status = match.status
        fact.corrected_fields = match.corrected_fields
        fact.reviewed_by_user_id = match.reviewed_by_user_id
        fact.reviewed_at = match.reviewed_at
        append_history(fact, match.reviewed_by_user_id or "", "carried_over", {"status": "unverified"},
                       {"status": match.status.value}, f"from file version {old_doc.file_version}")
        session.add(fact)
        carried += 1
    session.flush()
    refresh_document_status(session, new_doc)
    return carried


def pending_new_file(session: Session, series_id: str) -> MedicalDocument | None:
    """A newer file of this series that is still being read (not current yet)."""
    rows = series_rows(session, series_id)
    current = next((d for d in rows if d.is_current), None)
    return next(
        (d for d in rows if not d.is_current and current and d.file_version > current.file_version
         and d.status in (DocumentStatus.queued, DocumentStatus.processing)),
        None,
    )


def finish_new_file(session: Session, doc: MedicalDocument) -> None:
    """Called when a new file of an existing series has been read (successfully or not)."""
    current = current_row(session, doc.series_id)
    if current is None or current.id == doc.id:
        return
    if doc.status in (DocumentStatus.needs_review, DocumentStatus.ready):
        carried = carry_over_reviews(session, doc, current)
        make_current(session, doc.series_id, doc)
        record_change(session, doc, "new_file_version", user_id=doc.uploaded_by_user_id,
                      note={"kind": "carried_over", "count": carried} if carried else None)
    else:
        # The new file could not be read: the previous file stays current.
        record_change(session, current, "new_file_failed", user_id=doc.uploaded_by_user_id,
                      note={"kind": "file_failed", "file_version": doc.file_version,
                            "failure_code": doc.failure_code.value if doc.failure_code else None})
    session.commit()


# --- Recently deleted ---------------------------------------------------------------------


def purge_after(deleted_at: datetime) -> datetime:
    return deleted_at + timedelta(days=RETENTION_DAYS)


def version_count(session: Session, series_ids: list[str]) -> dict[str, int]:
    if not series_ids:
        return {}
    rows = session.exec(
        select(RecordVersion.series_id, func.max(RecordVersion.version_no))
        .where(RecordVersion.series_id.in_(series_ids))
        .group_by(RecordVersion.series_id)
    ).all()
    return dict(rows)


def purge_series(session: Session, series_id: str) -> list[str]:
    """Permanently remove every file, page, fact and version of a series. Returns the storage
    keys to delete from disk after the commit."""
    from sqlmodel import delete

    from app.models import DocumentPage

    rows = series_rows(session, series_id)
    doc_ids = [d.id for d in rows]
    fact_ids = list(session.exec(select(ExtractedFact.id).where(ExtractedFact.document_id.in_(doc_ids))).all())
    if rows:
        _unlink_reminders(session, rows[0].patient_id, fact_ids)
    session.exec(delete(ExtractedFact).where(ExtractedFact.document_id.in_(doc_ids)))
    session.exec(delete(DocumentPage).where(DocumentPage.document_id.in_(doc_ids)))
    session.exec(delete(RecordVersion).where(RecordVersion.series_id == series_id))
    keys = [d.storage_key for d in rows]
    for row in rows:
        session.delete(row)
    return keys


def remove_files(keys: list[str]) -> None:
    import logging

    from app import storage

    for key in keys:
        try:
            storage.path_for(key).unlink(missing_ok=True)
        except (OSError, ValueError) as exc:
            # The database delete stands; the orphaned file is noted for clean-up (no names).
            logging.getLogger("medivara.documents").error("document_file_not_removed",
                                                         extra={"exc_type": type(exc).__name__})


def purge_expired(session: Session) -> int:
    """Remove documents that have been in Recently deleted for longer than RETENTION_DAYS.
    Runs at startup and whenever the deleted list is opened."""
    cutoff = utcnow() - timedelta(days=RETENTION_DAYS)
    series = session.exec(
        select(MedicalDocument.series_id).where(MedicalDocument.deleted_at.is_not(None),
                                                MedicalDocument.deleted_at <= cutoff).distinct()
    ).all()
    keys: list[str] = []
    for series_id in series:
        keys += purge_series(session, series_id)
    session.commit()
    remove_files(keys)
    return len(series)
