# 04 — Functional Requirements

> SRD section 5.4. Owner: **Person C** (product). Technical feasibility reviewed by Persons A and B.
> Every P0 and P1 requirement includes: ID and name · description · user story · priority · preconditions · main flow · alternative and failure flows · acceptance criteria · dependencies · scope (hackathon MVP or future). P2 and Future items get one line each, so the roadmap is visible without padding the MVP.
> Abbreviations: SCR = screen ([10-ui-screen-spec.md](10-ui-screen-spec.md)), API = endpoint ([11-api-contract.md](11-api-contract.md)), AG = AI workflow stage ([08-ai-rag-design.md](08-ai-rag-design.md)), FE / BE = backlog tasks ([../fe-sprints/backlog.md](../fe-sprints/backlog.md), [../be-sprints/backlog.md](../be-sprints/backlog.md)), COPY = copy deck entry.

## ID ranges

| Range | Area |
|---|---|
| FR-001–009 | Access, onboarding, demo operations |
| FR-010–029 | Medical repository (feature area A) |
| FR-030–049 | RAG-based AI workflow (B) |
| FR-050–069 | Multimodal: text 050–054, voice 055–059, ISL 060–069 (C) |
| FR-070–079 | Reminders (D) |
| FR-080–089 | Solo and family profiles (E) |
| FR-090–099 | Appointment suggestions and booking (F) |
| FR-100–119 | Privacy, safety and security (G) |
| FR-120–129 | Cross-cutting UX states |

---

## A. Access, onboarding and demo operations

### FR-001 Sign in with demo accounts — P0 · Hackathon MVP
- **Description:** Users sign in with email and password. Seeded synthetic demo accounts are offered as one-click cards that use the same authentication call. The server issues an opaque session token and stores only its hash.
- **User story:** As a judge or team member, I want to sign in as a synthetic demo user so that I can explore MediVara with realistic but fake data.
- **Preconditions:** Seeded accounts exist (FR-006).
- **Main flow:**
  1. Open SCR-02.
  2. Enter credentials or click a demo card.
  3. API-02 verifies the credentials.
  4. The token is kept in memory and in session storage.
  5. API-04 decides: onboarding (SCR-01) or dashboard (SCR-04 / SCR-03).
- **Alternative / failure flows:**
  - Wrong credentials: 401 with one generic message (COPY-34a).
  - Server unreachable: error banner with retry.
- **Acceptance criteria:**
  - Valid credentials return a token. The server stores only its SHA-256 hash.
  - Unknown email and wrong password produce identical responses.
  - Demo cards use API-02; there is no client-side bypass.
  - `auth.login` and `auth.login_failed` audit events are written.
- **Dependencies:** SCR-02 · API-02, API-04 · FR-006 · BE-3.1 · FE-2.2.

### FR-002 Sign out and session lifecycle — P0 · Hackathon MVP
- **Description:** Sign-out revokes the session on the server. Sessions expire after 12 hours. Any 401 returns the user to sign-in.
- **User story:** As a user on a shared laptop, I want to sign out so that nobody else can see my records.
- **Preconditions:** Signed in.
- **Main flow:** Account menu → Sign out → API-03 → token discarded → SCR-02.
- **Alternative / failure flows:**
  - Expired or revoked token: the next call returns 401 `SESSION_EXPIRED`, and the user lands on SCR-02 with COPY-33.
  - Network failure during sign-out: the local token is cleared anyway.
- **Acceptance criteria:**
  - After sign-out, the old token receives 401 on every endpoint.
  - Expiry is enforced by the server.
  - Protected routes redirect to sign-in when no token is present.
- **Dependencies:** SCR-02, SCR-16 · API-03 · BE-3.1 · FE-1.3, FE-2.1.

### FR-003 Onboarding: disclaimer and consent — P0 · Hackathon MVP
- **Description:** On first sign-in, show what MediVara is and is not (COPY-01), the synthetic-data-only warning (COPY-03) and the AI processing consent (COPY-04). Both consents are recorded.
- **User story:** As a new user, I want to understand what MediVara does and how my documents are processed before I use it.
- **Preconditions:** Signed in; `onboarding_required` is true.
- **Main flow:** SCR-01 step 1 → step 2 (tick both) → two API-05 calls → step 3 display preferences → dashboard.
- **Alternative / failure flows:**
  - The user leaves before consenting: onboarding shows again at next sign-in.
  - AI consent later withdrawn (FR-106): uploads return 403 `CONSENT_REQUIRED`, but existing data stays viewable.
- **Acceptance criteria:**
  - ConsentRecords store the current policy version.
  - No patient data is requested before both consents exist.
  - The copy is verbatim from the copy deck.
- **Dependencies:** SCR-01 · API-04, API-05 · FR-102, FR-103 · BE-3.4 · FE-2.3.

### FR-004 Profile list and selection — P0 · Hackathon MVP
- **Description:** Users see every profile they can access, with their role and scopes. Users with one profile go straight to its dashboard.
- **User story:** As a user, I want to open the right person's profile so that I work with the correct records.
- **Preconditions:** Signed in and onboarded.
- **Main flow:** API-06 → exactly one profile: SCR-04; more than one: SCR-03 (P1, FR-083) → choose → SCR-04.
- **Alternative / failure flows:** API error shows a retry banner.
- **Acceptance criteria:**
  - Only profiles with an active grant are listed.
  - Role and scope badges match the API.
  - Patient routes include the patient ID.
- **Dependencies:** SCR-03, SCR-04 · API-06, API-07 · FR-005 · BE-3.3 · FE-2.4.

### FR-005 Per-patient access enforcement — P0 · Hackathon MVP
- **Description:** For every patient-scoped request, the server checks for an active grant with the required scope. It also checks that the requested resource belongs to the patient in the path. Every denial is audited.
- **User story:** As a patient, I want only people I have authorised to see my records so that my health information stays private.
- **Preconditions:** Owner grants are seeded with each profile.
- **Main flow:** Token → user → active grant for (patient, user) → scope check → resource–patient binding check → handler.
- **Alternative / failure flows:**
  - No grant: 403 `ACCESS_DENIED` and an `access.denied` audit event.
  - Missing scope: 403 `SCOPE_REQUIRED`.
  - Resource belongs to another patient: 404 `NOT_FOUND`.
  - Caregiver attempts an owner-only action: 403 `OWNER_ONLY`.
- **Acceptance criteria:**
  - Every patient-scoped endpoint passes the permission matrix (TC-ACC-01…10).
  - AI context is filtered by patient inside the query.
  - Revocation takes effect on the next request.
- **Dependencies:** [07-data-model.md](07-data-model.md) §4 · all patient-scoped APIs · BE-3.2, BE-3.5 · THR-01, THR-02, THR-15.

### FR-006 Demo reset and seed — P0 (operator) · Hackathon MVP
- **Description:** A command resets the database to seeded users, profiles and grants with fixed IDs. A documented procedure restores the demo snapshot (database file plus private file store) captured at G1 and IC-4.
- **User story:** As the demo lead, I want to restore a known-good state in under two minutes so that every rehearsal and the final demo start identically.
- **Preconditions:** A snapshot has been captured.
- **Main flow:** Stop the backend → restore the snapshot (or run reset and seed) → start → check API-01 → sign in as Meera.
- **Alternative / failure flows:**
  - Snapshot missing: reset and seed, then upload the sample documents manually (about 10 minutes).
  - Snapshot corrupted: restore the copy saved with the Git tag.
