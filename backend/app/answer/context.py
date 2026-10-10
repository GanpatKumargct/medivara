"""AG-10 evidence context assembly (FR-036, AI design §7). Retrieval tier T0: full patient context.

Ask: every line of this patient's processed documents, newest document first, with fact
status tags and user corrections, filtered by patient inside the query. Flagged
instruction-like lines are never included. Narrative: only the brief's evidence lines.
The model sees short keys (D1, L001, C001); the server keeps the key map.
"""

from dataclasses import dataclass, field

from sqlmodel import Session, select

from app.copy import OLDER_NOT_SEARCHED, notice
from app.facts import fact_sort_key
from app.models import ConsultationBrief, DocumentPage, DocumentStatus, ExtractedFact, FactStatus, MedicalDocument
from app.pipeline.normalize import display_date
from app.pipeline.screening import flagged_line_ids
from app.pipeline.validation import TYPE_LABELS

CHARS_PER_TOKEN = 4


@dataclass
class EvidenceEntry:
    key: str
    document_id: str
    document_title: str
    document_type: str
    document_date: str | None  # YYYY-MM-DD
    page: int
    line_ids: list[str]
    text: str
    fact_status: str | None
    is_user_correction: bool = False

    def as_evidence(self, evidence_id: str) -> dict:
        return {
            "evidence_id": evidence_id,
            "document_id": self.document_id,
            "document_title": self.document_title,
            "document_type": self.document_type,
            "document_date": self.document_date,
            "page": self.page,
            "line_ids": list(self.line_ids),
            "text": self.text,
            "fact_status": self.fact_status,
            "is_user_correction": self.is_user_correction,
        }


@dataclass
class Context:
    text: str = ""
    entries: dict[str, EvidenceEntry] = field(default_factory=dict)
    notices: list[dict] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not self.entries


def _status_tag(statuses: set[str]) -> str | None:
    if not statuses:
        return None
    labels = sorted("user marked extraction wrong" if s == "rejected" else s for s in statuses)
    return ", ".join(labels)


def _page(line_id: str) -> int:
    try:
        return int(line_id.removeprefix("p").split("-l")[0])
    except ValueError:
        return 1


def build_ask_context(session: Session, patient_id: str, cap_tokens: int) -> Context:
    docs = session.exec(
        select(MedicalDocument).where(
            MedicalDocument.patient_id == patient_id,
            MedicalDocument.status.in_([DocumentStatus.needs_review, DocumentStatus.ready]),
        )
    ).all()
    # Newest document first; undated last.
    docs = sorted(docs, key=lambda d: (d.document_date is not None, d.document_date, d.created_at), reverse=True)
    doc_ids = [d.id for d in docs]
    pages = session.exec(select(DocumentPage).where(DocumentPage.document_id.in_(doc_ids))).all()
    facts = session.exec(
        select(ExtractedFact).where(ExtractedFact.patient_id == patient_id, ExtractedFact.document_id.in_(doc_ids))
    ).all()

    ctx = Context()
    blocks: list[str] = []
    cap_chars = cap_tokens * CHARS_PER_TOKEN
    used = 0
    line_n = corr_n = 0
    for d_index, doc in enumerate(docs, start=1):
        flagged = flagged_line_ids(doc.flags_detail)
        doc_pages = sorted((p for p in pages if p.document_id == doc.id), key=lambda p: p.page_number)
        doc_facts = sorted((f for f in facts if f.document_id == doc.id), key=fact_sort_key)
        statuses: dict[str, set[str]] = {}
        for fact in doc_facts:
            for line_id in fact.source_line_ids:
                statuses.setdefault(line_id, set()).add(fact.status.value)

        review = "reviewed" if doc.status == DocumentStatus.ready else "needs review"
        date_text = display_date(doc.document_date) if doc.document_date else "undated"
        header = f"D{d_index} · {TYPE_LABELS.get(doc.document_type.value, 'Document')} · {doc.facility_name or 'Unknown source'} · {date_text} · {review}"
        block = [header]
        block_entries: dict[str, EvidenceEntry] = {}
        first_key: dict[str, str] = {}
        base = dict(
            document_id=doc.id,
            document_title=doc.title,
            document_type=doc.document_type.value,
            document_date=doc.document_date.isoformat() if doc.document_date else None,
        )
        n = line_n
        for page in doc_pages:
            for line in page.lines:
                if line["line_id"] in flagged:
                    continue
                n += 1
                key = f"L{n:03d}"
                tag = _status_tag(statuses.get(line["line_id"], set()))
                block.append(f"{key} [D{d_index} p{page.page_number}] {line['text']}" + (f" (fact: {tag})" if tag else ""))
                first_key[line["line_id"]] = key
                block_entries[key] = EvidenceEntry(
                    key=key, page=page.page_number, line_ids=[line["line_id"]], text=line["text"], fact_status=tag, **base
                )
        c = corr_n
        for fact in doc_facts:
            if fact.status != FactStatus.corrected or not fact.corrected_fields:
                continue
            source_key = next((first_key[i] for i in fact.source_line_ids if i in first_key), None)
            for field_name, new in fact.corrected_fields.items():
                c += 1
                key = f"C{c:03d}"
                old = getattr(fact, field_name, None)
                text = f"USER CORRECTION: {field_name} changed from {old} to {new}" + (f" (source line {source_key})" if source_key else "")
                block.append(f"{key} [D{d_index}] {text}")
                block_entries[key] = EvidenceEntry(
                    key=key,
                    page=_page(fact.source_line_ids[0]) if fact.source_line_ids else 1,
                    line_ids=list(fact.source_line_ids),
                    text=text,
                    fact_status="corrected",
                    is_user_correction=True,
                    **base,
                )

        size = sum(len(x) + 1 for x in block)
        if ctx.entries and used + size > cap_chars:
            ctx.notices.append(notice("older_documents_not_searched", OLDER_NOT_SEARCHED))
            break
        used += size
        line_n, corr_n = n, c
        blocks.append("\n".join(block))
        ctx.entries.update(block_entries)
    ctx.text = "\n\n".join(blocks)
    return ctx


def build_narrative_context(brief: ConsultationBrief) -> Context:
    """The brief's evidence snapshot and document headers only (AI design §7.3)."""
    ctx = Context()
    by_doc: dict[str, list[dict]] = {}
    for item in brief.evidence:
        by_doc.setdefault(item["document_id"], []).append(item)
    titles = {s["document_id"]: s["title"] for s in brief.sections.get("sources", [])}
    blocks = []
    n = 0
    for d_index, (doc_id, items) in enumerate(by_doc.items(), start=1):
        first = items[0]
        block = [f"D{d_index} · {titles.get(doc_id, first['document_title'])}"]
        for item in items:
            n += 1
            key = f"L{n:03d}"
            tag = item.get("fact_status")
            block.append(f"{key} [D{d_index} p{item['page']}] {item['text']}" + (f" (fact: {tag})" if tag else ""))
            ctx.entries[key] = EvidenceEntry(
                key=key,
                document_id=doc_id,
                document_title=item["document_title"],
                document_type=item["document_type"],
                document_date=item["document_date"],
                page=item["page"],
                line_ids=list(item["line_ids"]),
                text=item["text"],
                fact_status=tag,
                is_user_correction=item.get("is_user_correction", False),
            )
        blocks.append("\n".join(block))
    ctx.text = "\n\n".join(blocks)
    return ctx
