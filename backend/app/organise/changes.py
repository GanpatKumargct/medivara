"""Timeline change markers (BE-6.3, AI design §9.1). Values and dates only, never "better"/"worse".

- value_change: the same normalised lab test on consecutive dates, when the value differs.
- dose_change: a medicine's strength differs from the previous document that listed it.
"""

from app.organise.records import FactView, PatientRecords
from app.pipeline.normalize import as_number, compact, norm_medicine, norm_text


def _dated(views: list[FactView]) -> list[FactView]:
    return sorted((v for v in views if v.date), key=lambda v: (v.date, v.document.created_at))


def _same_value(a: str | None, b: str | None) -> bool:
    na, nb = as_number(a), as_number(b)
    return na == nb if na is not None and nb is not None else compact(a) == compact(b)


def _point(view: FactView, **values) -> dict:
    return {**values, "document_id": view.document.id, "date": view.date.isoformat() if view.date else None}


def value_changes(records: PatientRecords) -> dict[str, dict]:
    groups: dict[str, list[FactView]] = {}
    for view in records.facts:
        if view.fact.fact_type.value == "lab_result" and view.fields.get("name") and view.fields.get("value"):
            groups.setdefault(norm_text(view.fields["name"]), []).append(view)
    markers = {}
    for views in groups.values():
        ordered = _dated(views)
        for prev, cur in zip(ordered, ordered[1:]):
            if prev.date == cur.date or _same_value(prev.fields["value"], cur.fields["value"]):
                continue
            markers[cur.fact.id] = {
                "kind": "value_change",
                "previous": _point(prev, value=prev.fields["value"], unit=prev.fields.get("unit")),
                "current": _point(cur, value=cur.fields["value"], unit=cur.fields.get("unit")),
            }
    return markers


def dose_changes(records: PatientRecords) -> dict[str, dict]:
    groups: dict[str, list[FactView]] = {}
    for view in records.facts:
        if view.fact.fact_type.value == "medication" and view.fields.get("name") and view.fields.get("strength"):
            groups.setdefault(norm_medicine(view.fields["name"]), []).append(view)
    markers = {}
    for views in groups.values():
        # One entry per document: the previous *document* that listed the medicine.
        by_doc: dict[str, FactView] = {}
        for view in _dated(views):
            by_doc.setdefault(view.document.id, view)
        ordered = list(by_doc.values())
        for prev, cur in zip(ordered, ordered[1:]):
            if compact(prev.fields["strength"]) == compact(cur.fields["strength"]):
                continue
            markers[cur.fact.id] = {
                "kind": "dose_change",
                "previous": _point(prev, strength=prev.fields["strength"]),
                "current": _point(cur, strength=cur.fields["strength"]),
            }
    return markers


def change_markers(records: PatientRecords) -> dict[str, dict]:
    """Fact ID → change marker, for the timeline (API-17)."""
    return {**value_changes(records), **dose_changes(records)}

