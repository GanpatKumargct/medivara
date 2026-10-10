# 07 — Data Model

> SRD section 5.7. Owner: **Person B** (decision owner for schema). Reviewed by Person C.
> The model is described in tables only. No database scripts belong in this document.
> All data in the prototype is **synthetic**. No real patient data may be stored.

## 1. Conventions

| Topic | Rule |
|---|---|
| IDs | Strings with a type prefix. Seeded records use **fixed, readable IDs** (for example `usr_meera`, `pat_meera`) so mock fixtures and the database agree. Runtime records use the prefix plus a random UUID (for example `doc_3f9c…`). |
| Prefixes | `usr_` user · `ses_` session · `pat_` patient profile · `grt_` access grant · `cns_` consent · `doc_` document · `pg_` page · `fct_` fact · `brf_` brief · `aio_` AI output · `rem_` reminder · `spr_` simulated provider · `sls_` simulated slot · `apt_` mock appointment · `aud_` audit event |
| Timestamps | Stored in UTC, ISO 8601 with `Z`. Displayed in the viewer's timezone (default `Asia/Kolkata`, labelled "IST"). |
| Clinical dates | Stored as calendar dates (`YYYY-MM-DD`) plus the text **as written**. Numeric dates are parsed **day-first** (Indian convention). If both day and month are 12 or less, the record is flagged `date_ambiguous`. |
| Text fields | Values extracted from documents are stored **exactly as written**. Normalised copies are used only for comparison and are never shown as if the document said them. |
| Ownership | Every patient-scoped record carries `patient_id`. Access is decided by `PatientAccessGrant`, never by who created the record. |
| Deletion | Hard delete in the prototype (document delete is P1). The demo reset wipes everything and restores the snapshot. |
| Storage engine | SQLite in WAL mode (prototype). See the production path in [06-architecture.md](06-architecture.md). |

## 2. Entity relationship overview

```text
User 1───* Session
User 1───1 PatientProfile (as owner, seeded)          User *───* PatientProfile  via PatientAccessGrant
User 1───* ConsentRecord

PatientProfile 1───* MedicalDocument 1───* DocumentPage   (lines with line IDs live inside the page)
                              │
                              └───* ExtractedFact ──cites──> DocumentPage lines (source_line_ids)

PatientProfile 1───* ConsultationBrief ───0..1──> AIOutput (narrative)
PatientProfile 1───* AIOutput (answers)
PatientProfile 1───* Reminder ───0..1──> ExtractedFact (source follow-up)
PatientProfile 1───* MockAppointment ───1──> SimulatedProvider 1───* SimulatedSlot
AuditEvent ──refers to──> any entity by (resource_type, resource_id)

TimelineEvent = derived at read time from MedicalDocument + ExtractedFact (not stored)
```

## 3. Entities

### 3.1 User

| Field | Type | Notes |
|---|---|---|
| id | string | `usr_…` |
| email | string | Unique, stored lowercase. Demo accounts use the reserved `.test` domain. |
| password_hash | string | Produced by a standard slow password-hashing algorithm. Never returned by any API. |
| display_name | string | Shown in the UI |
| is_demo | boolean | True for seeded accounts |
| created_at | timestamp | |
| last_login_at | timestamp, nullable | |

### 3.2 Session

| Field | Type | Notes |
|---|---|---|
| id | string | `ses_…` |
| user_id | string | FK User |
| token_hash | string | SHA-256 of the opaque bearer token. The raw token is returned once at login and never stored. |
| created_at | timestamp | |
| expires_at | timestamp | 12 hours after creation (prototype) |
| revoked_at | timestamp, nullable | Set by logout |

### 3.3 PatientProfile

| Field | Type | Notes |
|---|---|---|
| id | string | `pat_…` |
| owner_user_id | string | FK User. Exactly one owner. |
| display_name | string | Synthetic name |
| age_years | integer, nullable | Synthetic; shown on the brief header only |
| is_synthetic | boolean | Always true in the prototype |
| created_at | timestamp | |

Communication preferences for the Visit Card are **not** stored server-side in the MVP. They are kept on the device (DEC-09). Server-side storage is P2.

