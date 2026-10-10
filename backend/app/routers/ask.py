"""API-21 POST /patients/{patient_id}/ask — single-turn, grounded question answering."""

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, field_validator
from sqlmodel import Session

from app import audit
from app.access import PatientAccess, require_access
from app.answer.service import ask
from app.db import get_session
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["ask"])


class AskRequest(BaseModel):
    question: str
    input_mode: Literal["text", "voice"] = "text"

    @field_validator("question")
    @classmethod
    def _length(cls, value: str) -> str:
        value = value.strip()
        if not 1 <= len(value) <= 500:
            raise ValueError("must be between 1 and 500 characters")
        return value


@router.post("/patients/{patient_id}/ask")
def ask_question(
    body: AskRequest,
    request: Request,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    output, response = ask(session, access.patient.id, access.current.user.id, body.question, body.input_mode)
    # Status and IDs only; the question text is never logged or audited.
    audit.write(
        request,
        "ask.answered",
        actor_user_id=access.current.user.id,
        patient_id=access.patient.id,
        resource_type="ai_output",
        resource_id=output.id,
        meta={"status": output.status, "input_mode": body.input_mode},
    )
    return response
