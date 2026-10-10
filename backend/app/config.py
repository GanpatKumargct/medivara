"""Runtime configuration from environment variables (SRD 06 §7)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ — .env and relative paths resolve from here, not from the directory the server
# was started in (otherwise starting it elsewhere silently drops the key and the database URL).
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Model provider: "openrouter" (default) or "gemini" (Google directly).
    llm_provider: Literal["openrouter", "gemini"] = "openrouter"
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.5-flash"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # Sent as reasoning.effort (thinking budget); empty to omit.
    openrouter_reasoning_effort: str = "low"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_fallback_model: str = ""
    gemini_thinking_level: str = "low"
    gemini_retry_backoff_s: float = 2.0
    # Development only: answer identical requests from a local cache to save quota.
    dev_response_cache: bool = False

    ai_mode: Literal["live", "cache_only", "off"] = "live"
    demo_mode: bool = False

    ask_context_token_cap: int = 24000
    timeout_extract_s: int = 60
    timeout_ask_s: int = 20
    timeout_narrative_s: int = 25

    session_hours: int = 12
    # Failed sign-ins allowed per email and per client IP within the window (app/ratelimit.py).
    login_max_failures_per_email: int = 5
    login_max_failures_per_ip: int = 20
    login_window_minutes: int = 15
    policy_version: str = "2026-10-demo-1"

    storage_dir: str = "storage/files"
    # PostgreSQL connection (SQLAlchemy URL). Empty → SQLite file at database_path.
    database_url: str = ""
    database_path: str = "storage/medivara.db"
    golden_cache_dir: str = "golden_cache"
    sample_manifest: str = "../demo-data/manifest.json"
    snapshot_dir: str = "snapshots"

    # Invitation emails (API-54). Sent only when smtp_host and smtp_from are both set.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    # Where the frontend runs; invitation links are {app_base_url}/invite/{invitation_id}.
    app_base_url: str = "http://localhost:5173"

    # Voice conversation through an ElevenLabs Agent (API-60/61). Never returned or logged.
    elevenlabs_api_key: str = ""
    elevenlabs_agent_id: str = ""
    elevenlabs_base_url: str = "https://api.elevenlabs.io"
    # Optional voice for female profiles, sent as an API-61 TTS override. The agent must allow
    # the "Voice" override in its ElevenLabs Security settings, otherwise the session is refused.
    elevenlabs_female_voice_id: str = ""
    timeout_voice_s: int = 10

    @field_validator("storage_dir", "database_path", "golden_cache_dir", "sample_manifest", "snapshot_dir")
    @classmethod
    def _anchor_to_backend(cls, value: str) -> str:
        return str((BACKEND_DIR / value).resolve()) if value else value


@lru_cache
def get_settings() -> Settings:
    return Settings()
