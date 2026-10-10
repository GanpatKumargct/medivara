"""AG-12 citation and safety validator (FR-038, AI design §8.4). Fails closed.

Each statement must pass every applicable check; failing statements are dropped one at a
time. If fewer than half pass (or none, while the status is `answered`) the response is
withheld and the user gets matching evidence lines instead.
"""

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

from app.answer.context import Context
from app.copy import COPY_08, COPY_08B, COPY_12B, notice
from app.pipeline.normalize import find_dates, norm_medicine, numbers_in

KINDS = {"record_fact", "uncertainty", "explanation", "not_found"}
CITED_KINDS = {"record_fact", "uncertainty"}
MAX_TEXT = 300

PRESCRIPTIVE = [
    r"\byou\s+(should|must|need\s+to|have\s+to|ought\s+to|can)\s+(now\s+)?(stop|start|take|increase|reduce|decrease|change|skip|double|switch|halve|quit)\b",
    r"\b(stop|quit)\s+taking\b",
    r"\b(do\s+not|don'?t|never)\s+take\b",
    r"\bswitch\s+to\b",
    r"\b(increase|reduce|decrease|double|halve|lower|raise)\s+(your|the)\s+(dose|dosage|medicine|medication)",
    r"\b(keep|continue)\s+taking\b",
    r"\b(best|better|wise|advisable|time)\s+to\s+(stop|start|skip|take|double|increase|reduce|decrease|change|switch|quit)\b",
    r"\bconsider\s+(stopping|starting|skipping|taking|doubling|increasing|reducing|decreasing|changing|switching)\b",
    r"\bno\s+longer\s+(need|needed|necessary|required)\b",
]
# A bare medicine verb shortly before one of the patient's medicine names ("Stop Metformin
# now", "Double your Metformin"). "take"/"taken" is left out so quoting a prescription
# ("says to take Metformin twice daily") still passes.
MED_VERB = r"\b(stop|stopping|skip|skipping|start|starting|double|doubling|increase|increasing|reduce|reducing|decrease|decreasing|halve|halving|quit|quitting|switch|switching|change|changing)\b(\W+\w+){0,3}?\W+"
DIAGNOSTIC = [
    r"\byou\s+(probably|likely|may|might|could|possibly)\s+(have|be\s+suffering)\b",
    r"\bthis\s+(means|suggests|indicates|shows|confirms)\s+(that\s+)?you\s+(have|are)\b",
    r"\ba\s+sign\s+of\b",
    r"\byou\s+(have\s+)?(developed|got)\b",
]
# "diagnosis"/"diagnosed" is allowed only when the cited line itself uses the word
# (for example "Diagnosis: Type 2 diabetes mellitus"), like the interpretation words.
_DIAGNOS = re.compile(r"\bdiagnos\w*", re.IGNORECASE)
PROGNOSTIC = [
    r"\byou\s+will\s+(be\s+(fine|ok|okay|alright)|recover|get\s+(worse|better)|improve)",
    r"\bnothing\s+to\s+worry\b",
    r"\bno\s+need\s+to\s+worry\b",
    r"\b(don'?t|do\s+not)\s+worry\b",
    r"\b(will|is\s+going\s+to)\s+(improve|worsen|get\s+worse|get\s+better)\b",
]
CLINICIAN = [
    r"\b(doctor|clinician|physician|hospital|clinic|lab|laboratory)\s+(was|is|were|has\s+been)\s+(wrong|mistaken|incorrect|right|correct)\b",
    r"\bwrong\s+(dose|dosage|medicine|medication|prescription|diagnosis)\b",
    r"\bincorrect\s+(prescription|dose|dosage|diagnosis)\b",
    r"\bmedical\s+error\b",
    r"\b(document|report|prescription|summary)\s+is\s+(wrong|right|correct|incorrect|mistaken)\b",
]
INTERPRETATION = [
    "normal", "abnormal", "improved", "improving", "worse", "worsened", "worsening", "better", "good", "bad",
    "healthy", "unhealthy", "controlled", "uncontrolled", "high", "low", "elevated", "raised", "dangerous",
    "serious", "concerning", "worrying",
]

_SAFETY = [
    ("prescriptive", [re.compile(p, re.IGNORECASE) for p in PRESCRIPTIVE]),
    ("diagnostic", [re.compile(p, re.IGNORECASE) for p in DIAGNOSTIC]),
    ("prognostic", [re.compile(p, re.IGNORECASE) for p in PROGNOSTIC]),
    ("clinician_judgement", [re.compile(p, re.IGNORECASE) for p in CLINICIAN]),
]
_INTERPRET = re.compile(r"\b(" + "|".join(INTERPRETATION) + r")\b", re.IGNORECASE)
_YOU = re.compile(r"\b(you|your|yours)\b", re.IGNORECASE)


@dataclass
class Validated:
    status: str  # answered · not_found · out_of_scope · withheld
    statements: list[dict] = field(default_factory=list)  # {id, kind, text, evidence_ids}
    evidence: list[dict] = field(default_factory=list)
    questions: list[str] = field(default_factory=list)
    notices: list[dict] = field(default_factory=list)
    report: dict = field(default_factory=dict)


def safety_reason(text: str) -> str | None:
    for reason, patterns in _SAFETY:
        if any(p.search(text) for p in patterns):
            return reason
    return None


def _mentions(text: str, name: str) -> bool:
    return bool(re.search(rf"\b{re.escape(name)}\b", text, re.IGNORECASE))


