"""AG-09 intent gate (FR-035, FR-100, AI design §10.1). Rules only; runs before any model call.

Emergencies get COPY-05. Requests for medication advice, diagnosis or judgement of a
clinician get COPY-06 with the relevant record lines. Everything else continues to the
grounded generator. Matching is case-insensitive on word boundaries.
"""

import re
from dataclasses import dataclass, field

EMERGENCY = [
    # Explicit calls for help (also the phrase behind the "emergency" sign, DEC-28).
    r"\bneed\s+(urgent\s+|emergency\s+)?(medical\s+)?help\s+now\b|\bneed\s+emergency\s+help\b",
    r"\bthis\s+is\s+an\s+emergency\b",
    r"chest\s+pain",
    r"chest\s+(hurts?|hurting|is\s+hurting|feels\s+tight|tightness)",
    r"heart\s+attack",
    r"\bnot\s+breathing\b",
    r"\bstopped\s+breathing\b",
    r"\bwant\s+to\s+die\b",
    r"\btook\s+(double|twice|two\s+times|an?\s+extra|extra)\b",
    r"(can'?t|cannot|unable\s+to)\s+breathe?",
    r"(difficulty|trouble|struggling)\s+(in\s+)?breathing",
    r"short(ness)?\s+of\s+breath",
    r"chok(e|ing)",
    r"unconscious",
    r"faint(ed|ing)",
    r"passed\s+out",
    r"seizures?",
    r"\bfits?\b(?!\s+(me|my|the|with|in|into))",
    r"stroke",
    r"face\s+(is\s+)?droop",
    r"slurred\s+speech",
    r"(heavy|severe)\s+bleeding",
    r"(vomiting|coughing)\s+(up\s+)?blood",
    r"overdose",
    r"took\s+(too\s+many|too\s+much|an?\s+extra\s+\w+\s+of)\b",
    r"poison(ed|ing)?",
    r"suicid(e|al)",
    r"kill\s+myself",
    r"end\s+(my|it\s+all|my\s+own)\s*life|end\s+it\s+all",
    r"self[-\s]?harm",
    r"hurt(ing)?\s+myself",
    r"severe\s+allergic\s+reaction",
    r"anaphyla",
    r"(face|throat|tongue|lips?)\b.{0,20}\bswell",
    r"swell(ing|ed)?\b.{0,20}\b(face|throat|tongue|lips?)",
]

MED_VERBS = r"(stop|start|take|skip|increase|decrease|reduce|double|change|switch|halve|quit)"
ADVICE = [
    rf"\bshould\s+i\s+(still\s+)?{MED_VERBS}",
    rf"\b(can|could|may)\s+i\s+(stop|skip|change|double|increase|decrease|reduce|quit|switch)",
    r"\bis\s+it\s+(safe|okay|ok|alright|fine)\s+to\b",
    r"\bhow\s+much\s+(\w+\s+)?should\s+i\s+take",
    r"\bwhat\s+dose\s+(should|do|must)\s+i\b",
    r"\bwhich\s+(medicine|medication|drug|tablet)s?\s+(is|are)\s+(best|better)",
    r"\b(do|did|could|might)\s+i\s+have\b.{0,30}\b(disease|diabetes|cancer|infection|disorder|syndrome|failure|"
    r"condition|kidney|heart|liver|thyroid|hypertension|anae?mia|tumou?r|covid|tuberculosis|tb)\b",
    r"\bis\s+my\s+(doctor|prescription|dose|treatment)\b.{0,30}\b(wrong|right|correct|incorrect|mistaken)",
    r"\bwhich\s+(doctor|document|prescription)\s+is\s+(right|correct|wrong)",
    r"\bam\s+i\s+going\s+to\s+(be\s+)?(ok|okay|fine|die|get\s+better|recover)",
    r"\bis\s+(this|it|that)\s+serious\b",
    rf"\btell\s+me\s+to\s+{MED_VERBS}",
]

_EMERGENCY = [re.compile(p, re.IGNORECASE) for p in EMERGENCY]
_ADVICE = [re.compile(p, re.IGNORECASE) for p in ADVICE]


def normalise(question: str) -> str:
    text = question.replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class GateResult:
    route: str  # emergency · advice_redirect · continue
    medicines: list[str] = field(default_factory=list)


def classify(question: str, patient_medicines: list[str]) -> GateResult:
    """`patient_medicines` are the patient's medicine names as written, for advice evidence."""
    text = normalise(question)
    if any(p.search(text) for p in _EMERGENCY):
        return GateResult("emergency")
    if any(p.search(text) for p in _ADVICE):
        named = [
            m for m in dict.fromkeys(patient_medicines) if re.search(rf"\b{re.escape(m)}\b", text, re.IGNORECASE)
        ]
        return GateResult("advice_redirect", named)
    return GateResult("continue")
