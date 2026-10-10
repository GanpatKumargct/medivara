"""BE-8.3: every AG-12 check and every AG-09 pattern family has a failing and a passing case.

Uses a small hand-built context, so the tests don't depend on uploads or the model.
"""

import pytest

from app.answer import gate
from app.answer.context import Context, EvidenceEntry
from app.answer.validator import check_statement, validate

MEDICINES = ["Metformin", "Amlodipine", "Atorvastatin"]


def entry(key, text, date="2026-05-04", status="confirmed"):
    return EvidenceEntry(key=key, document_id="doc_x", document_title="Lab report · Sunrise Diagnostics · 04 May 2026",
                         document_type="lab_report", document_date=date, page=1, line_ids=["p1-l6"], text=text,
                         fact_status=status)


CTX = Context(entries={
    "L001": entry("L001", "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H", status="unverified"),
    "L002": entry("L002", "1. Tab. Metformin 1000 mg — 1 tablet twice daily after meals — 90 days", date="2026-09-15"),
    "L003": entry("L003", "Date of admission: 27-Jul-2025   Date of discharge: 31-Jul-2025", date="2025-07-31"),
    "L004": entry("L004", "Course in hospital: Treated with IV fluids and supportive care. Recovered well.", date="2025-07-31"),
    "L005": entry("L005", "Diagnosis: Type 2 diabetes mellitus; Hypertension", date="2025-03-21"),
})


def reason(kind, text, keys=(), status="answered"):
    return check_statement({"kind": kind, "text": text, "evidence_keys": list(keys)}, status, CTX, MEDICINES)[0]


# (check, failing statement, passing statement) for every row of AI design §8.4.
CASES = [
    ("1 schema: kind", ("safety_notice", "Call 112.", []), ("record_fact", "Your HbA1c was 7.6 %.", ["L001"])),
    ("1 schema: length", ("record_fact", "x" * 301, ["L001"]), ("record_fact", "HbA1c 7.6 %.", ["L001"])),
    ("2 citation: missing", ("record_fact", "Your HbA1c was 7.6 %.", []), ("record_fact", "Your HbA1c was 7.6 %.", ["L001"])),
    ("2 citation: unknown key", ("uncertainty", "Your HbA1c was 7.6 %.", ["L999"]), ("uncertainty", "Your HbA1c was 7.6 %.", ["L001"])),
    ("3 numbers", ("record_fact", "Your HbA1c was 8.1 %.", ["L001"]), ("record_fact", "Your HbA1c was 7.6 %, range 4.0 - 5.6.", ["L001"])),
    ("3 dates", ("record_fact", "You were admitted on 28 Jul 2025.", ["L003"]), ("record_fact", "You were admitted on 27 Jul 2025.", ["L003"])),
    ("3 document date", ("record_fact", "Your HbA1c on 05 May 2026 was 7.6 %.", ["L001"]), ("record_fact", "Your HbA1c on 04 May 2026 was 7.6 %.", ["L001"])),
    ("3 year only", ("record_fact", "Your HbA1c in 2024 was 7.6 %.", ["L001"]), ("record_fact", "Your HbA1c in 2026 was 7.6 %.", ["L001"])),
    ("4 medicine", ("record_fact", "Your list includes Atorvastatin.", ["L002"]), ("record_fact", "Your list includes Metformin.", ["L002"])),
    ("5 prescriptive", ("record_fact", "You should increase Metformin.", ["L002"]), ("record_fact", "Your prescription lists Metformin twice daily.", ["L002"])),
    ("6 diagnostic", ("record_fact", "You probably have kidney disease.", ["L001"]), ("record_fact", "Your HbA1c was 7.6 %.", ["L001"])),
    ("6 diagnosis word", ("record_fact", "You were diagnosed with diabetes.", ["L001"]), ("record_fact", "The diagnosis listed is Type 2 diabetes mellitus.", ["L005"])),
    ("7 prognostic", ("record_fact", "Nothing to worry about with 7.6 %.", ["L001"]), ("record_fact", "The report lists 7.6 %.", ["L001"])),
    ("8 clinician judgement", ("record_fact", "The doctor was wrong about Metformin.", ["L002"]), ("record_fact", "Your doctor prescribed Metformin.", ["L002"])),
    ("9 interpretation", ("record_fact", "Your HbA1c of 7.6 % is high.", ["L001"]), ("record_fact", "The discharge summary says you recovered well.", ["L004"])),
    ("10 explanation: you", ("explanation", "Your HbA1c shows average sugar.", []), ("explanation", "HbA1c shows average blood sugar over recent months.", [])),
    ("10 explanation: number", ("explanation", "HbA1c covers about 3 months.", []), ("explanation", "HbA1c covers about three months.", [])),
    ("10 explanation: medicine", ("explanation", "Metformin lowers blood sugar.", []), ("explanation", "Some medicines lower blood sugar.", [])),
    ("10 explanation: length", ("explanation", "One. Two. Three.", []), ("explanation", "One sentence. Two sentences.", [])),
]


