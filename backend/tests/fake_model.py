"""A fake Gemini transport for tests: canned extraction outputs keyed by a line in the input.

The canned outputs follow the answer key in docs/hackathon/synthetic-demo-data-pack.md §5.
"""

import json
from types import SimpleNamespace


def lab(name, value, unit, rng, flag, line):
    return {"fact_type": "lab_result", "name": name, "value": value, "unit": unit, "reference_range": rng,
            "abnormal_flag_as_written": flag, "source_line_ids": [line]}


def med(name, strength, dose, frequency, timing, duration, line):
    return {"fact_type": "medication", "name": name, "strength": strength, "dose": dose, "frequency": frequency,
            "timing": timing, "duration": duration, "source_line_ids": [line]}


CANNED = {
    # DOC-1
    "Sample collected: 18-Mar-2025": {
        "document": {"document_type": "lab_report", "document_date_text": "18-Mar-2025",
                     "facility_name": "Sunrise Diagnostics", "clinician_name": None,
                     "header_line_ids": ["p1-l1", "p1-l3"]},
        "facts": [
            lab("HbA1c (Glycated haemoglobin)", "8.4", "%", "4.0 - 5.6", "H", "p1-l6"),
            lab("Fasting plasma glucose", "162", "mg/dL", "70 - 99", "H", "p1-l7"),
            lab("LDL cholesterol", "148", "mg/dL", "< 100", "H", "p1-l8"),
            lab("Serum creatinine", "0.9", "mg/dL", "0.6 - 1.1", None, "p1-l9"),
        ],
    },
    # DOC-4
    "Sample collected: 04/05/2026": {
        "document": {"document_type": "lab_report", "document_date_text": "04/05/2026",
                     "facility_name": "Sunrise Diagnostics", "clinician_name": None,
                     "header_line_ids": ["p1-l1", "p1-l3"]},
        "facts": [
            lab("HbA1c (Glycated haemoglobin)", "7.6", "%", "4.0 - 5.6", "H", "p1-l6"),
            lab("Fasting plasma glucose", "131", "mg/dL", "70 - 99", "H", "p1-l7"),
            lab("LDL cholesterol", "112", "mg/dL", "< 100", "H", "p1-l8"),
            lab("Serum creatinine", "1.0", "mg/dL", "0.6 - 1.1", None, "p1-l9"),
            lab("Haemoglobin", "12.1", "g/dL", None, None, "p1-l10"),
        ],
    },
    # DOC-2
    "Date: 21-Mar-2025": {
        "document": {"document_type": "prescription", "document_date_text": "21-Mar-2025",
                     "facility_name": "Lakeview Family Clinic", "clinician_name": "Dr. Arun Kumar",
                     "header_line_ids": ["p1-l1", "p1-l2", "p1-l3"]},
        "facts": [
            med("Metformin", "500 mg", "1 tablet", "twice daily", "after meals", "90 days", "p1-l8"),
            med("Amlodipine", "5 mg", "1 tablet", "once daily", None, "90 days", "p1-l9"),
            {"fact_type": "condition", "name": "Type 2 diabetes mellitus", "source_line_ids": ["p1-l5"]},
            {"fact_type": "condition", "name": "Hypertension", "source_line_ids": ["p1-l5"]},
            {"fact_type": "allergy", "name": None, "qualifier": "No known drug allergies", "source_line_ids": ["p1-l6"]},
            {"fact_type": "follow_up", "name": "Review after 3 months with HbA1c report", "due_text": "after 3 months",
             "source_line_ids": ["p1-l10"]},
        ],
    },
    # DOC-3
    "Date of discharge: 31-Jul-2025": {
        "document": {"document_type": "discharge_summary", "document_date_text": "31-Jul-2025",
                     "facility_name": "Greenfield General Hospital", "clinician_name": "Dr. Priya Nair",
                     "header_line_ids": ["p1-l1", "p1-l3", "p1-l4"]},
        "facts": [
            med("Metformin", "1000 mg", None, "twice daily", "after meals", None, "p1-l10"),
            med("Amlodipine", "5 mg", None, "once daily", None, None, "p1-l11"),
            med("Atorvastatin", "10 mg", None, "once daily", "at night", None, "p1-l12"),
            {"fact_type": "medication", "name": "ORS sachets", "frequency": "as needed", "duration": "3 days",
             "source_line_ids": ["p1-l13"]},
            {"fact_type": "condition", "name": "Acute gastroenteritis with dehydration", "source_line_ids": ["p1-l5"]},
            {"fact_type": "condition", "name": "Type 2 diabetes mellitus", "qualifier": "Known case of",
             "source_line_ids": ["p1-l6"]},
            {"fact_type": "condition", "name": "Hypertension", "qualifier": "Known case of", "source_line_ids": ["p1-l6"]},
            {"fact_type": "allergy", "name": "Sulfa drugs", "reaction": "rash", "source_line_ids": ["p1-l7"]},
            {"fact_type": "follow_up", "name": "Primary physician in 2 weeks", "due_text": "in 2 weeks",
             "source_line_ids": ["p1-l14"]},
        ],
    },
    # DOC-6 (the injected line p1-l5 must never reach the model)
    "Date: 16-Sep-2026": {
        "document": {"document_type": "consultation_note", "document_date_text": "16-Sep-2026",
                     "facility_name": "Lakeview Family Clinic", "clinician_name": None,
                     "header_line_ids": ["p1-l1", "p1-l2"]},
        "facts": [
            {"fact_type": "instruction", "name": "Diet advice: reduce sugar and salt; include vegetables at every meal",
             "source_line_ids": ["p1-l3"]},
            {"fact_type": "instruction", "name": "Activity: walk 30 minutes daily", "source_line_ids": ["p1-l4"]},
        ],
    },
    # DOC-5
    "Date: 15-Sep-2026": {
        "document": {"document_type": "prescription", "document_date_text": "15-Sep-2026",
                     "facility_name": "Lakeview Family Clinic", "clinician_name": "Dr. Arun Kumar",
                     "header_line_ids": ["p1-l1", "p1-l2", "p1-l3"]},
        "facts": [
            med("Metformin", "1000 mg", "1 tablet", "twice daily", "after meals", "90 days", "p1-l8"),
            med("Amlodipine", "5 mg", "1 tablet", "once daily", None, "90 days", "p1-l9"),
            med("Atorvastatin", "10 mg", "1 tablet", "at night", None, "90 days", "p1-l10"),
            {"fact_type": "condition", "name": "Type 2 diabetes mellitus", "source_line_ids": ["p1-l5"]},
            {"fact_type": "condition", "name": "Hypertension", "source_line_ids": ["p1-l5"]},
            {"fact_type": "condition", "name": "Dyslipidaemia", "source_line_ids": ["p1-l5"]},
            {"fact_type": "allergy", "name": "Sulfa drugs", "source_line_ids": ["p1-l6"]},
            {"fact_type": "follow_up", "name": "Review after 6 weeks with fasting glucose report",
             "due_text": "after 6 weeks", "source_line_ids": ["p1-l12"]},
            {"fact_type": "instruction", "name": "Diet: low sugar, low salt; walk 30 minutes daily",
             "source_line_ids": ["p1-l11"]},
        ],
    },
}


