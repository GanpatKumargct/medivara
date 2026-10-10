"""Audit writer (FR-104). Metadata holds IDs, counts and codes only, never PHI.

Events are written in their own short transaction, so a denial is recorded even
when the request itself fails, and an audit failure never blocks the user action.
"""

import logging
from typing import Any

from fastapi import Request
from sqlmodel import Session

from app.db import get_engine
from app.models import AuditEvent, AuditOutcome

log = logging.getLogger("medivara.audit")


def write(
    request: Request | None,
    action: str,
    outcome: AuditOutcome = AuditOutcome.success,
    *,
    actor_user_id: str | None = None,
    patient_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    request_id = getattr(request.state, "request_id", None) if request is not None else None
    try:
        with Session(get_engine()) as session:
            session.add(
                AuditEvent(
                    action=action,
                    outcome=outcome,
                    actor_user_id=actor_user_id,
                    patient_id=patient_id,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    request_id=request_id,
                    meta=meta or {},
                )
            )
            session.commit()
    except Exception as exc:  # noqa: BLE001  prototype trade-off: never block the action
        log.error("audit_write_failed", extra={"request_id": request_id, "exc_type": type(exc).__name__})
