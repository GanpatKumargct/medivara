"""Normalisation used only for comparison (AI design §6.1). Stored values stay as written."""

import re
from dataclasses import dataclass
from datetime import date

_DASHES = str.maketrans({"–": "-", "—": "-", "‑": "-", "−": "-"})
_EDGE_PUNCT = " .,;:!?()[]\"'"
# Digits inside words ("HbA1c", "T4") are not numbers; "500mg" still yields 500.
_NUMBER = re.compile(r"(?<![A-Za-z0-9.])(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)")
_MEDICINE_PREFIX = re.compile(r"^(?:\d+\.\s*)?(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syrup|inj)\.?\s+", re.IGNORECASE)

KNOWN_UNITS = {
    u.lower()
    for u in ("mg", "mcg", "g", "mL", "%", "mg/dL", "mmol/L", "g/dL", "mIU/L", "ng/dL", "ng/mL", "mg/L", "IU", "µIU/mL", "uIU/mL")
}

MONTHS = {
    m: i
    for i, names in enumerate(
        [
            ("jan", "january"),
            ("feb", "february"),
            ("mar", "march"),
            ("apr", "april"),
            ("may",),
            ("jun", "june"),
            ("jul", "july"),
            ("aug", "august"),
            ("sep", "sept", "september"),
            ("oct", "october"),
            ("nov", "november"),
            ("dec", "december"),
        ],
        start=1,
    )
    for m in names
}
MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def norm_text(text: str | None) -> str:
    if not text:
        return ""
    text = text.translate(_DASHES).lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip(_EDGE_PUNCT)


def compact(text: str | None) -> str:
    """Normalised and without spaces, so "500mg" matches "500 mg"."""
    return norm_text(text).replace(" ", "")


def norm_medicine(name: str | None) -> str:
    return norm_text(_MEDICINE_PREFIX.sub("", (name or "").strip()))


def numbers_in(text: str | None) -> list[float]:
    return [float(n.replace(",", "")) for n in _NUMBER.findall((text or "").translate(_DASHES))]


def as_number(text: str | None) -> float | None:
    """The value as a number when the whole value is numeric ("8.40" → 8.4)."""
    if text is None:
        return None
    candidate = text.strip().replace(",", "")
    try:
        return float(candidate)
    except ValueError:
        return None


def appears_in(needle: str | None, haystack: str) -> bool:
    """Whether a value as written appears in the source text, after normalisation."""
    if not needle:
        return False
    number = as_number(needle)
    if number is not None:
        return number in numbers_in(haystack)
    return compact(needle) in compact(haystack)


# --- Dates (day-first, Indian convention) -----------------------------------------------

_NUMERIC_DATE = re.compile(r"\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b")
_DAY_MONTH_YEAR = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?[\s\-./]*([A-Za-z]{3,9})\.?[\s\-.,/]*(\d{4})\b")
_MONTH_DAY_YEAR = re.compile(r"\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b")


@dataclass(frozen=True)
class ParsedDate:
    value: date
    ambiguous: bool


def _make(year: int, month: int, day: int) -> date | None:
    if year < 100:
        year += 2000
    try:
        return date(year, month, day)
    except ValueError:
        return None


def find_dates(text: str | None) -> list[tuple[tuple[int, int], ParsedDate]]:
    """Every date in `text` with its character span, in order (day-first for numeric dates)."""
    if not text:
        return []
    found: list[tuple[tuple[int, int], ParsedDate]] = []
    for m in _NUMERIC_DATE.finditer(text):
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if (d := _make(year, month, day)) is not None:
            found.append((m.span(), ParsedDate(d, ambiguous=day <= 12 and month <= 12)))
    for m in _DAY_MONTH_YEAR.finditer(text):
        month = MONTHS.get(m.group(2).lower())
        if month and (d := _make(int(m.group(3)), month, int(m.group(1)))) is not None:
            found.append((m.span(), ParsedDate(d, ambiguous=False)))
    for m in _MONTH_DAY_YEAR.finditer(text):
        month = MONTHS.get(m.group(1).lower())
        if month and (d := _make(int(m.group(3)), month, int(m.group(2)))) is not None:
            found.append((m.span(), ParsedDate(d, ambiguous=False)))
    found.sort(key=lambda item: item[0])
    # Drop overlaps (a span already covered by an earlier match).
    result, last_end = [], -1
    for span, parsed in found:
        if span[0] >= last_end:
            result.append((span, parsed))
            last_end = span[1]
    return result


def parse_date(text: str | None) -> ParsedDate | None:
    """Parse the first date in `text`. Numeric dates are day-first; when both the day
    and the month are 12 or less the result is flagged ambiguous."""
    dates = find_dates(text)
    return dates[0][1] if dates else None


def display_date(value: date | None) -> str | None:
    """`DD Mon YYYY`, for example 04 May 2026."""
    if value is None:
        return None
    return f"{value.day:02d} {MONTH_ABBR[value.month - 1]} {value.year}"
