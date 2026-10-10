# Backend Sprint Backlog — Person B only

> Owner: **Person B (Backend and AI Developer)**. Verified by Person C. Person B also owns the API contract and its fixtures.
> Sources of truth: API [../srd/11-api-contract.md](../srd/11-api-contract.md) · data model [../srd/07-data-model.md](../srd/07-data-model.md) · AI design [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) · threats [../srd/12-safety-threat-model.md](../srd/12-safety-threat-model.md) · Definition of Done [../srd/14-definition-of-done.md](../srd/14-definition-of-done.md).
> Estimates assume AI-assisted coding (ASM-06) and include writing, self-testing and Swagger checks. Sprint sheets in this folder list the same tasks in time order.

## 0. Scope boundary

Person B **does not** implement frontend screens, and **does not change the API contract silently** after a freeze (P0 at IC-0, P1 at G1). Any change follows the change policy in [../hackathon/integration-plan.md](../hackathon/integration-plan.md) §5: changelog entry, fixture update in the same commit, and Person A's acknowledgement for breaking changes.

### What is mocked, simplified or deferred

| Area | Decision | What the MVP does instead | Revisit |
|---|---|---|---|
| Vector database and embeddings | **Deferred (P2)** | Full patient context under a token cap (AG-10, tier T0) | FR-045, FR-046 |
| Agent framework | **Not used** | Plain orchestrated functions (AG-01…AG-12) | Never needed for the MVP |
| Task queue | **Simplified** | In-process background tasks; one model call in flight | Production |
| Identity | **Simplified** | Seeded accounts, password check, opaque tokens | Production identity |
| Invitations | **Simplified** (DEC-08) | Owner grants directly to an existing account | FR-085 |
| User preferences | **Moved to the browser** (DEC-09) | No endpoint | P2 |
| Intent classification | **Simplified** | Rules only (AG-09) | FR-047 |
| OCR for images and scans | **P1, first cut** | Scanned PDFs fail clearly (`NO_TEXT_LAYER`) | BE-5.8 |
| Appointment booking | **Simulated, second cut** | Deterministic suggestions; simulated providers | BE-11.x |
| Voice | **No backend** | Browser speech; `input_mode` recorded on Ask | BE-12.2 (P2) |
| Sign language | **No backend** | Static glossary in the frontend; Visit Card built from the brief | BE-13.2 (P2) |
| Notifications | **No backend push** | Client polls reminders while open | FR-075 |
| Sample import | **P1** | Demo snapshot restore plus live upload | BE-4.5 |
| Brand-to-generic medicine mapping | **Deferred** | Synthetic documents use generic names | Future, with a validated drug database |

## 1. Summary by sprint

| Sprint | Window | Tasks | Planned minutes | Available | Exit checkpoint |
|---|---|---|---|---|---|
| Kickoff | Day 1 09:00–09:45 | BE-1.3 | 5 | (kickoff) | IC-0 |
| Sprint 1 | Day 1 09:45–12:00 | BE-1.1, BE-1.2, BE-2.1, BE-2.2, BE-3.1–3.3 | 135 | 135 | IC-1 (BE-3.4 plus support, 30 min) |
| Sprint 2 | Day 1 13:00–16:30 | BE-2.3, BE-4.1–4.3, BE-5.1–5.4, BE-5.5 (first 25 min) | 210 | 210 | IC-2 (support, 20 min) |
| Sprint 3 | Day 1 16:50–18:30 | BE-5.5 (last 5 min), BE-5.6, BE-6.1, BE-6.2, BE-4.4, BE-7.1 | 100 | 100 | IC-3 (support, 15 min) and G1 |
| Sprint 4 | Day 2 09:20–12:00 | BE-2.4, BE-6.3, BE-7.2–7.6, BE-8.1, BE-8.2 | 145 (+15 buffer) | 160 | IC-4 (support, 20 min) |
| Sprint 5 | Day 2 12:45–14:15 | BE-5.7, BE-9.1, BE-9.2, BE-2.5 (reminder part), BE-10.1 | 90 | 90 | IC-5 and feature freeze |
| Sprint 6 | Day 2 14:15–15:45 | IC-5 support, BE-3.5, BE-8.3, BE-15.1, BE-14.1–14.3, BE-15.3 | 90 | 90 | IC-6 code freeze |

| Totals | Minutes | Hours |
|---|---|---|
| P0 (including integration support and stabilisation) | 765 | ≈ 12.75 |
| P1 scheduled (Sprint 5 family and reminders, IC-5 support) | 90 | ≈ 1.5 |
| Buffer (Sprint 4) | 15 | ≈ 0.25 |
| Available | 870 | ≈ 14.5 |
| Unscheduled P1 pool (pull in only if ahead, in this order): BE-4.5, BE-4.6, BE-11.1 + BE-11.2, BE-5.8 | 115 | ≈ 1.9 |

**Critical path:** BE-5.3 (Gemini wrapper) → BE-5.4 (extraction) → BE-5.5 (validation) → BE-6.1 / BE-6.2 (review, timeline) → BE-7.1 / BE-7.2 (rules, brief) → BE-7.3 / 7.4 / 8.2 (context, generator, validator) → BE-7.6 (Ask). Any slip here triggers the cut ladder at the next gate.

---

## Section 1 — Backend setup and configuration