### 3.4 PatientAccessGrant

| Field | Type | Notes |
|---|---|---|
| id | string | `grt_…` |
| patient_id | string | FK PatientProfile |
| grantee_user_id | string | FK User |
| role | enum | `owner` · `caregiver` |
| scopes | list of enum | `view_records` (required for caregivers) · `upload_documents` · `manage_reminders`. Owners implicitly hold all scopes and owner-only rights. |
| status | enum | `active` · `revoked` |
| granted_by_user_id | string | FK User (the owner) |
| consent_record_id | string, nullable | FK ConsentRecord (`sharing` consent captured at grant time) |
| created_at | timestamp | |
| revoked_at | timestamp, nullable | |
| revoked_by_user_id | string, nullable | Owner (revoke) or caregiver (leave) |

Constraint: at most one `active` grant per (patient_id, grantee_user_id). The owner grant is created with the profile and cannot be revoked.

### 3.5 ConsentRecord

| Field | Type | Notes |
|---|---|---|
| id | string | `cns_…` |
| user_id | string | Who gave or withdrew consent |
| patient_id | string, nullable | Set for consents about a specific profile (for example `sharing`) |
| consent_type | enum | `terms_and_disclaimer` · `ai_processing` · `sharing` · `voice_input` · `notifications` |
| granted | boolean | False records a withdrawal |
| policy_version | string | For example `2026-10-demo-1` |
| created_at | timestamp | |
| context | object | For example `{ "grant_id": "grt_…" }`. Never contains PHI. |

The latest record per (user_id, consent_type, patient_id) is the current state.

### 3.6 MedicalDocument

| Field | Type | Notes |
|---|---|---|
| id | string | `doc_…`. Seeded sample documents use fixed IDs (see the demo data pack). |
| patient_id | string | FK PatientProfile |
| uploaded_by_user_id | string | FK User |
| original_filename | string | Sanitised (no paths, control characters stripped, max 120 chars) |
| mime_type | string | Verified from file content (magic bytes), not from the filename |
| size_bytes | integer | Max 10 MB |
| sha256 | string | Used for duplicate detection per patient and as the golden-cache key |
| storage_key | string | Random UUID file name in the private store |
| page_count | integer | Max 10 pages (prototype) |
| title | string | Derived, for example "Lab report · Sunrise Diagnostics · 18 Mar 2025" |
| document_type | enum | `prescription` · `lab_report` · `discharge_summary` · `consultation_note` · `other` · `unknown` |
| document_type_source | enum | `ai` · `user` |
| document_date | date, nullable | Parsed day-first |
| document_date_text | string, nullable | As written |
| document_date_source | enum, nullable | `ai` · `user` |
| date_ambiguous | boolean | True when both day and month are 12 or less |
| facility_name | string, nullable | As written |
| clinician_name | string, nullable | As written |
| status | enum | `queued` · `processing` · `needs_review` · `ready` · `failed` (see §5) |
| stage | enum | `queued` · `reading_text` · `screening` · `extracting` · `validating` · `done` · `no_text_layer` |
| failure_code | enum, nullable | `UNREADABLE_PDF` · `NO_TEXT_LAYER` · `AI_UNAVAILABLE` · `AI_BLOCKED` · `AI_INVALID_OUTPUT` · `AI_TIMEOUT` · `INTERNAL_ERROR` |
| failure_message | string, nullable | User-safe text from the copy deck |
| flags | list of enum | `suspicious_instructions` · `date_ambiguous` · `date_missing` · `low_text_density` · `cached_extraction` · `sample` · `ai_transcribed` (P1) |
| is_sample | boolean | True for synthetic sample documents |
| extraction_source | enum | `live` · `cache` · `none` |
| model_id | string, nullable | For example `gemini-2.5-flash` |
| prompt_version | string, nullable | For example `extract-v1` |
| discarded_fact_count | integer | Facts dropped because no valid source line was cited |
| created_at, updated_at, processed_at | timestamps | |

### 3.7 DocumentPage

