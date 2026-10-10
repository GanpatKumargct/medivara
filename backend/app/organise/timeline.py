"""AG-06 timeline builder (FR-022). Deterministic and computed on every read; nothing stored.

Document events and their non-rejected facts, grouped by date. Wording comes only from
fields as written: values and dates, never "better" or "worse".
"""

from collections import defaultdict
from datetime import date

from app.models import MedicalDocument
from app.organise.records import FactView, PatientRecords
from app.pipeline.validation import TYPE_LABELS

EVENT_TYPES = [
    "document",
    "medication",
    "lab_result",
    "condition",
    "allergy",
    "procedure",
    "vital_sign",
    "follow_up",
    "instruction",
]


def _join(*parts: str | None, sep: str = " · ") -> str:
    return sep.join(p for p in parts if p)


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


def document_event(doc: MedicalDocument, facts: list[FactView]) -> dict:
    kinds = [f.fact.fact_type.value for f in facts]
    summary = _join(
        doc.clinician_name,
        _plural(kinds.count("medication"), "medicine") if "medication" in kinds else None,
        _plural(kinds.count("lab_result"), "test result") if "lab_result" in kinds else None,
        "follow-up advice" if "follow_up" in kinds else None,
    )
    sources = doc.header_sources or {}
    line_ids = sorted(
        {i for key in ("document_type", "document_date") if sources.get(key) for i in sources[key]["line_ids"]},
        key=lambda i: tuple(int(x) for x in i.removeprefix("p").split("-l")),
    )
    return {
        "id": f"evt_doc_{doc.id}",
        "date": doc.document_date.isoformat() if doc.document_date else None,
        "event_type": "document",
        "title": _join(TYPE_LABELS.get(doc.document_type.value, "Document"), doc.facility_name or "Unknown source"),
        "summary": summary,
        "document_id": doc.id,
        "fact_id": None,
        "status": None,
        "confidence": None,
        "change": None,
        "source": {"page": 1, "line_ids": line_ids},
    }


def _fact_title_summary(kind: str, f: dict) -> tuple[str, str]:
    name = f.get("name") or ""
    if kind == "medication":
        return _join(name, f.get("strength"), sep=" "), _join(f.get("dose"), f.get("frequency"), f.get("route"), f.get("timing"), f.get("duration"))
    if kind in ("lab_result", "vital_sign"):
        title = _join(name, f.get("value"), f.get("unit"), sep=" ")
        summary = _join(
            f"Reference {f['reference_range']}" if f.get("reference_range") else None,
            f"marked {f['abnormal_flag_as_written']} on the report" if f.get("abnormal_flag_as_written") else None,
        )
        return title, summary
    if kind == "allergy":
        return name or f.get("qualifier") or "", f"Reaction: {f['reaction']}" if f.get("reaction") else ""
    if kind == "condition":
        return name, f.get("qualifier") or ""
    if kind == "follow_up":
        return name, f.get("due_text") or ""
    return name, ""


def fact_event(view: FactView, change: dict | None = None) -> dict:
    kind = view.fact.fact_type.value
    title, summary = _fact_title_summary(kind, view.fields)
    return {
        "id": f"evt_fct_{view.fact.id}",
        "date": view.date.isoformat() if view.date else None,
        "event_type": kind,
        "title": title,
        "summary": summary,
        "document_id": view.document.id,
        "fact_id": view.fact.id,
        "status": view.fact.status.value,
        "confidence": view.fact.confidence.value,
        "change": change,
        "source": {"page": view.fact.source_page, "line_ids": list(view.fact.source_line_ids)},
    }


def build_timeline(
    records: PatientRecords,
    *,
    types: list[str] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    descending: bool = True,
    changes: dict[str, dict] | None = None,
) -> dict:
    """`changes` maps fact IDs to change markers (BE-6.3); markers are null without it."""
    wanted = set(types or EVENT_TYPES)
    has_range = date_from is not None or date_to is not None
    groups: dict[date, list[dict]] = defaultdict(list)
    undated: list[dict] = []

    def place(event_date: date | None, event: dict) -> None:
        if event["event_type"] not in wanted:
            return
        if event_date is None:
            if not has_range:
                undated.append(event)
            return
        if (date_from and event_date < date_from) or (date_to and event_date > date_to):
            return
        groups[event_date].append(event)

    for doc in records.documents:
        doc_facts = records.facts_of(doc.id)
        place(doc.document_date, document_event(doc, doc_facts))
        for view in doc_facts:
            place(view.date, fact_event(view, (changes or {}).get(view.fact.id)))

    ordered = sorted(groups, reverse=descending)
    shown = [e for d in ordered for e in groups[d]] + undated
    return {
        "groups": [{"date": d.isoformat(), "events": groups[d]} for d in ordered],
        "undated": undated,
        "counts": {
            "events": len(shown),
            "documents": sum(1 for e in shown if e["event_type"] == "document"),
            "unverified": sum(1 for e in shown if e["status"] == "unverified"),
        },
    }