#### BE-1.1 Service scaffold: app, settings, request IDs, error envelope, safe logging — P0 · 25 min · Sprint 1
- **Service:** FastAPI application in `backend/`.
- **Depends on:** IC-0 (contract frozen).
- **Data model:** none.
- **Contract:** API conventions §1–2 (error envelope, `X-Request-ID`).
- **Validation / authorisation:** Global handlers turn validation errors into `VALIDATION_ERROR` with `details.fields`. Unhandled errors return `INTERNAL_ERROR` with the request ID and no stack trace.
- **Failure behaviour:** Every error goes through the envelope; logs record the request ID, route, status, duration and error code only.
- **Acceptance:**
  - Unknown routes return an enveloped 404.
  - A thrown test exception returns an enveloped 500.
  - The log line contains no request body.
  - Settings load from the environment (the configuration table in [../srd/06-architecture.md](../srd/06-architecture.md) §7); an example environment file is committed without values; the real file is excluded from version control.
- **Test:** pytest for 404, 422 and 500 envelopes; manual log inspection.
- **Frontend handoff:** Enables FE-1.3 error parsing from IC-1.

#### BE-1.2 Health endpoint and AI mode switch (API-01) — P0 · 10 min · Sprint 1
- **Service:** API-01.
- **Depends on:** BE-1.1.
- **Data model:** none.
- **Contract:** `API-01.200`, `API-01.200.ai-off`.
- **Validation / authorisation:** Public; never returns secrets.
- **Failure behaviour:** `ai.available` reflects configuration plus the outcome of the last model call (set by the wrapper, BE-5.3).
- **Acceptance:** `AI_MODE` set to `live`, `cache_only` or `off` is reflected in the response; `demo_mode` follows `DEMO_MODE`.
- **Test:** Swagger; pytest for each mode.
- **Frontend handoff:** FE-10.3, real from IC-1.

#### BE-1.3 Contract fixtures review — P0 · 5 min · kickoff
- **Service:** `contracts/` folder.
- **Depends on:** Person C copying every fixture block from the contract into files named after its label.
- **Data model:** n/a.
- **Contract:** All fixtures in [../srd/11-api-contract.md](../srd/11-api-contract.md).
- **Validation / authorisation:** Person B checks that each file parses and matches the contract.
- **Failure behaviour:** n/a.
- **Acceptance:** 35 fixture files plus the shared errors exist and are committed before Sprint 1.
- **Test:** A file count matches the contract's fixture labels.
- **Frontend handoff:** Unblocks FE-1.4 at 09:45.

## Section 2 — Data models and persistence

#### BE-2.1 Core models and SQLite initialisation — P0 · 25 min · Sprint 1
- **Service:** Persistence layer.
- **Depends on:** BE-1.1.
- **Data model:** User, Session, PatientProfile, PatientAccessGrant, ConsentRecord, AuditEvent ([../srd/07-data-model.md](../srd/07-data-model.md) §3.1–3.5, §3.14).
- **Contract:** Supports API-02 to API-07.
- **Validation / authorisation:** Unique email; at most one active grant per patient and grantee.
- **Failure behaviour:** Database errors become `INTERNAL_ERROR`.
- **Acceptance:** Tables are created on start; SQLite runs in WAL mode; IDs use the prefixes.
- **Test:** Start from an empty database twice (the second start is idempotent).
- **Frontend handoff:** None directly.

#### BE-2.2 Seed and demo reset command — P0 · 10 min · Sprint 1
- **Service:** Command-line reset and seed, plus the documented snapshot restore.
- **Depends on:** BE-2.1.
- **Data model:**
  - Seeded users `usr_meera`, `usr_karthik`, `usr_ravi`, and `usr_fresh` (a test account with no consents, for onboarding tests).
  - Their profiles and owner grants, plus `grt_karthik_meera` (caregiver; `view_records`, `manage_reminders`), per the demo data pack §2.
  - Consents for the three demo users.
- **Contract:** Seeded IDs must equal the fixture IDs.
- **Validation / authorisation:** Passwords are hashed with a standard slow algorithm.
- **Failure behaviour:** Reset refuses to run unless `DEMO_MODE=true`.
- **Acceptance:** FR-006; sign-in works for all demo users straight after reset.
- **Test:** Reset, then sign in through Swagger.
- **Frontend handoff:** Required for IC-1.

#### BE-2.3 Document models — P0 · 15 min · Sprint 2
- **Service:** Persistence layer.
- **Depends on:** BE-2.1.
- **Data model:** MedicalDocument, DocumentPage (lines as a list with `line_id`, `text`, `bbox`), ExtractedFact (§3.6–3.8).
- **Contract:** Supports API-08 to API-17.
- **Validation / authorisation:** Enumerations exactly as in the data model; facts denormalise `patient_id`.
- **Failure behaviour:** n/a.
- **Acceptance:** A fact can be stored with history and corrections; a document stores status, stage and flags.
- **Test:** pytest model round-trip.
- **Frontend handoff:** None directly.

#### BE-2.4 Brief and AI output models — P0 · 5 min · Sprint 4
- **Service:** Persistence layer.
- **Depends on:** BE-2.3.
- **Data model:** ConsultationBrief, AIOutput (§3.10–3.11).
- **Contract:** Supports API-18 to API-21.
- **Validation / authorisation:** n/a.
- **Failure behaviour:** Storage failure is logged; the response is still returned (FR-041 trade-off).
- **Acceptance:** Rows are stored with evidence snapshot and validation report.
- **Test:** Inspect after an Ask call.
- **Frontend handoff:** None directly.

#### BE-2.5 Reminder, simulated provider and mock appointment models — P1 · 5 min (reminder) + 5 min (providers, only with BE-11.x) · Sprint 5
- **Service:** Persistence layer.
- **Depends on:** BE-2.1.
- **Data model:** Reminder (§3.12); SimulatedProvider, SimulatedSlot, MockAppointment (§3.13) only if booking is built; seed from the demo data pack §8.
- **Contract:** Supports API-27 to API-33.
- **Validation / authorisation:** `is_simulated` is always true.
- **Failure behaviour:** n/a.
- **Acceptance:** Tables exist; providers are seeded with slots relative to the demo date.
- **Test:** Swagger listing.
- **Frontend handoff:** None directly.

