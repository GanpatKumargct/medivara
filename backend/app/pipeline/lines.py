"""AG-02 text and line extraction (FR-015, AI design §4).

A line is the text on one baseline of one page. Words are grouped when their vertical
centres are within half the median word height, ordered left to right, and wide gaps
are kept as three spaces, so a lab table row (test, value, unit, range, flag) becomes
one line. Line IDs are `p{page}-l{n}`, numbered top to bottom, and stable for the same file.
"""

from dataclasses import dataclass, field
from statistics import median

import pymupdf

# A page with fewer characters than this is treated as image-only.
MIN_PAGE_CHARS = 20
# A gap wider than this many word-heights separates columns ("   ") rather than words (" ").
COLUMN_GAP_FACTOR = 0.8


class UnreadablePdf(Exception):
    """Encrypted, corrupt or otherwise unopenable PDF."""


@dataclass
class PageLines:
    page_number: int
    width: float
    height: float
    lines: list[dict]
    char_count: int


@dataclass
class ExtractedText:
    pages: list[PageLines] = field(default_factory=list)

    @property
    def has_text(self) -> bool:
        return any(p.char_count >= MIN_PAGE_CHARS for p in self.pages)

    @property
    def low_density(self) -> bool:
        """Some pages have text and some look image-only."""
        return self.has_text and any(p.char_count < MIN_PAGE_CHARS for p in self.pages)


def count_pages(data: bytes) -> int:
    """Page count for upload validation; raises UnreadablePdf if it can't be opened."""
    doc = _open(data)
    try:
        return doc.page_count
    finally:
        doc.close()


def _open(data: bytes) -> pymupdf.Document:
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001  PyMuPDF raises several types for bad files
        raise UnreadablePdf from exc
    if doc.needs_pass or doc.is_encrypted:
        doc.close()
        raise UnreadablePdf
    return doc


def _group_words(words: list[tuple]) -> list[list[tuple]]:
    if not words:
        return []
    heights = [w[3] - w[1] for w in words if w[3] > w[1]]
    tolerance = (median(heights) if heights else 10.0) / 2
    rows: list[dict] = []
    for word in sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        centre = (word[1] + word[3]) / 2
        for row in rows:
            if abs(row["centre"] - centre) <= tolerance:
                row["words"].append(word)
                break
        else:
            rows.append({"centre": centre, "words": [word]})
    rows.sort(key=lambda r: r["centre"])
    return [sorted(r["words"], key=lambda w: w[0]) for r in rows]


def _join(words: list[tuple]) -> str:
    height = median([w[3] - w[1] for w in words]) or 10.0
    parts = [words[0][4]]
    for prev, word in zip(words, words[1:]):
        gap = word[0] - prev[2]
        parts.append("   " if gap > height * COLUMN_GAP_FACTOR else " ")
        parts.append(word[4])
    return "".join(parts)


def extract_lines(data: bytes) -> ExtractedText:
    doc = _open(data)
    result = ExtractedText()
    try:
        for index, page in enumerate(doc, start=1):
            rows = _group_words(page.get_text("words"))
            lines = []
            for n, row in enumerate(rows, start=1):
                bbox = [
                    round(min(w[0] for w in row), 1),
                    round(min(w[1] for w in row), 1),
                    round(max(w[2] for w in row), 1),
                    round(max(w[3] for w in row), 1),
                ]
                lines.append({"line_id": f"p{index}-l{n}", "text": _join(row), "bbox": bbox})
            result.pages.append(
                PageLines(
                    page_number=index,
                    width=page.rect.width,
                    height=page.rect.height,
                    lines=lines,
                    char_count=sum(len(line["text"].replace(" ", "")) for line in lines),
                )
            )
    finally:
        doc.close()
    return result
