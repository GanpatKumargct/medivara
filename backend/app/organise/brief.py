"""AG-08 Consultation Brief assembler (FR-033, AI design §9.2). Deterministic; no AI.

Builds the sections, an evidence snapshot (every cited line, numbered E1… in first-cited
order) and a fingerprint used to detect staleness on read.
"""

import hashlib
from dataclasses import dataclass, field

from sqlmodel import Session, select

from app.versions import visible
from app.copy import COPY_02
from app.models import DocumentStatus, ExtractedFact, FactStatus, MedicalDocument
from app.organise.records import FactView, PatientRecords
from app.organise.rules import Finding, is_no_allergy, run_rules
from app.pipeline.normalize import compact, display_date, norm_medicine, norm_text

MAX_QUESTIONS = 6
MAX_RESULT_QUESTIONS = 2


@dataclass
class EvidenceRegistry:
    """Numbers cited lines E1, E2… in first-cited order; one entry per (document, lines)."""

    records: PatientRecords
    items: list[dict] = field(default_factory=list)
    _index: dict[tuple, str] = field(default_factory=dict)

    def cite(self, document_id: str, line_ids: list[str], fact_status: str | None = None) -> str:
        key = (document_id, tuple(line_ids))
        if key in self._index:
            return self._index[key]
        doc = next(d for d in self.records.documents if d.id == document_id)
        evidence_id = f"E{len(self.items) + 1}"
        self._index[key] = evidence_id
        self.items.append(
            {
                "evidence_id": evidence_id,
                "document_id": doc.id,
                "document_title": doc.title,
                "document_type": doc.document_type.value,
                "document_date": doc.document_date.isoformat() if doc.document_date else None,
                "page": int(line_ids[0].removeprefix("p").split("-l")[0]) if line_ids else 1,
                "line_ids": list(line_ids),
                "text": "\n".join(self.records.line_text(doc.id, i) or "" for i in line_ids),
                "fact_status": fact_status,
                "is_user_correction": False,
            }
        )
        return evidence_id

    def cite_fact(self, view: FactView) -> str:
        return self.cite(view.document.id, list(view.fact.source_line_ids), view.fact.status.value)


def fingerprint(session: Session, patient_id: str) -> str:
    """Hash of every processed document and every fact (status and update time), so any
    upload, review action, correction or deletion makes earlier briefs stale."""
    docs = session.exec(
        select(MedicalDocument.id, MedicalDocument.updated_at).where(
            MedicalDocument.patient_id == patient_id,
            MedicalDocument.status.in_([DocumentStatus.needs_review, DocumentStatus.ready]),
            visible(),
        )
    ).all()
    facts = session.exec(
        select(ExtractedFact.id, ExtractedFact.status, ExtractedFact.updated_at).where(
            ExtractedFact.patient_id == patient_id, ExtractedFact.document_id.in_([d[0] for d in docs])
        )
    ).all()
    parts = sorted(f"d:{i}:{u.isoformat()}" for i, u in docs) + sorted(f"f:{i}:{s.value}:{u.isoformat()}" for i, s, u in facts)
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def _badges(view: FactView, differ_ids: set[str]) -> list[str]:
    badges = []
    if view.fact.id in differ_ids:
        badges.append("documents_differ")
    if view.status == FactStatus.corrected:
        badges.append("corrected")
    return badges


def _join(*parts: str | None, sep: str = " ") -> str:
    return sep.join(p for p in parts if p)


def _chrono(views: list[FactView]) -> list[FactView]:
    return sorted(views, key=lambda v: (v.date is None, v.date or v.document.created_at.date(), v.document.created_at))


