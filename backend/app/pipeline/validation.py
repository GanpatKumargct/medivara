"""AG-05 validation and confidence (FR-017, AI design §6). Confidence never comes from the model.

Per fact: cited line IDs must exist (otherwise discarded and counted); name and value or
strength must appear in the cited lines; required fields must be present; dates parse
day-first. Hard reasons give `low`, soft reasons only give `medium`, none gives `high`.
"""

from dataclasses import dataclass, field
from datetime import date

from app.facts import line_sort_key
from app.models import Confidence
from app.pipeline.normalize import (
    KNOWN_UNITS,
    ParsedDate,
    appears_in,
    display_date,
    norm_medicine,
    norm_text,
    parse_date,
)

HARD_REASONS = {"value_not_in_source", "name_not_in_source", "missing_required_field", "date_in_future"}

TYPE_LABELS = {
    "prescription": "Prescription",
    "lab_report": "Lab report",
    "discharge_summary": "Discharge summary",
    "consultation_note": "Consultation note",
    "other": "Other document",
    "unknown": "Document",
}

COPY_28 = "The date {as_written} was read as {display} (day first). Please check it."


@dataclass
class ValidatedHeader:
    document_type: str
    document_date: date | None
    document_date_text: str | None
    date_ambiguous: bool
    facility_name: str | None
    clinician_name: str | None
    title: str
    flags: list[str]
    flags_detail: list[dict]
    header_sources: dict


@dataclass
class ValidatedFact:
    values: dict  # extracted fields, as written
    source_line_ids: list[str]
    source_page: int
    event_date: date | None
    confidence: Confidence
    uncertainty_reasons: list[str]


@dataclass
class ValidationResult:
    header: ValidatedHeader
    facts: list[ValidatedFact] = field(default_factory=list)
    discarded: int = 0


def confidence_for(reasons: list[str]) -> Confidence:
    """Hard reasons give low, soft reasons only give medium, none gives high."""
    if HARD_REASONS & set(reasons):
        return Confidence.low
    return Confidence.medium if reasons else Confidence.high


def build_title(document_type: str, facility_name: str | None, document_date: date | None) -> str:
    return " · ".join(
        [
            TYPE_LABELS.get(document_type, "Document"),
            facility_name or "Unknown source",
            display_date(document_date) if document_date else "Undated",
        ]
    )


def _required_missing(fact: dict) -> bool:
    t = fact["fact_type"]
    if t == "medication":
        return not (fact.get("name") and fact.get("frequency") and (fact.get("strength") or fact.get("dose")))
    if t in ("lab_result", "vital_sign"):
        return not (fact.get("name") and fact.get("value"))
    if t == "allergy":
        return not (fact.get("name") or fact.get("qualifier"))
    return not fact.get("name")


def _name_in_source(fact: dict, cited: str) -> bool:
    t = fact["fact_type"]
    if t == "allergy":
        return any(appears_in(v, cited) for v in (fact.get("name"), fact.get("qualifier")) if v)
    name = fact.get("name")
    if not name:
        return True  # reported as missing_required_field instead
    if t == "medication":
        return norm_medicine(name).replace(" ", "") in norm_text(cited).replace(" ", "")
    return appears_in(name, cited)


def _value_in_source(fact: dict, cited: str) -> bool:
    t = fact["fact_type"]
    if t in ("lab_result", "vital_sign"):
        return not fact.get("value") or appears_in(fact["value"], cited)
    if t == "medication":
        return all(appears_in(fact[k], cited) for k in ("strength", "dose") if fact.get(k))
    return True


