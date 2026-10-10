"""AG-07 consistency and gap rules (FR-032, AI design §9.1). Deterministic; no AI.

Findings describe what the documents say, cite every line they rely on, and never say
which document or clinician is right. Wording follows COPY-29 to COPY-29c and
COPY-30a to COPY-30d.
"""

from dataclasses import dataclass, field
from datetime import date

from app.organise.records import FactView, PatientRecords
from app.pipeline.normalize import compact, display_date, norm_medicine, norm_text
from app.pipeline.validation import TYPE_LABELS

POINTS = "points_to_clarify"
MISSING = "missing_information"
MAX_LAB_NO_RANGE = 5

NO_ALLERGY_PHRASES = {"no known drug allergies", "nkda", "nil known allergies", "no allergies", "no known allergies"}

# AI design §6.1 frequency table (comparison only). "At night" counts as once daily, so
# "once daily" + timing "at night" and "at night" are the same instruction.
FREQUENCIES = {
    "od": "once daily", "once a day": "once daily", "once daily": "once daily", "daily": "once daily",
    "1-0-0": "once daily", "0-0-1": "once daily", "0-1-0": "once daily",
    "hs": "once daily", "at night": "once daily", "at bedtime": "once daily", "nightly": "once daily",
    "bd": "twice daily", "bid": "twice daily", "twice a day": "twice daily", "twice daily": "twice daily",
    "1-0-1": "twice daily",
    "tds": "three times daily", "tid": "three times daily", "three times a day": "three times daily",
    "three times daily": "three times daily", "1-1-1": "three times daily",
    "qid": "four times daily", "four times a day": "four times daily", "four times daily": "four times daily",
}


@dataclass
class EvidenceRef:
    document_id: str
    line_ids: list[str]
    fact_id: str | None = None


@dataclass
class Finding:
    rule_id: str
    kind: str
    text: str
    evidence: list[EvidenceRef] = field(default_factory=list)
    suggested_question: str | None = None


def _label(view_or_doc) -> str:
    doc = getattr(view_or_doc, "document", view_or_doc)
    return TYPE_LABELS.get(doc.document_type.value, "Document")


def _date_text(d: date | None) -> str:
    return display_date(d) if d else "undated"


def _chrono(views: list[FactView]) -> list[FactView]:
    return sorted(views, key=lambda v: (v.document.document_date is None, v.document.document_date or date.min))


def _ref(view: FactView) -> EvidenceRef:
    return EvidenceRef(view.document.id, list(view.fact.source_line_ids), view.fact.id)


def _join_versions(parts: list[str]) -> str:
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]


def norm_frequency(text: str | None) -> str:
    key = norm_text(text)
    return FREQUENCIES.get(key, key)


def _medicines(records: PatientRecords) -> dict[str, list[FactView]]:
    groups: dict[str, list[FactView]] = {}
    for view in records.facts:
        if view.fact.fact_type.value == "medication" and view.fields.get("name"):
            groups.setdefault(norm_medicine(view.fields["name"]), []).append(view)
    return groups


def dose_differences(records: PatientRecords) -> list[Finding]:
    findings = []
    for views in _medicines(records).values():
        with_strength = _chrono([v for v in views if v.fields.get("strength")])
        by_strength: dict[str, list[FactView]] = {}
        for view in with_strength:
            by_strength.setdefault(compact(view.fields["strength"]), []).append(view)
        if len(by_strength) < 2 or len({v.document.id for v in with_strength}) < 2:
            continue
        latest = with_strength[-1]
        medicine = latest.fields["name"]
        versions = [
            f"{group[0].fields['strength']} ({'; '.join(f'{_label(v)}, {_date_text(v.document.document_date)}' for v in group)})"
            for group in by_strength.values()
        ]
        findings.append(
            Finding(
                rule_id="RULE-MED-DOSE-DIFF",
                kind=POINTS,
                text=(
                    f"Your documents list different strengths for {medicine}: {_join_versions(versions)}. "
                    f"The most recent document lists {latest.fields['strength']}. "
                    "Please confirm your current dose with your doctor."
                ),
                evidence=[_ref(v) for v in with_strength],
                suggested_question=f"Which dose of {medicine} should I be taking now?",
            )
        )
    return findings


def frequency_differences(records: PatientRecords) -> list[Finding]:
    findings = []
    for views in _medicines(records).values():
        by_strength: dict[str, list[FactView]] = {}
        for view in views:
            if view.fields.get("frequency"):
                by_strength.setdefault(compact(view.fields.get("strength")), []).append(view)
        for group in by_strength.values():
            group = _chrono(group)
            by_freq: dict[str, FactView] = {}
            for view in group:
                by_freq.setdefault(norm_frequency(view.fields["frequency"]), view)
            if len(by_freq) < 2 or len({v.document.id for v in group}) < 2:
                continue
            a, b = list(by_freq.values())[:2]
            medicine = group[-1].fields["name"]
            findings.append(
                Finding(
                    rule_id="RULE-MED-FREQ-DIFF",
                    kind=POINTS,
                    text=(
                        f"Your documents list different instructions for how often to take {medicine}: "
                        f"\"{a.fields['frequency']}\" ({_label(a)}, {_date_text(a.document.document_date)}) and "
                        f"\"{b.fields['frequency']}\" ({_label(b)}, {_date_text(b.document.document_date)}). "
                        "Please confirm with your doctor."
                    ),
                    evidence=[_ref(v) for v in group],
                    suggested_question=f"How often should I take {medicine}?",
                )
            )
    return findings


