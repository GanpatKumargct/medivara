"""API-60 GET /voice/config and API-61 POST /patients/{patient_id}/voice/session.

Voice conversation runs in the browser against an ElevenLabs Agent. The agent answers health
record questions only by calling a client tool (`ask_medical_records`), which the frontend
fulfils with API-52/API-21, so every answer still goes through the gate and the validator.

Modes:
- signed_url: ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID set. The server fetches a short-lived
  signed URL, so the key never leaves the server.
- public_agent: only ELEVENLABS_AGENT_ID set (a public agent); the browser connects by agent ID.
- off: neither.
The API key is never returned or logged.

The session also returns `dynamic_variables` for the agent's prompt: first names, the profile's
age, the speaker's role, today's date (IST) and a list of the profile's documents described by
metadata only (type, facility, date, review state). Document contents never go in them; facts
reach the agent only as checked answers from the tool.
"""

import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, Request
from sqlmodel import Session, select

from app import audit
from app.access import PatientAccess, require_access
from app.auth import CurrentUser, current_user
from app.config import Settings, get_settings
from app.consents import has_current_consent
from app.db import get_session
from app.errors import ApiError
from app.models import ConsentType, DocumentStatus, MedicalDocument, PatientProfile, Role, User, as_utc
from app.routers import API_PREFIX

router = APIRouter(prefix=API_PREFIX, tags=["voice"])
log = logging.getLogger("medivara.voice")

NOT_SET_UP = "Voice conversation isn't set up on this server."
NO_RESPONSE = "The voice service didn't respond. Try again, or type your question."


def voice_mode(settings: Settings) -> str:
    if settings.elevenlabs_agent_id and settings.elevenlabs_api_key:
        return "signed_url"
    if settings.elevenlabs_agent_id:
        return "public_agent"
    return "off"


IST = ZoneInfo("Asia/Kolkata")
MAX_LISTED_DOCUMENTS = 15
_TYPE_LABELS = {
    "prescription": "Prescription",
    "lab_report": "Lab report",
    "discharge_summary": "Discharge summary",
    "consultation_note": "Consultation note",
}
_STATE_LABELS = {
    DocumentStatus.ready: "reviewed",
    DocumentStatus.needs_review: "not reviewed yet",
    DocumentStatus.queued: "still being read",
    DocumentStatus.processing: "still being read",
    DocumentStatus.failed: "could not be read",
}


def _first_word(name: str | None) -> str:
    parts = (name or "").split()
    return parts[0] if parts else ""


def _day(value: date | datetime | None) -> str:
    return value.strftime("%d %b %Y") if value else "date unknown"


def describe_document(doc: MedicalDocument) -> str:
    """For example "Lab report from Sunrise Diagnostics, 04 May 2026 (not reviewed yet)". Metadata only."""
    kind = _TYPE_LABELS.get(doc.document_type.value, "Document")
    source = f" from {doc.facility_name}" if doc.facility_name else ""
    return f"{kind}{source}, {_day(doc.document_date)} ({_STATE_LABELS[doc.status]})"


def voice_variables(session: Session, patient: PatientProfile, user: User, role: Role) -> dict[str, str]:
    """Dynamic variables for the agent's prompt. All values are strings (contract §5b, API-61)."""
    docs = session.exec(
        select(MedicalDocument)
        .where(MedicalDocument.patient_id == patient.id)
        .order_by(MedicalDocument.created_at.desc(), MedicalDocument.id.desc())
    ).all()
    on_file = [d for d in docs if d.status != DocumentStatus.failed]
    # Newest document date first, undated last.
    listed = sorted(on_file, key=lambda d: d.document_date or date.min, reverse=True)[:MAX_LISTED_DOCUMENTS]
    summary = "; ".join(describe_document(d) for d in listed) or "No documents yet."
    if len(on_file) > MAX_LISTED_DOCUMENTS:
        summary += f"; and {len(on_file) - MAX_LISTED_DOCUMENTS} more"
    latest = docs[0] if docs else None
    return {
        "user_first_name": _first_word(user.display_name),
        "patient_first_name": _first_word(patient.display_name),
        "patient_name": patient.display_name,
        "patient_age": str(patient.age_years) if patient.age_years is not None else "not recorded",
        "access_role": "owner" if role == Role.owner else "caregiver",
        "today": _day(datetime.now(IST)),
        "document_count": str(len(on_file)),
        "documents_summary": summary,
        "latest_document": (
            f"{describe_document(latest)}, added {_day(as_utc(latest.created_at).astimezone(IST))}"
            if latest
            else "No documents yet."
        ),
    }


def fetch_signed_url(settings: Settings) -> str:
    url = settings.elevenlabs_base_url.rstrip("/") + "/v1/convai/conversation/get-signed-url"
    try:
        response = httpx.get(
            url,
            params={"agent_id": settings.elevenlabs_agent_id},
            headers={"xi-api-key": settings.elevenlabs_api_key},
            timeout=settings.timeout_voice_s,
        )
    except Exception as exc:  # noqa: BLE001  any transport failure is the same answer
        log.warning("voice_signed_url_failed", extra={"exc_type": type(exc).__name__})
        raise ApiError(502, "VOICE_UNAVAILABLE", NO_RESPONSE) from None
    if response.status_code != 200:
        log.warning("voice_signed_url_failed", extra={"status": response.status_code})
        raise ApiError(502, "VOICE_UNAVAILABLE", NO_RESPONSE)
    try:
        signed_url = response.json().get("signed_url")
    except Exception as exc:  # noqa: BLE001
        log.warning("voice_signed_url_failed", extra={"exc_type": type(exc).__name__})
        raise ApiError(502, "VOICE_UNAVAILABLE", NO_RESPONSE) from None
    if not isinstance(signed_url, str) or not signed_url:
        log.warning("voice_signed_url_failed", extra={"exc_type": "MissingSignedUrl"})
        raise ApiError(502, "VOICE_UNAVAILABLE", NO_RESPONSE)
    return signed_url


@router.get("/voice/config")
def voice_config(_current: CurrentUser = Depends(current_user)) -> dict:
    mode = voice_mode(get_settings())
    return {"available": mode != "off", "mode": mode}


@router.post("/patients/{patient_id}/voice/session")
def start_voice_session(
    request: Request,
    access: PatientAccess = Depends(require_access("view_records")),
    session: Session = Depends(get_session),
) -> dict:
    user = access.current.user
    # The speaker's own consent (voice is about the person talking, not the profile owner).
    if not has_current_consent(session, user.id, ConsentType.voice_input):
        raise ApiError(
            403,
            "CONSENT_REQUIRED",
            "Turn on voice input in your consent settings first.",
            {"consent_type": ConsentType.voice_input.value},
        )
    settings = get_settings()
    mode = voice_mode(settings)
    if mode == "off":
        raise ApiError(503, "VOICE_UNAVAILABLE", NOT_SET_UP)
    signed_url = fetch_signed_url(settings) if mode == "signed_url" else None
    audit.write(
        request,
        "voice.session_started",
        actor_user_id=user.id,
        patient_id=access.patient.id,
        resource_type="patient",
        resource_id=access.patient.id,
        meta={"mode": mode},
    )
    return {
        "signed_url": signed_url,
        "agent_id": settings.elevenlabs_agent_id if mode == "public_agent" else None,
        "dynamic_variables": voice_variables(session, access.patient, user, access.role),
    }