- **Acceptance criteria:**
  - Restore completes in 2 minutes or less.
  - Seeded IDs match the fixtures (`usr_meera`, `pat_meera`, `grt_karthik_meera`, …).
  - No data survives from earlier runs.
- **Dependencies:** BE-2.2 · [../hackathon/synthetic-demo-data-pack.md](../hackathon/synthetic-demo-data-pack.md) · [../hackathon/readiness-checklist.md](../hackathon/readiness-checklist.md).

---

## B. Medical repository

### FR-010 Upload a PDF document — P0 · Hackathon MVP
- **Description:** Upload a text-layer PDF (up to 10 MB and 10 pages). The server validates the content, rejects duplicates, stores the file privately and queues processing.
- **User story:** As a patient, I want to add my prescription or lab report PDF so that MediVara can organise it.
- **Preconditions:** `upload_documents` scope; the profile owner has granted `ai_processing` consent.
- **Main flow:** Choose or drop a file → client checks → API-08 → 202 `queued` → row appears → polling starts (FR-012).
- **Alternative / failure flows:**
  - Over 10 MB: 413 (COPY-34b).
  - Not a PDF: 415 (COPY-34c).
  - Over 10 pages: 422 (COPY-34e).
  - Duplicate: 409 with a link (COPY-34d).
  - No consent: 403 `CONSENT_REQUIRED`, which leads to the consent prompt.
  - No scope: the control is hidden; a direct call gets 403.
- **Acceptance criteria:**
  - The file is stored under a random name outside the web root.
  - Type is decided from magic bytes, not the filename.
  - SHA-256 is recorded.
  - A `document.uploaded` audit event is written.
  - 202 returns within 2 seconds for a 1 MB file on the demo laptop.
- **Dependencies:** SCR-05 · API-08 · AG-01 · FR-003, FR-012 · BE-4.1 · FE-3.2.

### FR-011 Import the synthetic sample set — P1 · Hackathon MVP if time permits
- **Description:** One click imports a named synthetic sample set through the live pipeline, with the golden cache as fallback. The import is idempotent and works only in demo mode.
- **User story:** As a judge, I want to load realistic sample records quickly so that I can try the features myself.
- **Preconditions:** Demo mode is on; `upload_documents` scope.
- **Main flow:** "Load synthetic sample records" → API-09 → documents appear with the "Synthetic sample" badge → processing.
- **Alternative / failure flows:**
  - Already imported: those files are listed as skipped.
  - Demo mode off: the button is hidden and the endpoint returns 404.
- **Acceptance criteria:**
  - Imported documents use the manifest's fixed IDs.
  - Importing again creates no duplicates.
  - Every imported document shows the badge.
- **Dependencies:** SCR-05 · API-09 · BE-4.5 · FE-3.7 · demo data pack.

### FR-012 Processing status, failure and retry — P0 · Hackathon MVP
- **Description:** Documents move through visible stages. Each failure has a code and copy-deck text. Retry is offered when it can help.
- **User story:** As a user, I want to see what is happening to my document and what to do if it fails.
- **Preconditions:** A document has been uploaded.
- **Main flow:**
  - Status path: `queued` → `processing` → `needs_review` or `ready`.
  - `processing` stages: reading_text → screening → extracting → validating.
  - The client polls API-11 every 2 seconds.
- **Alternative / failure flows:**
  - No text layer: `failed` / `NO_TEXT_LAYER` (COPY-14), no retry.
  - AI unavailable, timeout, blocked or invalid output: use the golden cache if the file is known (FR-040); otherwise `failed` with COPY-09c and Retry (API-13).
  - Internal error: `failed` with Retry.
- **Acceptance criteria:**
  - Stage labels follow COPY-36.
  - Polling stops on terminal states.
  - Retry re-queues the document.
  - API-10 and API-11 respond within 500 ms while extraction is running, so processing never blocks the server.
- **Dependencies:** SCR-05, SCR-06 · API-11, API-13 · AG-01–AG-05 · BE-5.1 · FE-3.3.

### FR-013 Document list — P0 · Hackathon MVP
- **Description:** Lists documents, with type and status filters, sorted by document date.
- **User story:** As a patient, I want to see all my documents in one place so that I can find any of them.
- **Preconditions:** `view_records`.
- **Main flow:** SCR-05 → API-10 → rows show title, type, date (with an ambiguity marker), status, flags and fact counts.
- **Alternative / failure flows:**
  - No documents: empty state with an Upload call to action.
  - Filters match nothing: filtered-empty state with "Clear filters".
- **Acceptance criteria:**
  - Sorted by document date, newest first, undated last.
  - Filters can be combined.
  - Synthetic, cached and suspicious-content documents carry badges.
- **Dependencies:** SCR-04, SCR-05 · API-10 · BE-4.2 · FE-3.1.

### FR-014 Original document viewer — P0 · Hackathon MVP
- **Description:** Shows the original PDF next to the extracted information and can open it at a given page. Files are served only through the authorised endpoint.
- **User story:** As a patient or a doctor, I want to see the original page a fact came from so that I can trust it.
- **Preconditions:** `view_records`.
- **Main flow:** Open a document → API-12 fetched with the bearer token → blob URL → browser viewer. "Show in document (page N)" moves to that page.
- **Alternative / failure flows:**
  - The browser can't jump to the page: show "See page N" instead.
  - File missing: error state.
- **Acceptance criteria:**
  - The token never appears in a URL.
  - Response headers include `nosniff` and `no-store`.
  - A `document.file_viewed` audit event is written.
  - The blob URL is released when the user leaves the screen.
- **Dependencies:** SCR-06 · API-12 · BE-4.3 · FE-3.4 · THR-12.

### FR-015 Text and line extraction — P0 · Hackathon MVP
- **Description:** Reads text page by page from text-layer PDFs and splits it into lines with stable IDs (`p{page}-l{n}`). Table rows are rebuilt from word positions.
- **User story:** As the system, I need exact line text with IDs so that every fact and statement can cite its source.
- **Preconditions:** A valid PDF.
- **Main flow:** AG-02 reads words with coordinates → groups them into lines by vertical position → assigns line IDs → stores the page lines.
- **Alternative / failure flows:**
  - A page with almost no characters: `no_text_layer` (FR-012) or the `low_text_density` flag.
  - Encrypted or corrupt PDF: `UNREADABLE_PDF`.
- **Acceptance criteria:**
  - Each synthetic lab test appears as one line containing name, value, unit, range and flag.
  - Line IDs are identical when the same file is processed again.
- **Dependencies:** AG-02 · BE-5.2 · [07-data-model.md](07-data-model.md) §3.7.

### FR-016 Structured fact extraction — P0 · Hackathon MVP
- **Description:** Gemini extracts the document header and facts into a flat schema. Values are copied exactly as written, and every fact cites its source line IDs.
- **User story:** As a patient, I want my documents turned into clear items (medicines, results, conditions) so that I can review and use them.
- **Preconditions:** Lines are available; the AI is available, or the file is in the golden cache.
- **Main flow:** AG-03 screening → AG-04 extraction (`store=false`, JSON schema) → candidate facts → FR-017.
- **Alternative / failure flows:** AI unavailable, blocked, timed out or invalid JSON → one retry → golden cache → otherwise failed (FR-012, FR-040).
- **Acceptance criteria:**
  - On the synthetic set, at least 90 % of answer-key fields are extracted correctly (MET-01).
  - No fact without valid source line IDs survives validation.
  - Values are not normalised in storage.
