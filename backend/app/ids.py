"""Prefixed IDs (SRD 07 §1). Seeded records use fixed readable IDs instead."""

import uuid


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4()}"
