# 11 — API Contract (v1.0)

> SRD section 5.11. **Contract owner: Person B.** Person A must acknowledge breaking changes, and Person C arbitrates disputes (see [../hackathon/integration-plan.md](../hackathon/integration-plan.md)).
> This is a specification, not an implementation. Every JSON block is a **canonical example** and is copied verbatim into a fixture file named on the line above it.
> P0 endpoints (API-01…21) freeze at **IC-0 (Day 1, 09:45)**. P1 endpoints (API-22…33) freeze at **G1 (Day 1, 18:45)**.

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1`. In development the frontend calls the same origin through the Vite proxy, so cookies and CORS are not involved. |
| Authentication | `Authorization: Bearer <token>` on every endpoint except API-01 and API-02. Tokens are opaque strings returned by API-02. |
| Content types | Requests and responses are `application/json`, except upload (`multipart/form-data`) and file download (the document's own type). |
| IDs | Prefixed strings (see [07-data-model.md](07-data-model.md) §1). Seeded users, profiles and grants have fixed IDs. Document and fact IDs in the examples are the IDs the P1 sample import assigns. Uploads receive random IDs, so **the frontend must never hardcode document or fact IDs**. |
| Times | Timestamps are UTC ISO 8601 with `Z`. Clinical dates are `YYYY-MM-DD`. The UI formats them as `DD Mon YYYY` and labels local times "IST". Example timestamps assume a demo on 24 Oct 2026. |
| Nulls | Every documented key is always present. Unknown or not-applicable values are `null`, never omitted. |
| Unknown fields | Clients must ignore fields they do not recognise. This lets additive changes ship without breaking the frontend. |
| Pagination | List endpoints accept `limit` (default 50, max 100) and `offset` (default 0) and return `{ items, total, limit, offset }`. The MVP UI does not show pagination controls. |
| Security headers | Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy: same-origin`, a `Permissions-Policy` and `Cache-Control: no-store` (unless the route sets its own). JSON responses also carry `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`. |
| Request IDs | Every response carries an `X-Request-ID` header. Errors repeat it in the body. Logs use the same ID. |
| AI results | AI paths (API-20, API-21) **never** return an HTTP error because the AI failed. They return 200 with a `status` such as `degraded`, `unavailable` or `withheld`, so the frontend handles a single response shape. |
| Fixtures | `contracts/API-<NN>.<http-status>[.<variant>].json` for endpoint examples and `contracts/errors/<CODE>.json` for shared errors. Person C copies the blocks at kickoff and Person B reviews them. |

## 2. Error model

Every non-2xx response uses this envelope.

Fixture: `contracts/errors/ACCESS_DENIED.json`
```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "You don't have access to this profile.",
    "details": {},
    "request_id": "req_01JB7Q8F3Z0R9M2K6T4W1XH5CN"
  }
}
```

Validation errors list the failing fields.

Fixture: `contracts/errors/VALIDATION_ERROR.json`
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "details": {
      "fields": [
        { "field": "question", "issue": "must be between 1 and 500 characters" }
      ]
    },
    "request_id": "req_01JB7Q9A1C4D5E6F7G8H9J0K1M"
  }
}
```

| HTTP | Code | When | Frontend behaviour |
|---|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON or multipart body | Generic error toast |
| 401 | `UNAUTHENTICATED` | Missing or unknown token | Clear session, go to login |
| 401 | `SESSION_EXPIRED` | Token expired or revoked | Clear session, go to login with "Your session ended" |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (same message for both) | Inline form error |
| 403 | `ACCESS_DENIED` | No active grant for this patient | Access denied page (COPY-27) |
| 403 | `SCOPE_REQUIRED` | Grant exists but lacks the scope; `details.required_scope` names it | Inline message; control should already be hidden |
| 403 | `OWNER_ONLY` | Owner-only action attempted by a caregiver | Inline message |
| 403 | `CONSENT_REQUIRED` | The profile owner has not consented to AI processing; `details.consent_type` | Link to onboarding/consent |
| 404 | `NOT_FOUND` | Resource does not exist **under this patient**, or the demo-only feature is disabled | Not found state |
| 404 | `USER_NOT_FOUND` | Grant target email has no account (prototype only) | Inline form error |
| 409 | `DUPLICATE_DOCUMENT` | Same file already uploaded for this patient; `details.existing_document_id` | Offer to open the existing document |
| 409 | `INVALID_STATE` | Action not allowed in the current status | Inline message and refresh |
| 409 | `GRANT_EXISTS` | Active grant already exists | Inline form error |
| 413 | `FILE_TOO_LARGE` | Over 10 MB | Inline upload error |
| 415 | `UNSUPPORTED_FILE_TYPE` | Content is not a PDF (P0). PNG and JPEG are accepted only when FR-024 ships | Inline upload error |
| 422 | `VALIDATION_ERROR` | Field-level problems; `details.fields` | Inline field errors |
| 422 | `TOO_MANY_PAGES` | Over 10 pages | Inline upload error |
| 429 | `RATE_LIMITED` | API-02 only: 5 failed sign-ins for one email, or 20 from one IP, within 15 minutes. Same answer for known and unknown emails; `details.retry_after_s` and a `Retry-After` header | Inline form error (COPY-34f) |
| 500 | `INTERNAL_ERROR` | Unexpected failure | Error banner with the request ID |

## 3. Shared objects

These objects appear in several responses. Field meanings are in [07-data-model.md](07-data-model.md).

| Object | Fields |
|---|---|
| `UserSummary` | `id`, `email`, `display_name`, `is_demo` |
| `PatientSummary` | `id`, `display_name`, `age_years`, `is_synthetic`, `my_role` (`owner` · `caregiver`), `scopes`, `owner_display_name`, `stats` `{ documents_total, documents_needs_review, documents_processing, documents_failed, upcoming_reminders, latest_brief_at }` |
| `DocumentSummary` | `id`, `patient_id`, `title`, `document_type`, `document_date`, `date_ambiguous`, `facility_name`, `clinician_name`, `status`, `stage`, `failure_code`, `failure_message`, `flags`, `is_sample`, `extraction_source`, `page_count`, `fact_counts` `{ total, unverified, low_confidence }`, `created_at`, `processed_at` |
| `Fact` | `id`, `document_id`, `fact_type`, `display_text`, `fields` (keys depend on `fact_type`, see below), `event_date`, `source` `{ page, line_ids, lines: [{ line_id, text }] }`, `confidence`, `uncertainty_reasons`, `status`, `corrected_fields`, `extraction_note`, `reviewed_at` |
| `Evidence` | `evidence_id` (local to the response, for example `E1`), `document_id`, `document_title`, `document_type`, `document_date`, `page`, `line_ids`, `text`, `fact_status` (nullable), `is_user_correction` |
| `Statement` | `id` (`S1`…), `kind` (`record_fact` · `uncertainty` · `explanation` · `not_found` · `safety_notice`), `text`, `evidence_ids` |
| `Notice` | `code`, `text` (text comes from the copy deck) |

`Fact.fields` keys by type. Keys are always present, `null` when absent:

| fact_type | fields keys |
|---|---|
| `medication` | `name`, `strength`, `dose`, `frequency`, `route`, `duration`, `timing`, `event_date_text` |
| `lab_result` | `name`, `value`, `unit`, `reference_range`, `abnormal_flag_as_written`, `event_date_text` |
| `condition` | `name`, `qualifier`, `event_date_text` |
| `allergy` | `name`, `qualifier`, `reaction` |
| `procedure` | `name`, `event_date_text` |
| `vital_sign` | `name`, `value`, `unit`, `event_date_text` |
| `follow_up` | `name`, `due_text` |
| `instruction` | `name` |

## 4. Endpoint index

| ID | Method and route | Purpose | Auth / scope | Priority | Screens | BE task | FE task |
|---|---|---|---|---|---|---|---|
| API-01 | `GET /health` | Service and AI status | Public | P0 | SCR-16 banner | BE-1.2 | FE-10.3 |
| API-02 | `POST /auth/login` | Sign in | Public | P0 | SCR-02 | BE-3.1 | FE-2.2 |
| API-03 | `POST /auth/logout` | Revoke session | Bearer | P0 | Header | BE-3.1 | FE-2.1 |
| API-04 | `GET /me` | Current user and consents | Bearer | P0 | SCR-01, SCR-15 | BE-3.1 | FE-2.3 |
| API-05 | `POST /me/consents` | Record consent | Bearer | P0 | SCR-01 | BE-3.4 | FE-2.3 |
| API-06 | `GET /patients` | Accessible profiles | Bearer | P0 | SCR-03, SCR-04 | BE-3.3 | FE-2.4, FE-2.5 |
| API-07 | `GET /patients/{patient_id}` | Profile with stats | `view_records` | P0 | SCR-04 | BE-3.3 | FE-2.4 |
| API-08 | `POST /patients/{patient_id}/documents` | Upload PDF | `upload_documents` | P0 | SCR-05 | BE-4.1 | FE-3.2 |
| API-09 | `POST /patients/{patient_id}/documents/import-samples` | Import synthetic sample set | `upload_documents`, demo mode | P1 | SCR-05 | BE-4.5 | FE-3.7 |
| API-10 | `GET /patients/{patient_id}/documents` | List documents | `view_records` | P0 | SCR-04, SCR-05 | BE-4.2 | FE-3.1 |
| API-11 | `GET /patients/{patient_id}/documents/{document_id}` | Document detail with facts | `view_records` | P0 | SCR-05, SCR-06 | BE-4.2 | FE-3.3, FE-3.5 |
| API-12 | `GET /patients/{patient_id}/documents/{document_id}/file` | Original file | `view_records` | P0 | SCR-06 | BE-4.3 | FE-3.4 |
| API-13 | `POST /patients/{patient_id}/documents/{document_id}/reprocess` | Retry processing | `upload_documents` | P0 | SCR-05, SCR-06 | BE-4.4 | FE-3.3 |
| API-14 | `PATCH /patients/{patient_id}/documents/{document_id}` | Correct document details | `upload_documents` | P0 | SCR-06 | BE-4.4 | FE-3.6 |
| API-15 | `PATCH /patients/{patient_id}/facts/{fact_id}` | Confirm / correct / reject a fact | `upload_documents` | P0 | SCR-06 | BE-6.1 | FE-3.5 |
| API-16 | `POST /patients/{patient_id}/documents/{document_id}/review` | Bulk-confirm high-confidence facts | `upload_documents` | P0 | SCR-06 | BE-6.1 | FE-3.6 |
| API-17 | `GET /patients/{patient_id}/timeline` | Source-linked timeline | `view_records` | P0 | SCR-07 | BE-6.2, BE-6.3 | FE-4.1, FE-4.2 |
| API-18 | `POST /patients/{patient_id}/briefs` | Create brief snapshot | `view_records` | P0 | SCR-09 | BE-7.2 | FE-4.4 |
| API-19 | `GET /patients/{patient_id}/briefs/latest` | Latest brief | `view_records` | P0 | SCR-04, SCR-09, SCR-11 | BE-7.2 | FE-4.4, FE-8.1 |
| API-20 | `POST /patients/{patient_id}/briefs/{brief_id}/narrative` | Generate validated narrative | `view_records` | P0 | SCR-09 | BE-7.5 | FE-4.5 |
| API-21 | `POST /patients/{patient_id}/ask` | Grounded question answering | `view_records` | P0 | SCR-08 | BE-7.6, BE-8.1, BE-8.2 | FE-5.1–5.3 |
| API-22 | `DELETE /patients/{patient_id}/documents/{document_id}` | Delete a document | Owner | P1 | SCR-06 | BE-4.6 | FE-3.8 |
| API-23 | `GET /patients/{patient_id}/access` | List grants | Owner | P1 | SCR-14 | BE-9.1 | FE-6.2 |
| API-24 | `POST /patients/{patient_id}/access` | Grant caregiver access | Owner | P1 | SCR-14 | BE-9.1 | FE-6.2 |
| API-25 | `DELETE /patients/{patient_id}/access/{grant_id}` | Revoke or leave | Owner, or the grantee | P1 | SCR-14 | BE-9.1 | FE-6.2 |
| API-26 | `GET /patients/{patient_id}/audit-events` | Access log | Owner | P1 | SCR-14 | BE-9.2 | FE-6.3 |
| API-27 | `GET /patients/{patient_id}/reminders` | List reminders | `view_records` | P1 | SCR-04, SCR-12 | BE-10.1 | FE-9.1 |
| API-28 | `POST /patients/{patient_id}/reminders` | Create reminder | `manage_reminders` | P1 | SCR-12 | BE-10.1 | FE-9.2 |
| API-29 | `PATCH /patients/{patient_id}/reminders/{reminder_id}` | Edit or dismiss | `manage_reminders` | P1 | SCR-12 | BE-10.1 | FE-9.1, FE-9.2 |
| API-30 | `POST /patients/{patient_id}/reminders/{reminder_id}/complete` | Mark done | `manage_reminders` | P1 | SCR-12 | BE-10.1 | FE-9.1 |
| API-31 | `GET /patients/{patient_id}/appointment-suggestions` | Specialty suggestions + simulated providers | `view_records` | P1 | SCR-13 | BE-11.1 | FE-9.4 |
| API-32 | `POST /patients/{patient_id}/appointments` | Simulated booking | `manage_reminders` | P1 | SCR-13 | BE-11.2 | FE-9.4 |
| API-33 | `GET /patients/{patient_id}/appointments` | List simulated appointments | `view_records` | P1 | SCR-13 | BE-11.2 | FE-9.4 |

Voice and sign language need **no endpoints** in the MVP. Speech runs in the browser. The ISL glossary is static content shipped with the frontend. The only backend touchpoints are `input_mode` on API-21 and the `voice_input` consent type on API-05.

---

## 5. Endpoints

### API-01 `GET /health` — P0

Purpose: lets the frontend show the AI status banner, and lets Person C check the demo machine. No authentication. Never returns secrets.

`ai.mode`: `live` (normal) · `cache_only` (failure drill: extraction uses only the golden cache) · `off` (failure drill: no model calls). `ai.available` reflects configuration and the outcome of the most recent model call. It does not trigger a call.

Fixture: `contracts/API-01.200.json`
```json
{
  "status": "ok",
  "service": "medivara-api",
  "contract_version": "1.0.0",
  "demo_mode": true,
  "ai": {
    "mode": "live",
    "available": true,
    "model": "google/gemini-2.5-flash"
  },
  "time": "2026-10-24T04:30:00Z"
}
```

Fixture: `contracts/API-01.200.ai-off.json`
```json
{
  "status": "ok",
  "service": "medivara-api",
  "contract_version": "1.0.0",
  "demo_mode": true,
  "ai": {
    "mode": "off",
    "available": false,
    "model": null
  },
  "time": "2026-10-24T04:31:00Z"
}
```

### API-02 `POST /auth/login` — P0

| Field | Type | Validation |
|---|---|---|
| email | string | Required; trimmed and lowercased; max 254 chars |
| password | string | Required; 1–128 chars |

Status codes: 200 · 401 `INVALID_CREDENTIALS` (identical for unknown email and wrong password) · 422 · 429 `RATE_LIMITED` (checked before the password; a successful sign-in clears the email's count).

Example request:
```json
{
  "email": "meera.demo@medivara.test",
  "password": "MediVara-Demo-2026"
}
```

Fixture: `contracts/API-02.200.json`
```json
{
  "token": "mvs_9b1f6c2e4a7d4f0e8c3b5a1d2e6f7a8b9c0d1e2f3a4b5c6d",
  "token_type": "bearer",
  "expires_at": "2026-10-24T16:30:00Z",
  "user": {
    "id": "usr_meera",
    "email": "meera.demo@medivara.test",
    "display_name": "Meera Raman",
    "is_demo": true
  }
}
```

Fixture: `contracts/API-02.401.json`
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "That email and password don't match a MediVara account.",
    "details": {},
    "request_id": "req_01JB7QB2M3N4P5Q6R7S8T9V0W1"
  }
}
```