- **Dependencies:** AG-03, AG-04 · BE-5.3, BE-5.4 · FR-017 · MET-01.

### FR-017 Extraction validation and confidence — P0 · Hackathon MVP
- **Description:** Rules check every fact:
  - the cited line IDs exist;
  - name, value, unit and strength appear in the cited lines;
  - required fields for the fact type are present;
  - dates parse day-first;
  - values are plausible.

  The rules then set the confidence level and uncertainty reasons.
- **User story:** As a patient, I want MediVara to tell me which items it is unsure about so that I check those first.
- **Preconditions:** Candidate facts from FR-016.
- **Main flow:** AG-05 → `high` / `medium` / `low` confidence with reasons → facts that can't be traced are discarded and counted → document status `needs_review`.
- **Alternative / failure flows:** All facts discarded → `needs_review` with zero facts and the notice "Nothing could be read reliably" → reprocess allowed.
- **Acceptance criteria:**
  - Confidence never comes from the model.
  - Ambiguous dates are flagged.
  - Missing reference ranges are flagged.
  - The discarded count is visible in the document detail.
- **Dependencies:** AG-05 · BE-5.5 · [07-data-model.md](07-data-model.md) §3.8.

### FR-018 Review facts: confirm, correct, reject — P0 · Hackathon MVP
- **Description:** Users confirm, correct, reject or un-reject facts. History and audit events are kept.
- **User story:** As a patient, I want to fix mistakes in what MediVara read so that my history is accurate.
- **Preconditions:** `upload_documents` scope.
- **Main flow:** SCR-06 → choose an action → API-15 → updated fact and document status.
- **Alternative / failure flows:**
  - Invalid transition: 409, then the screen refreshes.
  - Validation error: message under the field.
  - Caregiver without the scope: read-only view.
- **Acceptance criteria:**
  - The original extraction is kept in history.
  - Corrected values show everywhere with "Corrected by you".
  - Rejected facts are excluded from the timeline, the brief and Ask.
  - Each action writes an audit event.
- **Dependencies:** SCR-06 · API-15 · BE-6.1 · FE-3.5 · [07-data-model.md](07-data-model.md) §6.

### FR-019 Bulk-confirm high-confidence facts — P0 · Hackathon MVP
- **Description:** One action confirms all unverified high-confidence facts in a document.
- **User story:** As a busy user, I want to confirm the obvious items in one click and spend my time on the uncertain ones.
- **Preconditions:** The document has unverified high-confidence facts.
- **Main flow:** "Confirm all high-confidence items (n)" → API-16 → confirmed IDs and remaining count.
- **Alternative / failure flows:** Nothing eligible: the button is disabled with an explanation.
- **Acceptance criteria:**
  - Medium and low confidence facts are untouched.
  - A `facts.bulk_confirmed` audit event records the count.
  - The UI updates without a reload.
- **Dependencies:** SCR-06 · API-16 · BE-6.1 · FE-3.6.

### FR-020 Correct document details — P0 · Hackathon MVP
- **Description:** Users can correct a document's type, date, facility and clinician. Setting the date clears the ambiguity flag.
- **User story:** As a patient, I want to fix a wrongly read date so that my timeline is in the right order.
- **Preconditions:** `upload_documents` scope.
- **Main flow:** Edit in the document details card → API-14 → updated document → the timeline reflects the change.
- **Alternative / failure flows:** Future date or empty value: 422 with a field error.
- **Acceptance criteria:**
  - Corrected fields record their source as `user`.
  - A `document.updated` audit event is written.
  - The ambiguity banner disappears once the date is set.
- **Dependencies:** SCR-06 · API-14 · BE-4.4 · FE-3.6.

### FR-021 Source linking — P0 · Hackathon MVP
- **Description:** Every fact, timeline item, brief item and AI statement links to its document, page and exact line text.
- **User story:** As a patient or doctor, I want to see where each statement came from so that I can verify it.
- **Preconditions:** None.
- **Main flow:** Citation chip → Evidence drawer (title, date, page, line text) → "Open document at page N".
- **Alternative / failure flows:** Document deleted after the brief was created: the evidence snapshot still shows the text, with "Document deleted".
- **Acceptance criteria:**
  - 100 % of displayed facts and record statements have resolvable sources (MET-02).
  - Evidence text equals the stored line text character for character.
- **Dependencies:** SCR-06–SCR-09 · API-11, API-17–API-21 · AG-12 · FE-4.3.

### FR-022 Medical timeline — P0 · Hackathon MVP
- **Description:** A deterministic, chronological view of documents and non-rejected facts. It has type filters, an "include unverified" toggle, change markers and a "Date unknown" group.
- **User story:** As a patient, I want to see my history in order so that I can explain it to a doctor.
- **Preconditions:** At least one processed document.
- **Main flow:** SCR-07 → API-17 → groups by date → each event opens SCR-06 at the source.
- **Alternative / failure flows:**
  - No documents: empty state.
  - Filters match nothing: filtered-empty state.
  - Change markers are `null` until BE-6.3 ships.
- **Acceptance criteria:**
  - Events are ordered correctly.
  - Rejected facts never appear.
  - Unverified items carry the badge and follow the toggle.
  - Change markers show values and dates only, never words like "better" or "worse".
- **Dependencies:** SCR-07 · API-17 · AG-06, AG-07 · BE-6.2, BE-6.3 · FE-4.1, FE-4.2.

### FR-023 Delete a document — P1 · Hackathon MVP if time permits
- **Description:** The owner deletes a document together with its file, pages and facts. Existing briefs become stale.
- **User story:** As a patient, I want to remove a document I uploaded by mistake.
- **Preconditions:** Owner; the document is not processing.
- **Main flow:** Delete → confirm → API-22 → 204 → the list updates.
- **Alternative / failure flows:**
  - Document still processing: 409.
  - Caregiver: control hidden; a direct call gets 403.
- **Acceptance criteria:**
  - The file is removed from storage.
  - Its facts disappear from the timeline.
  - The latest brief shows as stale.
  - A `document.deleted` audit event is written.
- **Dependencies:** SCR-06 · API-22 · BE-4.6 · FE-3.8.

### FR-024 Read images and scanned PDFs (vision OCR) — P1 (first cut) · Future if cut
- **Description:** JPEG and PNG files and image-only PDFs are transcribed into lines by Gemini vision, flagged `ai_transcribed`, and then follow the normal pipeline.
- **User story:** As a patient with paper prescriptions, I want to photograph them and add them.
- **Preconditions:** FR-010 accepts images (enabled with this feature).
- **Main flow:** AG-02 detects an image or a missing text layer → vision transcription → lines → extraction → validation against the transcription.
- **Alternative / failure flows:** Unreadable image: failed with COPY-09c-style text.
- **Acceptance criteria:**
  - The document shows the `ai_transcribed` badge.
  - Confidence is capped at `medium`, because sources can only be checked against the AI transcription.
- **Dependencies:** AG-02 (P1 path) · BE-5.8 · FE-3.9.

### FR-025 Additional document types — P1 · Spec only
- **Description:** Recognise consultation notes and imaging reports, and extract their typical facts (instructions, procedures, conditions).
- **User story:** As a patient, I want all my documents organised, not only three kinds.
- **Preconditions:** FR-016.
- **Main flow:** As FR-016, with type classification.
- **Alternative / failure flows:** Unknown kinds are typed `other`; facts are still extracted.
- **Acceptance criteria:** A synthetic consultation note is processed with the correct type and facts.
- **Dependencies:** AG-04 prompt specification · BE-5.4.

