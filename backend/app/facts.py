"""Fact presentation shared by API-11 and later the timeline and brief (contract §3)."""

from app.models import ExtractedFact

# `Fact.fields` keys by fact type; every key is always present (null when absent).
FIELDS_BY_TYPE: dict[str, list[str]] = {
    "medication": ["name", "strength", "dose", "frequency", "route", "duration", "timing", "event_date_text"],
    "lab_result": ["name", "value", "unit", "reference_range", "abnormal_flag_as_written", "event_date_text"],
    "condition": ["name", "qualifier", "event_date_text"],
    "allergy": ["name", "qualifier", "reaction"],
    "procedure": ["name", "event_date_text"],
    "vital_sign": ["name", "value", "unit", "event_date_text"],
    "follow_up": ["name", "due_text"],
    "instruction": ["name"],
}

TYPE_ORDER = list(FIELDS_BY_TYPE)


def effective_fields(fact: ExtractedFact) -> dict[str, str | None]:
    """Fields as extracted, with the user's corrections applied on top."""
    keys = FIELDS_BY_TYPE[fact.fact_type.value]
    fields = {key: getattr(fact, key) for key in keys}
    for key, value in (fact.corrected_fields or {}).items():
        if key in fields:
            fields[key] = value
    return fields


def _join(*parts: str | None, sep: str = " ") -> str:
    return sep.join(p for p in parts if p)


def display_text(fact_type: str, f: dict[str, str | None]) -> str:
    name = f.get("name")
    if fact_type in ("lab_result", "vital_sign"):
        text = f"{name}: {_join(f.get('value'), f.get('unit'))}".rstrip(": ")
        if f.get("reference_range"):
            text += f" (ref {f['reference_range']})"
        if f.get("abnormal_flag_as_written"):
            text += f" {f['abnormal_flag_as_written']}"
        return text
    if fact_type == "medication":
        head = _join(name, f.get("strength"))
        return _join(head, f.get("dose"), f.get("frequency"), f.get("route"), f.get("timing"), f.get("duration"), sep=" · ")
    if fact_type == "allergy":
        base = name or f.get("qualifier") or ""
        return f"{base} ({f['reaction']})" if f.get("reaction") else base
    if fact_type == "condition" and f.get("qualifier"):
        return f"{name} ({f['qualifier']})"
    if fact_type == "follow_up" and f.get("due_text") and f["due_text"] not in (name or ""):
        return f"{name} ({f['due_text']})"
    return name or ""


def line_sort_key(line_id: str) -> tuple[int, int]:
    """`p2-l14` → (2, 14), for ordering by first source line."""
    try:
        page, line = line_id.removeprefix("p").split("-l")
        return int(page), int(line)
    except ValueError:
        return (10**6, 10**6)


def fact_sort_key(fact) -> tuple:
    """Display order: fact type, then first source line, then extraction order. The last part
    matters when two facts cite the same line (for example "Diagnosis: A; B"); without it,
    PostgreSQL may return them in any order."""
    first = fact.source_line_ids[0] if fact.source_line_ids else ""
    return (TYPE_ORDER.index(fact.fact_type.value), line_sort_key(first), fact.created_at, fact.id)