def _numbers_ok(text: str, cited_text: str, cited_dates: set[date]) -> bool:
    spans = find_dates(text)
    for _, parsed in spans:
        if parsed.value not in cited_dates:
            return False
    stripped = text
    for (start, end), _ in reversed(spans):
        stripped = stripped[:start] + " " + stripped[end:]
    evidence_numbers = set(numbers_in(cited_text))
    years = {d.year for d in cited_dates}
    for number in numbers_in(stripped):
        if number in evidence_numbers:
            continue
        if number.is_integer() and 1900 <= number <= 2100 and int(number) in years:
            continue
        return False
    return True


def check_statement(
    st: dict, status: str, ctx: Context, medicines: list[str]
) -> tuple[str | None, list[str]]:
    """Return (failure reason or None, valid cited keys)."""
    kind, text = st.get("kind"), (st.get("text") or "").strip()
    keys = [k for k in st.get("evidence_keys") or [] if isinstance(k, str)]
    if kind not in KINDS or not 1 <= len(text) <= MAX_TEXT:
        return "schema", []
    if kind in CITED_KINDS:
        if not keys or any(k not in ctx.entries for k in keys):
            return "bad_citation", []
    else:
        keys = [k for k in keys if k in ctx.entries]
    entries = [ctx.entries[k] for k in keys]
    cited_text = "\n".join(e.text for e in entries)
    cited_dates = {p.value for e in entries for _, p in find_dates(e.text)}
    cited_dates |= {date.fromisoformat(e.document_date) for e in entries if e.document_date}

    if kind in CITED_KINDS and not _numbers_ok(text, cited_text, cited_dates):
        return "number_not_in_evidence", keys
    if kind in CITED_KINDS | {"explanation"}:
        for name in medicines:
            if _mentions(text, name) and not _mentions(cited_text, name):
                return "medicine_not_in_evidence", keys
    if reason := safety_reason(text):
        return reason, keys
    if any(re.search(MED_VERB + re.escape(name) + r"\b", text, re.IGNORECASE) for name in medicines):
        return "prescriptive", keys
    if _DIAGNOS.search(text) and not _DIAGNOS.search(cited_text):
        return "diagnostic", keys
    if kind in CITED_KINDS:
        for word in _INTERPRET.findall(text):
            if not re.search(rf"\b{re.escape(word)}\b", cited_text, re.IGNORECASE):
                return "interpretation", keys
    if kind == "explanation" and any(_mentions(text, name) for name in medicines):
        return "medicine_not_in_evidence", keys
    if kind == "explanation":
        sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
        # Numbers as standalone values only: digits inside terms such as "HbA1c" are fine.
        if _YOU.search(text) or numbers_in(text) or find_dates(text) or len(sentences) > 2:
            return "explanation_not_generic", keys
    if kind == "not_found" and status != "not_found":
        return "status_mismatch", keys
    return None, keys


_QUESTION_EXTRA = re.compile(r"\b(too|instead|more|less|higher|lower|extra)\b", re.IGNORECASE)


def _clean_questions(raw: list, medicines: list[str]) -> list[str]:
    """Questions must be questions, contain no doses or numbers, no interpretation and no advice."""
    questions = []
    for q in raw or []:
        q = str(q).strip()
        if not q.endswith("?") or len(q) > 200 or q in questions:
            continue
        if safety_reason(q) or _DIAGNOS.search(q) or _INTERPRET.search(q) or numbers_in(q) or _QUESTION_EXTRA.search(q):
            continue
        if any(re.search(MED_VERB + re.escape(n) + r"\b", q, re.IGNORECASE) for n in medicines):
            continue
        questions.append(q)
    return questions[:3]


def validate(data: dict, ctx: Context, medicines: list[str], mode: str) -> Validated:
    """`medicines`: the patient's medicine names as written (normalised for matching)."""
    names = sorted({m for m in medicines if m} | {norm_medicine(m) for m in medicines if m}, key=len, reverse=True)
    status = data.get("status", "answered")
    if mode == "narrative":
        status = "answered"
    raw = [s for s in data.get("statements") or [] if isinstance(s, dict)]
    dropped: Counter = Counter()
    passed: list[tuple[dict, list[str]]] = []
    for st in raw:
        reason, keys = check_statement(st, status, ctx, names)
        if reason:
            dropped[reason] += 1
        else:
            passed.append((st, keys))
    report = {"checked": len(raw), "passed": len(passed), "dropped": dict(dropped)}

    if status in ("not_found", "out_of_scope") and mode == "answer":
        return Validated(status=status, report=report)

    if not passed or len(passed) * 2 < len(raw):
        return Validated(status="withheld", notices=[notice("withheld", COPY_08B)], report=report)

    order: list[str] = []
    for _, keys in passed:
        for key in keys:
            if key not in order:
                order.append(key)
    ids = {key: f"E{i}" for i, key in enumerate(order, start=1)}
    statements = [
        {"id": f"S{i}", "kind": st["kind"], "text": st["text"].strip(), "evidence_ids": [ids[k] for k in keys]}
        for i, (st, keys) in enumerate(passed, start=1)
    ]
    evidence = [ctx.entries[key].as_evidence(ids[key]) for key in order]
    notices = []
    if dropped:
        notices.append(notice("partially_withheld", COPY_08))
    if any((e["fact_status"] or "").find("unverified") >= 0 for e in evidence):
        notices.append(notice("unverified_included", COPY_12B))
    questions = _clean_questions(data.get("questions_for_doctor"), names) if mode == "answer" else []
    return Validated(status="answered", statements=statements, evidence=evidence, questions=questions, notices=notices, report=report)