### FR-026 Encounter grouping across documents — P2 · Future
Merge documents from the same visit or admission into one timeline encounter.

---

## C. RAG-based AI workflow

### FR-030 Bounded AI workflow — P0 · Hackathon MVP
- **Description:** All AI work runs through a fixed sequence of stages (AG-01–AG-12). Each stage has defined inputs and outputs, sees only one patient's data, has no tools or side effects, and validation fails closed. There are no autonomous agents.
- **User story:** As a judge or clinician, I want the AI's role to be limited and inspectable so that I can trust what it produces.
- **Preconditions:** None.
- **Main flow:**
  - Upload runs the processing modules M1 and M2.
  - Reads run the deterministic module M3.
  - Ask and the narrative run module M4.
- **Alternative / failure flows:** Every stage has a defined failure behaviour ([08-ai-rag-design.md](08-ai-rag-design.md) §3).
- **Acceptance criteria:**
  - The stage table is implemented as specified.
  - Model ID and prompt version are recorded.
  - No model output can change stored data without a user action.
- **Dependencies:** [08-ai-rag-design.md](08-ai-rag-design.md) · BE-5.x, BE-7.x, BE-8.x.

### FR-031 Prompt-injection screening — P0 · Hackathon MVP
- **Description:** Document text is scanned for instruction-like content, and flagged documents show a banner. Document text always goes to the model as delimited data, and outputs are validated regardless of the flag.
- **User story:** As a patient, I want MediVara to ignore hidden instructions inside documents so that it can't be tricked into giving harmful advice.
- **Preconditions:** Lines extracted.
- **Main flow:** AG-03 pattern scan → `suspicious_instructions` flag → extraction continues with the injection-safe prompt → COPY-13 banner in SCR-06.
- **Alternative / failure flows:** False positive: banner only; nothing is lost.
- **Acceptance criteria:**
  - The injection test document is flagged.
  - Its injected instruction is never followed in extraction, the brief or Ask across 5 runs (MET-04).
- **Dependencies:** AG-03 · BE-5.6 · THR-03 · TC-INJ-01…03.

### FR-032 Consistency and gap findings — P0 · Hackathon MVP
- **Description:** Deterministic rules detect differences between documents (medicine strength or frequency; allergy statements) and gaps (no allergy information, undated documents, labs without a reference range, a follow-up with no later visit or reminder). Wording is neutral, every finding cites evidence, and a finding may suggest a question.
- **User story:** As a patient, I want to know where my documents disagree or lack information so that I can ask my doctor.
- **Preconditions:** Facts exist.
- **Main flow:** AG-07 runs on read → findings feed the brief sections and the timeline change markers.
- **Alternative / failure flows:** No findings: the section says "Nothing to clarify was found in your documents". It never says "all clear".
- **Acceptance criteria:**
  - The planted metformin difference and allergy conflict are detected.
  - Wording follows COPY-29 to COPY-29c and COPY-30a to COPY-30d.
  - A finding never says which document is correct.
- **Dependencies:** AG-07 · BE-7.1 · FR-022, FR-033.

### FR-033 Consultation Brief (snapshot, questions, print) — P0 · Hackathon MVP
- **Description:** Creates a deterministic snapshot containing: header, medicines, conditions, results over time, allergies, points to clarify, missing information, templated questions, sources and evidence. It has a print layout and staleness detection.
- **User story:** As a patient, I want a short summary with sources to take to my appointment.
- **Preconditions:** `view_records`; at least one processed document.
- **Main flow:** SCR-09 → Create (API-18) → renders instantly → Print.
- **Alternative / failure flows:**
  - No documents: empty state.
  - Unverified toggle off: unverified items are left out.
  - Documents changed since creation: stale banner (COPY-31).
- **Acceptance criteria:**
  - Sections render within 1 second.
  - Every item is cited.
  - The print layout fits the demo data on at most 2 A4 pages.
  - Questions are generated from findings by template.
- **Dependencies:** SCR-09 · API-18, API-19 · AG-08 · BE-7.2 · FE-4.4, FE-4.6.

### FR-034 Brief narrative — P0 · Hackathon MVP (cut step 8)
- **Description:** When a brief is opened, a short AI overview is generated from the brief's evidence. Each statement is validated, and the overview is labelled AI-generated (COPY-38). If generation fails, the templated sentence stays.
- **User story:** As a patient, I want a short, readable overview of my history, but only if every sentence is backed by my documents.
- **Preconditions:** A brief exists; the AI is available.
- **Main flow:** API-20 → AG-10 (brief evidence) → AG-11 → AG-12 → `ready`.
- **Alternative / failure flows:**
  - AI down, blocked or timed out: `unavailable` (COPY-09a).
  - Fewer than half the statements pass: `withheld` (COPY-08b).
  - Some statements dropped: COPY-08 notice.
- **Acceptance criteria:**
  - No unlabelled AI text appears.
  - Every `record_fact` statement is cited.
  - No advice or diagnostic wording passes validation.
  - Generation completes within 25 seconds.
- **Dependencies:** API-20 · AG-10–AG-12 · BE-7.4, BE-7.5 · FE-4.5.

### FR-035 Ask: intent gate — P0 · Hackathon MVP
- **Description:** Before any model call, rules detect:
  - emergencies → fixed message;
  - requests for medication advice, diagnosis or judgement of a clinician → safe redirect with the relevant records and a suggested question;
  - invalid input.
- **User story:** As a user who is in distress or asking for medical advice, I want an immediate, safe response instead of an improvised AI answer.
- **Preconditions:** A question has been submitted.
- **Main flow:** AG-09 pattern match → emergency: COPY-05; advice: COPY-06 plus keyword-matched evidence plus a templated question; otherwise continue to FR-036.
- **Alternative / failure flows:** False positive: the user sees the safe template and can rephrase.
- **Acceptance criteria:**
  - 10 of 10 scripted emergency and advice prompts are handled by templates with no model call (MET-03).
  - Gate responses return in under 200 ms.
- **Dependencies:** AG-09 · BE-8.1 · COPY-05, COPY-06 · THR-16.

### FR-036 Ask: patient-scoped evidence context — P0 · Hackathon MVP
- **Description:** The context contains every line of this patient's processed documents, with document headers, fact-status tags and user-correction notes. It is filtered by patient inside the query, keyed with short IDs, and capped by tokens (most recent documents first, with a notice).
- **User story:** As a patient, I want answers based only on my own documents.
- **Preconditions:** The intent gate passed.
- **Main flow:** AG-10 builds the context and maps short keys to (document, line).
- **Alternative / failure flows:**
  - Over the cap: newest documents first, plus the notice "Older documents were not searched".
  - No documents: `not_found`.
- **Acceptance criteria:**
  - No other patient's data can enter the context (TC-ACC-07).
  - Lines from rejected facts are tagged.
  - User corrections are included.
- **Dependencies:** AG-10 · BE-7.3 · THR-02.

### FR-037 Ask: grounded answer with citations — P0 · Hackathon MVP (cut step 9)
- **Description:** Gemini answers only from the provided evidence. It returns typed statements with evidence IDs and questions for the doctor. Ask is single-turn, with a 20-second limit and an evidence-only fallback.
- **User story:** As a patient, I want to ask questions in my own words and get answers with sources.
- **Preconditions:** Context built.
- **Main flow:** AG-11 → AG-12 → API-21 response → SCR-08 renders it.
- **Alternative / failure flows:**
  - AI unavailable or timeout: `degraded` (COPY-09b plus evidence).
  - Answer not in the records: `not_found`.
  - Off-topic question: `out_of_scope`.