@pytest.mark.parametrize(("check", "bad", "good"), CASES, ids=[c[0] for c in CASES])
def test_each_check_fails_and_passes(check, bad, good):
    assert reason(*bad) is not None, f"{check}: unsafe statement passed"
    assert reason(*good) is None, f"{check}: valid statement rejected ({reason(*good)})"


def test_11_status_mismatch():
    assert reason("not_found", "Not in your documents.", status="answered") == "status_mismatch"
    assert reason("not_found", "Not in your documents.", status="not_found") is None


def test_withholding_thresholds_and_notices():
    good = {"kind": "record_fact", "text": "Your HbA1c was 7.6 %.", "evidence_keys": ["L001"]}
    bad = {"kind": "record_fact", "text": "Your HbA1c was 9.9 %.", "evidence_keys": ["L001"]}
    one_of_four = validate({"status": "answered", "statements": [good, good, good, bad], "questions_for_doctor": []}, CTX, MEDICINES, "answer")
    assert one_of_four.status == "answered" and len(one_of_four.statements) == 3
    assert [n["code"] for n in one_of_four.notices] == ["partially_withheld", "unverified_included"]
    assert one_of_four.statements[0]["evidence_ids"] == ["E1"] and len(one_of_four.evidence) == 1
    three_of_four = validate({"status": "answered", "statements": [good, bad, bad, bad], "questions_for_doctor": []}, CTX, MEDICINES, "answer")
    assert three_of_four.status == "withheld" and three_of_four.statements == []
    none = validate({"status": "answered", "statements": [], "questions_for_doctor": []}, CTX, MEDICINES, "answer")
    assert none.status == "withheld"
    assert three_of_four.report == {"checked": 4, "passed": 1, "dropped": {"number_not_in_evidence": 3}}


def test_questions_for_doctor_are_filtered():
    good = {"kind": "record_fact", "text": "Your HbA1c was 7.6 %.", "evidence_keys": ["L001"]}
    out = validate({"status": "answered", "statements": [good], "questions_for_doctor": [
        "What does my HbA1c mean for my care?", "You should stop taking Metformin?", "Take more tests.", "q4?", "q5?"]},
        CTX, MEDICINES, "answer")
    assert out.questions == ["What does my HbA1c mean for my care?", "q4?", "q5?"]


# --- Gate families (AI design §10.1) -----------------------------------------------------

EMERGENCY_HITS = [
    "I have chest pain", "I can't breathe", "trouble breathing", "my child is choking", "he is unconscious",
    "she fainted", "I passed out", "having a seizure", "is this a stroke", "her face is drooping", "slurred speech now",
    "heavy bleeding", "vomiting blood", "an overdose", "I took too many tablets", "I think I was poisoned",
    "I feel suicidal", "I want to kill myself", "I want to end my life", "thinking of self-harm", "I might hurt myself",
    "severe allergic reaction", "anaphylaxis", "swelling of my throat", "my lips are swelling",
]
ADVICE_HITS = [
    "Should I stop metformin?", "Can I skip my dose?", "Is it safe to take both?", "How much should I take?",
    "What dose should I take?", "Which medicine is best?", "Do I have diabetes?", "Is my prescription wrong?",
    "Which doctor is right?", "Am I going to be OK?", "Is this serious?", "Tell me to double my dose",
]
CONTINUE = [
    "What was my most recent HbA1c?", "What dose of metformin was I prescribed in March 2025?", "Do I have any allergies?",
    "When is my next follow-up?", "Why was I admitted to hospital?", "What is HbA1c?", "Summarise my documents",
    "Which medicines are listed in my latest prescription?", "Has my creatinine been checked?",
]


@pytest.mark.parametrize("text", EMERGENCY_HITS)
def test_emergency_family(text):
    assert gate.classify(text, MEDICINES).route == "emergency"


@pytest.mark.parametrize("text", ADVICE_HITS)
def test_advice_family(text):
    assert gate.classify(text, MEDICINES).route == "advice_redirect"


@pytest.mark.parametrize("text", CONTINUE)
def test_grounded_questions_continue(text):
    assert gate.classify(text, MEDICINES).route == "continue"


def test_gate_normalises_quotes_and_finds_medicines():
    assert gate.classify("I can’t breathe", MEDICINES).route == "emergency"
    r = gate.classify("Should I stop taking METFORMIN or amlodipine?", MEDICINES)
    assert r.route == "advice_redirect" and r.medicines == ["Metformin", "Amlodipine"]
    assert gate.classify("Emergency: chest pain. Should I stop metformin?", MEDICINES).route == "emergency"  # emergency wins