## Section 3 — Authentication, demo access and record isolation

#### BE-3.1 Login, logout, me (API-02, API-03, API-04) — P0 · 30 min · Sprint 1
- **Service:** Auth endpoints.
- **Depends on:** BE-2.1, BE-2.2.
- **Data model:** User, Session, ConsentRecord.
- **Contract:** `API-02.200`, `API-02.401`; API-03 returns 204; `API-04.200`.
- **Validation / authorisation:**
  - Email is normalised.
  - Same 401 message for an unknown email and a wrong password.
  - The token is a 32-byte random value; only its SHA-256 is stored; expiry is `SESSION_HOURS`.
  - Logout sets `revoked_at`; any later use returns `SESSION_EXPIRED`.
- **Failure behaviour:** Audit events `auth.login`, `auth.login_failed`, `auth.logout`.
- **Acceptance:** FR-001, FR-002.
- **Test:** TC-AUTH-01, 02, 04, 05.
- **Frontend handoff:** FE-2.2, FE-2.1, FE-11.1 at **IC-1**.

#### BE-3.2 Access guard and audit writer — P0 · 15 min · Sprint 1
- **Service:** A shared dependency used by every patient-scoped route.
- **Depends on:** BE-3.1.
- **Data model:** PatientAccessGrant, AuditEvent.
- **Contract:** Errors `ACCESS_DENIED`, `SCOPE_REQUIRED`, `OWNER_ONLY`, `NOT_FOUND`.
- **Validation / authorisation:** In this order:
  1. Look up the active grant for (patient in the path, current user).
  2. Check the required scope or owner-only rule.
  3. Provide a helper that loads any child resource **filtered by both its ID and the patient ID** (404 on mismatch).

  Grants are never cached in the session.
- **Failure behaviour:** Every denial writes an `access.denied` audit event with request ID and outcome, and no PHI.
- **Acceptance:** FR-005; the data-model access table holds for every route that uses the guard.
- **Test:** TC-ACC-01 to TC-ACC-10 (through Swagger by Person C; pytest in BE-3.5).
- **Frontend handoff:** Behaviour visible through FE-10.2.

#### BE-3.3 Patients list and detail (API-06, API-07) — P0 · 20 min · Sprint 1
- **Service:** API-06, API-07.
- **Depends on:** BE-3.2.
- **Data model:** PatientProfile, grants; counts from documents and reminders (zeros before those tables exist).
- **Contract:** `API-06.200`, `API-07.200`, `API-07.403`.
- **Validation / authorisation:** Lists only active grants; includes `my_role` and `scopes`.
- **Failure behaviour:** 403 for a foreign patient on API-07.
- **Acceptance:** FR-004; the stats keys are always present.
- **Test:** Sign in as Karthik: two profiles; as Ravi: one.
- **Frontend handoff:** FE-2.4, FE-2.5 at IC-1.

#### BE-3.4 Consent endpoint and AI-processing consent check — P0 · 10 min · IC-1 window
- **Service:** API-05; reusable check for API-08.
- **Depends on:** BE-3.1.
- **Data model:** ConsentRecord.
- **Contract:** `API-05.201`; `onboarding_required` in API-04.
- **Validation / authorisation:** `policy_version` must equal `POLICY_VERSION`; the `sharing` type is rejected here (422).
- **Failure behaviour:** The upload check returns `CONSENT_REQUIRED` when the profile owner's latest `ai_processing` consent is missing or withdrawn.
- **Acceptance:** FR-003; the `usr_fresh` account sees `onboarding_required: true`.
- **Test:** Swagger with `usr_fresh`.
- **Frontend handoff:** FE-2.3.

#### BE-3.5 Isolation and IDOR test suite — P0 · 20 min · Sprint 6
- **Service:** pytest suite.
- **Depends on:** All P0 endpoints.
- **Data model:** Seeded users and data.
- **Contract:** Expected 403 and 404 codes.
- **Validation / authorisation:** About six cases:
  1. Ravi reads Meera's profile (403).
  2. Ravi reads Meera's document through Ravi's patient path (404).
  3. Fact PATCH across patients (404).
  4. Karthik uploads to Meera (403 `SCOPE_REQUIRED`).
  5. Karthik grants access on Meera's profile (403 `OWNER_ONLY`).
  6. Ask context for Ravi contains none of Meera's lines.
- **Failure behaviour:** n/a.
- **Acceptance:** All pass; this is part of the demo Definition of Done.
- **Test:** pytest run recorded in the release notes.
- **Frontend handoff:** n/a.

## Section 4 — Document upload and validation

#### BE-4.1 Upload endpoint (API-08) — P0 · 30 min · Sprint 2
- **Service:** API-08 plus AG-01.
- **Depends on:** BE-2.3, BE-3.2, BE-3.4.
- **Data model:** MedicalDocument (status `queued`).
- **Contract:** `API-08.202`, `API-08.409`; errors 413, 415, 422 `TOO_MANY_PAGES`, 403.
- **Validation / authorisation:**
  - Requires `upload_documents` and the owner's `ai_processing` consent.
  - Type is checked from magic bytes (PDF only in P0).
  - Size at most 10 MB; page count at most 10 (opened safely).
  - File name sanitised (no path parts, max 120 chars).
  - SHA-256 duplicate check per patient.
  - Stored under a random name in `STORAGE_DIR`.
- **Failure behaviour:** Any validation failure stores nothing; the processing task is queued only after the row is committed.
- **Acceptance:** FR-010; 202 within 2 s for a 1 MB file; a `document.uploaded` audit event is written.
- **Test:** TC-DOC-01 to TC-DOC-05, TC-SEC-01.
- **Frontend handoff:** FE-3.2 at **IC-2**.