| Field | Type | Notes |
|---|---|---|
| id | string | `pg_…` |
| document_id | string | FK MedicalDocument |
| page_number | integer | 1-based |
| width, height | number | Page size in PDF points (used for future highlighting) |
| text_source | enum | `pdf_text_layer` · `ai_ocr` (P1) |
| lines | list of objects | Each `{ line_id, text, bbox }`. `line_id` format is `p{page}-l{n}`, for example `p1-l14`. Table rows are rebuilt by vertical position so one lab test is one line. |
| char_count | integer | Used to detect `no_text_layer` and `low_text_density` |

### 3.8 ExtractedFact

One flat record per fact. Fields that do not apply to a fact type are null. Field meanings by type are in [08-ai-rag-design.md](08-ai-rag-design.md) §5.

| Field | Type | Notes |
|---|---|---|
| id | string | `fct_…` |
| patient_id | string | FK PatientProfile (denormalised for fast scoping) |
| document_id | string | FK MedicalDocument |
| fact_type | enum | `medication` · `lab_result` · `condition` · `allergy` · `procedure` · `vital_sign` · `follow_up` · `instruction` |
| name | string | As written (drug, test, condition, allergen, procedure, vital, instruction label) |
| value | string, nullable | As written (lab value, vital value, allergy status phrase) |
| unit | string, nullable | As written |
| reference_range | string, nullable | As written |
| abnormal_flag_as_written | string, nullable | For example "H", "L", "High". Never computed by MediVara. |
| strength | string, nullable | Medication, for example "500 mg" |
| dose | string, nullable | Medication, for example "1 tablet" |
| frequency | string, nullable | As written, for example "twice daily", "1-0-1" |
| route | string, nullable | As written |
| duration | string, nullable | As written, for example "90 days" |
| timing | string, nullable | As written, for example "after meals" |
| qualifier | string, nullable | For example "known case of", "no known drug allergies" |
| reaction | string, nullable | Allergy reaction as written |
| due_text | string, nullable | Follow-up timing as written, for example "after 6 weeks" |
| event_date_text | string, nullable | A date written next to this fact |
| event_date | date, nullable | Parsed day-first; otherwise the document date is used for the timeline |
| source_line_ids | list of string | At least one valid line ID, otherwise the fact is discarded |
| source_page | integer | Page of the first cited line |
| confidence | enum | `high` · `medium` · `low`. Computed by rules, never taken from the model. |
| uncertainty_reasons | list of enum | `value_not_in_source` · `name_not_in_source` · `missing_required_field` · `missing_unit` · `missing_reference_range` · `unrecognised_unit` · `date_ambiguous` · `date_in_future` · `model_note` |
| extraction_note | string, nullable | Model's own note about illegible or ambiguous text |
| status | enum | `unverified` · `confirmed` · `corrected` · `rejected` (see §6) |
| corrected_fields | object, nullable | Only the fields the user changed, for example `{ "value": "8.2" }` |
| history | list of objects | Each `{ at, by_user_id, action, before, after }`. The original extraction is always kept. |
| reviewed_by_user_id | string, nullable | |
| reviewed_at | timestamp, nullable | |
| created_at, updated_at | timestamps | |

### 3.9 TimelineEvent (derived, not stored)

Built on every request by AG-06 from documents and non-rejected facts. Its fields are listed here because the API returns them.

| Field | Type | Notes |
|---|---|---|
| id | string | `evt_doc_<document_id>` or `evt_fct_<fact_id>`. Stable across requests. |
| date | date, nullable | Fact `event_date`, otherwise the document date. Null goes to the "Date unknown" group. |
| event_type | enum | `document` · `medication` · `lab_result` · `condition` · `allergy` · `procedure` · `vital_sign` · `follow_up` · `instruction` |
| title, summary | string | Built from fields as written |
| document_id | string | Always present |
| fact_id | string, nullable | |
| status, confidence | enum | Copied from the fact |
| change | object, nullable | From AG-07: `{ kind: "value_change" \| "dose_change", previous: {…}, current: {…} }` |
| source | object | `{ page, line_ids }` |

### 3.10 ConsultationBrief

