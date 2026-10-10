"""Review rules shared by API-13 to API-16 (FR-018 to FR-020, data model §5–6)."""

from sqlmodel import Session, select

from app.models import DocumentStatus, ExtractedFact, FactStatus, MedicalDocument, utcnow

# Data model §6: allowed transitions by action.
TRANSITIONS: dict[str, tuple[set[FactStatus], FactStatus]] = {
    "confirm": ({FactStatus.unverified}, FactStatus.confirmed),
    "correct": ({FactStatus.unverified, FactStatus.confirmed, FactStatus.corrected}, FactStatus.corrected),
    "reject": ({FactStatus.unverified, FactStatus.confirmed, FactStatus.corrected}, FactStatus.rejected),
    "undo_reject": ({FactStatus.rejected}, FactStatus.unverified),
}

REVIEWABLE = {DocumentStatus.needs_review, DocumentStatus.ready}


def refresh_document_status(session: Session, doc: MedicalDocument) -> None:
    """`ready` once no unverified facts remain, otherwise `needs_review` (data model §5)."""
    if doc.status not in REVIEWABLE:
        return
    unverified = session.exec(
        select(ExtractedFact.id).where(
            ExtractedFact.document_id == doc.id, ExtractedFact.status == FactStatus.unverified
        )
    ).first()
    facts_exist = session.exec(select(ExtractedFact.id).where(ExtractedFact.document_id == doc.id)).first()
    # A document with nothing extracted stays in review so the user notices it.
    doc.status = DocumentStatus.needs_review if unverified or not facts_exist else DocumentStatus.ready
    doc.updated_at = utcnow()
    session.add(doc)


def append_history(fact: ExtractedFact, user_id: str, action: str, before, after, note: str | None = None) -> None:
    entry = {"at": utcnow().isoformat(), "by_user_id": user_id, "action": action, "before": before, "after": after}
    if note:
        entry["note"] = note
    # Reassign so the JSON column is marked as changed.
    fact.history = [*fact.history, entry]


def has_reviewed_facts(session: Session, document_id: str) -> bool:
    return (
        session.exec(
            select(ExtractedFact.id).where(
                ExtractedFact.document_id == document_id, ExtractedFact.status != FactStatus.unverified
            )
        ).first()
        is not None
    )
