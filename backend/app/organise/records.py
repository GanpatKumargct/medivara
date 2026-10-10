"""One patient's processed records, loaded once for M3 (timeline, rules, brief).

Every query filters by patient ID. Only documents that finished processing are included,
and rejected facts are never returned.
"""

from dataclasses import dataclass
from datetime import date

from sqlmodel import Session, select

from app.facts import effective_fields, fact_sort_key
from app.models import DocumentPage, DocumentStatus, ExtractedFact, FactStatus, MedicalDocument

PROCESSED = (DocumentStatus.needs_review, DocumentStatus.ready)


@dataclass
class FactView:
    fact: ExtractedFact
    document: MedicalDocument
    fields: dict  # effective fields: as written, with user corrections applied

    @property
    def date(self) -> date | None:
        return self.fact.event_date or self.document.document_date

    @property
    def status(self) -> FactStatus:
        return self.fact.status


@dataclass
class PatientRecords:
    documents: list[MedicalDocument]
    facts: list[FactView]
    lines: dict[tuple[str, str], str]  # (document_id, line_id) → text

    def facts_of(self, document_id: str) -> list[FactView]:
        return [f for f in self.facts if f.document.id == document_id]

    def line_text(self, document_id: str, line_id: str) -> str | None:
        return self.lines.get((document_id, line_id))


def load_records(session: Session, patient_id: str, include_unverified: bool = True) -> PatientRecords:
    documents = session.exec(
        select(MedicalDocument)
        .where(MedicalDocument.patient_id == patient_id, MedicalDocument.status.in_(PROCESSED))
        .order_by(MedicalDocument.created_at)
    ).all()
    by_id = {d.id: d for d in documents}
    statuses = [FactStatus.confirmed, FactStatus.corrected] + ([FactStatus.unverified] if include_unverified else [])
    rows = session.exec(
        select(ExtractedFact).where(
            ExtractedFact.patient_id == patient_id,
            ExtractedFact.document_id.in_(list(by_id)),
            ExtractedFact.status.in_(statuses),
        )
    ).all()
    rows = sorted(rows, key=fact_sort_key)
    facts = [FactView(fact=f, document=by_id[f.document_id], fields=effective_fields(f)) for f in rows]
    pages = session.exec(select(DocumentPage).where(DocumentPage.document_id.in_(list(by_id)))).all()
    lines = {(p.document_id, line["line_id"]): line["text"] for p in pages for line in p.lines}
    return PatientRecords(documents=list(documents), facts=facts, lines=lines)
