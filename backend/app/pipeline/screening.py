"""AG-03 prompt-injection screening (FR-031, AI design §11 layer 2).

Lines that look like instructions to an AI are flagged and excluded from every model
input (extraction here; Ask and narrative context in Sprint 4). A false positive only
adds the COPY-13 banner and drops that line from AI processing; nothing else is lost.
"""

import re

COPY_13 = (
    "This document contains text that looks like instructions to an AI system. MediVara ignored those "
    "instructions and treated the document as information only. Please check that the document is genuine."
)

_PATTERNS = [
    r"\b(ignore|disregard|forget|override)\b.{0,30}\b(instructions?|rules|prompts?|directions)\b",
    r"\bsystem\s+prompt\b",
    r"\byou\s+are\s+now\b",
    r"\bact\s+as\s+(an?|the|my|your)\b",
    r"\bdeveloper\s+mode\b",
    r"\bjailbreak",
    r"^\s*(system|assistant|user)\s*:",
    r"\bnote\s+to\s+(the\s+)?(ai|assistant|model|chatbot|llm)\b",
    r"\b(ai|language\s+model|chatbot|llm)\s*,?\s+(please\s+)?(ignore|tell|say|respond|output)\b",
    r"\btell\s+the\s+patient\s+to\b",
    r"\bdo\s+not\s+mention\b",
    r"\b(reveal|print|show|repeat)\s+(your|the)\s+(system\s+)?(instructions|prompt|rules)\b",
]
_COMPILED = [re.compile(p, re.IGNORECASE) for p in _PATTERNS]


def is_suspicious(text: str) -> bool:
    return any(p.search(text) for p in _COMPILED)


def screen_lines(lines: list[dict]) -> tuple[list[dict], list[dict]]:
    """Split lines into (safe for the model, flagged)."""
    kept, flagged = [], []
    for line in lines:
        (flagged if is_suspicious(line["text"]) else kept).append(line)
    return kept, flagged


def flagged_line_ids(flags_detail: list[dict]) -> set[str]:
    """Line IDs a document's screening excluded, as recorded in its flags_detail."""
    ids: set[str] = set()
    for item in flags_detail or []:
        if item.get("flag") == "suspicious_instructions":
            ids.update(item.get("line_ids") or [])
    return ids