def is_no_allergy(view: FactView) -> bool:
    return any(norm_text(view.fields.get(k)) in NO_ALLERGY_PHRASES for k in ("name", "qualifier"))


def _allergy_statement(view: FactView) -> str:
    if is_no_allergy(view):
        return view.fields.get("qualifier") or view.fields.get("name")
    name = view.fields.get("name") or ""
    return f"{name} ({view.fields['reaction']})" if view.fields.get("reaction") else name


def allergy_findings(records: PatientRecords) -> tuple[list[Finding], list[Finding]]:
    allergies = _chrono([v for v in records.facts if v.fact.fact_type.value == "allergy"])
    if not allergies:
        missing = [Finding("RULE-ALLERGY-MISSING", MISSING, "None of your documents mention allergies.")] if records.documents else []
        return [], missing
    none_known = [v for v in allergies if is_no_allergy(v)]
    listed = [v for v in allergies if not is_no_allergy(v) and v.fields.get("name")]
    if not none_known or not listed:
        return [], []
    a, b = none_known[-1], listed[0]
    return [
        Finding(
            rule_id="RULE-ALLERGY-CONFLICT",
            kind=POINTS,
            text=(
                f"Your documents differ on allergies: \"{_allergy_statement(a)}\" ({_label(a)}, "
                f"{_date_text(a.document.document_date)}) and \"{_allergy_statement(b)}\" ({_label(b)}, "
                f"{_date_text(b.document.document_date)}). Please confirm your allergies with your doctor."
            ),
            evidence=[_ref(v) for v in _chrono(none_known + listed)],
            suggested_question=f"Can you confirm whether I am allergic to {b.fields['name'].lower()}?",
        )
    ], []


def undated_documents(records: PatientRecords) -> list[Finding]:
    findings = []
    for doc in records.documents:
        if doc.document_date is None:
            source = (doc.header_sources or {}).get("document_type")
            findings.append(
                Finding(
                    "RULE-DOC-UNDATED",
                    MISSING,
                    f"{doc.title} has no date we could read.",
                    [EvidenceRef(doc.id, source["line_ids"])] if source else [],
                )
            )
    return findings


def labs_without_range(records: PatientRecords) -> list[Finding]:
    labs = [v for v in records.facts if v.fact.fact_type.value == "lab_result" and not v.fields.get("reference_range")]
    return [
        Finding(
            "RULE-LAB-NO-RANGE",
            MISSING,
            f"{v.fields.get('name')} ({_date_text(v.date)}) has no reference range printed on the report.",
            [_ref(v)],
        )
        for v in _chrono(labs)[:MAX_LAB_NO_RANGE]
    ]


def followup_without_visit(
    records: PatientRecords, reminder_fact_ids: set[str] = frozenset(), appointment_dates: list[date] = ()
) -> list[Finding]:
    """The most recent follow-up instruction with no later document, reminder or appointment."""
    follow_ups = [v for v in records.facts if v.fact.fact_type.value == "follow_up" and v.document.document_date]
    if not follow_ups:
        return []
    latest = max(follow_ups, key=lambda v: v.document.document_date)
    since = latest.document.document_date
    later_document = any(d.document_date and d.document_date > since for d in records.documents)
    later_appointment = any(d > since for d in appointment_dates)
    if later_document or later_appointment or latest.fact.id in reminder_fact_ids:
        return []
    instruction = latest.fields.get("name") or ""
    if instruction and instruction[-1] not in ".!?":
        instruction += "."
    return [
        Finding(
            "RULE-FOLLOWUP-NO-APPT",
            MISSING,
            (
                # The quoted instruction ends with its own full stop (as in the API-18 fixture).
                f"Your {_label(latest).lower()} from {_date_text(since)} says \"{instruction}\" "
                "No later visit, appointment or reminder was found in MediVara."
            ),
            [_ref(latest)],
            "When should my next review be, and which tests should I bring?",
        )
    ]


def run_rules(
    records: PatientRecords, reminder_fact_ids: set[str] = frozenset(), appointment_dates: list[date] = ()
) -> list[Finding]:
    """All findings, points to clarify first. Reminders and appointments arrive in Sprint 5."""
    allergy_points, allergy_missing = allergy_findings(records)
    return [
        *dose_differences(records),
        *frequency_differences(records),
        *allergy_points,
        *allergy_missing,
        *undated_documents(records),
        *followup_without_visit(records, reminder_fact_ids, appointment_dates),
        *labs_without_range(records),
    ]