| Field | Type | Notes |
|---|---|---|
| id | string | `brf_…` |
| patient_id | string | FK PatientProfile |
| created_by_user_id | string | FK User |
| created_at | timestamp | |
| include_unverified | boolean | Default true. Unverified items carry a badge. |
| visit_reason | string, nullable | User's own words, max 300 chars |
| sections | object | Deterministic content (header, medications, conditions, results over time, allergies, points to clarify, missing information, questions for the doctor, sources) |
| evidence | list of objects | Snapshot of cited lines at creation time, so the brief stays traceable after later edits |
| fingerprint | string | Hash of the contributing document IDs, fact IDs and their `updated_at` values |
| narrative_output_id | string, nullable | FK AIOutput (type `brief_narrative`) |

`stale` is computed at read time by comparing the stored fingerprint with the current one.

### 3.11 AIOutput

| Field | Type | Notes |
|---|---|---|
| id | string | `aio_…` |
| patient_id | string | FK PatientProfile |
| requested_by_user_id | string | FK User |
| output_type | enum | `answer` · `brief_narrative` |
| input_mode | enum, nullable | `text` · `voice` (answers only) |
| question_text | string, nullable | Stored for traceability. Deleted by the demo reset. Production would apply a retention policy. |
| status | enum | Answer: `answered` · `not_found` · `advice_redirect` · `emergency` · `out_of_scope` · `degraded` · `withheld`. Narrative: `ready` · `unavailable` · `withheld`. |
| statements | list of objects | Each `{ id, kind, text, evidence_ids }` |
| evidence | list of objects | Snapshot of the evidence lines shown |
| questions_for_doctor | list of string | |
| notices | list of objects | `{ code, text }` |
| validation_report | object | Counts of statements checked, passed, dropped by reason |
| model_id, prompt_version, thinking_level | string | Null when no model call was made (gate responses, degraded mode) |
| latency_ms | integer | |
| created_at | timestamp | |

### 3.12 Reminder (P1)

| Field | Type | Notes |
|---|---|---|
| id | string | `rem_…` |
| patient_id | string | FK PatientProfile |
| created_by_user_id | string | FK User |
| type | enum | `appointment` · `medication` · `follow_up` · `other` |
| title | string | 1–120 chars |
| notes | string, nullable | Max 500 chars |
| schedule_kind | enum | `once` · `daily` |
| schedule | object | Once: `{ date, time }`. Daily: `{ times: ["08:00","20:00"], start_date, end_date? }`. Local wall-clock values. |
| timezone | string | IANA name, default `Asia/Kolkata` |
| next_due_at | timestamp, nullable | UTC, computed by the server |
| last_completed_at | timestamp, nullable | |
| status | enum | `active` · `completed` · `dismissed` |
| source_fact_id | string, nullable | Follow-up or medication fact it was created from |
| medication_schedule_attested | boolean | Required true for `medication` reminders (COPY-24) |
| created_at, updated_at | timestamps | |

### 3.13 SimulatedProvider, SimulatedSlot, MockAppointment (P1, likely cut)

| Entity | Field | Notes |
|---|---|---|
| SimulatedProvider | id (`spr_…`), display_name, specialty_id, city, languages, isl_interpreter_on_request, is_simulated | Fictional names only. `is_simulated` is always true. No prices, ratings or credentials. |
| SimulatedSlot | id (`sls_…`), provider_id, start_at, end_at, is_available | Generated relative to the demo date |
| MockAppointment | id (`apt_…`), patient_id, booked_by_user_id, provider_id, slot_id, start_at, reason, needs_isl_interpreter, status (`simulated` · `cancelled`), is_simulated, created_at | Status is never "confirmed" |

### 3.14 AuditEvent

| Field | Type | Notes |
|---|---|---|
| id | string | `aud_…` |
| at | timestamp | |
| actor_user_id | string, nullable | Null for failed logins with unknown email |
| patient_id | string, nullable | |
| action | enum | See the list below |
| resource_type, resource_id | string, nullable | |
| outcome | enum | `success` · `denied` · `error` |
| request_id | string | Correlates with application logs |
| metadata | object | IDs, counts and codes only. **Never** document text, question text, fact values or names. |