#### BE-4.2 Documents list and detail (API-10, API-11) — P0 · 25 min · Sprint 2
- **Service:** API-10, API-11.
- **Depends on:** BE-4.1.
- **Data model:** MedicalDocument, DocumentPage, ExtractedFact.
- **Contract:** `API-10.200`; `API-11.200.needs-review`, `.processing`, `.ready`, `.failed-no-text-layer`, `.suspicious`, `.cached`.
- **Validation / authorisation:** `view_records`; filters for status and type; sorting per the contract; facts returned with **resolved source line texts**, and with `fields` limited to the keys for their type.
- **Failure behaviour:** 404 when the document doesn't belong to the patient in the path.
- **Acceptance:** FR-013; responses respond in under 500 ms while processing runs (NFR-PERF-05).
- **Test:** Compare with the fixtures (key test, BE-15.1); TC-PERF-04.
- **Frontend handoff:** FE-3.1, FE-3.3, FE-3.5 at IC-2.

#### BE-4.3 File stream (API-12) — P0 · 10 min · Sprint 2
- **Service:** API-12.
- **Depends on:** BE-4.1.
- **Data model:** MedicalDocument (`storage_key`).
- **Contract:** Headers per the contract.
- **Validation / authorisation:** `view_records`; resource binding.
- **Failure behaviour:** 404 if the file is missing.
- **Acceptance:** FR-014; a `document.file_viewed` audit event is written; `nosniff` and `no-store` headers are present.
- **Test:** TC-SEC-02.
- **Frontend handoff:** FE-3.4 at IC-2.

#### BE-4.4 Reprocess and document metadata patch (API-13, API-14) — P0 · 15 min · Sprint 3
- **Service:** API-13, API-14.
- **Depends on:** BE-5.1.
- **Data model:** MedicalDocument.
- **Contract:** API-13 returns 202 (same body as API-08); API-14 returns 200.
- **Validation / authorisation:** `upload_documents`. Reprocess only from `failed`, or from `needs_review` with no reviewed facts (otherwise 409). Patch rules: date not in the future, strings of 1–120 chars; setting the date clears `date_ambiguous`; source becomes `user`.
- **Failure behaviour:** 409 `INVALID_STATE`.
- **Acceptance:** FR-012 (retry), FR-020; audit events.
- **Test:** Retry after `AI_MODE=off` then `live`; set DOC-4's date.
- **Frontend handoff:** FE-3.3, FE-3.6 at IC-3.

#### BE-4.5 Sample import (API-09) — P1 · 20 min · pull-in
- **Service:** API-09.
- **Depends on:** BE-4.1, BE-5.7.
- **Data model:** MedicalDocument with fixed IDs from the sample manifest.
- **Contract:** `API-09.202`.
- **Validation / authorisation:** Demo mode only (404 otherwise); the set must belong to the patient; idempotent by SHA-256.
- **Failure behaviour:** Each document goes through the normal pipeline, with the cache as fallback.
- **Acceptance:** FR-011.
- **Test:** Import twice.
- **Frontend handoff:** FE-3.7.

#### BE-4.6 Delete document (API-22) — P1 · 10 min · pull-in
- **Service:** API-22.
- **Depends on:** BE-4.2.
- **Data model:** Removes the file, pages and facts.
- **Contract:** 204.
- **Validation / authorisation:** Owner only; not while processing (409).
- **Failure behaviour:** File removal failure is logged, the database delete still happens, and a clean-up note is written to the log.
- **Acceptance:** FR-023; the brief becomes stale through the fingerprint.
- **Test:** TC-DOC-08.
- **Frontend handoff:** FE-3.8.

## Section 5 — OCR and structured extraction

#### BE-5.1 Processing orchestrator — P0 · 20 min · Sprint 2
- **Service:** Background task: AG-01 → AG-02 → AG-03 → AG-04 → AG-05.
- **Depends on:** BE-4.1.
- **Data model:** MedicalDocument `status`, `stage`, `failure_code`.
- **Contract:** The stage and status values that API-11 exposes.
- **Validation / authorisation:** Runs with the document's patient scope only.
- **Failure behaviour:**
  - Each failure maps to a `failure_code` with copy-deck text.
  - Model and file calls never block the server's request handling (they run off the event loop).
  - SQLite writes stay short.
- **Acceptance:** FR-012; stages progress as polled; TC-PERF-04 (polling stays responsive).
- **Test:** Upload while repeatedly polling API-10.
- **Frontend handoff:** FE-3.3 at IC-2.

#### BE-5.2 Text and line extraction (AG-02) — P0 · 30 min · Sprint 2
- **Service:** AG-02.
- **Depends on:** BE-5.1.
- **Data model:** DocumentPage lines.
- **Contract:** Line IDs `p{page}-l{n}`; resolved line texts in API-11.
- **Validation / authorisation:** n/a.
- **Failure behaviour:** Fewer than about 20 characters on every page → `NO_TEXT_LAYER`; unreadable or encrypted → `UNREADABLE_PDF`; low density → flag only.
- **Acceptance:** FR-015; DOC-1 and DOC-4 give one line per lab row; reprocessing gives identical line IDs.
- **Test:** TC-EXT-02, TC-DOC-06 (DOC-7).
- **Frontend handoff:** Visible in FE-3.5 source lines.