def build_brief(records: PatientRecords, patient, visit_reason: str | None, findings: list[Finding] | None = None) -> dict:
    findings = run_rules(records) if findings is None else findings
    reg = EvidenceRegistry(records)
    differ_fact_ids = {e.fact_id for f in findings if f.rule_id != "RULE-ALLERGY-MISSING" for e in f.evidence if e.fact_id}

    docs = records.documents
    dated = sorted(d.document_date for d in docs if d.document_date)
    providers = {norm_text(d.facility_name) for d in docs if d.facility_name}
    unverified = sum(1 for v in records.facts if v.status == FactStatus.unverified)

    # Medicines: only from the most recent document that lists medicines (DEC-22).
    meds = [v for v in records.facts if v.fact.fact_type.value == "medication"]
    med_docs = list({v.document.id: v.document for v in meds}.values())
    dated_med_docs = sorted((d for d in med_docs if d.document_date), key=lambda d: (d.document_date, d.created_at))
    current_doc = (dated_med_docs or med_docs)[-1] if med_docs else None
    medications, other_meds = [], []
    if current_doc:
        current = [v for v in meds if v.document.id == current_doc.id]
        current_names = {norm_medicine(v.fields.get("name")) for v in current}
        for n, v in enumerate(current, start=1):
            f = v.fields
            medications.append(
                {
                    "id": f"B-MED-{n}",
                    "text": _join(
                        _join(f.get("name"), f.get("strength")),
                        _join(f.get("dose"), f.get("frequency"), f.get("route"), f.get("timing")),
                        f.get("duration"),
                        sep=" · ",
                    ),
                    "status": v.status.value,
                    "badges": _badges(v, differ_fact_ids),
                    "evidence_ids": [reg.cite_fact(v)],
                }
            )
        older: dict[str, FactView] = {}
        for v in _chrono([m for m in meds if norm_medicine(m.fields.get("name")) not in current_names]):
            older[norm_medicine(v.fields.get("name"))] = v  # keeps the most recent mention
        for n, v in enumerate(older.values(), start=1):
            other_meds.append(
                {
                    "id": f"B-OMED-{n}",
                    "name": v.fields.get("name"),
                    "last_seen_date": v.date.isoformat() if v.date else None,
                    "evidence_ids": [reg.cite_fact(v)],
                }
            )

    conditions, seen = [], {}
    for v in _chrono([c for c in records.facts if c.fact.fact_type.value == "condition" and c.fields.get("name")]):
        seen.setdefault(norm_text(v.fields["name"]), v)
    for n, v in enumerate(seen.values(), start=1):
        first = f" (first documented {display_date(v.date)})" if v.date else ""
        conditions.append(
            {
                "id": f"B-CON-{n}",
                "text": f"{v.fields['name']}{first}",
                "status": v.status.value,
                "badges": _badges(v, differ_fact_ids),
                "evidence_ids": [reg.cite_fact(v)],
            }
        )

    labs: dict[str, list[FactView]] = {}
    for v in _chrono([l for l in records.facts if l.fact.fact_type.value == "lab_result" and l.fields.get("name")]):
        labs.setdefault(norm_text(v.fields["name"]), []).append(v)
    results = []
    for n, views in enumerate(labs.values(), start=1):
        results.append(
            {
                "id": f"B-LAB-{n}",
                "test_name": views[-1].fields["name"],
                "reference_range_as_written": next(
                    (v.fields["reference_range"] for v in reversed(views) if v.fields.get("reference_range")), None
                ),
                "values": [
                    {
                        "date": v.date.isoformat() if v.date else None,
                        "value": v.fields.get("value"),
                        "unit": v.fields.get("unit"),
                        "flag_as_written": v.fields.get("abnormal_flag_as_written"),
                        "status": v.status.value,
                        "evidence_ids": [reg.cite_fact(v)],
                    }
                    for v in views
                ],
            }
        )

    allergy_views = _chrono([a for a in records.facts if a.fact.fact_type.value == "allergy"])
    listed = [a for a in allergy_views if not is_no_allergy(a) and a.fields.get("name")]
    by_allergen: dict[str, list[FactView]] = {}
    for v in listed:
        by_allergen.setdefault(compact(v.fields["name"]), []).append(v)
    allergy_items = []
    for n, views in enumerate(by_allergen.values(), start=1):
        best = next((v for v in views if v.fields.get("reaction")), views[-1])
        text = f"{best.fields['name']} ({best.fields['reaction']})" if best.fields.get("reaction") else best.fields["name"]
        allergy_items.append(
            {
                "id": f"B-ALG-{n}",
                "text": text,
                "status": best.status.value,
                "badges": sorted({b for v in views for b in _badges(v, differ_fact_ids)}),
                "evidence_ids": [reg.cite_fact(v) for v in views],
            }
        )
    if not allergy_items:
        none_known = [a for a in allergy_views if is_no_allergy(a)]
        if none_known:
            v = none_known[-1]
            allergy_items.append(
                {
                    "id": "B-ALG-1",
                    "text": v.fields.get("qualifier") or v.fields.get("name"),
                    "status": v.status.value,
                    "badges": _badges(v, differ_fact_ids),
                    "evidence_ids": [reg.cite_fact(v)],
                }
            )
    conflict = any(f.rule_id == "RULE-ALLERGY-CONFLICT" for f in findings)
    allergy_status = "conflicting" if conflict else ("documented" if allergy_items else "not_documented")

    def finding_out(n: int, f: Finding) -> dict:
        statuses = {fv.fact.id: fv.status.value for fv in records.facts}
        return {
            "id": f"F-{n}",
            "rule_id": f.rule_id,
            "text": f.text,
            "evidence_ids": [reg.cite(e.document_id, e.line_ids, statuses.get(e.fact_id)) for e in f.evidence],
            "suggested_question": f.suggested_question,
        }

    numbered = list(enumerate(findings, start=1))
    points = [finding_out(n, f) for n, f in numbered if f.kind == "points_to_clarify"]
    missing = [finding_out(n, f) for n, f in numbered if f.kind == "missing_information"]

    questions: list[str] = []
    for f in findings:
        if f.suggested_question and f.suggested_question not in questions:
            questions.append(f.suggested_question)
    for lab in [r for r in results if len(r["values"]) >= 2][:MAX_RESULT_QUESTIONS]:
        q = f"What do my recent {lab['test_name'].split(' (')[0]} results mean for my care?"
        if q not in questions:
            questions.append(q)

    cited_docs = {e["document_id"] for e in reg.items}
    cited = [d for d in docs if d.id in cited_docs]
    # Newest first, undated last.
    sources = [
        {"document_id": d.id, "title": d.title}
        for d in sorted((d for d in cited if d.document_date), key=lambda d: d.document_date, reverse=True)
    ] + [{"document_id": d.id, "title": d.title} for d in cited if not d.document_date]
    templated = (
        f"Based on {len(docs)} document{'s' if len(docs) != 1 else ''} from {len(providers)} "
        f"provider{'s' if len(providers) != 1 else ''}"
        + (f" between {display_date(dated[0])} and {display_date(dated[-1])}." if dated else ".")
    )
    return {
        "header": {
            "patient_display_name": patient.display_name,
            "age_years": patient.age_years,
            "documents_count": len(docs),
            "providers_count": len(providers),
            "date_range": {"from": dated[0].isoformat(), "to": dated[-1].isoformat()} if dated else None,
            "unverified_items_count": unverified,
        },
        "templated_text": templated,
        "sections": {
            "medications_from": {"document_id": current_doc.id, "title": current_doc.title} if current_doc else None,
            "medications": medications,
            "other_medications_mentioned": other_meds,
            "conditions": conditions,
            "results_over_time": results,
            "allergies": {"status": allergy_status, "items": allergy_items},
            "points_to_clarify": points,
            "missing_information": missing,
            "questions_for_doctor": questions[:MAX_QUESTIONS],
        },
        "evidence": reg.items,
        "sources": sources,
        "disclaimer": COPY_02,
    }