- **Acceptance criteria:**
  - At least 12 of the 15 evaluation questions are answered correctly, as judged by Person C against the expected answers.
  - 100 % of `record_fact` statements are cited.
  - 95th-percentile latency is 20 seconds or less.
- **Dependencies:** SCR-08 · API-21 · AG-11, AG-12 · BE-7.4, BE-7.6 · FE-5.1–5.3.

### FR-038 Citation and safety validation — P0 · Hackathon MVP
- **Description:** Every statement is checked:
  - its evidence IDs exist in the context;
  - its numbers, dates and medicine names appear in the cited evidence (dates may also match the cited document's date);
  - safety patterns block prescriptive, diagnostic, predictive and clinician-judging language;
  - `explanation` statements contain no digits and none of the patient's medicine names.

  Failing statements are dropped one by one. If fewer than half pass, the whole answer is withheld.
- **User story:** As a patient, I want MediVara to remove anything it can't prove from my documents.
- **Preconditions:** Generator output.
- **Main flow:** AG-12 → passing statements, notices and a validation report.
- **Alternative / failure flows:** Invalid schema: retry once, then `degraded`.
- **Acceptance criteria:**
  - False rejections are 10 % or fewer on the evaluation set (MET-05).
  - No prescriptive statement is displayed in evaluation runs.
  - The validation report is stored.
- **Dependencies:** AG-12 · BE-8.2, BE-8.3 · THR-05.

### FR-039 Not-found and uncertainty communication — P0 · Hackathon MVP
- **Description:** When the records lack the information, MediVara says so plainly. When documents disagree or facts are unverified, it says so with citations. Gaps are never filled with outside knowledge about the patient.
- **User story:** As a patient, I want honesty when MediVara doesn't know.
- **Preconditions:** None.
- **Main flow:** The generator returns `not_found` or `uncertainty` statements; a notice is added whenever unverified evidence is used.
- **Alternative / failure flows:** None.
- **Acceptance criteria:**
  - "What is my blood group?" returns `not_found`.
  - The allergy question returns an uncertainty statement citing both sources.
  - The COPY-12b notice appears whenever unverified evidence is used.
- **Dependencies:** AG-11, AG-12 · COPY-07, COPY-12b.

### FR-040 Degraded mode and golden cache — P0 · Hackathon MVP
- **Description:** When Gemini is unavailable, blocked, slow or returns invalid output:
  - Extraction uses the golden cache for known files, labelled "Cached result", or fails with retry.
  - Ask returns evidence lines only.
  - The brief keeps its deterministic sections and the templated overview.
  - A global banner appears.

  An AI mode switch supports failure drills.
- **User story:** As a presenter and as a user, I want MediVara to keep working honestly when the AI is down.
- **Preconditions:** The cache was recorded for the sample files on Day 1.
- **Main flow:** Failure detected → feature-specific fallback → banner driven by API-01.
- **Alternative / failure flows:** Cache miss: failed with retry.
- **Acceptance criteria:**
  - With the AI mode set to `off`, the golden path still shows the timeline and the brief.
  - Cached results show COPY-11.
  - No crash and no raw error appears.
- **Dependencies:** API-01 · SCR-16 · BE-5.7, BE-14.2 · THR-07.

### FR-041 AI output traceability and staleness — P0 · Hackathon MVP
- **Description:** Every AI output (answer or narrative) is stored with its statements, evidence snapshot, validation report, model ID, prompt version, thinking level and latency. Briefs store a fingerprint, and staleness is computed on read.
- **User story:** As the team, and later as an auditor, we want to know exactly what MediVara showed and why.
- **Preconditions:** None.
- **Main flow:** An AIOutput or ConsultationBrief row is written on every generation.
- **Alternative / failure flows:** If storage fails, the response is still returned and the error is logged with the request ID. This is a prototype trade-off.
- **Acceptance criteria:**
  - Every displayed answer has an AIOutput row.
  - The brief shows as stale after a fact correction.
  - Question text never appears in application logs.
- **Dependencies:** [07-data-model.md](07-data-model.md) §3.10–3.11 · BE-2.4, BE-7.2, BE-7.6.

### FR-045 Ranked retrieval beyond the context cap — P2 · Future
Rank page-bounded chunks with BM25 when a patient's lines exceed the context cap.

### FR-046 Hybrid semantic retrieval — P2 · Future
Add embeddings (for example `gemini-embedding-001`) with patient-filtered vector search for large records.

### FR-047 LLM intent classifier — P2 · Future
Supplement the rules-first gate with a small, fast model (for example `gemini-3.5-flash-lite`) for intent detection.

### FR-048 Identifier redaction before AI calls — P2 · Future
Remove names, phone numbers, addresses and health IDs from text before it is sent to the model, and map citations back afterwards.

---

## D. Multimodal interaction

### FR-050 Plain-language text standards — P0 · Hackathon MVP
- **Description:** UI copy and AI output use plain English aimed at grade 6–8, with short sentences and explained terms. Values stay exactly as written, and AI text is labelled.
- **User story:** As a user with limited reading ability, I want short, clear sentences.
- **Preconditions:** None.
- **Main flow:**
  - The copy deck is the source of all fixed text.
  - The generator follows its prompt rules: at most 6 statements, short sentences.
  - Explanation statements carry COPY-37.
- **Alternative / failure flows:** None.
- **Acceptance criteria:**
  - Person C runs a readability check on the copy deck and on 10 sample answers.
  - Explanations are always labelled.
- **Dependencies:** copy deck · AG-11 prompt specification.

### FR-051 Display preferences — P0 · Hackathon MVP
- **Description:** Text size (100 / 125 / 150 %), high contrast and reduced motion. Saved per device and applied across the app.
- **User story:** As a user with low vision, I want bigger text and stronger contrast.
- **Preconditions:** None.
- **Main flow:** Onboarding step 3 or the header "Aa" menu → applied → saved.
- **Alternative / failure flows:** Browser storage unavailable: defaults every session.
- **Acceptance criteria:**
  - At 150 % text, no content or function is lost on P0 screens.
  - High-contrast mode meets AA contrast.
- **Dependencies:** SCR-01 · FE-2.1, FE-2.3 · NFR-A11Y-03.

### FR-055 Read-aloud — P1 · Hackathon MVP (planned)
- **Description:** Reads answers, the brief and the Visit Card aloud through browser speech synthesis, preferring on-device en-IN voices. Controls: play, pause, stop, speed.
- **User story:** As a user with limited reading ability or low vision, I want my brief read to me.
- **Preconditions:** The browser supports speech synthesis.
- **Main flow:** Read aloud → validated on-screen text is spoken → controls stay available.
- **Alternative / failure flows:**
  - No voices available: the button is hidden, with a hint.
  - Only network voices: COPY-21 is shown first.
- **Acceptance criteria:**
  - Reads only validated text that is on screen.
  - Stop takes effect immediately.
  - Citations are read as "source: …".
- **Dependencies:** SCR-10 · FE-7.1.

### FR-056 Speech-to-text question input — P1 (cut step 3) · Hackathon MVP if time permits
- **Description:** A microphone button transcribes speech (en-IN) into the question box for review. The user must press Send. Requests carry `input_mode: "voice"`. Includes disclosure, consent and permission handling.
- **User story:** As a user who finds typing hard, I want to speak my question.
- **Preconditions:** Chrome or Edge; microphone permission.
- **Main flow:** Tap the microphone → COPY-20 on first use → listening → transcript appears in the box → edit → Send.
- **Alternative / failure flows:**
  - Permission denied: COPY-22.
  - Browser unsupported: the button is hidden.
  - No speech detected: "try again" message.
- **Acceptance criteria:**
  - Nothing is ever sent automatically.
  - MediVara stores no audio.
  - A `voice_input` consent record is created.
- **Dependencies:** SCR-10 · API-05, API-21 · FE-7.2, FE-7.3 · THR-08.

### FR-058 Voice navigation — P2 · Future
Spoken commands such as "open my timeline" or "read my brief".

### FR-059 Server-side speech services — P2 · Future
Gemini transcription and TTS models for consistent cross-browser voice, Indian-language voices and control over data handling.

### FR-060 Visit Communication Card — P0 · Hackathon MVP (never cut)
- **Description:** A printable, full-screen card showing:
  - chosen communication needs (Deaf / ISL statements, interpreter request, writing preference);
  - an optional note;
  - key facts with sources from the latest brief;
  - quick phrases.
- **User story:** As a Deaf ISL user, I want to show reception a clear card so that they arrange an interpreter or write things down.
- **Preconditions:** A latest brief exists (needed for the key facts).
- **Main flow:** SCR-11 → choose needs → card renders → "Show to staff" or Print.
- **Alternative / failure flows:**
  - No brief: the card shows without facts, with a "Create brief" call to action.
  - Device storage unavailable: default statements.
- **Acceptance criteria:**
  - Works fully without sound.
  - Full-screen text is at least 28 px with 7:1 contrast.
  - Prints on one A4 page.
  - No translation claims anywhere.
- **Dependencies:** SCR-11 · API-19 · FE-8.1 · COPY-17, COPY-19.

### FR-061 ISL health-term glossary — P0 · Hackathon MVP (never cut)
- **Description:** Up to 15 health terms with official ISLRTC ISL dictionary videos, embedded in privacy-enhanced mode with attribution. Person C curates and verifies them. There is a fallback for offline use or missing videos.
- **User story:** As a Deaf ISL user, or a member of staff learning a sign, I want to see the official sign for a health term.
- **Preconditions:** The glossary content file is ready (prepared before the event).
- **Main flow:** SCR-11 Glossary → search or select → the video plays with attribution.
- **Alternative / failure flows:**
  - Offline or blocked: text plus a link (COPY-18b).
  - A term without a verified video: no video is shown.
- **Acceptance criteria:**
  - Every video carries attribution.
  - Only verified entries show a video.
  - The content file records the source URL and verification date for each term.
- **Dependencies:** SCR-11 · FE-8.2 · demo data pack §7 · THR-09.

### FR-062 ISL term links in brief and answers — P1 · Hackathon MVP if time permits
- **Description:** When ISL mode is on, glossary terms that appear in the brief or in answers show a small sign icon that opens the glossary entry.
- **User story:** As a Deaf ISL user, I want to see the sign for a term while reading my brief.
- **Preconditions:** FR-061; ISL mode enabled in display preferences.
- **Main flow:** Terms are matched case-insensitively against glossary terms and aliases → icon → glossary entry.
- **Alternative / failure flows:** No match: nothing is shown.
- **Acceptance criteria:**
  - Matches only whole words.
  - The icon has an accessible name: "Show ISL sign for {term}".
- **Dependencies:** SCR-09, SCR-08, SCR-11 · FE-8.3.

### FR-063 ISL interpreter request on simulated booking — P1 (with FR-091) · Hackathon MVP if time permits
- **Description:** The simulated booking form includes "I need an ISL interpreter". The confirmation repeats the request, marked as simulated.
- **User story:** As a Deaf ISL user, I want my interpreter need recorded with the appointment.
- **Preconditions:** FR-091.
- **Main flow:** Tick the box → API-32 `needs_isl_interpreter: true` → the confirmation shows it.
- **Alternative / failure flows:** The booking feature is cut: the Visit Card carries the request instead (FR-060).
- **Acceptance criteria:** The flag is stored and displayed; the "Simulated" label is present.
- **Dependencies:** SCR-13 · API-32 · FE-9.4 · BE-11.2.

### FR-064 Experimental isolated-sign recognition — P2 · Future (not built in the hackathon)
On-device recognition of a handful of isolated ISL signs, using open datasets such as INCLUDE. Requires co-design and validation with Deaf signers before any public demo.

### FR-065 ISL sentence translation or signing avatar — Future
Two-way translation between ISL and text or speech. A research-level problem that requires the Deaf community, linguists and large datasets. MediVara will not claim it.

---

## E. Reminders

### FR-070 Create a reminder — P1 · Hackathon MVP (planned)
- **Description:** Create reminders of type appointment, medication, follow-up or other. Schedules are once (date and time) or daily (up to four times). Timezone is IST. Medication reminders require the user's attestation.
- **User story:** As a patient or caregiver, I want to set reminders for appointments and medicine times my doctor gave me.
- **Preconditions:** `manage_reminders` scope.
- **Main flow:** SCR-12 → New reminder → form → API-28 → appears in the list.
- **Alternative / failure flows:**
  - Past date: 422.
  - Medication reminder without the attestation: the client blocks it and the server returns 422.
- **Acceptance criteria:**
  - `next_due_at` is computed by the server.
  - Times display with the "IST" label.
  - A `reminder.created` audit event is written.
- **Dependencies:** SCR-12 · API-28 · BE-10.1 · FE-9.2 · COPY-24.

### FR-071 Manage reminders — P1 · Hackathon MVP (planned)
- **Description:** List reminders grouped by due status. Edit, dismiss, restore and complete them. Completing a daily reminder moves it to the next time.
- **User story:** As a patient, I want to tick off reminders and fix them when plans change.
- **Preconditions:** `view_records` to list; `manage_reminders` to change.
- **Main flow:** API-27 list → Done (API-30), Edit or Dismiss (API-29).
- **Alternative / failure flows:**
  - Completing a dismissed reminder: 409.
  - Caregiver without the scope: read-only.
- **Acceptance criteria:**
  - Completing a once-only reminder sets status `completed`.
  - Completing a daily reminder advances `next_due_at`.
  - Each change writes an audit event.
- **Dependencies:** SCR-12 · API-27, API-29, API-30 · BE-10.1 · FE-9.1.

### FR-072 Reminder from an extracted follow-up — P1 · Hackathon MVP (planned)
- **Description:** Follow-up facts without a reminder appear under "Suggested from your documents". "Create reminder" pre-fills the form, including the source fact. MediVara never creates a reminder by itself.
- **User story:** As a patient, I want to turn "review after 6 weeks" into a reminder in one step.
- **Preconditions:** A follow-up fact exists.
- **Main flow:** Suggestion → pre-filled form; the user picks the date (the document's wording is shown) → API-28 with `source_fact_id`.
- **Alternative / failure flows:** The fact was rejected: no suggestion appears.
- **Acceptance criteria:**
  - The reminder links back to its source document.
  - The suggested date is never auto-calculated and saved without the user choosing it.
- **Dependencies:** SCR-12 · API-17 (follow-up facts), API-28 · FE-9.2.

### FR-073 In-app and browser notifications — P1 (cut step 4) · Hackathon MVP if time permits
- **Description:** While the app is open, due reminders show in the app. After the user opts in, a browser notification also appears, checked every 60 seconds. There is no delivery guarantee.
- **User story:** As a patient, I want a nudge when a reminder is due.
- **Preconditions:** The user enabled notifications after reading COPY-23.
- **Main flow:** Enable → browser permission prompt → `notifications` consent record → polling → notification.
- **Alternative / failure flows:** Permission denied: in-app only, with a message.
- **Acceptance criteria:**
  - COPY-23 appears before the permission prompt.
  - No notification is attempted without permission.
  - Nothing is promised about delivery.
- **Dependencies:** SCR-12 · API-05, API-27 · FE-9.3.

### FR-074 Timezone handling — P1 · Hackathon MVP (planned)
- **Description:** Reminder schedules are stored as local wall-clock values plus an IANA timezone (MVP: `Asia/Kolkata`). The server computes UTC due times. The UI always labels times "IST".
- **User story:** As a user, I want reminder times to mean exactly what I typed.
- **Preconditions:** None.
- **Main flow:** The form shows "IST (Asia/Kolkata)" → server conversion → display with the label.
- **Alternative / failure flows:** Any other timezone: 422 in the MVP.
- **Acceptance criteria:** A reminder at 10:00 IST is stored as 04:30Z and displayed as "10:00 IST".
- **Dependencies:** API-28 · BE-10.1 · FE-9.2.

### FR-075 Push notifications when the app is closed — P2 · Future
A service worker plus a push service, with delivery tracking and fallbacks such as SMS.

---

## F. Solo and family profiles

### FR-080 Grant caregiver access — P1 · Hackathon MVP (planned)
- **Description:** The owner grants access to an existing MediVara account, chooses scopes (view required; upload and reminders optional) and confirms the sharing consent. The grant is active immediately (DEC-08).
- **User story:** As a patient, I want to let a family member see my records and manage my reminders, and nothing more.
- **Preconditions:** Owner; the grantee has an account.
- **Main flow:** SCR-14 → email, scopes, consent → API-24 → the grant appears in the list.
- **Alternative / failure flows:**
  - Unknown email: 404 `USER_NOT_FOUND`.
  - Existing grant: 409.
  - Consent not ticked: blocked.
- **Acceptance criteria:**
  - A `sharing` ConsentRecord and an `access.granted` audit event are written.
  - The caregiver sees the profile on their next load.
- **Dependencies:** SCR-14 · API-24 · BE-9.1 · FE-6.2 · COPY-25.

### FR-081 Caregiver scope enforcement — P1 · Hackathon MVP (planned)
- **Description:** Caregivers can do only what their scopes allow. The UI hides other controls; the server enforces the scopes.
- **User story:** As a patient, I want a caregiver with view-only access to be unable to change anything.
- **Preconditions:** A caregiver grant exists.
- **Main flow:** UI reads `my_role` and `scopes` from API-06 and API-07 → controls shown or hidden → the server checks each call.
- **Alternative / failure flows:** Direct API call without the scope: 403 `SCOPE_REQUIRED`.
- **Acceptance criteria:** The permission matrix rows for caregivers all pass (TC-ACC-04…06).
- **Dependencies:** FR-005 · API-06, API-07 · BE-3.2 · FE-6.1.

### FR-082 Revoke access — P1 · Hackathon MVP (planned)
- **Description:** The owner removes a caregiver, or a caregiver leaves. Either takes effect on the next request.
- **User story:** As a patient, I want to remove someone's access instantly.
- **Preconditions:** An active caregiver grant exists.
- **Main flow:** Remove → COPY-26 confirmation → API-25 → 204 → the caregiver's next request gets 403.
- **Alternative / failure flows:** Attempting to revoke the owner grant: 409.
- **Acceptance criteria:**
  - In the demo, a refresh in Karthik's window shows the Access denied page within one request.
  - `access.revoked` and `access.denied` audit events are written.
- **Dependencies:** SCR-14 · API-25 · BE-9.1 · FE-6.2.

### FR-083 Family dashboard — P1 · Hackathon MVP (planned)
- **Description:** Users with several accessible profiles see cards with role and scope badges and stats, showing only permitted profiles.
- **User story:** As a caregiver, I want to switch between my own records and my parent's.
- **Preconditions:** More than one accessible profile.
- **Main flow:** SCR-03 → open a profile.
- **Alternative / failure flows:** A grant was revoked while the dashboard was open: opening that profile shows the Access denied page.
- **Acceptance criteria:** Cards match API-06 exactly; no profile appears without an active grant.
- **Dependencies:** SCR-03 · API-06 · FE-2.5.

### FR-084 Access log — P1 (cut step 6) · Hackathon MVP if time permits
- **Description:** The owner sees who accessed or changed the profile and when, including denied attempts. The log contains no medical content.
- **User story:** As a patient, I want to know who looked at my records.
- **Preconditions:** Owner.
- **Main flow:** SCR-14 Access log tab → API-26.
- **Alternative / failure flows:** Caregiver: tab hidden; a direct call gets 403 `OWNER_ONLY`.
- **Acceptance criteria:** Grant, revoke and denied events appear with human-readable labels; no document text or values appear.
- **Dependencies:** SCR-14 · API-26 · BE-9.2 · FE-6.3.

### FR-085 Invitation acceptance and identity verification — P2 · Future
The invitee accepts by email or SMS link, with identity checks and a way to dispute. This avoids revealing which emails have accounts.

### FR-086 Managed dependent profiles — P2 · Future
Profiles for children or for adults who lack capacity, managed by a verified guardian. Requires a legal-authority process.

---

## G. Appointment suggestions and booking

### FR-090 Specialty suggestions and preparation checklist — P1 (cut step 2) · Hackathon MVP if time permits
- **Description:** A deterministic mapping from documented conditions and reason keywords to specialty categories. Each suggestion explains why and cites its source. A preparation checklist is included. It is not a diagnosis.
- **User story:** As a patient, I want to know which kind of specialist deals with conditions in my records, so that I can arrange the right appointment.
- **Preconditions:** `view_records`.
- **Main flow:** SCR-13 → optional reason → API-31 → categories with citations, checklist and disclaimer COPY-16b.
- **Alternative / failure flows:**
  - Emergency wording in the reason: COPY-05 and no suggestions.
  - No documented conditions: General medicine plus the checklist.
- **Acceptance criteria:**
  - Lab values are never used for suggestions.
  - The disclaimer is always visible.
  - Every suggestion cites its source.
- **Dependencies:** SCR-13 · API-31 · BE-11.1 · FE-9.4 · [08-ai-rag-design.md](08-ai-rag-design.md) §10.

### FR-091 Simulated providers and booking — P1 (cut step 2) · Hackathon MVP if time permits
- **Description:** Fictional providers with generated slots. Booking creates a `simulated` appointment, labelled everywhere. It never uses the word "confirmed" and never shows prices, ratings or credentials.
- **User story:** As a demo viewer, I want to see how booking would work, without being misled.
- **Preconditions:** FR-090.
- **Main flow:** Choose provider and slot → optional interpreter request (FR-063) → API-32 → confirmation with COPY-16 → offer to add a reminder.
- **Alternative / failure flows:** Slot already taken: 409 `INVALID_STATE`, then refresh the slots.
- **Acceptance criteria:**
  - "Simulated" is visible on every provider, slot and booking.
  - An `appointment.simulated_booked` audit event is written.
- **Dependencies:** SCR-13 · API-32, API-33 · BE-11.2 · FE-9.4.

### FR-092 Real booking integrations — Future
Provider directories, scheduling-system APIs, verification, payments and notifications. Requires partnerships and agreements. Never represented as working.

---

## H. Privacy, safety and security

### FR-100 Emergency message — P0 · Hackathon MVP
- **Description:** Emergency wording in Ask (or in the appointment reason) returns the fixed COPY-05 immediately, with no model call.
- **User story:** As a person in crisis, I want to be told immediately how to get urgent help.
- **Preconditions:** None.
- **Main flow:** AG-09 match → COPY-05 card shown prominently and announced assertively.
- **Alternative / failure flows:** False positive: harmless; the user can rephrase.
- **Acceptance criteria:**
  - All emergency prompts in the evaluation set trigger COPY-05 within 200 ms.
  - The emergency numbers are re-verified by Person C before the event.
- **Dependencies:** AG-09 · BE-8.1 · FE-5.3 · THR-16.

### FR-101 Medical-advice boundary — P0 · Hackathon MVP
- **Description:** MediVara never diagnoses, prescribes, recommends medication changes, predicts outcomes or judges clinicians. This is enforced by the intent gate, the prompt rules and the validator.
- **User story:** As a patient, I want MediVara to support my conversations with my doctor, never replace them.
- **Preconditions:** None.
- **Main flow:** AG-09 redirect (COPY-06) → AG-11 prompt rules → AG-12 safety patterns.
- **Alternative / failure flows:** Model produces advice anyway: the validator drops the statement; if too few remain, the answer is withheld.
- **Acceptance criteria:** 0 advice statements displayed across the evaluation set, including adversarial prompts (TC-SAFE-01…08).
- **Dependencies:** AG-09, AG-11, AG-12 · THR-05, THR-10.

### FR-102 Disclaimers — P0 · Hackathon MVP
- **Description:** COPY-02 appears in the footer, in every answer and in the brief. COPY-01 appears in onboarding. AI-written text is labelled (COPY-38). Explanations are labelled (COPY-37).
- **User story:** As a user, I want to always know what MediVara is and isn't.
- **Preconditions:** None.
- **Main flow:** Shared components render the disclaimers.
- **Alternative / failure flows:** None.
- **Acceptance criteria:** Person C's copy audit finds a disclaimer on every AI surface and in the print layout.
- **Dependencies:** copy deck · FE-1.5 · SCR-08, SCR-09.

### FR-103 Synthetic-data-only safeguards — P0 · Hackathon MVP
- **Description:** The COPY-03 warning appears at sign-in, onboarding and upload. Profiles are flagged synthetic. Sample documents are watermarked. The team declines any request to process real records.
- **User story:** As the team, we want to make sure no real health data enters a prototype that uses a cloud AI service.
- **Preconditions:** None.
- **Main flow:** Warnings in the UI; watermarked samples; a script line for judges ([../hackathon/demo-and-judging-strategy.md](../hackathon/demo-and-judging-strategy.md)).
- **Alternative / failure flows:** Someone offers a real report: politely decline; offer a synthetic sample.
- **Acceptance criteria:** The warning is visible on SCR-01, SCR-02 and SCR-05; every sample PDF carries the watermark.
- **Dependencies:** COPY-03 · demo data pack · THR-18.

### FR-104 Audit events — P0 · Hackathon MVP
- **Description:** The actions listed in [07-data-model.md](07-data-model.md) §3.14 write audit events containing IDs, outcome and request ID, and no PHI.
- **User story:** As a patient, I want a record of who did what with my information.
- **Preconditions:** None.
- **Main flow:** The audit writer is called by handlers and by the access guard.
- **Alternative / failure flows:** An audit write failure is logged and does not block the user action (prototype).
- **Acceptance criteria:**
  - Every listed action produces an event in the tests.
  - Metadata contains no document text, question text or values.
- **Dependencies:** BE-3.2 · FR-084 (viewer).

### FR-105 Log hygiene and secrets — P0 · Hackathon MVP
- **Description:** Application logs contain request IDs, routes, status codes, durations and error codes only. The Gemini API key lives only in the backend environment file, which is excluded from version control and never reaches the frontend.
- **User story:** As a patient, I want my information kept out of logs and my data protected by keys that can't leak to the browser.
- **Preconditions:** None.
- **Main flow:** A structured logger with an allow-list of fields; secrets loaded from the environment.
- **Alternative / failure flows:** Exceptions are logged with type and request ID, without document text.
- **Acceptance criteria:**
  - After a full rehearsal, a search of the logs finds no synthetic patient names, medicine names, values or question text (TC-SEC-04).
  - A search of the frontend build finds no API key (TC-SEC-05).
- **Dependencies:** BE-1.1, BE-14.1 · FE-12.4 · THR-13, THR-14.

### FR-106 Consent withdrawal — P1 · Spec (pull in only if ahead)
- **Description:** Users can withdraw `ai_processing`, `voice_input` or `notifications` consent in Settings, with the consequences explained.
- **User story:** As a user, I want to change my mind about how my data is processed.
- **Preconditions:** Signed in.
- **Main flow:** SCR-15 → Withdraw → API-05 with `granted: false` → features update (uploads blocked; microphone disabled; notifications off).
- **Alternative / failure flows:** None.
- **Acceptance criteria:** A ConsentRecord is written; uploads then return `CONSENT_REQUIRED`.
- **Dependencies:** SCR-15 · API-05 · FE-10.4.

---

## I. Cross-cutting UX

### FR-120 System states — P0 · Hackathon MVP
- **Description:** Every screen uses the shared loading, empty, error, success, session-ended, access-denied, not-found, offline and AI-degraded states from SCR-16.
- **User story:** As a user, I always want to know what is happening and what I can do next.
- **Preconditions:** None.
- **Main flow:** Shared components map API errors (by code) to copy.
- **Alternative / failure flows:** Unknown error code: the generic banner with the request ID.
- **Acceptance criteria:**
  - No raw error, stack trace or blank screen appears in E2E runs.
  - Every error banner shows the request ID.
- **Dependencies:** SCR-16 · FE-10.1–FE-10.3.

### FR-121 Demo and simulation indicators — P0 · Hackathon MVP
- **Description:** Badges and labels make the nature of data explicit: Synthetic sample, Synthetic profile, Simulated, Cached result, AI-generated, plus the development-only mock badge.
- **User story:** As a judge, I want to know what is real, simulated or cached, so that I am never misled.
- **Preconditions:** None.
- **Main flow:** Data flags → badges.
- **Alternative / failure flows:** None.
- **Acceptance criteria:**
  - Every simulated or cached item is labelled.
  - The mock badge never appears in the demo build (readiness checklist).
- **Dependencies:** SCR-16 · FE-10.3 · COPY-11, COPY-15, COPY-32, COPY-35, COPY-38.

---

## Requirement count

| Priority | Count | IDs |
|---|---|---|
| P0 | 42 | FR-001–006, FR-010, FR-012–022, FR-030–041, FR-050, FR-051, FR-060, FR-061, FR-100–105, FR-120, FR-121 |
| P1 | 21 | FR-011, FR-023–025, FR-055, FR-056, FR-062, FR-063, FR-070–074, FR-080–084, FR-090, FR-091, FR-106 |
| P2 / Future | 13 | FR-026, FR-045–048, FR-058, FR-059, FR-064, FR-065, FR-075, FR-085, FR-086, FR-092 |
| **Total** | **76** | |

The traceability matrix (P0 FR → screen → API → FE task → BE task → test) is in [../hackathon/test-plan.md](../hackathon/test-plan.md) §8.