def key_for(model_input: str, needle: str) -> str:
    """The L/C key of the first context line containing `needle` (as the model would cite it)."""
    for line in model_input.splitlines():
        if needle in line and line[:1] in "LC" and line[1:4].isdigit():
            return line.split(" ", 1)[0]
    raise AssertionError(f"no context line contains {needle!r}")


def statement(kind, text, model_input=None, *needles):
    return {"kind": kind, "text": text, "evidence_keys": [key_for(model_input, n) for n in needles]}


def response(payload, status="completed"):
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return SimpleNamespace(status=status, output_text=text,
                           usage=SimpleNamespace(total_input_tokens=500, total_output_tokens=200))


class FakeModel:
    """Records requests; answers from CANNED unless `script` gives per-call behaviour."""

    def __init__(self, script=None, extra=None):
        # Callables taking the model input and returning a payload, for Ask and the narrative.
        self.ask = lambda model_input: {"status": "not_found", "statements": [], "questions_for_doctor": []}
        self.narrate = lambda model_input: {"status": "answered", "statements": [], "questions_for_doctor": []}
        self.requests = []
        self.script = list(script or [])
        # Extra entries are checked first, so they win over the standard markers.
        self.canned = {**(extra or {}), **CANNED}

    def __call__(self, request, timeout):
        self.requests.append(request)
        if self.script:
            step = self.script.pop(0)
            if isinstance(step, Exception):
                raise step
            return step
        if "QUESTION_START" in request["input"]:
            return response(self.ask(request["input"]))
        if "Write the overview of these records." in request["input"]:
            return response(self.narrate(request["input"]))
        for marker, payload in self.canned.items():
            if marker in request["input"]:
                return response(payload)
        return response({"document": {"document_type": "other", "document_date_text": None, "facility_name": None,
                                      "clinician_name": None, "header_line_ids": []}, "facts": []})
