"""Golden cache (BE-5.7, FR-040, AI design §13): validated extractions of the synthetic samples.

Keyed by SHA-256. Used only after a live extraction failure, or in the `cache_only` / `off`
drill modes, and always labelled ("Cached result", COPY-11). Only documents listed in the
sample manifest are ever exported, so no other uploads can enter the cache.

Export (run after Person C has checked the extractions against the answer key):
    uv run python -m app.pipeline.golden_cache export
"""

import json
import sys
from pathlib import Path

from sqlmodel import Session, select

from app.config import get_settings
from app.db import get_engine
from app.models import DocumentStatus, ExtractedFact, FactStatus, MedicalDocument, utcnow
from app.pipeline.extraction import FACT_STRING_FIELDS, Extraction

COPY_11 = "The AI service didn't respond, so MediVara used a saved reading of this same file from earlier testing."


def _dir() -> Path:
    return Path(get_settings().golden_cache_dir)


def _path(sha256: str) -> Path:
    if len(sha256) != 64 or any(c not in "0123456789abcdef" for c in sha256):
        raise ValueError("invalid sha256")
    return _dir() / f"{sha256}.json"


def lookup(sha256: str) -> Extraction | None:
    path = _path(sha256)
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return Extraction(document=data["document"], facts=data["facts"], model_id=data.get("model_id"))


def manifest_hashes() -> set[str]:
    path = Path(get_settings().sample_manifest)
    if not path.exists():
        return set()
    return {s["sha256"] for s in json.loads(path.read_text())["samples"]}


def export(session: Session) -> list[str]:
    """Write one cache file per processed manifest document; returns the file names written."""
    allowed = manifest_hashes()
    docs = session.exec(
        select(MedicalDocument).where(MedicalDocument.status.in_([DocumentStatus.needs_review, DocumentStatus.ready]))
    ).all()
    written = []
    _dir().mkdir(parents=True, exist_ok=True)
    for doc in docs:
        if not (doc.is_sample or doc.sha256 in allowed) or doc.extraction_source != "live":
            continue
        facts = session.exec(
            select(ExtractedFact).where(ExtractedFact.document_id == doc.id, ExtractedFact.status != FactStatus.rejected)
        ).all()
        sources = doc.header_sources or {}
        header_lines = sorted({i for v in sources.values() if v for i in v["line_ids"]})
        payload = {
            "sha256": doc.sha256,
            "original_filename": doc.original_filename,
            "model_id": doc.model_id,
            "prompt_version": doc.prompt_version,
            "exported_at": utcnow().isoformat(),
            "document": {
                "document_type": doc.document_type.value,
                "document_date_text": doc.document_date_text,
                "facility_name": doc.facility_name,
                "clinician_name": doc.clinician_name,
                "header_line_ids": header_lines,
            },
            # Values as extracted (as written), re-checked by AG-05 when the cache is used.
            "facts": [
                {"fact_type": f.fact_type.value, "source_line_ids": list(f.source_line_ids),
                 **{name: getattr(f, name) for name in FACT_STRING_FIELDS}}
                for f in facts
            ],
        }
        path = _path(doc.sha256)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
        written.append(path.name)
    return written


if __name__ == "__main__":
    if sys.argv[1:] != ["export"]:
        sys.exit("Usage: python -m app.pipeline.golden_cache export")
    with Session(get_engine()) as s:
        names = export(s)
    print(f"Exported {len(names)} cached extractions to {_dir()}")