### API-03 `POST /auth/logout` — P0

Revokes the current session. No body. Returns **204 No Content**. A second call with the same token returns 401 `SESSION_EXPIRED`.

### API-04 `GET /me` — P0

Returns the signed-in user, their consent state and whether onboarding is needed. `onboarding_required` is true until both `terms_and_disclaimer` and `ai_processing` are granted for `current_policy_version`.

Fixture: `contracts/API-04.200.json`
```json
{
  "user": {
    "id": "usr_meera",
    "email": "meera.demo@medivara.test",
    "display_name": "Meera Raman",
    "is_demo": true
  },
  "owned_patient_id": "pat_meera",
  "current_policy_version": "2026-10-demo-1",
  "onboarding_required": false,
  "consents": {
    "terms_and_disclaimer": { "granted": true, "policy_version": "2026-10-demo-1", "at": "2026-10-24T04:32:10Z" },
    "ai_processing": { "granted": true, "policy_version": "2026-10-demo-1", "at": "2026-10-24T04:32:10Z" },
    "voice_input": null,
    "notifications": null
  }
}
```

### API-05 `POST /me/consents` — P0

| Field | Type | Validation |
|---|---|---|
| consent_type | enum | `terms_and_disclaimer` · `ai_processing` · `voice_input` · `notifications`. (`sharing` is recorded only by API-24.) |
| granted | boolean | Required. `false` records a withdrawal. |
| policy_version | string | Must equal `current_policy_version` from API-04 |

Status codes: 201 · 422.

Example request:
```json
{
  "consent_type": "ai_processing",
  "granted": true,
  "policy_version": "2026-10-demo-1"
}
```

Fixture: `contracts/API-05.201.json`
```json
{
  "consent": {
    "id": "cns_6a1d0c9e-2f4b-4c7a-9d3e-1b2c3d4e5f60",
    "consent_type": "ai_processing",
    "granted": true,
    "policy_version": "2026-10-demo-1",
    "patient_id": null,
    "created_at": "2026-10-24T04:32:10Z"
  }
}
```

### API-06 `GET /patients` — P0

Lists every profile the user can access: their own, plus profiles shared with them through active grants.

Fixture: `contracts/API-06.200.json`
```json
{
  "items": [
    {
      "id": "pat_karthik",
      "display_name": "Karthik Raman",
      "age_years": 32,
      "is_synthetic": true,
      "my_role": "owner",
      "scopes": ["view_records", "upload_documents", "manage_reminders"],
      "owner_display_name": "Karthik Raman",
      "stats": {
        "documents_total": 1,
        "documents_needs_review": 0,
        "documents_processing": 0,
        "documents_failed": 0,
        "upcoming_reminders": 0,
        "latest_brief_at": null
      }
    },
    {
      "id": "pat_meera",
      "display_name": "Meera Raman",
      "age_years": 58,
      "is_synthetic": true,
      "my_role": "caregiver",
      "scopes": ["view_records", "manage_reminders"],
      "owner_display_name": "Meera Raman",
      "stats": {
        "documents_total": 6,
        "documents_needs_review": 1,
        "documents_processing": 0,
        "documents_failed": 1,
        "upcoming_reminders": 1,
        "latest_brief_at": "2026-10-24T05:02:41Z"
      }
    }
  ],
  "total": 2,
  "limit": 50,
  "offset": 0
}
```

### API-07 `GET /patients/{patient_id}` — P0

Returns one `PatientSummary` (same shape as the items in API-06) plus `created_at`. Status codes: 200 · 403 `ACCESS_DENIED` · 404.

Fixture: `contracts/API-07.200.json`
```json
{
  "id": "pat_meera",
  "display_name": "Meera Raman",
  "age_years": 58,
  "is_synthetic": true,
  "my_role": "owner",
  "scopes": ["view_records", "upload_documents", "manage_reminders"],
  "owner_display_name": "Meera Raman",
  "stats": {
    "documents_total": 6,
    "documents_needs_review": 1,
    "documents_processing": 0,
    "documents_failed": 1,
    "upcoming_reminders": 1,
    "latest_brief_at": "2026-10-24T05:02:41Z"
  },
  "created_at": "2026-10-24T03:00:00Z"
}
```

Fixture: `contracts/API-07.403.json`
```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "You don't have access to this profile.",
    "details": {},
    "request_id": "req_01JB7QC4X5Y6Z7A8B9C0D1E2F3"
  }
}
```

### API-08 `POST /patients/{patient_id}/documents` — P0

Accepts one PDF and starts background processing. The server checks the file synchronously (type from magic bytes, size, page count, duplicate hash), stores it privately and returns **202** with status `queued`. The client then polls API-11 every 2 seconds until the status leaves `queued` or `processing`.

| Part | Type | Validation |
|---|---|---|
| file | binary | Required. PDF by content (PNG/JPEG only after FR-024). Max 10 MB. Max 10 pages. |
| document_type_hint | enum, optional | `prescription` · `lab_report` · `discharge_summary` · `consultation_note` · `other` |

Preconditions: the caller has `upload_documents`, and the **profile owner** has granted `ai_processing` consent.

Status codes: 202 · 403 `SCOPE_REQUIRED` / `CONSENT_REQUIRED` · 409 `DUPLICATE_DOCUMENT` · 413 · 415 · 422 `TOO_MANY_PAGES`.

A real upload gets a random ID such as `doc_7d2f6a90-…`. This fixture reuses the sample ID `doc_meera_rx_2026_09` so the follow-on fixtures (API-11, API-16, API-17) line up in mock mode.

Fixture: `contracts/API-08.202.json`
```json
{
  "document": {
    "id": "doc_meera_rx_2026_09",
    "patient_id": "pat_meera",
    "title": "Uploaded document · rx_lakeview_sep2026.pdf",
    "document_type": "unknown",
    "document_date": null,
    "date_ambiguous": false,
    "facility_name": null,
    "clinician_name": null,
    "status": "queued",
    "stage": "queued",
    "failure_code": null,
    "failure_message": null,
    "flags": [],
    "is_sample": false,
    "extraction_source": "none",
    "page_count": 1,
    "fact_counts": { "total": 0, "unverified": 0, "low_confidence": 0 },
    "created_at": "2026-10-24T05:00:02Z",
    "processed_at": null
  }
}
```

Fixture: `contracts/API-08.409.json`
```json
{
  "error": {
    "code": "DUPLICATE_DOCUMENT",
    "message": "This file is already in Meera Raman's records.",
    "details": { "existing_document_id": "doc_meera_rx_2026_09" },
    "request_id": "req_01JB7QD6G7H8J9K0M1N2P3Q4R5"
  }
}
```

### API-09 `POST /patients/{patient_id}/documents/import-samples` — P1

Imports a named synthetic sample set through the normal pipeline (the golden cache is the fallback). It is idempotent: files already present are skipped. It is available only when demo mode is on, and otherwise returns 404 `NOT_FOUND`. Sample sets are defined in [../hackathon/synthetic-demo-data-pack.md](../hackathon/synthetic-demo-data-pack.md).

| Field | Type | Validation |
|---|---|---|
| sample_set_id | string | Must exist and belong to this patient, for example `meera-core` |

Example request:
```json
{ "sample_set_id": "meera-core" }
```

Fixture: `contracts/API-09.202.json`
```json
{
  "imported": [
    {
      "id": "doc_meera_lab_2025_03",
      "patient_id": "pat_meera",
      "title": "Sample · lab_sunrise_mar2025.pdf",
      "document_type": "unknown",
      "document_date": null,
      "date_ambiguous": false,
      "facility_name": null,
      "clinician_name": null,
      "status": "queued",
      "stage": "queued",
      "failure_code": null,
      "failure_message": null,
      "flags": ["sample"],
      "is_sample": true,
      "extraction_source": "none",
      "page_count": 1,
      "fact_counts": { "total": 0, "unverified": 0, "low_confidence": 0 },
      "created_at": "2026-10-24T04:40:00Z",
      "processed_at": null
    }
  ],
  "skipped": [
    { "sample_id": "meera-rx-2025-03", "existing_document_id": "doc_meera_rx_2025_03" }
  ]
}
```

### API-10 `GET /patients/{patient_id}/documents` — P0

Query parameters: `status` (optional, comma-separated), `document_type` (optional, comma-separated), `limit`, `offset`. Sort order: `document_date` descending (undated last), then `created_at` descending.

Fixture: `contracts/API-10.200.json`
```json
{
  "items": [
    {
      "id": "doc_meera_lab_2026_05",
      "patient_id": "pat_meera",
      "title": "Lab report · Sunrise Diagnostics · 04 May 2026",
      "document_type": "lab_report",
      "document_date": "2026-05-04",
      "date_ambiguous": true,
      "facility_name": "Sunrise Diagnostics",
      "clinician_name": null,
      "status": "needs_review",
      "stage": "done",
      "failure_code": null,
      "failure_message": null,
      "flags": ["date_ambiguous", "sample"],
      "is_sample": true,
      "extraction_source": "live",
      "page_count": 1,
      "fact_counts": { "total": 5, "unverified": 5, "low_confidence": 0 },
      "created_at": "2026-10-24T04:40:00Z",
      "processed_at": "2026-10-24T04:40:21Z"
    },
    {
      "id": "doc_meera_scan_2026_06",
      "patient_id": "pat_meera",
      "title": "Sample · scanned_prescription.pdf",
      "document_type": "unknown",
      "document_date": null,
      "date_ambiguous": false,
      "facility_name": null,
      "clinician_name": null,
      "status": "failed",
      "stage": "no_text_layer",
      "failure_code": "NO_TEXT_LAYER",
      "failure_message": "This looks like a scanned image. Reading scanned documents isn't available in this prototype yet.",
      "flags": ["sample"],
      "is_sample": true,
      "extraction_source": "none",
      "page_count": 1,
      "fact_counts": { "total": 0, "unverified": 0, "low_confidence": 0 },
      "created_at": "2026-10-24T04:40:00Z",
      "processed_at": "2026-10-24T04:40:03Z"
    }
  ],
  "total": 2,
  "limit": 50,
  "offset": 0
}
```

### API-11 `GET /patients/{patient_id}/documents/{document_id}` — P0

Returns the document, header sources, the extracted page lines (`document.pages`, added in 1.1.0) and all facts, including rejected ones so the user can undo. Facts are ordered by type (medication, lab_result, condition, allergy, procedure, vital_sign, follow_up, instruction), then by first source line. This is also the polling endpoint during processing.

