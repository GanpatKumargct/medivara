"""API-01 GET /health — public; never returns secrets."""

from fastapi import APIRouter

from app.ai_state import ai_status
from app.config import get_settings
from app.models import iso_z, utcnow
from app.routers import API_PREFIX

CONTRACT_VERSION = "1.1.0"

router = APIRouter(prefix=API_PREFIX, tags=["health"])


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "medivara-api",
        "contract_version": CONTRACT_VERSION,
        "demo_mode": get_settings().demo_mode,
        "ai": ai_status(),
        "time": iso_z(utcnow()),
    }