Audit actions: `auth.login`, `auth.login_failed`, `auth.logout`, `consent.recorded`, `document.uploaded`, `document.imported`, `document.file_viewed`, `document.reprocessed`, `document.updated`, `document.deleted`, `fact.confirmed`, `fact.corrected`, `fact.rejected`, `facts.bulk_confirmed`, `brief.created`, `brief.narrative_generated`, `ask.answered`, `access.granted`, `access.revoked`, `access.denied`, `reminder.created`, `reminder.updated`, `reminder.completed`, `appointment.simulated_booked`.

## 4. Access rules

The backend enforces every rule on every request. The frontend hides controls for convenience only.

| Action | Owner | Caregiver with scope | Anyone else |
|---|---|---|---|
| See the profile in `GET /patients` | Yes | Yes (`view_records`) | No |
| Read documents, files, facts, timeline, briefs; use Ask | Yes | `view_records` | 403 `ACCESS_DENIED` |
| Upload or reprocess documents | Yes | `upload_documents` | 403 |
| Confirm, correct or reject facts; correct document details | Yes | `upload_documents` | 403 |
| Create briefs and narratives | Yes | `view_records` | 403 |
| Create, edit, complete reminders | Yes | `manage_reminders` | 403 |
| Book or list simulated appointments | Yes | `manage_reminders` | 403 |
| Grant or revoke access; see the access log | Yes | No (`OWNER_ONLY`) | 403 |
| Delete documents; record consent for the profile | Yes | No | 403 |
| Leave (revoke own caregiver grant) | n/a | Yes | n/a |

Rules that prevent guessed-ID access (IDOR):

1. Every patient-scoped route includes `{patient_id}`. The server first checks for an active grant on that patient.
2. The server then checks that the requested resource (document, fact, reminder, brief) belongs to **that** patient. If not, it returns 404 `NOT_FOUND`, even if the user could access the other patient.
3. The context assembled for AI calls (AG-10) is filtered by `patient_id` in the query itself, not afterwards.
4. Revocation takes effect on the next request because grants are checked per request and never cached in the session.
5. Every denial writes an `access.denied` audit event.

## 5. Document status semantics

| Status | Meaning | Shown to the user as |
|---|---|---|
| `queued` | Accepted, waiting for processing | "Waiting to be read" |
| `processing` | Pipeline running; `stage` says where | "Reading your document… (stage)" |
| `needs_review` | Processed; at least one fact is `unverified` | "Ready — please review" |
| `ready` | Processed; no `unverified` facts remain | "Reviewed" |
| `failed` | Processing stopped; `failure_code` explains why | Message from the copy deck with "Try again" where retry can help |

## 6. Fact status semantics (used everywhere)

| Status | Timeline | Brief | Ask context | UI treatment |
|---|---|---|---|---|
| `unverified` | Shown | Shown if `include_unverified` is true (default) | Included; tagged unverified | "Unverified" badge (COPY-12) |
| `confirmed` | Shown | Shown | Included | No badge |
| `corrected` | Corrected value shown | Corrected value shown | The source line plus a user-correction note are both included | "Corrected by you" label; original kept in history |
| `rejected` | Hidden | Hidden | Excluded, and the source line is tagged "user marked extraction wrong" | Visible only in the document review screen, greyed out, with undo |

Allowed transitions: `unverified` → `confirmed` · `corrected` · `rejected`. `confirmed` → `corrected` · `rejected`. `corrected` → `corrected` · `rejected`. `rejected` → `unverified` (undo). Every transition appends to `history` and writes an audit event.

## 7. Data retention and deletion (prototype)

| Data | Retention in the prototype | Production requirement (future) |
|---|---|---|
| Uploaded files and pages | Until document delete (P1) or demo reset | Retention policy, user-initiated deletion with backup purge |
| Facts and history | Same as the document | Same |
| Briefs and AI outputs | Until demo reset | Configurable retention; user deletion |
| Audit events | Until demo reset | Tamper-evident, retained per policy |
| Sessions | Expire after 12 h; deleted on reset | Short-lived access tokens with refresh rotation |
| Gemini requests | Sent with `store=false`; not retained by MediVara | Enterprise terms, data-processing agreement, residency review |