Fixture: `contracts/API-11.200.needs-review.json`
```json
{
  "document": {
    "id": "doc_meera_lab_2026_05",
    "patient_id": "pat_meera",
    "title": "Lab report · Sunrise Diagnostics · 04 May 2026",
    "document_type": "lab_report",
    "document_date": "2026-05-04",
    "date_ambiguous": true,
    "facility_name": "Sunrise Diagnostics",
    "clinician_name": null,
    "status": "needs_review",
    "stage": "done",
    "failure_code": null,
    "failure_message": null,
    "flags": ["date_ambiguous", "sample"],
    "is_sample": true,
    "extraction_source": "live",
    "page_count": 1,
    "fact_counts": { "total": 5, "unverified": 5, "low_confidence": 0 },
    "created_at": "2026-10-24T04:40:00Z",
    "processed_at": "2026-10-24T04:40:21Z",
    "original_filename": "lab_sunrise_may2026.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 48211,
    "header_sources": {
      "document_type": { "line_ids": ["p1-l1"], "text": "SUNRISE DIAGNOSTICS — LABORATORY REPORT — SYNTHETIC DEMO DOCUMENT" },
      "document_date": { "line_ids": ["p1-l3"], "text": "Sample collected: 04/05/2026   Report date: 04/05/2026" },
      "facility_name": { "line_ids": ["p1-l1"], "text": "SUNRISE DIAGNOSTICS — LABORATORY REPORT — SYNTHETIC DEMO DOCUMENT" },
      "clinician_name": null
    },
    "flags_detail": [
      { "flag": "date_ambiguous", "text": "The date 04/05/2026 was read as 04 May 2026 (day first). Please check it." }
    ],
    "pages": [
      {
        "page": 1,
        "lines": [
          { "line_id": "p1-l1", "text": "SUNRISE DIAGNOSTICS — LABORATORY REPORT — SYNTHETIC DEMO DOCUMENT" },
          { "line_id": "p1-l6", "text": "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H" },
          { "line_id": "p1-l10", "text": "Haemoglobin   12.1   g/dL" }
        ]
      }
    ]
  },
  "facts": [
    {
      "id": "fct_meera_lab_2026_05_01",
      "document_id": "doc_meera_lab_2026_05",
      "fact_type": "lab_result",
      "display_text": "HbA1c (Glycated haemoglobin): 7.6 % (ref 4.0 - 5.6) H",
      "fields": {
        "name": "HbA1c (Glycated haemoglobin)",
        "value": "7.6",
        "unit": "%",
        "reference_range": "4.0 - 5.6",
        "abnormal_flag_as_written": "H",
        "event_date_text": null
      },
      "event_date": "2026-05-04",
      "source": {
        "page": 1,
        "line_ids": ["p1-l6"],
        "lines": [{ "line_id": "p1-l6", "text": "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H" }]
      },
      "confidence": "medium",
      "uncertainty_reasons": ["date_ambiguous"],
      "status": "unverified",
      "corrected_fields": null,
      "extraction_note": null,
      "reviewed_at": null
    },
    {
      "id": "fct_meera_lab_2026_05_05",
      "document_id": "doc_meera_lab_2026_05",
      "fact_type": "lab_result",
      "display_text": "Haemoglobin: 12.1 g/dL",
      "fields": {
        "name": "Haemoglobin",
        "value": "12.1",
        "unit": "g/dL",
        "reference_range": null,
        "abnormal_flag_as_written": null,
        "event_date_text": null
      },
      "event_date": "2026-05-04",
      "source": {
        "page": 1,
        "line_ids": ["p1-l10"],
        "lines": [{ "line_id": "p1-l10", "text": "Haemoglobin   12.1   g/dL" }]
      },
      "confidence": "medium",
      "uncertainty_reasons": ["missing_reference_range", "date_ambiguous"],
      "status": "unverified",
      "corrected_fields": null,
      "extraction_note": null,
      "reviewed_at": null
    }
  ]
}
```

Fixture: `contracts/API-11.200.processing.json`
```json
{
  "document": {
    "id": "doc_meera_rx_2026_09",
    "patient_id": "pat_meera",
    "title": "Uploaded document · rx_lakeview_sep2026.pdf",
    "document_type": "unknown",
    "document_date": null,
    "date_ambiguous": false,
    "facility_name": null,
    "clinician_name": null,
    "status": "processing",
    "stage": "extracting",
    "failure_code": null,
    "failure_message": null,
    "flags": [],
    "is_sample": false,
    "extraction_source": "none",
    "page_count": 1,
    "fact_counts": { "total": 0, "unverified": 0, "low_confidence": 0 },
    "created_at": "2026-10-24T05:00:02Z",
    "processed_at": null,
    "original_filename": "rx_lakeview_sep2026.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 39874,
    "header_sources": {
      "document_type": null,
      "document_date": null,
      "facility_name": null,
      "clinician_name": null
    },
    "flags_detail": []
  },
  "facts": []
}
```

Other required fixtures for this endpoint, with the same shape:
- `API-11.200.ready.json`: all facts reviewed.
- `API-11.200.failed-no-text-layer.json`: matches the scanned item in API-10.
- `API-11.200.suspicious.json`: injection test document; `flags` contains `suspicious_instructions` and `flags_detail` carries COPY-13.
- `API-11.200.cached.json`: `extraction_source` is `cache` and `flags` contains `cached_extraction`.

### API-12 `GET /patients/{patient_id}/documents/{document_id}/file` — P0