def validate_fact(
    fact: dict, lines_by_id: dict[str, dict], doc_date: ParsedDate | None, today: date
) -> ValidatedFact | None:
    """Return a ValidatedFact, or None when no cited line exists (discard)."""
    cited_ids = sorted({i for i in fact.get("source_line_ids", []) if i in lines_by_id}, key=line_sort_key)
    if not cited_ids:
        return None
    cited = "\n".join(lines_by_id[i]["text"] for i in cited_ids)

    reasons: list[str] = []
    if not _name_in_source(fact, cited):
        reasons.append("name_not_in_source")
    if not _value_in_source(fact, cited):
        reasons.append("value_not_in_source")
    if _required_missing(fact):
        reasons.append("missing_required_field")

    event = parse_date(fact.get("event_date_text"))
    event_date = event.value if event else None
    if any(d and d > today for d in (event_date, doc_date.value if doc_date else None)):
        reasons.append("date_in_future")

    if fact["fact_type"] in ("lab_result", "vital_sign"):
        unit = fact.get("unit")
        if not unit:
            reasons.append("missing_unit")
        elif unit.strip().lower() not in KNOWN_UNITS:
            reasons.append("unrecognised_unit")
    if fact["fact_type"] == "lab_result" and not fact.get("reference_range"):
        reasons.append("missing_reference_range")
    if (doc_date and doc_date.ambiguous) or (event and event.ambiguous):
        reasons.append("date_ambiguous")
    if fact.get("extraction_note"):
        reasons.append("model_note")

    confidence = confidence_for(reasons)
    values = {k: v for k, v in fact.items() if k not in ("fact_type", "source_line_ids")}
    values["fact_type"] = fact["fact_type"]
    return ValidatedFact(
        values=values,
        source_line_ids=cited_ids,
        source_page=line_sort_key(cited_ids[0])[0],
        event_date=event_date,
        confidence=confidence,
        uncertainty_reasons=reasons,
    )



def _find_source(value: str | None, lines: list[dict], preferred: list[str]) -> dict | None:
    if not value:
        return None
    ordered = [l for l in lines if l["line_id"] in preferred] + [l for l in lines if l["line_id"] not in preferred]
    for line in ordered:
        if appears_in(value, line["text"]):
            return {"line_ids": [line["line_id"]], "text": line["text"]}
    return None


def validate_header(document: dict, lines: list[dict], existing_flags: list[str]) -> ValidatedHeader:
    parsed = parse_date(document.get("document_date_text"))
    preferred = document.get("header_line_ids") or []
    by_id = {l["line_id"]: l for l in lines}
    flags = [f for f in existing_flags if f not in ("date_ambiguous", "date_missing")]
    flags_detail: list[dict] = []
    if parsed is None:
        flags.append("date_missing")
    elif parsed.ambiguous:
        flags.append("date_ambiguous")
        flags_detail.append(
            {
                "flag": "date_ambiguous",
                "text": COPY_28.format(as_written=document["document_date_text"], display=display_date(parsed.value)),
            }
        )

    type_line = next((by_id[i] for i in preferred if i in by_id), lines[0] if lines else None)
    date_source = _find_source(document.get("document_date_text"), lines, preferred)
    header_sources = {
        "document_type": {"line_ids": [type_line["line_id"]], "text": type_line["text"]} if type_line else None,
        "document_date": date_source,
        "facility_name": _find_source(document.get("facility_name"), lines, preferred),
        "clinician_name": _find_source(document.get("clinician_name"), lines, preferred),
    }

    doc_type = document["document_type"]
    title = build_title(doc_type, document.get("facility_name"), parsed.value if parsed else None)
    return ValidatedHeader(
        document_type=doc_type,
        document_date=parsed.value if parsed else None,
        document_date_text=document.get("document_date_text"),
        date_ambiguous=bool(parsed and parsed.ambiguous),
        facility_name=document.get("facility_name"),
        clinician_name=document.get("clinician_name"),
        title=title,
        flags=flags,
        flags_detail=flags_detail,
        header_sources=header_sources,
    )


def validate(document: dict, facts: list[dict], lines: list[dict], existing_flags: list[str], today: date) -> ValidationResult:
    header = validate_header(document, lines, existing_flags)
    doc_date = parse_date(document.get("document_date_text"))
    by_id = {l["line_id"]: l for l in lines}
    result = ValidationResult(header=header)
    for fact in facts:
        validated = validate_fact(fact, by_id, doc_date, today)
        if validated is None:
            result.discarded += 1
        else:
            result.facts.append(validated)
    return result