#### BE-5.3 Gemini client wrapper — P0 · 30 min · Sprint 2
- **Service:** A single module that every model call goes through.
- **Depends on:** BE-1.1; Gemini key and billing verified before the event.
- **Data model:** none. It records model ID, latency, token counts and outcome code for logging only.
- **Contract:** Internal.
- **Validation / authorisation:** Settings per [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §12.1:
  - official SDK, version pinned; `store=false` on every call; no `background` and no `previous_interaction_id`;
  - model, thinking level and timeouts from configuration; one call in flight;
  - JSON-schema responses.
- **Failure behaviour:**
  - One retry with backoff for 429, 5xx, timeout and invalid JSON.
  - Blocked, filtered or empty outputs count as failures **even with HTTP 200**.
  - Typed outcomes: `ok`, `timeout`, `quota`, `server`, `blocked`, `invalid`.
  - Updates `ai.available` for API-01.
  - Respects `AI_MODE` (`off` means no calls).
  - Development-only response cache keyed by a request hash.
- **Acceptance:**
  - A unit test asserts `store=false` on the request.
  - Recorded blocked and empty responses map to failures (TC-REL-04).
  - Prompts and outputs never appear in logs.
- **Test:** Unit tests with recorded responses; one live smoke call at IC-0.
- **Frontend handoff:** n/a (visible as degraded states).

#### BE-5.4 Structured extraction call (AG-04) — P0 · 25 min · Sprint 2
- **Service:** AG-04.
- **Depends on:** BE-5.2, BE-5.3, BE-5.6 (until BE-5.6 exists, AG-04 receives every line).
- **Data model:** Candidate facts (in memory).
- **Contract:** Response schema in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §5.1; prompt rules in §5.2 (`extract-v1`).
- **Validation / authorisation:** Input is one document's non-flagged lines inside the start and end markers.
- **Failure behaviour:** Wrapper outcome other than `ok` → golden cache (BE-5.7, once built) → `failed` with `AI_TIMEOUT`, `AI_UNAVAILABLE`, `AI_BLOCKED` or `AI_INVALID_OUTPUT`.
- **Acceptance:** FR-016; MET-01 of at least 90 % on the answer key by IC-2, or a plan to fix by IC-3.
- **Test:** TC-EXT-01 (Person C runs the comparison).
- **Frontend handoff:** Live facts in FE-3.5 at IC-2.

#### BE-5.5 Validation and confidence (AG-05) — P0 · 30 min (25 in Sprint 2, 5 in Sprint 3)
- **Service:** AG-05.
- **Depends on:** BE-5.4.
- **Data model:** ExtractedFact `confidence`, `uncertainty_reasons`; document `discarded_fact_count`, `date_ambiguous`, title.
- **Contract:** The confidence and reason enumerations in API-11.
- **Validation / authorisation:** The checks, normalisation and confidence rules in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §6 (day-first dates).
- **Failure behaviour:** Facts that can't be traced are discarded and counted; if every fact is discarded, the document is `needs_review` with zero facts.
- **Acceptance:** FR-017; DOC-4's date and Haemoglobin are flagged; no fact without valid lines survives.
- **Test:** TC-EXT-03, 04, 05 (unit test with a crafted candidate).
- **Frontend handoff:** Badges and reasons in FE-3.5.

#### BE-5.6 Injection screening (AG-03) — P0 · 10 min · Sprint 3
- **Service:** AG-03.
- **Depends on:** BE-5.2.
- **Data model:** Document `flags` and `flags_detail` (flagged line IDs and texts).
- **Contract:** `API-11.200.suspicious`.
- **Validation / authorisation:** Pattern families in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §11; flagged lines are excluded from the AG-04 and AG-10 inputs.
- **Failure behaviour:** A false positive only adds the banner.
- **Acceptance:** FR-031; DOC-6 is flagged and p1-l5 never reaches any model input.
- **Test:** TC-INJ-01 (unit test on the context builder and the extraction input).
- **Frontend handoff:** FE-3.6 banner.

#### BE-5.7 Golden cache — P0 · 15 min · Sprint 5
- **Service:** Cache lookup in AG-04, plus an exporter.
- **Depends on:** BE-5.4, BE-5.5; validated extractions of every sample document checked by Person C at G1 (stored in the database or snapshot).
- **Data model:** Files in `GOLDEN_CACHE_DIR` keyed by SHA-256: header, facts, model and prompt version.
- **Contract:** `extraction_source: "cache"`, the `cached_extraction` flag (`API-11.200.cached`).
- **Validation / authorisation:** The exporter writes only documents marked `is_sample` or listed in the manifest.
- **Failure behaviour:** Used **only** after a live failure, or in `cache_only` mode; always labelled.
- **Acceptance:** FR-040; with `AI_MODE=cache_only`, uploading DOC-5 gives the cached facts with the label.
- **Test:** TC-REL-01 drill.
- **Frontend handoff:** COPY-11 chip (FE-3.6, FE-10.3).

#### BE-5.8 Vision OCR for images and scanned PDFs — P1 (cut step 1) · 45 min · pull-in
- **Service:** AG-02, P1 path.
- **Depends on:** BE-5.3.
- **Data model:** DocumentPage `text_source: ai_ocr`; flag `ai_transcribed`.
- **Contract:** API-08 accepts PNG and JPEG; API-11 shows the flag.
- **Validation / authorisation:** High media resolution; one document at a time.
- **Failure behaviour:** Unreadable → `failed`; confidence capped at `medium`.
- **Acceptance:** FR-024.
- **Test:** Upload a synthetic image.
- **Frontend handoff:** FE-3.9.

## Section 6 — Medical timeline APIs

#### BE-6.1 Fact review: patch and bulk confirm (API-15, API-16) — P0 · 20 min · Sprint 3
- **Service:** API-15, API-16.
- **Depends on:** BE-5.5.
- **Data model:** ExtractedFact `status`, `corrected_fields`, `history`; document status recalculated.
- **Contract:** `API-15.200`, `API-16.200`.
- **Validation / authorisation:** `upload_documents`; transitions per [../srd/07-data-model.md](../srd/07-data-model.md) §6; `corrected_fields` keys valid for the fact type; values of 1–200 chars; resource binding.
- **Failure behaviour:** 409 `INVALID_STATE`; 422 for invalid fields.
- **Acceptance:** FR-018, FR-019; audit events; `ready` once nothing is unverified.
- **Test:** TC-EXT-06, TC-EXT-07, TC-ACC-09.
- **Frontend handoff:** FE-3.5, FE-3.6 at **IC-3**.

#### BE-6.2 Timeline builder and endpoint (AG-06, API-17) — P0 · 25 min · Sprint 3
- **Service:** API-17.
- **Depends on:** BE-6.1.
- **Data model:** Derived TimelineEvent.
- **Contract:** `API-17.200`; `change` is `null` until BE-6.3.
- **Validation / authorisation:** `view_records`; query parameters validated; rejected facts excluded; `include_unverified` honoured.
- **Failure behaviour:** Empty result is a valid response.
- **Acceptance:** FR-022; responds in 500 ms or less.
- **Test:** TC-TL-01, TC-TL-02, TC-TL-04.
- **Frontend handoff:** FE-4.1, FE-4.2 at **IC-3**.

#### BE-6.3 Timeline change markers — P0 · 5 min · Sprint 4
- **Service:** AG-07 output reused in API-17.
- **Depends on:** BE-7.1.
- **Data model:** `change` object.
- **Contract:** `value_change` and `dose_change` shapes in `API-17.200`.
- **Validation / authorisation:** n/a.
- **Failure behaviour:** n/a.
- **Acceptance:** Metformin 500 → 1000 mg and HbA1c 8.4 → 7.6 markers appear.
- **Test:** TC-TL-03.
- **Frontend handoff:** FE-4.1 renders them at IC-4.

## Section 7 — RAG retrieval and evidence-grounded summaries

#### BE-7.1 Consistency and gap rules (AG-07) — P0 · 25 min · Sprint 3
- **Service:** AG-07.
- **Depends on:** BE-6.1.
- **Data model:** Reads facts, documents, reminders (if present), appointments (if present).
- **Contract:** Finding shape in API-18 (`points_to_clarify`, `missing_information`).
- **Validation / authorisation:** The rules table in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §9.1; wording from COPY-29 to COPY-29c and COPY-30a to COPY-30d; frequency normalisation table.
- **Failure behaviour:** n/a.
- **Acceptance:** FR-032; the 4 planted findings are detected on the demo data.
- **Test:** TC-BRF-02.
- **Frontend handoff:** Through API-18 at IC-4.

#### BE-7.2 Brief assembler and endpoints (AG-08, API-18, API-19) — P0 · 30 min · Sprint 4
- **Service:** API-18, API-19.
- **Depends on:** BE-7.1, BE-2.4.
- **Data model:** ConsultationBrief (sections, evidence snapshot, fingerprint).
- **Contract:** `API-18.201`, `API-19.200`, 404 when there is no brief.
- **Validation / authorisation:** `view_records`; `visit_reason` max 300 chars; section rules per AI design §9.2 (`medications_from`, `other_medications_mentioned`).
- **Failure behaviour:** n/a. Deterministic; built in 500 ms or less.
- **Acceptance:** FR-033, FR-041 (stale); every item has evidence IDs that resolve.
- **Test:** TC-BRF-01, 03, 06.
- **Frontend handoff:** FE-4.4, FE-8.1 at **IC-4**.

#### BE-7.3 Evidence context assembly (AG-10) — P0 · 15 min · Sprint 4
- **Service:** AG-10.
- **Depends on:** BE-5.6, BE-6.1.
- **Data model:** Reads pages, facts and corrections for **one patient**, filtered inside the query.
- **Contract:** Internal key map (`L…`, `C…`).
- **Validation / authorisation:** Excludes flagged lines; tags fact status; applies the cap from `ASK_CONTEXT_TOKEN_CAP` with the newest-first rule and a notice.
- **Failure behaviour:** No documents → `not_found` without a model call.
- **Acceptance:** FR-036.
- **Test:** TC-ACC-07, TC-ASK-09 (set a low cap).
- **Frontend handoff:** n/a.

#### BE-7.4 Grounded generator (AG-11) — P0 · 20 min · Sprint 4
- **Service:** AG-11, in two modes (answer and narrative).
- **Depends on:** BE-5.3, BE-7.3.
- **Data model:** Raw output (in memory).
- **Contract:** Output schema and prompt rules in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §8.1 to §8.3 (`ask-v1`, `narrative-v1`).
- **Validation / authorisation:** The question sits in its own delimited block.
- **Failure behaviour:** Wrapper outcome other than `ok` → degraded (Ask) or unavailable (narrative).
- **Acceptance:** FR-037 (12 of 15 correct, judged by C).
- **Test:** TC-ASK-01.
- **Frontend handoff:** n/a.

#### BE-7.5 Brief narrative endpoint (API-20) — P0 · 10 min · Sprint 4
- **Service:** API-20.
- **Depends on:** BE-7.2, BE-7.4, BE-8.2.
- **Data model:** AIOutput (`brief_narrative`) linked to the brief.
- **Contract:** `API-20.200.ready`, `API-20.200.unavailable`.
- **Validation / authorisation:** `view_records`; the brief must belong to the patient.
- **Failure behaviour:** 25 s limit → `unavailable`; fewer than half the statements pass → `withheld`.
- **Acceptance:** FR-034.
- **Test:** TC-BRF-04.
- **Frontend handoff:** FE-4.5 at **IC-4**.

#### BE-7.6 Ask endpoint (API-21) — P0 · 20 min · Sprint 4
- **Service:** API-21: gate → context → generator → validator → store.
- **Depends on:** BE-8.1, BE-7.3, BE-7.4, BE-8.2.
- **Data model:** AIOutput (`answer`, `input_mode`, `question_text`).
- **Contract:** Every API-21 fixture variant.
- **Validation / authorisation:** `view_records`; question of 1–500 chars; `input_mode` enumeration.
- **Failure behaviour:** 20 s limit → `degraded` with keyword-matched evidence lines; the question text is never logged.
- **Acceptance:** FR-035 to FR-039, FR-041.
- **Test:** TC-ASK-01 to TC-ASK-08.
- **Frontend handoff:** FE-5.x at **IC-4**.

#### BE-7.7 Ranked retrieval beyond the cap (BM25) — P2 · deferred
FR-045. Not scheduled.

#### BE-7.8 Embeddings and hybrid retrieval — P2 · deferred
FR-046. Not scheduled.

## Section 8 — Safety validation and uncertainty handling

#### BE-8.1 Intent gate (AG-09) — P0 · 10 min · Sprint 4
- **Service:** AG-09.
- **Depends on:** BE-6.1 (the patient's medicine names).
- **Data model:** Reads medication facts.
- **Contract:** `API-21.200.emergency`, `API-21.200.advice-redirect`.
- **Validation / authorisation:** Pattern families in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §10.1; COPY-05 and COPY-06 verbatim; template question.
- **Failure behaviour:** n/a. No model call on gate routes.
- **Acceptance:** FR-035, FR-100, FR-101; responds in under 200 ms.
- **Test:** TC-SAFE-01, 02, 03.
- **Frontend handoff:** FE-5.3.

#### BE-8.2 Citation and safety validator (AG-12) — P0 · 30 min · Sprint 4
- **Service:** AG-12.
- **Depends on:** BE-7.3.
- **Data model:** AIOutput `validation_report`.
- **Contract:** Statement and evidence shapes; notices COPY-08, COPY-08b, COPY-12b.
- **Validation / authorisation:** Checks 1–11 in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §8.4; statements dropped one by one; withheld when fewer than half pass; cited keys mapped to `E1…`.
- **Failure behaviour:** Fails closed.
- **Acceptance:** FR-038; false rejections at most 10 % (MET-05, tuned with Person C before the freeze).
- **Test:** TC-SAFE-05, 06, 07, 08.
- **Frontend handoff:** FE-5.2 notices.

#### BE-8.3 Validator and gate unit tests; evaluation-run support — P0 · 10 min · Sprint 6
- **Service:** pytest; a small helper that runs the evaluation questions and prints statuses for Person C's log.
- **Depends on:** BE-8.1, BE-8.2.
- **Data model:** n/a.
- **Contract:** n/a.
- **Validation / authorisation:** Crafted outputs for each failure reason.
- **Failure behaviour:** n/a.
- **Acceptance:** Every check has at least one failing and one passing case.
- **Test:** pytest.
- **Frontend handoff:** n/a.

## Section 9 — Caregiver permissions

#### BE-9.1 Access list, grant, revoke (API-23, API-24, API-25) — P1 · 30 min · Sprint 5
- **Service:** API-23, API-24, API-25.
- **Depends on:** BE-3.2.
- **Data model:** PatientAccessGrant; ConsentRecord (`sharing`).
- **Contract:** `API-23.200`, `API-24.201`; 204 on revoke.
- **Validation / authorisation:**
  - Owner-only for list and grant.
  - Revoke allowed for the owner, or for the grantee on their own grant.
  - Grant rules: `view_records` required; `consent_confirmed` must be true; no self-grant; `GRANT_EXISTS`; `USER_NOT_FOUND`.
- **Failure behaviour:** The owner grant can't be revoked (409).
- **Acceptance:** FR-080, FR-082; audit events; revoke takes effect on the next request.
- **Test:** TC-FAM-01, 03, 05; TC-ACC-08.
- **Frontend handoff:** FE-6.2 at **IC-5**.

#### BE-9.2 Audit events list (API-26) — P1 · 10 min · Sprint 5
- **Service:** API-26.
- **Depends on:** BE-3.2.
- **Data model:** AuditEvent.
- **Contract:** `API-26.200` with `action_label`.
- **Validation / authorisation:** Owner only; newest first; pagination.
- **Failure behaviour:** n/a.
- **Acceptance:** FR-084; no PHI in any field.
- **Test:** TC-FAM-04, TC-SEC-06.
- **Frontend handoff:** FE-6.3 at IC-5.

## Section 10 — Reminder APIs and scheduling behaviour

#### BE-10.1 Reminders endpoints and timezone logic (API-27 to API-30) — P1 · 30 min · Sprint 5
- **Service:** API-27, API-28, API-29, API-30.
- **Depends on:** BE-2.5, BE-3.2.
- **Data model:** Reminder.
- **Contract:** `API-27.200`; API-28 request and response; 409 for invalid completes.
- **Validation / authorisation:**
  - `view_records` to list; `manage_reminders` to change.
  - Title 1–120; once: a date today or later plus `HH:MM`; daily: 1–4 times plus a start date.
  - Timezone must be `Asia/Kolkata`.
  - `medication_schedule_attested` must be true for the medication type.
  - `source_fact_id` must belong to the patient.
- **Failure behaviour:** `next_due_at` is computed in UTC from local time plus the timezone. Completing a once-only reminder sets `completed`; completing a daily one advances to the next time.
- **Acceptance:** FR-070, FR-071, FR-072, FR-074; 10:00 IST is stored as 04:30Z.
- **Test:** TC-REM-01, 02, 03.
- **Frontend handoff:** FE-9.1, FE-9.2 at **IC-5**.

## Section 11 — Mock appointment suggestions and booking

#### BE-11.1 Appointment suggestions (API-31) — P1 (cut step 2) · 25 min · pull-in
- **Service:** API-31.
- **Depends on:** BE-6.1, BE-2.5 (providers).
- **Data model:** Condition facts; simulated providers and slots.
- **Contract:** `API-31.200`.
- **Validation / authorisation:** `view_records`; reason max 300 chars; the mapping table in [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md) §10.2; emergency patterns from AG-09.
- **Failure behaviour:** No conditions → general medicine only.
- **Acceptance:** FR-090; never uses lab values; the disclaimer is always present.
- **Test:** TC-APT-01, TC-APT-03.
- **Frontend handoff:** FE-9.4.

#### BE-11.2 Simulated booking and list (API-32, API-33) — P1 (cut step 2) · 15 min · pull-in
- **Service:** API-32, API-33.
- **Depends on:** BE-11.1.
- **Data model:** MockAppointment (`status: simulated`).
- **Contract:** `API-32.201`.
- **Validation / authorisation:** `manage_reminders`; the slot must be available and belong to the provider.
- **Failure behaviour:** Slot taken → 409.
- **Acceptance:** FR-091, FR-063; the word "confirmed" never appears in any field.
- **Test:** TC-APT-02.
- **Frontend handoff:** FE-9.4.

## Section 12 — Voice service integration or defined fallback

#### BE-12.1 Voice contract — P0 · 0 min (part of BE-7.6)
- **Service:** API-21 `input_mode`; API-05 `voice_input` consent type.
- **Depends on:** BE-7.6, BE-3.4.
- **Data model:** AIOutput `input_mode`; ConsentRecord.
- **Contract:** As specified. There are **no audio endpoints**: the backend never receives audio.
- **Validation / authorisation:** Enumeration check.
- **Failure behaviour:** n/a.
- **Acceptance:** `input_mode: "voice"` is stored on the AIOutput.
- **Test:** TC-VOICE-03 (backend part).
- **Frontend handoff:** FE-7.3.

#### BE-12.2 Server-side speech-to-text and text-to-speech — P2 · deferred
FR-059: Gemini transcription and speech models, for cross-browser support and Indian-language voices. Not scheduled.

## Section 13 — Sign-language support contract and limited MVP capability

#### BE-13.1 ISL contract — P0 · 0 min (documentation only)
- **Service:** None in the MVP.
- **Contract:**
  - The ISL glossary is static frontend content prepared by Person C.
  - The Visit Card uses API-19 (latest brief) only.
  - `needs_isl_interpreter` exists on API-32 if booking is built.
- **Acceptance:** No sign-language endpoint is created, and no server claims a translation capability.
- **Test:** Contract review.
- **Frontend handoff:** FE-8.1, FE-8.2.

#### BE-13.2 Glossary content service; recognition backend — P2 · deferred
FR-062 extensions and FR-064 research. Not scheduled.

## Section 14 — Error handling, logging and privacy safeguards

#### BE-14.1 Log hygiene and PHI check — P0 · 10 min · Sprint 6
- **Service:** Logging configuration review.
- **Depends on:** All endpoints.
- **Data model:** n/a.
- **Contract:** n/a.
- **Validation / authorisation:** The allow-list fields are the only ones logged; exceptions are logged by type and request ID.
- **Failure behaviour:** n/a.
- **Acceptance:** FR-105; NFR-PRIV-03.
- **Test:** TC-SEC-04, after a full rehearsal.
- **Frontend handoff:** n/a.

#### BE-14.2 AI failure-drill support — P0 · 10 min · Sprint 6
- **Service:** `AI_MODE` handling across extraction, Ask and narrative.
- **Depends on:** BE-5.3, BE-5.7, BE-7.5, BE-7.6.
- **Data model:** n/a.
- **Contract:** `API-01.200.ai-off`, `API-21.200.degraded`, `API-20.200.unavailable`.
- **Validation / authorisation:** n/a.
- **Failure behaviour:** `off`: no model calls anywhere. `cache_only`: extraction from the cache only.
- **Acceptance:** NFR-REL-01; switching modes needs only a restart with the variable changed.
- **Test:** TC-REL-01.
- **Frontend handoff:** FE-10.3 banner.

#### BE-14.3 Security headers and upload hardening check — P0 · 5 min · Sprint 6
- **Service:** Review of API-08 and API-12.
- **Depends on:** BE-4.1, BE-4.3.
- **Data model:** n/a.
- **Contract:** Headers in API-12.
- **Validation / authorisation:** Storage is outside any served path; the file name is sanitised; type comes from content.
- **Failure behaviour:** n/a.
- **Acceptance:** TC-SEC-01, TC-SEC-02, TC-DOC-03 pass.
- **Test:** Manual checks.
- **Frontend handoff:** n/a.

## Section 15 — API tests and integration support

#### BE-15.1 Contract key test — P0 · 10 min · Sprint 6
- **Service:** pytest that calls each P0 endpoint against the seeded data and checks that the response contains at least the keys of the matching fixture, with the same types.
- **Depends on:** All P0 endpoints; `contracts/`.
- **Acceptance:** Passes for API-01 to API-21; run again after any contract change.
- **Test:** pytest.
- **Frontend handoff:** Protects every frontend integration.

#### BE-15.2 Integration support at checkpoints — P0 (IC-1 to IC-4), P1 (IC-5) · 20 + 20 + 15 + 20 + 15 min · checkpoint windows
- **Service:** Person B pairs with Person A during each checkpoint window to switch features from mock to real and fix mismatches immediately.
- **Acceptance:** The checkpoint's acceptance tests pass (integration plan §4).
- **Frontend handoff:** FE-11.1 to FE-11.5.

#### BE-15.3 Bug-fix buffer — P0 · 10 min · Sprint 6
- **Service:** Bugs assigned to Person B by Person C after triage.
- **Acceptance:** Every demo-blocking backend bug is closed before code freeze. Rehearsal 1 (16:00) gives a further window for critical fixes only.