Streams the original file. Response headers: `Content-Type` (stored type), `Content-Disposition: inline; filename="<sanitised name>"`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`. The frontend fetches the file with the bearer token and shows it through a blob URL. The token is never put in a URL. Writes the audit event `document.file_viewed`. Status codes: 200 · 403 · 404.

### API-13 `POST /patients/{patient_id}/documents/{document_id}/reprocess` — P0

Re-runs processing. Allowed when `status` is `failed`, or `needs_review` with no reviewed facts. Unreviewed facts are discarded and re-extracted. No body. Returns 202 with the same body shape as API-08. Status codes: 202 · 403 · 404 · 409 `INVALID_STATE`.

### API-14 `PATCH /patients/{patient_id}/documents/{document_id}` — P0

| Field | Type | Validation |
|---|---|---|
| document_type | enum, optional | As in API-08 |
| document_date | date, optional | `YYYY-MM-DD`; not in the future. Setting it clears `date_ambiguous`. |
| facility_name | string, optional | 1–120 chars |
| clinician_name | string, optional | 1–120 chars |

At least one field is required. Changed fields get source `user`. Returns 200 with `{ "document": DocumentSummary }`. Status codes: 200 · 403 · 404 · 422.

Example request:
```json
{ "document_date": "2026-05-04" }
```

### API-15 `PATCH /patients/{patient_id}/facts/{fact_id}` — P0

| Field | Type | Validation |
|---|---|---|
| action | enum | `confirm` · `correct` · `reject` · `undo_reject` |
| corrected_fields | object | Required for `correct`. Keys must be valid `fields` keys for the fact type. Values are strings of 1–200 chars. |
| note | string, optional | Max 200 chars. Stored in history; never sent to AI. |

Transitions follow [07-data-model.md](07-data-model.md) §6. Others return 409 `INVALID_STATE`. The response includes the document's new status, so the UI can update its badge.

Example request:
```json
{
  "action": "correct",
  "corrected_fields": { "value": "7.6", "unit": "%" },
  "note": "Checked against the paper report"
}
```

Fixture: `contracts/API-15.200.json`
```json
{
  "fact": {
    "id": "fct_meera_lab_2026_05_01",
    "document_id": "doc_meera_lab_2026_05",
    "fact_type": "lab_result",
    "display_text": "HbA1c (Glycated haemoglobin): 7.6 % (ref 4.0 - 5.6) H",
    "fields": {
      "name": "HbA1c (Glycated haemoglobin)",
      "value": "7.6",
      "unit": "%",
      "reference_range": "4.0 - 5.6",
      "abnormal_flag_as_written": "H",
      "event_date_text": null
    },
    "event_date": "2026-05-04",
    "source": {
      "page": 1,
      "line_ids": ["p1-l6"],
      "lines": [{ "line_id": "p1-l6", "text": "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H" }]
    },
    "confidence": "medium",
    "uncertainty_reasons": ["date_ambiguous"],
    "status": "confirmed",
    "corrected_fields": null,
    "extraction_note": null,
    "reviewed_at": "2026-10-24T05:01:12Z"
  },
  "document": { "id": "doc_meera_lab_2026_05", "status": "needs_review" }
}
```

### API-16 `POST /patients/{patient_id}/documents/{document_id}/review` — P0

Confirms every `unverified` fact with `high` confidence in one action. Medium and low confidence facts stay for individual review.

Example request:
```json
{ "action": "confirm_high_confidence" }
```

Fixture: `contracts/API-16.200.json`
```json
{
  "confirmed_fact_ids": [
    "fct_meera_rx_2026_09_01",
    "fct_meera_rx_2026_09_02",
    "fct_meera_rx_2026_09_03",
    "fct_meera_rx_2026_09_04",
    "fct_meera_rx_2026_09_05",
    "fct_meera_rx_2026_09_06",
    "fct_meera_rx_2026_09_07",
    "fct_meera_rx_2026_09_08",
    "fct_meera_rx_2026_09_09"
  ],
  "remaining_unverified": 0,
  "document": { "id": "doc_meera_rx_2026_09", "status": "ready" }
}
```

### API-17 `GET /patients/{patient_id}/timeline` — P0

Query parameters:
- `from`, `to` (`YYYY-MM-DD`, optional)
- `types` (comma-separated `event_type` values, optional)
- `include_unverified` (default `true`)
- `order` (`desc` default, or `asc`)

Rejected facts never appear. `change` markers come from AG-07 (BE-6.3) and may be `null` until that task ships.

Fixture: `contracts/API-17.200.json`
```json
{
  "groups": [
    {
      "date": "2026-09-15",
      "events": [
        {
          "id": "evt_doc_doc_meera_rx_2026_09",
          "date": "2026-09-15",
          "event_type": "document",
          "title": "Prescription · Lakeview Family Clinic",
          "summary": "Dr. Arun Kumar · 3 medicines · follow-up advice",
          "document_id": "doc_meera_rx_2026_09",
          "fact_id": null,
          "status": null,
          "confidence": null,
          "change": null,
          "source": { "page": 1, "line_ids": ["p1-l1", "p1-l3"] }
        },
        {
          "id": "evt_fct_fct_meera_rx_2026_09_01",
          "date": "2026-09-15",
          "event_type": "medication",
          "title": "Metformin 1000 mg",
          "summary": "1 tablet · twice daily · after meals · 90 days",
          "document_id": "doc_meera_rx_2026_09",
          "fact_id": "fct_meera_rx_2026_09_01",
          "status": "confirmed",
          "confidence": "high",
          "change": {
            "kind": "dose_change",
            "previous": { "strength": "500 mg", "document_id": "doc_meera_rx_2025_03", "date": "2025-03-21" },
            "current": { "strength": "1000 mg", "document_id": "doc_meera_rx_2026_09", "date": "2026-09-15" }
          },
          "source": { "page": 1, "line_ids": ["p1-l8"] }
        }
      ]
    },
    {
      "date": "2026-05-04",
      "events": [
        {
          "id": "evt_fct_fct_meera_lab_2026_05_01",
          "date": "2026-05-04",
          "event_type": "lab_result",
          "title": "HbA1c (Glycated haemoglobin) 7.6 %",
          "summary": "Reference 4.0 - 5.6 · marked H on the report",
          "document_id": "doc_meera_lab_2026_05",
          "fact_id": "fct_meera_lab_2026_05_01",
          "status": "unverified",
          "confidence": "medium",
          "change": {
            "kind": "value_change",
            "previous": { "value": "8.4", "unit": "%", "document_id": "doc_meera_lab_2025_03", "date": "2025-03-18" },
            "current": { "value": "7.6", "unit": "%", "document_id": "doc_meera_lab_2026_05", "date": "2026-05-04" }
          },
          "source": { "page": 1, "line_ids": ["p1-l6"] }
        }
      ]
    }
  ],
  "undated": [],
  "counts": { "events": 3, "documents": 2, "unverified": 1 },
  "generated_at": "2026-10-24T05:02:00Z"
}
```

### API-18 `POST /patients/{patient_id}/briefs` — P0

Builds a **deterministic** snapshot instantly (no model call; target under 500 ms). The narrative is requested separately through API-20. Section rules are in [08-ai-rag-design.md](08-ai-rag-design.md) §9.2. `medications` come only from the most recent document that lists medicines, named in `medications_from`. Older medicine names appear in `other_medications_mentioned` and are never presented as current.

| Field | Type | Validation |
|---|---|---|
| include_unverified | boolean | Default `true` |
| visit_reason | string, optional | Max 300 chars. Shown as "Reason for visit (your words)". |

Example request:
```json
{ "include_unverified": true, "visit_reason": "Routine diabetes review" }
```

Fixture: `contracts/API-18.201.json`
```json
{
  "brief": {
    "id": "brf_2c7e9a14-5b3d-4f6e-8a1c-0d9e8f7a6b5c",
    "patient_id": "pat_meera",
    "created_at": "2026-10-24T05:02:41Z",
    "created_by": { "user_id": "usr_meera", "display_name": "Meera Raman" },
    "include_unverified": true,
    "visit_reason": "Routine diabetes review",
    "stale": false,
    "header": {
      "patient_display_name": "Meera Raman",
      "age_years": 58,
      "documents_count": 5,
      "providers_count": 3,
      "date_range": { "from": "2025-03-18", "to": "2026-09-15" },
      "unverified_items_count": 5
    },
    "overview": {
      "templated_text": "Based on 5 documents from 3 providers between 18 Mar 2025 and 15 Sep 2026.",
      "narrative_status": "not_requested",
      "narrative": null
    },
    "sections": {
      "medications_from": {
        "document_id": "doc_meera_rx_2026_09",
        "title": "Prescription · Lakeview Family Clinic · 15 Sep 2026"
      },
      "medications": [
        {
          "id": "B-MED-1",
          "text": "Metformin 1000 mg · 1 tablet twice daily after meals · 90 days",
          "status": "confirmed",
          "badges": ["documents_differ"],
          "evidence_ids": ["E1"]
        },
        {
          "id": "B-MED-2",
          "text": "Amlodipine 5 mg · 1 tablet once daily · 90 days",
          "status": "confirmed",
          "badges": [],
          "evidence_ids": ["E2"]
        },
        {
          "id": "B-MED-3",
          "text": "Atorvastatin 10 mg · 1 tablet at night · 90 days",
          "status": "confirmed",
          "badges": [],
          "evidence_ids": ["E3"]
        }
      ],
      "other_medications_mentioned": [
        {
          "id": "B-OMED-1",
          "name": "ORS sachets",
          "last_seen_date": "2025-07-31",
          "evidence_ids": ["E13"]
        }
      ],
      "conditions": [
        {
          "id": "B-CON-1",
          "text": "Type 2 diabetes mellitus (first documented 21 Mar 2025)",
          "status": "confirmed",
          "badges": [],
          "evidence_ids": ["E4"]
        }
      ],
      "results_over_time": [
        {
          "id": "B-LAB-1",
          "test_name": "HbA1c (Glycated haemoglobin)",
          "reference_range_as_written": "4.0 - 5.6",
          "values": [
            { "date": "2025-03-18", "value": "8.4", "unit": "%", "flag_as_written": "H", "status": "confirmed", "evidence_ids": ["E5"] },
            { "date": "2026-05-04", "value": "7.6", "unit": "%", "flag_as_written": "H", "status": "unverified", "evidence_ids": ["E6"] }
          ]
        }
      ],
      "allergies": {
        "status": "conflicting",
        "items": [
          { "id": "B-ALG-1", "text": "Sulfa drugs (rash)", "status": "confirmed", "badges": ["documents_differ"], "evidence_ids": ["E7"] }
        ]
      },
      "points_to_clarify": [
        {
          "id": "F-1",
          "rule_id": "RULE-MED-DOSE-DIFF",
          "text": "Your documents list different strengths for Metformin: 500 mg (Prescription, 21 Mar 2025) and 1000 mg (Discharge summary, 31 Jul 2025; Prescription, 15 Sep 2026). The most recent document lists 1000 mg. Please confirm your current dose with your doctor.",
          "evidence_ids": ["E8", "E9", "E1"],
          "suggested_question": "Which dose of Metformin should I be taking now?"
        },
        {
          "id": "F-2",
          "rule_id": "RULE-ALLERGY-CONFLICT",
          "text": "Your documents differ on allergies: \"No known drug allergies\" (Prescription, 21 Mar 2025) and \"Sulfa drugs (rash)\" (Discharge summary, 31 Jul 2025). Please confirm your allergies with your doctor.",
          "evidence_ids": ["E10", "E7"],
          "suggested_question": "Can you confirm whether I am allergic to sulfa drugs?"
        }
      ],
      "missing_information": [
        {
          "id": "F-3",
          "rule_id": "RULE-FOLLOWUP-NO-APPT",
          "text": "Your prescription from 15 Sep 2026 says \"Review after 6 weeks with fasting glucose report.\" No later visit, appointment or reminder was found in MediVara.",
          "evidence_ids": ["E11"],
          "suggested_question": "When should my next review be, and which tests should I bring?"
        },
        {
          "id": "F-4",
          "rule_id": "RULE-LAB-NO-RANGE",
          "text": "Haemoglobin (04 May 2026) has no reference range printed on the report.",
          "evidence_ids": ["E12"],
          "suggested_question": null
        }
      ],
      "questions_for_doctor": [
        "Which dose of Metformin should I be taking now?",
        "Can you confirm whether I am allergic to sulfa drugs?",
        "When should my next review be, and which tests should I bring?",
        "What do my recent HbA1c results mean for my care?"
      ]
    },
    "evidence": [
      { "evidence_id": "E1", "document_id": "doc_meera_rx_2026_09", "document_title": "Prescription · Lakeview Family Clinic · 15 Sep 2026", "document_type": "prescription", "document_date": "2026-09-15", "page": 1, "line_ids": ["p1-l8"], "text": "1. Tab. Metformin 1000 mg — 1 tablet twice daily after meals — 90 days", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E2", "document_id": "doc_meera_rx_2026_09", "document_title": "Prescription · Lakeview Family Clinic · 15 Sep 2026", "document_type": "prescription", "document_date": "2026-09-15", "page": 1, "line_ids": ["p1-l9"], "text": "2. Tab. Amlodipine 5 mg — 1 tablet once daily — 90 days", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E3", "document_id": "doc_meera_rx_2026_09", "document_title": "Prescription · Lakeview Family Clinic · 15 Sep 2026", "document_type": "prescription", "document_date": "2026-09-15", "page": 1, "line_ids": ["p1-l10"], "text": "3. Tab. Atorvastatin 10 mg — 1 tablet at night — 90 days", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E4", "document_id": "doc_meera_rx_2025_03", "document_title": "Prescription · Lakeview Family Clinic · 21 Mar 2025", "document_type": "prescription", "document_date": "2025-03-21", "page": 1, "line_ids": ["p1-l5"], "text": "Diagnosis: Type 2 diabetes mellitus; Hypertension", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E5", "document_id": "doc_meera_lab_2025_03", "document_title": "Lab report · Sunrise Diagnostics · 18 Mar 2025", "document_type": "lab_report", "document_date": "2025-03-18", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E6", "document_id": "doc_meera_lab_2026_05", "document_title": "Lab report · Sunrise Diagnostics · 04 May 2026", "document_type": "lab_report", "document_date": "2026-05-04", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H", "fact_status": "unverified", "is_user_correction": false },
      { "evidence_id": "E7", "document_id": "doc_meera_dc_2025_07", "document_title": "Discharge summary · Greenfield General Hospital · 31 Jul 2025", "document_type": "discharge_summary", "document_date": "2025-07-31", "page": 1, "line_ids": ["p1-l7"], "text": "Allergies: Sulfa drugs (rash)", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E8", "document_id": "doc_meera_rx_2025_03", "document_title": "Prescription · Lakeview Family Clinic · 21 Mar 2025", "document_type": "prescription", "document_date": "2025-03-21", "page": 1, "line_ids": ["p1-l8"], "text": "1. Tab. Metformin 500 mg — 1 tablet twice daily after meals — 90 days", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E9", "document_id": "doc_meera_dc_2025_07", "document_title": "Discharge summary · Greenfield General Hospital · 31 Jul 2025", "document_type": "discharge_summary", "document_date": "2025-07-31", "page": 1, "line_ids": ["p1-l10"], "text": "Tab. Metformin 1000 mg — twice daily after meals", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E10", "document_id": "doc_meera_rx_2025_03", "document_title": "Prescription · Lakeview Family Clinic · 21 Mar 2025", "document_type": "prescription", "document_date": "2025-03-21", "page": 1, "line_ids": ["p1-l6"], "text": "Allergies: No known drug allergies", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E11", "document_id": "doc_meera_rx_2026_09", "document_title": "Prescription · Lakeview Family Clinic · 15 Sep 2026", "document_type": "prescription", "document_date": "2026-09-15", "page": 1, "line_ids": ["p1-l12"], "text": "Advice: Review after 6 weeks with fasting glucose report.", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E12", "document_id": "doc_meera_lab_2026_05", "document_title": "Lab report · Sunrise Diagnostics · 04 May 2026", "document_type": "lab_report", "document_date": "2026-05-04", "page": 1, "line_ids": ["p1-l10"], "text": "Haemoglobin   12.1   g/dL", "fact_status": "unverified", "is_user_correction": false },
      { "evidence_id": "E13", "document_id": "doc_meera_dc_2025_07", "document_title": "Discharge summary · Greenfield General Hospital · 31 Jul 2025", "document_type": "discharge_summary", "document_date": "2025-07-31", "page": 1, "line_ids": ["p1-l13"], "text": "ORS sachets — as needed for 3 days", "fact_status": "confirmed", "is_user_correction": false }
    ],
    "sources": [
      { "document_id": "doc_meera_rx_2026_09", "title": "Prescription · Lakeview Family Clinic · 15 Sep 2026" },
      { "document_id": "doc_meera_lab_2026_05", "title": "Lab report · Sunrise Diagnostics · 04 May 2026" },
      { "document_id": "doc_meera_dc_2025_07", "title": "Discharge summary · Greenfield General Hospital · 31 Jul 2025" },
      { "document_id": "doc_meera_rx_2025_03", "title": "Prescription · Lakeview Family Clinic · 21 Mar 2025" },
      { "document_id": "doc_meera_lab_2025_03", "title": "Lab report · Sunrise Diagnostics · 18 Mar 2025" }
    ],
    "disclaimer": "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor."
  }
}
```

### API-19 `GET /patients/{patient_id}/briefs/latest` — P0

Returns the most recent brief, with `stale` recomputed and `overview.narrative` filled in if API-20 has run. Returns 404 `NOT_FOUND` when no brief exists yet; the frontend shows the "Create your first brief" empty state.

Fixture: `contracts/API-19.200.json` has the same body as `API-18.201.json`, except that `overview.narrative_status` is `"ready"` and `overview.narrative` holds the `narrative` object from `API-20.200.ready.json`.

### API-20 `POST /patients/{patient_id}/briefs/{brief_id}/narrative` — P0

Generates a short overview grounded in the brief's evidence lines, synchronously, with a 25-second limit. The narrative has its **own** evidence list; evidence IDs are local to that list. If the AI fails, times out or is blocked, or if fewer than half the statements pass validation, `status` is `unavailable` or `withheld`, and the frontend keeps showing `templated_text`. No body.

Fixture: `contracts/API-20.200.ready.json`
```json
{
  "brief_id": "brf_2c7e9a14-5b3d-4f6e-8a1c-0d9e8f7a6b5c",
  "narrative": {
    "output_id": "aio_8e1f2a3b-4c5d-4e6f-9a0b-1c2d3e4f5a6b",
    "status": "ready",
    "statements": [
      { "id": "S1", "kind": "record_fact", "text": "Your records from Sunrise Diagnostics, Lakeview Family Clinic and Greenfield General Hospital document Type 2 diabetes mellitus and hypertension.", "evidence_ids": ["E1"] },
      { "id": "S2", "kind": "record_fact", "text": "You were admitted to Greenfield General Hospital from 27 Jul 2025 to 31 Jul 2025 for acute gastroenteritis with dehydration.", "evidence_ids": ["E2", "E3"] },
      { "id": "S3", "kind": "record_fact", "text": "Your HbA1c was 8.4 % on 18 Mar 2025 and 7.6 % on 04 May 2026.", "evidence_ids": ["E4", "E5"] },
      { "id": "S4", "kind": "uncertainty", "text": "Your documents list different Metformin strengths over time, so it is worth confirming your current dose.", "evidence_ids": ["E6", "E7"] }
    ],
    "evidence": [
      { "evidence_id": "E1", "document_id": "doc_meera_rx_2025_03", "document_title": "Prescription · Lakeview Family Clinic · 21 Mar 2025", "document_type": "prescription", "document_date": "2025-03-21", "page": 1, "line_ids": ["p1-l5"], "text": "Diagnosis: Type 2 diabetes mellitus; Hypertension", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E2", "document_id": "doc_meera_dc_2025_07", "document_title": "Discharge summary · Greenfield General Hospital · 31 Jul 2025", "document_type": "discharge_summary", "document_date": "2025-07-31", "page": 1, "line_ids": ["p1-l3"], "text": "Date of admission: 27-Jul-2025   Date of discharge: 31-Jul-2025", "fact_status": null, "is_user_correction": false },
      { "evidence_id": "E3", "document_id": "doc_meera_dc_2025_07", "document_title": "Discharge summary · Greenfield General Hospital · 31 Jul 2025", "document_type": "discharge_summary", "document_date": "2025-07-31", "page": 1, "line_ids": ["p1-l5"], "text": "Diagnosis: Acute gastroenteritis with dehydration", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E4", "document_id": "doc_meera_lab_2025_03", "document_title": "Lab report · Sunrise Diagnostics · 18 Mar 2025", "document_type": "lab_report", "document_date": "2025-03-18", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E5", "document_id": "doc_meera_lab_2026_05", "document_title": "Lab report · Sunrise Diagnostics · 04 May 2026", "document_type": "lab_report", "document_date": "2026-05-04", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H", "fact_status": "unverified", "is_user_correction": false },
      { "evidence_id": "E6", "document_id": "doc_meera_rx_2025_03", "document_title": "Prescription · Lakeview Family Clinic · 21 Mar 2025", "document_type": "prescription", "document_date": "2025-03-21", "page": 1, "line_ids": ["p1-l8"], "text": "1. Tab. Metformin 500 mg — 1 tablet twice daily after meals — 90 days", "fact_status": "confirmed", "is_user_correction": false },
      { "evidence_id": "E7", "document_id": "doc_meera_rx_2026_09", "document_title": "Prescription · Lakeview Family Clinic · 15 Sep 2026", "document_type": "prescription", "document_date": "2026-09-15", "page": 1, "line_ids": ["p1-l8"], "text": "1. Tab. Metformin 1000 mg — 1 tablet twice daily after meals — 90 days", "fact_status": "confirmed", "is_user_correction": false }
    ],
    "notices": [
      { "code": "unverified_included", "text": "Some of this comes from information you haven't reviewed yet." }
    ],
    "templated_text": "Based on 5 documents from 3 providers between 18 Mar 2025 and 15 Sep 2026.",
    "generated_at": "2026-10-24T05:02:52Z"
  }
}
```

Fixture: `contracts/API-20.200.unavailable.json`
```json
{
  "brief_id": "brf_2c7e9a14-5b3d-4f6e-8a1c-0d9e8f7a6b5c",
  "narrative": {
    "output_id": "aio_9f2a3b4c-5d6e-4f7a-8b9c-0d1e2f3a4b5c",
    "status": "unavailable",
    "statements": [],
    "evidence": [],
    "notices": [
      { "code": "ai_unavailable", "text": "The AI summary isn't available right now. Everything below comes directly from your documents." }
    ],
    "templated_text": "Based on 5 documents from 3 providers between 18 Mar 2025 and 15 Sep 2026.",
    "generated_at": "2026-10-24T05:03:20Z"
  }
}
```

### API-21 `POST /patients/{patient_id}/ask` — P0

Single-turn. There is no conversation memory on the server; the frontend keeps the thread for the session only.

| Field | Type | Validation |
|---|---|---|
| question | string | Required; 1–500 chars after trimming |
| input_mode | enum | `text` (default) · `voice` |

Pipeline: AG-09 gate → AG-10 context → AG-11 generator → AG-12 validator (see [08-ai-rag-design.md](08-ai-rag-design.md)). Hard time limit: 20 seconds, then the evidence-only fallback.

`status` values:

| Value | Meaning |
|---|---|
| `answered` | Validated statements returned |
| `not_found` | The records don't contain the answer |
| `advice_redirect` | Medication or diagnosis advice was requested. Safe template plus relevant lines, no model call. |
| `emergency` | Emergency wording detected. Fixed message, no model call, empty evidence. |
| `out_of_scope` | Not about the patient's records |
| `degraded` | AI unavailable. Keyword-matched evidence lines only. |
| `withheld` | Fewer than half the statements passed validation. Evidence shown instead. |

Example request:
```json
{ "question": "What was my most recent HbA1c, and what was it before?", "input_mode": "text" }
```

Fixture: `contracts/API-21.200.answered.json`
```json
{
  "answer_id": "aio_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  "status": "answered",
  "statements": [
    { "id": "S1", "kind": "record_fact", "text": "Your most recent HbA1c was 7.6 % on the lab report dated 04 May 2026.", "evidence_ids": ["E1"] },
    { "id": "S2", "kind": "record_fact", "text": "Before that, your HbA1c was 8.4 % on the lab report dated 18 Mar 2025.", "evidence_ids": ["E2"] },
    { "id": "S3", "kind": "record_fact", "text": "Both reports mark the result with \"H\" next to a reference range of 4.0 - 5.6.", "evidence_ids": ["E1", "E2"] }
  ],
  "evidence": [
    { "evidence_id": "E1", "document_id": "doc_meera_lab_2026_05", "document_title": "Lab report · Sunrise Diagnostics · 04 May 2026", "document_type": "lab_report", "document_date": "2026-05-04", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H", "fact_status": "unverified", "is_user_correction": false },
    { "evidence_id": "E2", "document_id": "doc_meera_lab_2025_03", "document_title": "Lab report · Sunrise Diagnostics · 18 Mar 2025", "document_type": "lab_report", "document_date": "2025-03-18", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H", "fact_status": "confirmed", "is_user_correction": false }
  ],
  "questions_for_doctor": [
    "What do my recent HbA1c results mean for my diabetes care?",
    "When should I repeat my HbA1c test?"
  ],
  "notices": [
    { "code": "unverified_included", "text": "Some of this comes from information you haven't reviewed yet." }
  ],
  "disclaimer": "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.",
  "generated_at": "2026-10-24T05:05:10Z",
  "latency_ms": 6840
}
```

Fixture: `contracts/API-21.200.advice-redirect.json`
```json
{
  "answer_id": "aio_2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  "status": "advice_redirect",
  "statements": [
    { "id": "S1", "kind": "safety_notice", "text": "I can't advise you to start, stop or change any medicine or dose. Only your doctor can decide that with you. Here is what your documents say, so you can discuss it with them.", "evidence_ids": [] }
  ],
  "evidence": [
    { "evidence_id": "E1", "document_id": "doc_meera_rx_2026_09", "document_title": "Prescription · Lakeview Family Clinic · 15 Sep 2026", "document_type": "prescription", "document_date": "2026-09-15", "page": 1, "line_ids": ["p1-l8"], "text": "1. Tab. Metformin 1000 mg — 1 tablet twice daily after meals — 90 days", "fact_status": "confirmed", "is_user_correction": false },
    { "evidence_id": "E2", "document_id": "doc_meera_rx_2025_03", "document_title": "Prescription · Lakeview Family Clinic · 21 Mar 2025", "document_type": "prescription", "document_date": "2025-03-21", "page": 1, "line_ids": ["p1-l8"], "text": "1. Tab. Metformin 500 mg — 1 tablet twice daily after meals — 90 days", "fact_status": "confirmed", "is_user_correction": false }
  ],
  "questions_for_doctor": [
    "Is my current dose of Metformin still right for me?"
  ],
  "notices": [],
  "disclaimer": "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.",
  "generated_at": "2026-10-24T05:06:02Z",
  "latency_ms": 41
}
```

Fixture: `contracts/API-21.200.emergency.json`
```json
{
  "answer_id": "aio_3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
  "status": "emergency",
  "statements": [
    { "id": "S1", "kind": "safety_notice", "text": "If you or someone else may be in danger or need urgent medical help, call 112 (emergency) or 108 (ambulance) now, or go to the nearest emergency department. If you are thinking about harming yourself, call Tele-MANAS on 14416 (free, 24×7). MediVara cannot help in an emergency.", "evidence_ids": [] }
  ],
  "evidence": [],
  "questions_for_doctor": [],
  "notices": [],
  "disclaimer": "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.",
  "generated_at": "2026-10-24T05:06:40Z",
  "latency_ms": 12
}
```

Fixture: `contracts/API-21.200.not-found.json`
```json
{
  "answer_id": "aio_4d5e6f7a-8b9c-4d0e-1f2a-3b4c5d6e7f8a",
  "status": "not_found",
  "statements": [
    { "id": "S1", "kind": "not_found", "text": "I couldn't find this in your documents. If you have a report that mentions it, you can upload it, or ask your doctor.", "evidence_ids": [] }
  ],
  "evidence": [],
  "questions_for_doctor": [],
  "notices": [],
  "disclaimer": "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.",
  "generated_at": "2026-10-24T05:07:15Z",
  "latency_ms": 5210
}
```

Fixture: `contracts/API-21.200.degraded.json`
```json
{
  "answer_id": "aio_5e6f7a8b-9c0d-4e1f-2a3b-4c5d6e7f8a9b",
  "status": "degraded",
  "statements": [],
  "evidence": [
    { "evidence_id": "E1", "document_id": "doc_meera_lab_2026_05", "document_title": "Lab report · Sunrise Diagnostics · 04 May 2026", "document_type": "lab_report", "document_date": "2026-05-04", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H", "fact_status": "unverified", "is_user_correction": false },
    { "evidence_id": "E2", "document_id": "doc_meera_lab_2025_03", "document_title": "Lab report · Sunrise Diagnostics · 18 Mar 2025", "document_type": "lab_report", "document_date": "2025-03-18", "page": 1, "line_ids": ["p1-l6"], "text": "HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H", "fact_status": "confirmed", "is_user_correction": false }
  ],
  "questions_for_doctor": [],
  "notices": [
    { "code": "ai_unavailable", "text": "The AI assistant isn't available right now. These lines from your documents match your question." }
  ],
  "disclaimer": "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.",
  "generated_at": "2026-10-24T05:08:00Z",
  "latency_ms": 20015
}
```

`contracts/API-21.200.withheld.json` has the degraded shape with `status` `"withheld"` and notice code `withheld` (COPY-08). `contracts/API-21.200.out-of-scope.json` has the not-found shape with `status` `"out_of_scope"` and the out-of-scope text from COPY-07b.

---

### API-22 `DELETE /patients/{patient_id}/documents/{document_id}` — P1

Owner only. Deletes the file, pages and facts. Briefs that used the document become `stale` automatically through the fingerprint. Returns **204**. Status codes: 204 · 403 `OWNER_ONLY` · 404 · 409 `INVALID_STATE` (while processing).

### API-23 `GET /patients/{patient_id}/access` — P1

Owner only. Lists all grants, including the owner's own grant and revoked grants. The grantee's email is masked for anyone except the owner of that email.

Fixture: `contracts/API-23.200.json`
```json
{
  "grants": [
    {
      "id": "grt_meera_owner",
      "grantee": { "user_id": "usr_meera", "display_name": "Meera Raman", "email": "meera.demo@medivara.test" },
      "role": "owner",
      "scopes": ["view_records", "upload_documents", "manage_reminders"],
      "status": "active",
      "granted_at": "2026-10-24T03:00:00Z",
      "revoked_at": null
    },
    {
      "id": "grt_karthik_meera",
      "grantee": { "user_id": "usr_karthik", "display_name": "Karthik Raman", "email": "karthik.demo@medivara.test" },
      "role": "caregiver",
      "scopes": ["view_records", "manage_reminders"],
      "status": "active",
      "granted_at": "2026-10-24T03:00:00Z",
      "revoked_at": null
    }
  ]
}
```

### API-24 `POST /patients/{patient_id}/access` — P1

Owner only. Grants caregiver access **directly** to an existing account (DEC-08). Records a `sharing` consent and writes an `access.granted` audit event.

| Field | Type | Validation |
|---|---|---|
| grantee_email | string | Must belong to an existing user, and not the owner |
| scopes | list of enum | Must include `view_records`; may add `upload_documents`, `manage_reminders` |
| consent_confirmed | boolean | Must be `true` (the user ticked COPY-25) |
| policy_version | string | Must equal the current policy version |

Status codes: 201 · 403 `OWNER_ONLY` · 404 `USER_NOT_FOUND` (prototype only; production uses invitations to avoid revealing which emails have accounts) · 409 `GRANT_EXISTS` · 422.

Example request:
```json
{
  "grantee_email": "karthik.demo@medivara.test",
  "scopes": ["view_records", "manage_reminders"],
  "consent_confirmed": true,
  "policy_version": "2026-10-demo-1"
}
```

Fixture: `contracts/API-24.201.json`
```json
{
  "grant": {
    "id": "grt_5d6e7f8a-9b0c-4d1e-2f3a-4b5c6d7e8f9a",
    "grantee": { "user_id": "usr_karthik", "display_name": "Karthik Raman", "email": "karthik.demo@medivara.test" },
    "role": "caregiver",
    "scopes": ["view_records", "manage_reminders"],
    "status": "active",
    "granted_at": "2026-10-24T05:10:00Z",
    "revoked_at": null
  }
}
```

### API-25 `DELETE /patients/{patient_id}/access/{grant_id}` — P1

The owner revokes a caregiver grant, or a caregiver revokes their own grant (leave). The owner grant cannot be revoked (409 `INVALID_STATE`). It takes effect on the next request. Returns **204**. Writes an `access.revoked` audit event.

### API-26 `GET /patients/{patient_id}/audit-events` — P1

Owner only. Newest first. Supports `limit` and `offset`. `action_label` is human-readable text supplied by the backend.

Fixture: `contracts/API-26.200.json`
```json
{
  "items": [
    {
      "id": "aud_7f8a9b0c-1d2e-4f3a-4b5c-6d7e8f9a0b1c",
      "at": "2026-10-24T05:12:30Z",
      "actor": { "user_id": "usr_karthik", "display_name": "Karthik Raman" },
      "action": "access.denied",
      "action_label": "Access denied after revoke",
      "resource_type": "patient",
      "resource_id": "pat_meera",
      "outcome": "denied"
    },
    {
      "id": "aud_6e7f8a9b-0c1d-4e2f-3a4b-5c6d7e8f9a0b",
      "at": "2026-10-24T05:12:05Z",
      "actor": { "user_id": "usr_meera", "display_name": "Meera Raman" },
      "action": "access.revoked",
      "action_label": "Revoked Karthik Raman's access",
      "resource_type": "grant",
      "resource_id": "grt_karthik_meera",
      "outcome": "success"
    }
  ],
  "total": 2,
  "limit": 50,
  "offset": 0
}
```

### API-27 `GET /patients/{patient_id}/reminders` — P1

Query parameters: `status` (`active` default, `completed`, `dismissed`, or `all`), `limit`, `offset`. Sorted by `next_due_at` ascending.

Fixture: `contracts/API-27.200.json`
```json
{
  "items": [
    {
      "id": "rem_0a1b2c3d-4e5f-4a6b-7c8d-9e0f1a2b3c4d",
      "type": "follow_up",
      "title": "Review with Dr. Arun Kumar (bring fasting glucose report)",
      "notes": null,
      "schedule_kind": "once",
      "schedule": { "date": "2026-10-27", "time": "10:00", "times": null, "start_date": null, "end_date": null },
      "timezone": "Asia/Kolkata",
      "next_due_at": "2026-10-27T04:30:00Z",
      "next_due_local": "27 Oct 2026, 10:00 IST",
      "last_completed_at": null,
      "status": "active",
      "source_fact_id": "fct_meera_rx_2026_09_08",
      "medication_schedule_attested": false,
      "created_by": { "user_id": "usr_meera", "display_name": "Meera Raman" },
      "created_at": "2026-10-24T05:09:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### API-28 `POST /patients/{patient_id}/reminders` — P1

| Field | Type | Validation |
|---|---|---|
| type | enum | `appointment` · `medication` · `follow_up` · `other` |
| title | string | 1–120 chars |
| notes | string, optional | Max 500 chars |
| schedule_kind | enum | `once` · `daily` |
| schedule | object | Once: `date` (today or later) and `time` (`HH:MM`). Daily: `times` (1–4 values of `HH:MM`), `start_date`, optional `end_date`. |
| timezone | string | IANA name. The MVP accepts only `Asia/Kolkata`. |
| source_fact_id | string, optional | Must be a fact of this patient |
| medication_schedule_attested | boolean | Must be `true` when `type` is `medication` (COPY-24) |

Returns 201 with `{ "reminder": … }` (same object as in API-27). Status codes: 201 · 403 · 422.

Example request:
```json
{
  "type": "follow_up",
  "title": "Review with Dr. Arun Kumar (bring fasting glucose report)",
  "notes": null,
  "schedule_kind": "once",
  "schedule": { "date": "2026-10-27", "time": "10:00", "times": null, "start_date": null, "end_date": null },
  "timezone": "Asia/Kolkata",
  "source_fact_id": "fct_meera_rx_2026_09_08",
  "medication_schedule_attested": false
}
```

### API-29 `PATCH /patients/{patient_id}/reminders/{reminder_id}` — P1

Accepts any subset of the API-28 fields, plus `status` with value `dismissed` or `active` (restore). Validation is the same as API-28. Returns 200 with `{ "reminder": … }`.

### API-30 `POST /patients/{patient_id}/reminders/{reminder_id}/complete` — P1

For `once`: status becomes `completed`. For `daily`: `last_completed_at` is set and `next_due_at` moves to the next scheduled time. No body. Returns 200 with `{ "reminder": … }`. 409 `INVALID_STATE` if the reminder is dismissed or already completed.

### API-31 `GET /patients/{patient_id}/appointment-suggestions` — P1

Query parameter: `reason` (optional, max 300 chars). Suggestions come from a **deterministic mapping table** of documented conditions and reason keywords to specialties ([08-ai-rag-design.md](08-ai-rag-design.md) §10). Lab values are never used. Emergency wording returns `emergency_notice: true` with no suggestions. Providers and slots are fictional.

Fixture: `contracts/API-31.200.json`
```json
{
  "categories": [
    {
      "specialty_id": "endocrinology",
      "specialty_name": "Endocrinology (diabetes and hormone specialist)",
      "why": [
        { "text": "Your records document \"Type 2 diabetes mellitus\".", "evidence_ids": ["E1"] }
      ]
    },
    {
      "specialty_id": "general_medicine",
      "specialty_name": "General medicine",
      "why": [
        { "text": "Your records document \"Hypertension\".", "evidence_ids": ["E1"] }
      ]
    }
  ],
  "evidence": [
    { "evidence_id": "E1", "document_id": "doc_meera_rx_2026_09", "document_title": "Prescription · Lakeview Family Clinic · 15 Sep 2026", "document_type": "prescription", "document_date": "2026-09-15", "page": 1, "line_ids": ["p1-l5"], "text": "Diagnosis: Type 2 diabetes mellitus; Hypertension; Dyslipidaemia", "fact_status": "confirmed", "is_user_correction": false }
  ],
  "preparation_checklist": [
    "Bring your latest Consultation Brief or Visit Card.",
    "Bring all your current medicines or their strips.",
    "Bring your most recent lab reports.",
    "Write down the questions you want to ask."
  ],
  "emergency_notice": false,
  "providers": [
    {
      "id": "spr_demo_endo_1",
      "display_name": "Demo Endocrinology Clinic A (simulated)",
      "specialty_id": "endocrinology",
      "city": "Chennai",
      "languages": ["English", "Tamil"],
      "isl_interpreter_on_request": true,
      "is_simulated": true,
      "slots": [
        { "id": "sls_demo_endo_1_a", "start_at": "2026-10-28T05:00:00Z", "end_at": "2026-10-28T05:20:00Z" },
        { "id": "sls_demo_endo_1_b", "start_at": "2026-10-29T09:30:00Z", "end_at": "2026-10-29T09:50:00Z" }
      ]
    }
  ],
  "disclaimer": "These are general categories based on what your documents mention. They are not a diagnosis or a referral. Providers shown are simulated for this demo."
}
```

### API-32 `POST /patients/{patient_id}/appointments` — P1

| Field | Type | Validation |
|---|---|---|
| provider_id | string | Must be a simulated provider |
| slot_id | string | Must belong to that provider and still be available |
| reason | string, optional | Max 300 chars |
| needs_isl_interpreter | boolean | Default `false` |
| notes | string, optional | Max 300 chars |

Example request:
```json
{
  "provider_id": "spr_demo_endo_1",
  "slot_id": "sls_demo_endo_1_a",
  "reason": "Diabetes review",
  "needs_isl_interpreter": false,
  "notes": null
}
```

Fixture: `contracts/API-32.201.json`
```json
{
  "appointment": {
    "id": "apt_1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    "status": "simulated",
    "is_simulated": true,
    "provider": { "id": "spr_demo_endo_1", "display_name": "Demo Endocrinology Clinic A (simulated)" },
    "start_at": "2026-10-28T05:00:00Z",
    "start_local": "28 Oct 2026, 10:30 IST",
    "reason": "Diabetes review",
    "needs_isl_interpreter": false,
    "created_at": "2026-10-24T05:15:00Z",
    "disclaimer": "Simulated booking for demonstration only. No appointment has been made with a real healthcare provider, and no provider has been contacted."
  }
}
```

### API-33 `GET /patients/{patient_id}/appointments` — P1

Returns `{ items: [appointment…], total, limit, offset }`, using the same object as API-32, sorted by `start_at`.

---

## 5b. Redesign extensions (API-40 to API-67)

> Added in contract 1.2.0 for the frontend redesign (API-40 to API-61); contract 1.4.0 adds women's health, API-62 to API-67. **Additive only**: no existing route or response shape changes (one API-04 behaviour note below). 28 endpoints, API-40 to API-67. Every path is under `/api/v1`, uses the §2 error envelope and follows §1 (UTC `Z` timestamps, `YYYY-MM-DD` dates, documented keys never omitted). Data lives in new tables only (`profile_details`, `vital_reading`, `chat_session`, `chat_message`, `invitation`, `womens_health_settings`, `period_log`), so existing databases need no migration. Every route except API-40 needs a bearer token (401 `UNAUTHENTICATED` otherwise).

**API-04 behaviour note.** `owned_patient_id` is the user's **first-created** owned profile (by `created_at`, then `id`), so family profiles from API-41 never replace it.

New error codes. `RATE_LIMITED` also applies to API-40; `GRANT_EXISTS` and `INVALID_STATE` also apply to invitations. A 422 lists every failing field at once, with paths such as `emergency_contacts.0.phone`.

| HTTP | Code | When |
|---|---|---|
| 409 | `EMAIL_TAKEN` | API-40: an account already uses this email |
| 409 | `PROFILE_LIMIT` | API-41: the user already owns 10 profiles |
| 409 | `INVITATION_EXISTS` | API-54: a pending, unexpired invitation for this email and profile already exists |
| 403 | `CONSENT_REQUIRED` | API-61: the **current user** has no current `voice_input` consent; `details.consent_type: "voice_input"` |
| 503 | `VOICE_UNAVAILABLE` | API-61: voice isn't configured on this server |
| 502 | `VOICE_UNAVAILABLE` | API-61: ElevenLabs didn't answer or refused |
| 409 | `PERIOD_OVERLAP` | API-65/66: the period overlaps another period logged for this profile ("This overlaps a period you've already logged.") |

Shared objects (every key always present, `null` when empty):

| Object | Fields |
|---|---|
| `Relationship` | enum `self` · `spouse` · `parent` · `child` · `sibling` · `grandparent` · `other` |
| `Details` | `patient_id`, `relationship`, `date_of_birth`, `sex` (`female` · `male` · `other`), `blood_group`, `height_cm`, `emergency_contacts` `[{ name, phone, relation }]`, `allergies_note`, `conditions_note`, `medications_note`, `organ_donor`, `updated_at` |
| `Vital` | `id` (`vit_…`), `kind`, `value`, `value2`, `unit`, `context`, `notes`, `measured_at`, `created_by` `{ user_id, display_name }`, `created_at` |
| `Chat` | `id` (`cht_…`), `title`, `created_at`, `updated_at`, `message_count`, `last_message_preview` (latest question, at most 120 chars, or `null`) |
| `ChatMessage` | `id` (`msg_…`), `chat_id`, `role` (`user` · `assistant`), `kind` (`question` · `answer` · `attachment`), `text` (questions only), `input_mode` (questions only), `answer` (answers only: the full API-21 response object), `document` (attachments only: `{ id, title, status, document_type, document_date }` looked up live, `null` once the document is gone), `created_at` |
| `OwnerInvitation` | `id` (`inv_…`), `email`, `relationship`, `scopes`, `status` (`pending` · `accepted` · `declined` · `cancelled` · `expired`), `created_at`, `expires_at`, `responded_at`, `invite_url` |
| `MyInvitation` | `id`, `patient` `{ id, display_name }`, `invited_by` `{ display_name }`, `relationship`, `scopes`, `created_at`, `expires_at` |
| `WomensHealth` | `patient_id`, `mode` (`off` · `cycle` · `pregnancy` · `postpartum`), `cycle_length_days`, `period_length_days`, `lmp_date`, `due_date`, `delivery_date`, `updated_at`, `summary` `{ cycle, pregnancy, postpartum, voice_context }` (API-62) |
| `Period` | `id` (`per_…`), `start_date`, `end_date`, `length_days` (end − start + 1, or `null` without an end), `flow` (`light` · `medium` · `heavy`), `symptoms` (array, canonical order), `notes`, `created_by` `{ user_id, display_name }`, `created_at`, `updated_at` |

| ID | Method and route | Auth / scope |
|---|---|---|
| API-40 | `POST /auth/register` | Public |
| API-41 | `POST /patients` | Bearer |
| API-42 | `GET /patients/{patient_id}/details` | `view_records` |
| API-43 | `PUT /patients/{patient_id}/details` | Owner |
| API-44 | `GET /patients/{patient_id}/vitals` | `view_records` |
| API-45 | `POST /patients/{patient_id}/vitals` | `upload_documents` |
| API-46 | `DELETE /patients/{patient_id}/vitals/{vital_id}` | `upload_documents` |
| API-47 | `GET /patients/{patient_id}/chats` | `view_records`, own chats only |
| API-48 | `POST /patients/{patient_id}/chats` | `view_records` |
| API-49 | `GET /patients/{patient_id}/chats/{chat_id}` | `view_records`, chat creator |
| API-50 | `PATCH /patients/{patient_id}/chats/{chat_id}` | `view_records`, chat creator |
| API-51 | `DELETE /patients/{patient_id}/chats/{chat_id}` | `view_records`, chat creator |
| API-52 | `POST /patients/{patient_id}/chats/{chat_id}/messages` | `view_records`, chat creator |
| API-53 | `POST /patients/{patient_id}/chats/{chat_id}/attachments` | `view_records`, chat creator |
| API-54 | `POST /patients/{patient_id}/invitations` | Owner |
| API-55 | `GET /patients/{patient_id}/invitations` | Owner |
| API-56 | `DELETE /patients/{patient_id}/invitations/{invitation_id}` | Owner |
| API-57 | `GET /me/invitations` | Bearer (invitee) |
| API-58 | `POST /me/invitations/{invitation_id}/accept` | Bearer (invitee) |
| API-59 | `POST /me/invitations/{invitation_id}/decline` | Bearer (invitee) |
| API-60 | `GET /voice/config` | Bearer |
| API-61 | `POST /patients/{patient_id}/voice/session` | `view_records` + own `voice_input` consent |
| API-62 | `GET /patients/{patient_id}/womens-health` | `view_records` |
| API-63 | `PUT /patients/{patient_id}/womens-health` | `upload_documents` |
| API-64 | `GET /patients/{patient_id}/periods` | `view_records` |
| API-65 | `POST /patients/{patient_id}/periods` | `upload_documents` |
| API-66 | `PATCH /patients/{patient_id}/periods/{period_id}` | `upload_documents` |
| API-67 | `DELETE /patients/{patient_id}/periods/{period_id}` | `upload_documents` |

### API-40 `POST /auth/register`

Public. Request `{ "email": "asha@example.com", "password": "correct-horse-battery", "display_name": "Asha Iyer", "sex": "female" }`. The email is trimmed and lowercased and needs one `@`, a dot in the domain and at most 254 characters. Password 10–128 characters. The display name is trimmed (inner whitespace collapsed), 1–80 characters. `sex` (since 1.4.0) is optional: `female` · `male` · `other` · `null`, trimmed and lowercased; an empty string counts as `null`, anything else is 422 field `sex`.

Creates the account, its own profile (`is_synthetic: true`) with the owner grant and a Medical ID with `relationship: "self"` and the given `sex`, then signs in. **201** with exactly the API-02 body (`token`, `token_type`, `expires_at`, `user`). New accounts have no consents, so API-04 returns `onboarding_required: true` and the existing onboarding flow applies.

Errors: 409 `EMAIL_TAKEN` ("An account already uses this email. Sign in instead.") · 422 · 429 `RATE_LIMITED` (more than 10 registration attempts that pass validation from one IP in 15 minutes; `details.retry_after_s` and `Retry-After`). Audit `auth.registered`.

### API-41 `POST /patients`

Bearer. A family member's profile, owned and managed by the current user. Request `{ "display_name": "Lakshmi Raman", "age_years": 82, "relationship": "parent", "sex": "female" }`: display name 1–80 (trimmed), `age_years` 0–130 or `null`, `relationship` from the enum, optional `sex` (since 1.4.0, same rule as API-40). `relationship` and `sex` are stored in the Medical ID (API-42); the response shape is unchanged.

**201** `{ "patient": { …PatientSummary, "created_at": "2026-10-24T05:20:00Z" } }`, the same object as API-07. The profile then appears in API-06 with `my_role: "owner"`. Errors: 409 `PROFILE_LIMIT` (10 owned profiles per user, the user's own included) · 422. Audit `patient.created`.

### API-42 `GET /patients/{patient_id}/details`

`view_records`. **200** `{ "details": Details }`. A profile with no saved Medical ID returns the same keys with `null` values, `emergency_contacts: []` and `updated_at: null`, never 404. `relationship` is only exposed here (API-06/07 are unchanged).

### API-43 `PUT /patients/{patient_id}/details`

Owner only (403 `OWNER_ONLY`). Self-reported; nothing is checked against documents or interpreted. Every `Details` field except `patient_id` and `updated_at` is optional and nullable, and **a PUT replaces the whole Medical ID**: a missing field is saved as `null` (contacts as `[]`). Empty strings count as `null`.

| Field | Rule |
|---|---|
| relationship | `Relationship` enum |
| date_of_birth | `YYYY-MM-DD`, not in the future (IST) |
| sex | `female` · `male` · `other` |
| blood_group | `A+` `A-` `B+` `B-` `AB+` `AB-` `O+` `O-` |
| height_cm | 30–250 |
| emergency_contacts | at most 5 of `{ name 1–80, phone 3–20 chars of digits, spaces and + - ( ), relation 0–40 }` |
| allergies_note, conditions_note, medications_note | at most 500 characters each |
| organ_donor | boolean or `null` |

Example request:
```json
{
  "relationship": "self",
  "date_of_birth": "1968-04-12",
  "sex": "female",
  "blood_group": "B+",
  "height_cm": 158.5,
  "emergency_contacts": [{ "name": "Karthik Raman", "phone": "+91 98765 43210", "relation": "Son" }],
  "allergies_note": "Sulfa drugs (rash)",
  "conditions_note": null,
  "medications_note": null,
  "organ_donor": true
}
```

**200** `{ "details": Details }` (as saved, `updated_at` set). Errors: 403 `OWNER_ONLY` · 422. Audit `profile.details_updated`.

### API-44 `GET /patients/{patient_id}/vitals`

`view_records`. Query: `kind` (optional, one of the kinds below), `limit` 1–500 (default 200). **200** `{ "items": [Vital], "total": 12 }`, newest `measured_at` first; `total` counts every matching reading, not just the returned page.

### API-45 `POST /patients/{patient_id}/vitals`

`upload_documents` (a caregiver without it gets 403 `SCOPE_REQUIRED`). Ranges are **plausibility checks against typing mistakes only**: MediVara never labels a reading as normal or abnormal.

| kind | unit | value | value2 | context |
|---|---|---|---|---|
| `blood_pressure` | `mmHg` | systolic 50–260 | **required**, diastolic 30–160 | `null` |
| `blood_sugar` | `mg/dL` | 20–600 | `null` | `fasting` · `post_meal` · `random` · `null` |
| `weight` | `kg` | 1–300 | `null` | `null` |
| `heart_rate` | `bpm` | 20–250 | `null` | `null` |
| `spo2` | `%` | 50–100 | `null` | `null` |
| `temperature` | `°C` or `°F` | 30–45 °C, 86–113 °F | `null` | `null` |

`measured_at` is ISO 8601 with an offset or `Z`, at most 5 minutes in the future; it is returned in UTC. `notes` at most 200 characters.

Example request and **201** response:
```json
{ "kind": "blood_pressure", "value": 128, "value2": 82, "unit": "mmHg", "measured_at": "2026-10-24T08:30:00+05:30", "context": null, "notes": "After a walk" }
```
```json
{
  "vital": {
    "id": "vit_0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    "kind": "blood_pressure",
    "value": 128,
    "value2": 82,
    "unit": "mmHg",
    "context": null,
    "notes": "After a walk",
    "measured_at": "2026-10-24T03:00:00Z",
    "created_by": { "user_id": "usr_meera", "display_name": "Meera Raman" },
    "created_at": "2026-10-24T05:25:00Z"
  }
}
```

Errors: 403 `SCOPE_REQUIRED` · 422 (fields `kind`, `unit`, `value`, `value2`, `context`, `notes`, `measured_at`). Audit `vital.recorded` (meta `{ kind }` only).

### API-46 `DELETE /patients/{patient_id}/vitals/{vital_id}`

`upload_documents`. **204**. 404 `NOT_FOUND` when the reading isn't this profile's. Audit `vital.deleted`.

### API-47 to API-53 Chats

Saved Ask conversations. A chat is **private to the user who created it**: a caregiver never sees the owner's chats and the owner never sees a caregiver's. Every chat route needs `view_records`, and a chat is found only by (chat ID, profile in the path, current user); anything else is 404 `NOT_FOUND`.

- **API-47** `GET /patients/{patient_id}/chats?limit=50&offset=0` → **200** `{ "items": [Chat], "total", "limit", "offset" }`, most recently active (`updated_at`) first. `limit` max 100.
- **API-48** `POST /patients/{patient_id}/chats` with `{ "title": "BP questions" }`, `{}` or no body → **201** `{ "chat": Chat }`. The title is trimmed, 1–80 characters, default `"New chat"`.
- **API-49** `GET /patients/{patient_id}/chats/{chat_id}` → **200** `{ "chat": Chat, "messages": [ChatMessage] }`, oldest message first.
- **API-50** `PATCH /patients/{patient_id}/chats/{chat_id}` with `{ "title": "Sugar log" }` (trimmed, 1–80) → **200** `{ "chat": Chat }`.
- **API-51** `DELETE /patients/{patient_id}/chats/{chat_id}` → **204**; its messages are deleted too. Audit `chat.deleted`.
- **API-52** `POST /patients/{patient_id}/chats/{chat_id}/messages` with `{ "question": "What was my most recent HbA1c?", "input_mode": "text" }` (question trimmed 1–500; `input_mode` `text` · `voice`, default `text`). Runs **exactly the API-21 pipeline** (emergency and advice gate, grounded context, validator), stores a `user`/`question` and an `assistant`/`answer` message, and moves the chat to the top. While the title is still `"New chat"` it becomes the question (first 60 characters, cut at a word boundary, plus "…" when cut). As in API-21, AI problems never become HTTP errors: the answer's `status` carries them. **201** `{ "user_message": ChatMessage, "assistant_message": ChatMessage, "chat": Chat }`. Audit `ask.answered` with meta `{ status, input_mode, chat_id }`.
- **API-53** `POST /patients/{patient_id}/chats/{chat_id}/attachments` with `{ "document_id": "doc_…" }` → **201** `{ "message": ChatMessage, "chat": Chat }`. The document must belong to this profile (404 `NOT_FOUND` otherwise). While the title is still `"New chat"` it becomes `"Document: "` plus the document title (60 characters, "…" when cut). Attaching is a marker in the conversation; Ask always searches all of the profile's documents.

API-52 **201** example (answer object shortened; it is the full API-21 response):
```json
{
  "user_message": {
    "id": "msg_1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "chat_id": "cht_9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
    "role": "user",
    "kind": "question",
    "text": "What was my most recent HbA1c?",
    "input_mode": "text",
    "answer": null,
    "document": null,
    "created_at": "2026-10-24T05:30:00Z"
  },
  "assistant_message": {
    "id": "msg_2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
    "chat_id": "cht_9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
    "role": "assistant",
    "kind": "answer",
    "text": null,
    "input_mode": null,
    "answer": { "answer_id": "aio_…", "status": "answered", "statements": [], "evidence": [], "questions_for_doctor": [], "notices": [], "disclaimer": "…", "generated_at": "2026-10-24T05:30:02Z", "latency_ms": 1840 },
    "document": null,
    "created_at": "2026-10-24T05:30:02Z"
  },
  "chat": {
    "id": "cht_9f8e7d6c-5b4a-4c3d-2e1f-0a9b8c7d6e5f",
    "title": "What was my most recent HbA1c?",
    "created_at": "2026-10-24T05:29:40Z",
    "updated_at": "2026-10-24T05:30:02Z",
    "message_count": 2,
    "last_message_preview": "What was my most recent HbA1c?"
  }
}
```

### API-54 `POST /patients/{patient_id}/invitations`

Owner only. Invites a caregiver by email, whether or not an account exists for it; the answer never reveals which. Same rules as API-24 (`scopes` must include `view_records`, `consent_confirmed: true`, current `policy_version`), plus a valid email that isn't the owner's own (422 field `email`) and a `Relationship`. Records a `sharing` consent whose context holds the invitation ID. The invitation expires after 14 days. The ID (`inv_` + UUID v4) is the secret in the link; accepting also requires signing in with the invited email.

```json
{ "email": "ravi.demo@medivara.test", "scopes": ["view_records"], "relationship": "sibling", "consent_confirmed": true, "policy_version": "2026-10-demo-1" }
```

**201**:
```json
{
  "invitation": {
    "id": "inv_3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
    "email": "ravi.demo@medivara.test",
    "relationship": "sibling",
    "scopes": ["view_records"],
    "status": "pending",
    "created_at": "2026-10-24T05:35:00Z",
    "expires_at": "2026-11-07T05:35:00Z",
    "responded_at": null,
    "invite_url": "/invite/inv_3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f"
  },
  "invite_url": "/invite/inv_3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
  "email_sent": false
}
```

`invite_url` is a frontend path. `email_sent` is `true` when the server queued an email (SMTP configured); otherwise the owner shares the link. Errors: 403 `OWNER_ONLY` · 409 `INVITATION_EXISTS` · 409 `GRANT_EXISTS` (that email's account already has active access) · 422. Audit `invitation.created` (meta: invitation ID and scopes, never the email).

### API-55 `GET /patients/{patient_id}/invitations`

Owner only. **200** `{ "invitations": [OwnerInvitation] }`, newest first, every status. A pending invitation past `expires_at` is reported as `expired` (computed, not stored).

### API-56 `DELETE /patients/{patient_id}/invitations/{invitation_id}`

Owner only. Cancels a pending invitation. **204**. 404 `NOT_FOUND` if it isn't this profile's · 409 `INVALID_STATE` if it isn't pending (accepted, declined, cancelled or expired). Audit `invitation.cancelled`.

### API-57 `GET /me/invitations`

Bearer. Pending, unexpired invitations addressed to the current user's email, newest first. **200**:
```json
{
  "invitations": [
    {
      "id": "inv_3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f",
      "patient": { "id": "pat_meera", "display_name": "Meera Raman" },
      "invited_by": { "display_name": "Meera Raman" },
      "relationship": "sibling",
      "scopes": ["view_records"],
      "created_at": "2026-10-24T05:35:00Z",
      "expires_at": "2026-11-07T05:35:00Z"
    }
  ]
}
```

### API-58 `POST /me/invitations/{invitation_id}/accept`

Bearer. The invitation must be pending, unexpired and addressed to the current user's email; otherwise 404 `NOT_FOUND` (the same answer in every case). 422 if the current user owns the profile. Creates the caregiver grant (the invitation's scopes, granted by the inviter, linked to the invitation's consent record) unless an active grant already exists, and marks the invitation accepted. **200** `{ "patient_id": "pat_meera" }`; the profile then appears in API-06. Audit `invitation.accepted` and `access.granted` (actor: the invitee).

### API-59 `POST /me/invitations/{invitation_id}/decline`

Bearer. Same lookup rules as API-58. **204**. Audit `invitation.declined`.

### API-60 `GET /voice/config`

Bearer. **200** `{ "available": true, "mode": "signed_url" }`. `mode` is `signed_url` (server has an ElevenLabs API key and agent ID), `public_agent` (agent ID only) or `off`; `available` is `false` only when `off`. Use it to show or hide voice conversation.

### API-61 `POST /patients/{patient_id}/voice/session`

`view_records`, and the **current user's** own current `voice_input` consent (API-05), else 403 `CONSENT_REQUIRED` with `details.consent_type: "voice_input"`. No body. **200**:
```json
{
  "signed_url": "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=…&conversation_signature=…",
  "agent_id": null,
  "dynamic_variables": {
    "user_first_name": "Karthik",
    "patient_first_name": "Meera",
    "patient_name": "Meera Raman",
    "patient_age": "58",
    "access_role": "caregiver",
    "today": "11 Oct 2026",
    "document_count": "2",
    "documents_summary": "Lab report from Sunrise Diagnostics, 04 May 2026 (not reviewed yet); Prescription from Lakeview Family Clinic, 15 Sep 2026 (reviewed)",
    "latest_document": "Lab report from Sunrise Diagnostics, 04 May 2026 (not reviewed yet), added 10 Oct 2026",
    "patient_sex": "female",
    "womens_health_mode": "pregnancy",
    "womens_health_context": "Pregnancy tracker: week 14 and 4 days (second trimester). Due date 07 Apr 2027, 178 days to go. Calculated from dates the user entered."
  },
  "overrides": { "tts": { "voiceId": "21m00Tcm4TlvDq8ikWAM" } }
}
```

Every `dynamic_variables` value is a string, and every key is always present. `patient_age` is `"not recorded"` when unknown; `access_role` is `"owner"` or `"caregiver"`; `today` is the IST date (`DD Mon YYYY`). `document_count` and `documents_summary` cover documents that weren't `failed`: up to 15, newest document date first (undated last), each `"{Type}[ from {facility}], {date or "date unknown"} ({reviewed | not reviewed yet | still being read})"`, then `"; and N more"`. `latest_document` is the most recently uploaded document, failed ones included (`"could not be read"`), plus `", added {IST date}"`. With no documents both are `"No documents yet."`. The variables carry document **metadata only**, never contents: facts reach the agent only through the `ask_medical_records` tool.

Since 1.4.0: `patient_sex` is the profile's Medical ID `sex` (`female` · `male` · `other`) or `"not recorded"`; `womens_health_mode` is the API-62 `mode` (`"off"` by default); `womens_health_context` is API-62 `summary.voice_context` (`"Not in use."` when off), which never contains the fertile window, symptoms or notes. `overrides` is always present: `{ "tts": { "voiceId": "<id>" } }` when the server sets `ELEVENLABS_FEMALE_VOICE_ID` **and** the profile's `sex` is `"female"`, otherwise `null`. When it isn't `null`, pass it as the session's `overrides` (the agent must allow the Voice override in its ElevenLabs Security settings, otherwise ElevenLabs refuses the session).

`signed_url` is set only in `signed_url` mode (short-lived; fetch a new one per conversation) and `agent_id` only in `public_agent` mode. Start the ElevenLabs conversation with whichever is set plus `dynamic_variables` (and `overrides` when not `null`), and implement the agent's client tool `ask_medical_records({ question })` with API-52 (`input_mode: "voice"`) or API-21, returning the answer text, so spoken answers go through the same gate and validator. The API key is never returned. Errors: 403 `CONSENT_REQUIRED` · 503 `VOICE_UNAVAILABLE` ("Voice conversation isn't set up on this server.") · 502 `VOICE_UNAVAILABLE` ("The voice service didn't respond. Try again, or type your question."). Audit `voice.session_started`.

### API-62 to API-67 Women's health

Added in 1.4.0. A period tracker, a pregnancy tracker and an after-birth tracker, from dates the user enters. Every number is **date arithmetic, an estimate, never medical advice**; nothing is labelled normal or abnormal. "Today" is the IST date. Audit metadata holds the mode or the period ID only, never dates, symptoms or notes.

### API-62 `GET /patients/{patient_id}/womens-health`

`view_records`. **200** `{ "womens_health": WomensHealth }`. A profile with no saved settings returns `mode: "off"` with `null` settings and `updated_at: null`, never 404. Example for today = 11 Oct 2026:
```json
{
  "womens_health": {
    "patient_id": "pat_meera",
    "mode": "cycle",
    "cycle_length_days": 28,
    "period_length_days": 5,
    "lmp_date": null,
    "due_date": null,
    "delivery_date": null,
    "updated_at": "2026-10-11T04:30:00Z",
    "summary": {
      "cycle": {
        "last_period_start": "2026-10-01",
        "cycle_day": 11,
        "average_cycle_days": 29,
        "average_period_days": 5,
        "next_period_estimate": "2026-10-30",
        "next_period_end_estimate": "2026-11-03",
        "days_until_next_period": 19,
        "fertile_window_start": "2026-10-11",
        "fertile_window_end": "2026-10-17",
        "logged_periods": 3
      },
      "pregnancy": null,
      "postpartum": null,
      "voice_context": "Period tracker: cycle day 11. Last period started 01 Oct 2026. Next period estimated around 30 Oct 2026 (in 19 days). Average cycle 29 days. These are estimates from dates the user entered, not medical advice."
    }
  }
}
```

In `pregnancy` mode `summary.pregnancy` is, for example, `{ "due_date": "2027-04-07", "lmp_date": "2026-07-01", "weeks": 14, "days": 4, "trimester": 2, "days_to_go": 178 }`; in `postpartum` mode `summary.postpartum` is, for example, `{ "delivery_date": "2026-08-26", "days_since_delivery": 46, "weeks_since_delivery": 6 }`. Otherwise both are `null`.

Calculation rules (dates are `YYYY-MM-DD`; numbers are integers):

- **cycle**, always computed from the period log whatever the mode. Logs sorted by `start_date`; `last_period_start` is the latest start; `logged_periods` is the number of logs. Gaps are the days between consecutive starts; gaps outside 15–60 are ignored and the **last 6** kept gaps are averaged: `average_cycle_days` = round(mean) (half to even), else the `cycle_length_days` setting, else `null`. `average_period_days` = round(mean of end − start + 1) over the last 6 logs that have an `end_date`, else the `period_length_days` setting, else `null`. `cycle_day` = today − last start + 1. With a last start and an average cycle: `next_period_estimate` = last start + average cycle; `days_until_next_period` = next − today (negative means late); ovulation = next − 14 days; `fertile_window_start` = ovulation − 5 days; `fertile_window_end` = ovulation + 1 day; `next_period_end_estimate` = next + (average period − 1), or `null` without an average period. Otherwise those are `null`. **With no logs every field is `null` except `logged_periods: 0`, even when settings exist.**
- **pregnancy**, only in `pregnancy` mode. `due_date` = the setting, else `lmp_date` + 280 days; `lmp_date` = the setting, else due − 280 days. Gestation = max(0, today − LMP) days: `weeks` = gestation ÷ 7 (whole), `days` = the remainder; `trimester` 1 below week 13, 2 below week 27, else 3; `days_to_go` = due − today (negative once passed).
- **postpartum**, only in `postpartum` mode. `days_since_delivery` = max(0, today − delivery); `weeks_since_delivery` = that ÷ 7 (whole).
- **voice_context**, one plain-English line for the voice agent (API-61 `womens_health_context`). Dates as `DD Mon YYYY`, singular and plural forms correct ("1 day", "1 week"). Never the fertile window, symptoms or notes.

| Situation | `voice_context` |
|---|---|
| `off` | `Not in use.` |
| `cycle`, no logs | `Period tracker is on, but no periods have been logged yet.` |
| `cycle`, no average | `Period tracker: cycle day 3. Last period started 09 Oct 2026. There isn't enough information yet to estimate the next period.` |
| `cycle`, with an estimate | `Period tracker: cycle day 11. Last period started 01 Oct 2026. Next period estimated around 30 Oct 2026 (in 19 days). Average cycle 29 days. These are estimates from dates the user entered, not medical advice.` The bracket is `in N days`, `today` or `N days late`. |
| `pregnancy` | `Pregnancy tracker: week 14 and 4 days (second trimester). Due date 07 Apr 2027, 178 days to go. Calculated from dates the user entered.` Once the due date has passed: `… (third trimester). Due date 08 Oct 2026 has passed. Calculated from dates the user entered.` |
| `postpartum` | `After-birth tracker: 6 weeks since delivery on 26 Aug 2026.` |

### API-63 `PUT /patients/{patient_id}/womens-health`

`upload_documents` (a caregiver without it gets 403 `SCOPE_REQUIRED`). Every key is optional and **a PUT replaces every field**: a missing key is saved as `null`, a missing `mode` as `"off"`.

| Field | Rule |
|---|---|
| mode | `off` · `cycle` · `pregnancy` · `postpartum` |
| cycle_length_days | 21–45 |
| period_length_days | 2–10 |
| lmp_date | from today − 300 days to today |
| due_date | from today − 30 days to today + 300 days |
| delivery_date | from today − 730 days to today |
| `pregnancy` mode | needs `lmp_date` or `due_date` (422 field `lmp_date`, issue "pregnancy mode needs lmp_date or due_date") |
| `postpartum` mode | needs `delivery_date` (422 field `delivery_date`) |

```json
{ "mode": "pregnancy", "cycle_length_days": null, "period_length_days": null, "lmp_date": "2026-07-01", "due_date": null, "delivery_date": null }
```

**200** `{ "womens_health": WomensHealth }` as saved, with its summary. Errors: 403 `SCOPE_REQUIRED` · 422 (every failing field at once). Audit `womens_health.updated` (meta `{ mode }` only).

### API-64 `GET /patients/{patient_id}/periods`

`view_records`. Query `limit` 1–200 (default 24). **200** `{ "items": [Period], "total": 3 }`, newest `start_date` first; `total` counts every log.

### API-65 `POST /patients/{patient_id}/periods`

`upload_documents`. Request `{ start_date (required), end_date?, flow?, symptoms?, notes? }`:

| Field | Rule |
|---|---|
| start_date | not after today |
| end_date | `null`, or from `start_date` to `start_date` + 14 days, and not after today |
| flow | `light` · `medium` · `heavy` · `null` |
| symptoms | array of `cramps` `headache` `bloating` `mood_changes` `fatigue` `acne` `back_pain` `tender_breasts` `nausea`; stored deduplicated in that order |
| notes | at most 200 characters (trimmed; empty is `null`) |

A period may not overlap another log of the same profile; a log without an `end_date` counts as `start_date` + 6 days for this check. Otherwise 409 `PERIOD_OVERLAP` ("This overlaps a period you've already logged.").

```json
{ "start_date": "2026-10-01", "end_date": "2026-10-05", "flow": "medium", "symptoms": ["cramps", "fatigue"], "notes": "Better by day 3" }
```

**201**:
```json
{
  "period": {
    "id": "per_5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
    "start_date": "2026-10-01",
    "end_date": "2026-10-05",
    "length_days": 5,
    "flow": "medium",
    "symptoms": ["cramps", "fatigue"],
    "notes": "Better by day 3",
    "created_by": { "user_id": "usr_meera", "display_name": "Meera Raman" },
    "created_at": "2026-10-11T04:35:00Z",
    "updated_at": "2026-10-11T04:35:00Z"
  }
}
```

Errors: 403 `SCOPE_REQUIRED` · 409 `PERIOD_OVERLAP` · 422 (fields `start_date`, `end_date`, `flow`, `symptoms`, `notes`). Audit `period.logged` (meta: the period ID only).

### API-66 `PATCH /patients/{patient_id}/periods/{period_id}`

`upload_documents`. Any of `start_date`, `end_date`, `flow`, `symptoms`, `notes`; only the keys sent change. An explicit `null` clears `end_date`, `flow` or `notes`; `symptoms: null` stores `[]`; `start_date: null` is 422. The resulting record is checked with the API-65 rules, and for overlaps against the profile's other logs. **200** `{ "period": Period }`. Errors: 403 `SCOPE_REQUIRED` · 404 `NOT_FOUND` (not this profile's period) · 409 `PERIOD_OVERLAP` · 422. Audit `period.updated`.

### API-67 `DELETE /patients/{patient_id}/periods/{period_id}`

`upload_documents`. **204**. 404 `NOT_FOUND` when the period isn't this profile's. Audit `period.deleted`.


---

## 6. Contract changelog

| Version | Date | Change | Type | Approved by |
|---|---|---|---|---|
| 1.0.0 | Pre-event | Initial contract: API-01…33 | n/a | B (owner), A (ack), C (review) |
| 1.1.0 | 2026-10-10 | API-11 adds `document.pages` (`[{ page, lines: [{ line_id, text }] }]`) so SCR-06 can show the document text and highlight source lines. Clients ignore unknown fields. | Additive | B (owner); A to acknowledge |
| 1.2.0 | 2026-10-10 | §5b redesign extensions, API-40 to API-61: registration, family profiles, Medical ID, vitals, saved chats, email invitations and voice sessions. New codes `EMAIL_TAKEN`, `PROFILE_LIMIT`, `INVITATION_EXISTS`, `VOICE_UNAVAILABLE`. API-04 `owned_patient_id` is now the first-created owned profile. No existing response shape changes. | Additive | B (owner); A to acknowledge |
| 1.3.0 | 2026-10-11 | API-61 `dynamic_variables` gains `patient_name`, `patient_age`, `access_role`, `today`, `document_count`, `documents_summary` and `latest_document` (document metadata only). | Additive | B (owner); A to acknowledge |
| 1.4.0 | 2026-10-11 | Women's health, API-62 to API-67: tracker settings with a calculated summary, and a period log. API-40 and API-41 accept an optional `sex` (stored in the Medical ID). API-61 `dynamic_variables` gains `patient_sex`, `womens_health_mode` and `womens_health_context`, and the response gains `overrides` (a TTS voice for female profiles when `ELEVENLABS_FEMALE_VOICE_ID` is set, else `null`). New code `PERIOD_OVERLAP`. New tables `womens_health_settings`, `period_log`. | Additive | B (owner); A to acknowledge |

Rules for entries are in [../hackathon/integration-plan.md](../hackathon/integration-plan.md) §5. Additive changes increase the minor version (1.1.0). Breaking changes increase the major version and need Person A's acknowledgement.
