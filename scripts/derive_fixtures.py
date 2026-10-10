"""Derive the fixtures the API contract describes in prose (run after extract_fixtures.py).

Usage: python3 scripts/derive_fixtures.py
Each derived file follows the rule written next to its endpoint in docs/srd/11-api-contract.md.
"""

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / "contracts"

COPY_07B = "I can only help with questions about the documents in this MediVara profile."
COPY_08B = "MediVara couldn't check an answer against your documents, so here are the most relevant lines instead."
COPY_11 = "The AI service didn't respond, so MediVara used a saved reading of this same file from earlier testing."
COPY_13 = (
    "This document contains text that looks like instructions to an AI system. MediVara ignored those "
    "instructions and treated the document as information only. Please check that the document is genuine."
)


def load(name):
    return json.loads((C / name).read_text())


def save(name, data):
    (C / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    return name


def main():
    written = []
    review = load("API-11.200.needs-review.json")

    # API-11 ready: all facts reviewed.
    ready = copy.deepcopy(review)
    ready["document"].update(status="ready", fact_counts={"total": 2, "unverified": 0, "low_confidence": 0})
    for fact in ready["facts"]:
        fact.update(status="confirmed", reviewed_at="2026-10-24T05:01:12Z")
    written.append(save("API-11.200.ready.json", ready))

    # API-11 failed-no-text-layer: matches the scanned item in API-10.
    scanned = next(d for d in load("API-10.200.json")["items"] if d["failure_code"] == "NO_TEXT_LAYER")
    failed = {
        "document": {
            **scanned,
            "original_filename": "scanned_prescription.pdf",
            "mime_type": "application/pdf",
            "size_bytes": 71994,
            "header_sources": {"document_type": None, "document_date": None, "facility_name": None, "clinician_name": None},
            "flags_detail": [],
        },
        "facts": [],
    }
    written.append(save("API-11.200.failed-no-text-layer.json", failed))

    # API-11 suspicious: the injection test document (DOC-6).
    sus = copy.deepcopy(review)
    d = sus["document"]
    d.update(
        id="doc_meera_note_2026_09",
        title="Consultation note · Lakeview Family Clinic · 16 Sep 2026",
        document_type="consultation_note",
        document_date="2026-09-16",
        date_ambiguous=False,
        facility_name="Lakeview Family Clinic",
        flags=["suspicious_instructions", "sample"],
        fact_counts={"total": 2, "unverified": 2, "low_confidence": 0},
        original_filename="note_lakeview_sep2026.pdf",
        header_sources={
            "document_type": {"line_ids": ["p1-l1"], "text": "LAKEVIEW FAMILY CLINIC — CLINIC NOTE — SYNTHETIC DEMO DOCUMENT"},
            "document_date": {"line_ids": ["p1-l2"], "text": "Date: 16-Sep-2026   Patient: Meera Raman"},
            "facility_name": {"line_ids": ["p1-l1"], "text": "LAKEVIEW FAMILY CLINIC — CLINIC NOTE — SYNTHETIC DEMO DOCUMENT"},
            "clinician_name": None,
        },
        flags_detail=[{"flag": "suspicious_instructions", "text": COPY_13, "line_ids": ["p1-l5"]}],
    )
    texts = [
        ("p1-l3", "Diet advice: reduce sugar and salt; include vegetables at every meal"),
        ("p1-l4", "Activity: walk 30 minutes daily"),
    ]
    sus["facts"] = [
        {
            "id": f"fct_meera_note_2026_09_0{i}",
            "document_id": "doc_meera_note_2026_09",
            "fact_type": "instruction",
            "display_text": name,
            "fields": {"name": name},
            "event_date": "2026-09-16",
            "source": {"page": 1, "line_ids": [line], "lines": [{"line_id": line, "text": name + "."}]},
            "confidence": "high",
            "uncertainty_reasons": [],
            "status": "unverified",
            "corrected_fields": None,
            "extraction_note": None,
            "reviewed_at": None,
        }
        for i, (line, name) in enumerate(texts, start=1)
    ]
    written.append(save("API-11.200.suspicious.json", sus))

    # API-11 cached: extraction_source cache and the cached_extraction flag.
    cached = copy.deepcopy(review)
    cached["document"].update(extraction_source="cache", flags=[*review["document"]["flags"], "cached_extraction"])
    cached["document"]["flags_detail"] = [*review["document"]["flags_detail"], {"flag": "cached_extraction", "text": COPY_11}]
    written.append(save("API-11.200.cached.json", cached))

    # API-19: API-18 with the narrative from API-20 ready.
    latest = load("API-18.201.json")
    latest["brief"]["overview"].update(narrative_status="ready", narrative=load("API-20.200.ready.json")["narrative"])
    written.append(save("API-19.200.json", latest))

    # API-21 withheld: degraded shape, status withheld, notice code withheld.
    withheld = load("API-21.200.degraded.json")
    withheld.update(answer_id="aio_6f7a8b9c-0d1e-4f2a-3b4c-5d6e7f8a9b0c", status="withheld", latency_ms=7420,
                    notices=[{"code": "withheld", "text": COPY_08B}])
    written.append(save("API-21.200.withheld.json", withheld))

    # API-21 out-of-scope: not-found shape, status out_of_scope, COPY-07b.
    oos = load("API-21.200.not-found.json")
    oos.update(answer_id="aio_7a8b9c0d-1e2f-4a3b-4c5d-6e7f8a9b0c1d", status="out_of_scope")
    oos["statements"][0]["text"] = COPY_07B
    written.append(save("API-21.200.out-of-scope.json", oos))

    print(f"Derived {len(written)} fixtures: {', '.join(written)}")


if __name__ == "__main__":
    main()
