"""Tables (SRD 07 §3). Timestamps are timezone-aware UTC."""

from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Column, Index, text
from sqlmodel import Field, SQLModel

from app.ids import new_id


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """SQLite may hand back naive values; treat them as UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def iso_z(dt: datetime | None) -> str | None:
    """Format a timestamp as ISO 8601 UTC with Z, to the second."""
    if dt is None:
        return None
    return as_utc(dt).replace(microsecond=0, tzinfo=None).isoformat() + "Z"


class Scope(str, Enum):
    view_records = "view_records"
    upload_documents = "upload_documents"
    manage_reminders = "manage_reminders"


ALL_SCOPES = [s.value for s in Scope]


class Role(str, Enum):
    owner = "owner"
    caregiver = "caregiver"


class GrantStatus(str, Enum):
    active = "active"
    revoked = "revoked"


class ConsentType(str, Enum):
    terms_and_disclaimer = "terms_and_disclaimer"
    ai_processing = "ai_processing"
    sharing = "sharing"
    voice_input = "voice_input"
    notifications = "notifications"


class AuditOutcome(str, Enum):
    success = "success"
    denied = "denied"
    error = "error"


class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: new_id("usr"), primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    display_name: str
    is_demo: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    last_login_at: datetime | None = None


class AuthSession(SQLModel, table=True):
    """A sign-in session (named to avoid clashing with sqlmodel.Session)."""

    __tablename__ = "session"

    id: str = Field(default_factory=lambda: new_id("ses"), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime
    revoked_at: datetime | None = None


class PatientProfile(SQLModel, table=True):
    __tablename__ = "patient_profile"

    id: str = Field(default_factory=lambda: new_id("pat"), primary_key=True)
    owner_user_id: str = Field(foreign_key="user.id", index=True)
    display_name: str
    age_years: int | None = None
    is_synthetic: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class PatientAccessGrant(SQLModel, table=True):
    __tablename__ = "patient_access_grant"
    # At most one active grant per (patient, grantee).
    __table_args__ = (
        Index(
            "uq_active_grant",
            "patient_id",
            "grantee_user_id",
            unique=True,
            sqlite_where=text("status = 'active'"),
            postgresql_where=text("status = 'active'"),
        ),
    )

    id: str = Field(default_factory=lambda: new_id("grt"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    grantee_user_id: str = Field(foreign_key="user.id", index=True)
    role: Role
    scopes: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    status: GrantStatus = GrantStatus.active
    granted_by_user_id: str = Field(foreign_key="user.id")
    consent_record_id: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    revoked_at: datetime | None = None
    revoked_by_user_id: str | None = None


class ConsentRecord(SQLModel, table=True):
    __tablename__ = "consent_record"

    id: str = Field(default_factory=lambda: new_id("cns"), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    patient_id: str | None = Field(default=None, foreign_key="patient_profile.id")
    consent_type: ConsentType
    granted: bool
    policy_version: str
    created_at: datetime = Field(default_factory=utcnow)
    # IDs only, never PHI.
    context: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class AuditEvent(SQLModel, table=True):
    __tablename__ = "audit_event"

    id: str = Field(default_factory=lambda: new_id("aud"), primary_key=True)
    at: datetime = Field(default_factory=utcnow, index=True)
    actor_user_id: str | None = None
    patient_id: str | None = Field(default=None, index=True)
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    outcome: AuditOutcome
    request_id: str | None = None
    # IDs, counts and codes only. Never document text, question text, values or names.
    meta: dict[str, Any] = Field(default_factory=dict, sa_column=Column("metadata", JSON, nullable=False))


# --- Documents, pages and facts (SRD 07 §3.6–3.8) -------------------------------------


class DocumentType(str, Enum):
    prescription = "prescription"
    lab_report = "lab_report"
    discharge_summary = "discharge_summary"
    consultation_note = "consultation_note"
    other = "other"
    unknown = "unknown"


class DocumentStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    needs_review = "needs_review"
    ready = "ready"
    failed = "failed"


class DocumentStage(str, Enum):
    queued = "queued"
    reading_text = "reading_text"
    screening = "screening"
    extracting = "extracting"
    validating = "validating"
    done = "done"
    no_text_layer = "no_text_layer"


class FailureCode(str, Enum):
    UNREADABLE_PDF = "UNREADABLE_PDF"
    NO_TEXT_LAYER = "NO_TEXT_LAYER"
    AI_UNAVAILABLE = "AI_UNAVAILABLE"
    AI_BLOCKED = "AI_BLOCKED"
    AI_INVALID_OUTPUT = "AI_INVALID_OUTPUT"
    AI_TIMEOUT = "AI_TIMEOUT"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class FactType(str, Enum):
    medication = "medication"
    lab_result = "lab_result"
    condition = "condition"
    allergy = "allergy"
    procedure = "procedure"
    vital_sign = "vital_sign"
    follow_up = "follow_up"
    instruction = "instruction"


class Confidence(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class FactStatus(str, Enum):
    unverified = "unverified"
    confirmed = "confirmed"
    corrected = "corrected"
    rejected = "rejected"


def _json_list() -> Any:
    return Field(default_factory=list, sa_column=Column(JSON, nullable=False))


def _json_dict() -> Any:
    return Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class MedicalDocument(SQLModel, table=True):
    __tablename__ = "medical_document"

    id: str = Field(default_factory=lambda: new_id("doc"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    uploaded_by_user_id: str = Field(foreign_key="user.id")
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str = Field(index=True)
    storage_key: str
    page_count: int
    title: str
    document_type: DocumentType = DocumentType.unknown
    document_type_source: str | None = None  # ai · user
    document_type_hint: str | None = None
    document_date: date | None = None
    document_date_text: str | None = None
    document_date_source: str | None = None  # ai · user
    date_ambiguous: bool = False
    facility_name: str | None = None
    clinician_name: str | None = None
    status: DocumentStatus = DocumentStatus.queued
    stage: DocumentStage = DocumentStage.queued
    failure_code: FailureCode | None = None
    failure_message: str | None = None
    flags: list[str] = _json_list()
    # [{flag, text, line_ids?}] shown as banners in SCR-06.
    flags_detail: list[dict[str, Any]] = _json_list()
    # {field: {line_ids, text} | null} for document_type, document_date, facility_name, clinician_name.
    header_sources: dict[str, Any] = _json_dict()
    # Header fields the user corrected through API-14; reprocessing keeps them.
    user_edited_fields: list[str] = _json_list()
    is_sample: bool = False
    extraction_source: str = "none"  # live · cache · none
    model_id: str | None = None
    prompt_version: str | None = None
    discarded_fact_count: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    processed_at: datetime | None = None


class DocumentPage(SQLModel, table=True):
    __tablename__ = "document_page"

    id: str = Field(default_factory=lambda: new_id("pg"), primary_key=True)
    document_id: str = Field(foreign_key="medical_document.id", index=True)
    page_number: int
    width: float
    height: float
    text_source: str = "pdf_text_layer"
    # [{line_id, text, bbox}] with line_id "p{page}-l{n}".
    lines: list[dict[str, Any]] = _json_list()
    char_count: int = 0


class ExtractedFact(SQLModel, table=True):
    __tablename__ = "extracted_fact"

    id: str = Field(default_factory=lambda: new_id("fct"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    document_id: str = Field(foreign_key="medical_document.id", index=True)
    fact_type: FactType
    # Values exactly as written in the document.
    name: str | None = None
    value: str | None = None
    unit: str | None = None
    reference_range: str | None = None
    abnormal_flag_as_written: str | None = None
    strength: str | None = None
    dose: str | None = None
    frequency: str | None = None
    route: str | None = None
    duration: str | None = None
    timing: str | None = None
    qualifier: str | None = None
    reaction: str | None = None
    due_text: str | None = None
    event_date_text: str | None = None
    event_date: date | None = None
    source_line_ids: list[str] = _json_list()
    source_page: int = 1
    confidence: Confidence = Confidence.medium
    uncertainty_reasons: list[str] = _json_list()
    extraction_note: str | None = None
    status: FactStatus = FactStatus.unverified
    corrected_fields: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    history: list[dict[str, Any]] = _json_list()
    reviewed_by_user_id: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


# --- Briefs and AI outputs (SRD 07 §3.10–3.11) ------------------------------------------


class ConsultationBrief(SQLModel, table=True):
    __tablename__ = "consultation_brief"

    id: str = Field(default_factory=lambda: new_id("brf"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    created_by_user_id: str = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=utcnow, index=True)
    include_unverified: bool = True
    visit_reason: str | None = None
    # Deterministic body: header, overview.templated_text, sections, sources.
    sections: dict[str, Any] = _json_dict()
    # Snapshot of every cited line at creation time, so the brief stays traceable.
    evidence: list[dict[str, Any]] = _json_list()
    fingerprint: str
    narrative_output_id: str | None = None


class AIOutput(SQLModel, table=True):
    __tablename__ = "ai_output"

    id: str = Field(default_factory=lambda: new_id("aio"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    requested_by_user_id: str = Field(foreign_key="user.id")
    output_type: str  # answer · brief_narrative
    input_mode: str | None = None  # text · voice (answers only)
    # Stored for traceability; deleted by the demo reset. Never logged.
    question_text: str | None = None
    status: str
    statements: list[dict[str, Any]] = _json_list()
    evidence: list[dict[str, Any]] = _json_list()
    questions_for_doctor: list[str] = _json_list()
    notices: list[dict[str, Any]] = _json_list()
    validation_report: dict[str, Any] = _json_dict()
    model_id: str | None = None
    prompt_version: str | None = None
    thinking_level: str | None = None
    latency_ms: int = 0
    created_at: datetime = Field(default_factory=utcnow)


# --- Reminders (SRD 07 §3.12, P1) -------------------------------------------------------


class ReminderType(str, Enum):
    appointment = "appointment"
    medication = "medication"
    follow_up = "follow_up"
    other = "other"


class ReminderStatus(str, Enum):
    active = "active"
    completed = "completed"
    dismissed = "dismissed"


class Reminder(SQLModel, table=True):
    id: str = Field(default_factory=lambda: new_id("rem"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    created_by_user_id: str = Field(foreign_key="user.id")
    type: ReminderType
    title: str
    notes: str | None = None
    schedule_kind: str  # once · daily
    # Local wall-clock values: once {date, time}; daily {times, start_date, end_date?}.
    schedule: dict[str, Any] = _json_dict()
    timezone: str = "Asia/Kolkata"
    next_due_at: datetime | None = None  # UTC, computed by the server
    last_completed_at: datetime | None = None
    status: ReminderStatus = ReminderStatus.active
    source_fact_id: str | None = None
    medication_schedule_attested: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


# --- Redesign extensions (API contract §5b). New tables only: existing tables are never altered,
# because create_all() does not add columns to tables that already exist in a team database.


class ProfileDetails(SQLModel, table=True):
    """Medical ID for one profile (API-42/43). One row per profile, created lazily."""

    __tablename__ = "profile_details"

    patient_id: str = Field(foreign_key="patient_profile.id", primary_key=True)
    relationship: str | None = None  # self · spouse · parent · child · sibling · grandparent · other
    date_of_birth: date | None = None
    sex: str | None = None
    blood_group: str | None = None
    height_cm: float | None = None
    # [{name, phone, relation}]
    emergency_contacts: list[dict[str, Any]] = _json_list()
    allergies_note: str | None = None
    conditions_note: str | None = None
    medications_note: str | None = None
    organ_donor: bool | None = None
    updated_at: datetime = Field(default_factory=utcnow)
    updated_by_user_id: str | None = None


class VitalReading(SQLModel, table=True):
    """A self-recorded reading (API-44 to 46). Values are never labelled normal or abnormal."""

    __tablename__ = "vital_reading"
    __table_args__ = (Index("ix_vital_reading_patient_kind_time", "patient_id", "kind", "measured_at"),)

    id: str = Field(default_factory=lambda: new_id("vit"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    kind: str
    value: float
    value2: float | None = None
    unit: str
    context: str | None = None
    notes: str | None = None
    measured_at: datetime
    created_by_user_id: str = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=utcnow)


class ChatSession(SQLModel, table=True):
    """A saved Ask conversation (API-47 to 53). Private to the user who created it."""

    __tablename__ = "chat_session"

    id: str = Field(default_factory=lambda: new_id("cht"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    title: str = "New chat"
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_message"

    id: str = Field(default_factory=lambda: new_id("msg"), primary_key=True)
    chat_id: str = Field(foreign_key="chat_session.id", index=True)
    role: str  # user · assistant
    kind: str  # question · answer · attachment
    # Question text. Stored like AIOutput.question_text; never logged or audited.
    text: str | None = None
    input_mode: str | None = None
    # No foreign key: the document may be deleted later, and the message then shows it as gone.
    document_id: str | None = None
    # The API-21 response for answers; {} otherwise.
    payload: dict[str, Any] = _json_dict()
    ai_output_id: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Invitation(SQLModel, table=True):
    """An emailed invitation to become a caregiver (API-54 to 59). The ID is the secret in the link."""

    __tablename__ = "invitation"

    id: str = Field(default_factory=lambda: new_id("inv"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    email: str = Field(index=True)  # lowercased
    relationship: str
    scopes: list[str] = _json_list()
    status: str = "pending"  # pending · accepted · declined · cancelled ("expired" is computed)
    invited_by_user_id: str = Field(foreign_key="user.id")
    consent_record_id: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime
    responded_at: datetime | None = None
    accepted_user_id: str | None = None


class WomensHealthSettings(SQLModel, table=True):
    """Women's health tracker settings for one profile (API-62/63). One row per profile, created lazily."""

    __tablename__ = "womens_health_settings"

    patient_id: str = Field(foreign_key="patient_profile.id", primary_key=True)
    mode: str = "off"  # off · cycle · pregnancy · postpartum
    cycle_length_days: int | None = None
    period_length_days: int | None = None
    lmp_date: date | None = None
    due_date: date | None = None
    delivery_date: date | None = None
    updated_at: datetime | None = None
    updated_by_user_id: str | None = None


class PeriodLog(SQLModel, table=True):
    """A logged period (API-64 to 67). Dates are what the user entered; nothing is interpreted."""

    __tablename__ = "period_log"

    id: str = Field(default_factory=lambda: new_id("per"), primary_key=True)
    patient_id: str = Field(foreign_key="patient_profile.id", index=True)
    start_date: date
    end_date: date | None = None
    flow: str | None = None  # light · medium · heavy
    symptoms: list[str] = _json_list()
    notes: str | None = None
    created_by_user_id: str = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
