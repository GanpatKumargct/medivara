# Frontend Sprint Backlog — Person A only

> Owner: **Person A (Frontend Developer)**. Verified by Person C. Contract owner for every endpoint: Person B.
> Sources of truth: screens [../srd/10-ui-screen-spec.md](../srd/10-ui-screen-spec.md) · API [../srd/11-api-contract.md](../srd/11-api-contract.md) · requirements [../srd/04-functional-requirements.md](../srd/04-functional-requirements.md) · Definition of Done [../srd/14-definition-of-done.md](../srd/14-definition-of-done.md).
> Estimates assume AI-assisted coding (ASM-06) and include writing, self-testing and polish. Sprint sheets in this folder list the same tasks in time order.

## 0. Scope boundary

Person A **does not** implement:
- backend services, database logic or server-side authorisation;
- AI pipelines or calls to Gemini (the browser never calls Gemini);
- medical logic: inconsistency rules, date interpretation of document content, lab interpretation.

The frontend displays what the API returns, applies UI permissions for convenience only, and never colour-codes results as good or bad. If a screen seems to need logic that isn't in the API, raise a contract question with Person B; don't build it in the client.

**Handoff status values used below:**
- **Mock-first → IC-n:** built against MSW fixtures, switched to the real API at checkpoint IC-n.
- **Frontend-only:** no backend dependency.
- **Real-only:** needs the live backend (rare).

## 1. Summary by sprint

| Sprint | Window | Tasks | Planned minutes | Available | Exit checkpoint |
|---|---|---|---|---|---|
| Sprint 1 | Day 1 09:45–12:00 | FE-1.1–1.5, FE-2.1, FE-2.2 | 135 | 135 | IC-1 (FE-11.1, 20 min) |
| Sprint 2 | Day 1 13:00–16:30 | FE-2.3, FE-2.4, FE-3.1–3.5, FE-10.1, FE-10.2 | 205 | 210 | IC-2 (FE-11.2, 20 min) |
| Sprint 3 | Day 1 16:50–18:30 | FE-3.6, FE-4.1–4.3, FE-10.3 | 95 | 100 | IC-3 (FE-11.3, 15 min) |
| Sprint 4 | Day 2 09:20–12:00 | FE-12.1, FE-4.4–4.6, FE-8.1, FE-8.2, FE-5.1–5.3, FE-7.1 | 160 | 160 | IC-4 (FE-11.4, 20 min) |
| Sprint 5 | Day 2 12:45–14:15 | FE-2.5, FE-6.1–6.3, FE-9.1, FE-9.2 | 90 | 90 | IC-5 and feature freeze |
| Sprint 6 | Day 2 14:15–15:45 | FE-11.5, FE-12.2–12.5 | 90 | 90 | IC-6 code freeze |

| Totals | Minutes | Hours |
|---|---|---|
| P0 (including integration windows and stabilisation) | 730 | ≈ 12.2 |
| P1 scheduled (read-aloud, Sprint 5, IC-5 switch) | 120 | ≈ 2.0 |
| Available (all sprint and integration windows) | 870 | ≈ 14.5 |
| Unscheduled P1 pool (pull in only if ahead, in this order): FE-7.2 + FE-7.3, FE-9.3, FE-3.7, FE-3.8, FE-10.4, FE-8.3, FE-9.4, FE-3.9 | 145 | ≈ 2.4 |

## 2. Mock readiness by screen

All P0 fixtures exist from IC-0, because they are copied from the contract. Every screen can be built before the backend is ready.

| Screen | Fixtures (in `contracts/`) | MSW scenarios needed | Switches to real at |
|---|---|---|---|
| SCR-02 Login | API-02.200, API-02.401 | success, wrong password, slow | IC-1 (never mocked after IC-1) |
| SCR-01 Onboarding | API-04.200, API-05.201 | onboarding required / not required | IC-1 |
| SCR-03 / SCR-04 Profiles and dashboard | API-06.200, API-07.200, API-07.403, API-10.200, API-19.200 | caregiver view, empty profile, 403 | IC-1 (profiles), IC-2 (documents), IC-4 (brief tile) |
| SCR-05 Records | API-08.202, API-08.409, API-10.200, API-11.200.processing, API-11.200.failed-no-text-layer | queued → processing → needs_review progression; 413, 415, 409; failed | IC-2 |
| SCR-06 Review | API-11.200.needs-review, .ready, .suspicious, .cached; API-15.200; API-16.200 | validation error, 409 invalid state | IC-2 (read), IC-3 (actions) |
| SCR-07 Timeline | API-17.200 | empty, filtered-empty | IC-3 |
| SCR-09 Brief | API-18.201, API-19.200, API-20.200.ready, API-20.200.unavailable | 404 (no brief), stale, narrative slow | IC-4 |
| SCR-08 Ask | API-21.200 (answered, advice-redirect, emergency, not-found, degraded, withheld, out-of-scope) | slow (22 s, to trigger the client timeout) | IC-4 |
| SCR-11 Visit Assist | API-19.200 + glossary content file | no brief; glossary offline | IC-4 (brief); the glossary is frontend-only |
| SCR-14 Family | API-23.200, API-24.201, API-26.200 | USER_NOT_FOUND, GRANT_EXISTS | IC-5 |
| SCR-12 Reminders | API-27.200, API-28 request and response | validation errors | IC-5 |
| SCR-13 Appointments | API-31.200, API-32.201 | emergency notice | Only if built |
| SCR-16 States | API-01.200, API-01.200.ai-off | AI off | IC-1 |

---

## Section 1 — Frontend setup and design foundation

#### FE-1.1 Project scaffold and conventions — P0 · 25 min · Sprint 1
- **Implements:** foundation for every SCR; NFR-MNT-04.
- **Depends on:** IC-0 decisions (component library confirmed, DEC-19).
- **API / mock:** none.
- **Deliverable:**
  - Vite + React + TypeScript app in `frontend/`, with Tailwind and the chosen component library installed.
  - Lint and format configuration; folder convention (screens, components, api, mocks, content).
  - Same-origin dev proxy to the backend's `/api/v1`.
  - README run steps.
- **Acceptance:**
  - The app starts with one command.
  - The proxy forwards `/api/v1/health` to the backend when it is running.
  - TypeScript strict mode is on.
- **Test:** Person C follows the README on a second laptop.
- **Handoff:** Frontend-only.

#### FE-1.2 Design tokens and base components — P0 · 20 min · Sprint 1
- **Implements:** global UX rules (SCR §1); NFR-A11Y-01, NFR-A11Y-06.
- **Depends on:** FE-1.1.
- **API / mock:** none.
- **Deliverable:**
  - Colour tokens (AA contrast, plus a high-contrast variant); type scale at 100 / 125 / 150 %; spacing.
  - Base components: Button, Card, Badge (text plus icon), Alert, Dialog, Tabs, Toast, Skeleton, Chip.
- **Acceptance:**
  - All text and background pairs meet AA.
  - The high-contrast variant switches globally.
  - Badges never rely on colour alone.
- **Test:** Contrast checker on tokens; visual check at 150 %.
- **Handoff:** Frontend-only.

#### FE-1.3 API client, session handling and error envelope — P0 · 20 min · Sprint 1
- **Implements:** FR-001, FR-002, FR-120; API conventions §1–2.
- **Depends on:** FE-1.1.
- **API / mock:** every endpoint; shared error fixtures.
- **Deliverable:**
  - A single fetch wrapper:
    - adds the bearer token;
    - parses the error envelope into typed errors (code, message, details, request ID);
    - on 401, clears the session and redirects with COPY-33.
  - The token is kept in memory plus session storage (never local storage).
  - TanStack Query provider with sensible defaults (no automatic retries on 4xx).
- **Acceptance:**
  - The token never appears in URLs or logs.
  - Two browser windows can hold two different users.
  - Every error carries its request ID for display.
- **Test:** Sign in as Meera in one window and Karthik in another; force a 401 using the MSW scenario.
- **Handoff:** Mock-first → IC-1.

#### FE-1.4 MSW mock layer, fixtures, scenarios and mock badge — P0 · 25 min · Sprint 1
- **Implements:** integration plan §2 (guardrails); FR-121 (mock badge).
- **Depends on:** FE-1.3; fixtures copied into `contracts/` at kickoff (Person C copies, Person B reviews).
- **API / mock:** all fixtures in §2 of this document.
- **Deliverable:**
  - Mock Service Worker handlers driven by the fixture files.
  - Per-feature toggles from `VITE_MOCK_FEATURES` (for example `documents,timeline,brief,ask`).
  - Scenario switcher in a dev-only panel: slow, failure, empty, degraded.
  - Pass-through for unmocked routes.
  - The fixed "MOCK DATA" badge (COPY-32) whenever any handler is active.
- **Acceptance:**
  - With every feature switched to real, no handler intercepts.
  - **Login is never mocked once IC-1 passes.**
  - The badge appears exactly when mocks are active.
- **Test:** Toggle features on and off and watch the network panel.
- **Handoff:** Frontend-only (consumes Person B's fixtures).

#### FE-1.5 Copy deck module — P0 · 5 min · Sprint 1
- **Implements:** FR-102, FR-050; copy deck (SCR §19).
- **Depends on:** FE-1.1.
- **API / mock:** none.
- **Deliverable:** One content module holding every COPY string verbatim, with placeholders.
- **Acceptance:** No user-facing safety text is typed inline in screens.
- **Test:** Search the code for stray disclaimer text.
- **Handoff:** Frontend-only.

## Section 2 — Navigation and dashboard

#### FE-2.1 App shell, routing, header and footer — P0 · 20 min · Sprint 1
- **Implements:** SCR §1; FR-002, FR-051, FR-102.
- **Depends on:** FE-1.2, FE-1.3.
- **API / mock:** API-03 (sign-out).
- **Deliverable:**
  - Protected routes with patient ID in the path (`/p/{patient_id}/…`).
  - Sidebar navigation that becomes a bottom bar on mobile.
  - Header: profile name and role badge, "Aa" display menu (text size, contrast, reduced motion), account menu with sign-out.
  - Footer with COPY-02; "Skip to main content" link.
- **Acceptance:**
  - Unauthenticated users are redirected to SCR-02.
  - Sign-out calls API-03 and clears the session even if that call fails.
  - Display preferences persist on the device.
- **Test:** Keyboard-only navigation; sign out and press Back.
- **Handoff:** Mock-first → IC-1.

#### FE-2.2 Login and demo entry (SCR-02) — P0 · 20 min · Sprint 1
- **Implements:** FR-001; SCR-02.
- **Depends on:** FE-1.3, FE-2.1.
- **API / mock:** API-02 (`API-02.200`, `API-02.401`).
- **Deliverable:**
  - Email and password form.
  - Three demo account cards (Meera, Karthik, Ravi) that fill the form and submit through API-02.
  - COPY-03 banner; COPY-34a error.
- **Acceptance:** SCR-02 AC1–AC3.
- **Test:** Sign in with each card; wrong password shows one generic message.
- **Handoff:** Mock-first → **IC-1 (must be real at IC-1)**.

#### FE-2.3 Onboarding: disclaimer, consent, display quick setup (SCR-01) — P0 · 15 min · Sprint 2
- **Implements:** FR-003, FR-051; SCR-01.
- **Depends on:** FE-2.1, FE-1.5.
- **API / mock:** API-04, API-05 (`API-04.200`, `API-05.201`).
- **Deliverable:** A three-step card. Continue is disabled until both consents are ticked. Two API-05 calls. Display preferences with a live preview.
- **Acceptance:** SCR-01 AC1–AC3. No patient data is fetched before consent.
- **Test:** Fresh test account (Person B creates it), or the MSW scenario "onboarding required".
- **Handoff:** Mock-first → IC-1 / IC-2.

#### FE-2.4 Patient dashboard (SCR-04) — P0 · 20 min · Sprint 2
- **Implements:** FR-004, FR-013 (recent list); SCR-04.
- **Depends on:** FE-2.1, FE-10.1.
- **API / mock:** API-07, API-10, API-19 (404 means no brief yet); API-27 tile (P1, hidden until IC-5).
- **Deliverable:**
  - Header with role badge and "Synthetic profile" badge.
  - Quick actions.
  - Tiles: documents, needs review, latest brief.
  - Each tile handles its own errors independently.
- **Acceptance:** SCR-04 AC1–AC3. Upload is hidden for caregivers without `upload_documents`.
- **Test:** Sign in as Meera, then as Karthik (mock scenario before IC-5).
- **Handoff:** Mock-first → IC-1 (profile) / IC-2 (documents) / IC-4 (brief tile).

#### FE-2.5 Profile selector and family dashboard (SCR-03) — P1 · 10 min · Sprint 5
- **Implements:** FR-083; SCR-03.
- **Depends on:** FE-2.4.
- **API / mock:** API-06 (`API-06.200`).
- **Deliverable:** Profile cards with role and scope chips and stats. Users with a single profile skip straight to the dashboard.
- **Acceptance:** SCR-03 AC1–AC3.
- **Test:** Karthik sees two cards; Meera goes straight to the dashboard.
- **Handoff:** Mock-first → IC-5.

## Section 3 — Document repository and upload flow

#### FE-3.1 Records list and filters (SCR-05) — P0 · 25 min · Sprint 2
- **Implements:** FR-013; SCR-05.
- **Depends on:** FE-10.1.
- **API / mock:** API-10 (`API-10.200`).
- **Deliverable:**
  - Rows (cards on mobile) showing title, type icon, date with the "ambiguous" marker, status chip, flags (Synthetic sample, Cached result, Suspicious content) and fact counts.
  - Type and status filter chips.
  - Empty and filtered-empty states.
- **Acceptance:** FR-013 acceptance criteria; badges carry text.
- **Test:** MSW scenarios for empty, many documents and filters.
- **Handoff:** Mock-first → IC-2.

#### FE-3.2 Upload drop zone and client validation — P0 · 25 min · Sprint 2
- **Implements:** FR-010; SCR-05.
- **Depends on:** FE-3.1.
- **API / mock:** API-08 (`API-08.202`, `API-08.409`, errors 413 / 415 / 422).
- **Deliverable:**
  - Drop zone that also works as a button.
  - Optional document type hint.
  - Client checks for extension, MIME type and 10 MB.
  - Error messages COPY-34b to COPY-34e; the duplicate error links to the existing document.
  - COPY-03 visible.
  - Hidden without `upload_documents`.
- **Acceptance:** SCR-05 AC1 and AC3; no upload request is sent for files that fail the client checks.
- **Test:** Upload a valid PDF, an oversized file, a renamed text file and a duplicate.
- **Handoff:** Mock-first → IC-2.

#### FE-3.3 Processing status polling, stages, failure and retry — P0 · 20 min · Sprint 2
- **Implements:** FR-012; SCR-05, SCR-06.
- **Depends on:** FE-3.2.
- **API / mock:** API-11 (`API-11.200.processing` → `needs-review`; `failed-no-text-layer`), API-13 (reprocess).
- **Deliverable:**
  - Stage line with the COPY-36 labels.
  - Polling every 2 s that stops on terminal states.
  - Failure card mapped from the failure code: COPY-14 (no retry button), COPY-09c (with "Try again").
  - Live-region announcements.
- **Acceptance:** SCR-05 AC1, AC2 and AC4.
- **Test:** MSW progression scenario; watch the network panel to confirm the polling interval.
- **Handoff:** Mock-first → IC-2.

#### FE-3.4 Document viewer pane (SCR-06, left) — P0 · 25 min · Sprint 2
- **Implements:** FR-014; SCR-06.
- **Depends on:** FE-1.3.
- **API / mock:** API-12 (MSW serves a synthetic PDF from `demo-data/`).
- **Deliverable:**
  - Authenticated fetch → blob URL → the browser's built-in PDF viewer.
  - "Go to page N" (via `#page=N`, falling back to the text "See page N").
  - Revokes the blob URL on unmount.
  - Tabs layout below 1024 px.
- **Acceptance:** The token never appears in a URL; the page jump works in Chrome on the demo laptop.
- **Test:** Open a fact's source page from the review panel.
- **Handoff:** Mock-first → IC-2.

#### FE-3.5 Extraction review panel: facts, confidence, source lines, actions — P0 · 45 min · Sprint 2
- **Implements:** FR-016, FR-017, FR-018, FR-021; SCR-06.
- **Depends on:** FE-3.4, FE-1.2.
- **API / mock:** API-11 (`needs-review`, `ready`), API-15 (`API-15.200`, 409, 422).
- **Deliverable:**
  - Facts grouped by type. Each card shows: display text; confidence badge; uncertainty reasons in plain words; source line in quote style; "Show in document (page N)"; status badge.
  - Confirm, Correct and Reject actions, plus Undo for rejected facts.
  - A Correct dialog with the fields for that fact type.
  - Read-only for users without the scope.
  - Low-confidence facts listed first.
- **Acceptance:** SCR-06 AC1, AC2 and AC5.
- **Test:** Confirm, correct and reject using fixtures; check that the document status updates from the response.
- **Handoff:** Mock-first → IC-2 (read) / IC-3 (actions).

#### FE-3.6 Bulk confirm, document details edit, flag banners — P0 · 20 min · Sprint 3
- **Implements:** FR-019, FR-020, FR-031 (banner), FR-040 (cached chip); SCR-06.
- **Depends on:** FE-3.5.
- **API / mock:** API-16 (`API-16.200`), API-14, API-11 (`suspicious`, `cached`).
- **Deliverable:**
  - "Confirm all high-confidence items (n)" button.
  - Document details card with Edit (type, date, facility, clinician).
  - Banners: COPY-13, COPY-28, COPY-11.
- **Acceptance:** SCR-06 AC3 and AC4.
- **Test:** Bulk confirm on the DOC-5 fixture; set the date on the DOC-4 fixture and check that the banner disappears.
- **Handoff:** Mock-first → IC-3.

#### FE-3.7 Sample import button — P1 · 5 min · pull-in
- **Implements:** FR-011.
- **Depends on:** FE-3.1.
- **API / mock:** API-09 (`API-09.202`).
- **Deliverable:** "Load synthetic sample records" button, shown only when health reports `demo_mode` true; the result shows imported and skipped documents.
- **Acceptance:** FR-011 acceptance criteria.
- **Test:** Import twice; the second time everything is skipped.
- **Handoff:** Mock-first → when BE-4.5 ships.

#### FE-3.8 Delete document — P1 · 10 min · pull-in
- **Implements:** FR-023.
- **Depends on:** FE-3.5.
- **API / mock:** API-22.
- **Deliverable:** Owner-only Delete with a confirmation dialog; on success, return to the list.
- **Acceptance:** FR-023 acceptance criteria (the UI side).
- **Test:** Delete the injection test document in a test environment.
- **Handoff:** Mock-first → when BE-4.6 ships.

#### FE-3.9 Image upload and "AI-transcribed" label — P1 (cut step 1) · 10 min · pull-in
- **Implements:** FR-024.
- **Depends on:** FE-3.2.
- **API / mock:** API-08 accepting PNG and JPEG.
- **Deliverable:** Accept images in the drop zone when the feature is enabled; show the `ai_transcribed` badge.
- **Acceptance:** FR-024 acceptance criteria (the UI side).
- **Test:** Upload a synthetic image.
- **Handoff:** Only if BE-5.8 ships.

## Section 4 — Medical timeline and evidence-linked summary

#### FE-4.1 Timeline view (SCR-07) — P0 · 35 min · Sprint 3
- **Implements:** FR-022; SCR-07.
- **Depends on:** FE-10.1.
- **API / mock:** API-17 (`API-17.200`).
- **Deliverable:**
  - Vertical timeline with date headings.
  - Document cards with child fact rows.
  - Change markers as values and dates ("500 mg → 1000 mg").
  - A "Date unknown" group.
  - Unverified badges.
- **Acceptance:** SCR-07 AC1–AC3.
- **Test:** Fixture walkthrough; confirm no "better" or "worse" language and no red or green colouring of values.
- **Handoff:** Mock-first → IC-3.

#### FE-4.2 Timeline filters, unverified toggle, deep links — P0 · 15 min · Sprint 3
- **Implements:** FR-022, FR-021; SCR-07.
- **Depends on:** FE-4.1, FE-3.4.
- **API / mock:** API-17 query parameters.
- **Deliverable:**
  - Type chips, date range, "Include unverified" toggle, order switch.
  - Clicking an event opens SCR-06 at the document, with the fact highlighted and the page set.
  - Filtered-empty state.
- **Acceptance:** SCR-07 AC3 and AC4.
- **Test:** Toggle unverified off and confirm DOC-4's facts disappear; click an event and land on the right page.
- **Handoff:** Mock-first → IC-3.

#### FE-4.3 Evidence drawer (shared) — P0 · 15 min · Sprint 3
- **Implements:** FR-021; global citations rule.
- **Depends on:** FE-1.2.
- **API / mock:** evidence objects from API-18 to API-21 fixtures.
- **Deliverable:**
  - Citation chip component (`E1`), with an accessible name such as "Source 1: Lab report, 04 May 2026".
  - Drawer (side panel on desktop, bottom sheet on mobile) showing document title, date, page, exact line text, fact status, and "Open document at page N".
- **Acceptance:** Evidence text is shown exactly as received; the drawer is keyboard operable and returns focus when closed.
- **Test:** Open every citation in the API-18 fixture.
- **Handoff:** Frontend component used by FE-4.4 and FE-5.2.

#### FE-4.4 Consultation Brief screen (SCR-09) — P0 · 25 min · Sprint 4
- **Implements:** FR-033, FR-041 (stale); SCR-09.
- **Depends on:** FE-4.3.
- **API / mock:** API-18 (`API-18.201`), API-19 (`API-19.200`, 404).
- **Deliverable:**
  - Create bar (unverified toggle, visit reason).
  - Header.
  - Sections:
    - medicines from `medications_from`, plus the collapsed "Also mentioned in older documents" list;
    - conditions;
    - results-over-time tables;
    - allergies;
    - points to clarify;
    - missing information;
    - questions;
    - sources.
  - Badges; stale banner (COPY-31); empty state.
- **Acceptance:** SCR-09 AC1–AC3.
- **Test:** Fixture walkthrough; switch the 404 scenario to see the empty state.
- **Handoff:** Mock-first → IC-4.

#### FE-4.5 Brief narrative block — P0 · 10 min · Sprint 4
- **Implements:** FR-034; SCR-09.
- **Depends on:** FE-4.4.
- **API / mock:** API-20 (`API-20.200.ready`, `.unavailable`, slow scenario).
- **Deliverable:**
  - Shows the templated text immediately and calls API-20 once on open.
  - States: "Writing a short summary…", ready (COPY-38 label plus citations), unavailable or withheld (keeps the templated text and shows the notice).
  - The update is announced politely.
- **Acceptance:** SCR-09 AC1 and AC5; the sections never wait for the narrative.
- **Test:** Ready, unavailable and slow scenarios.
- **Handoff:** Mock-first → IC-4.

#### FE-4.6 Print layouts (brief, Visit Card) — P0 · 10 min · Sprint 4
- **Implements:** FR-033 (print), FR-060 (print); NFR-CMP-03.
- **Depends on:** FE-4.4, FE-8.1.
- **API / mock:** none.
- **Deliverable:**
  - Print styles for A4: navigation hidden, `[E1]` markers, a sources appendix with line texts, footer text.
  - Visit Card on one page.
- **Acceptance:** SCR-09 AC4; SCR-11 AC1 (print).
- **Test:** Print preview in Chrome.
- **Handoff:** Frontend-only.

## Section 5 — AI chat interface

#### FE-5.1 Ask screen and input (SCR-08) — P0 · 20 min · Sprint 4
- **Implements:** FR-037; SCR-08.
- **Depends on:** FE-1.3.
- **API / mock:** API-21 (all variants).
- **Deliverable:**
  - Session-only thread (cleared on sign-out).
  - Example question chips.
  - Input with a 500-character counter; Send disabled while waiting.
  - Progressive loading text with Cancel.
  - Client timeout at 25 s, then a "Try again" state.
- **Acceptance:** SCR-08 AC3 and AC4; focus stays in the input.
- **Test:** Slow scenario (22 s) shows the progressive text; the 26 s scenario hits the timeout state.
- **Handoff:** Mock-first → IC-4.

#### FE-5.2 Answer rendering with citations and doctor questions — P0 · 20 min · Sprint 4
- **Implements:** FR-037, FR-039, FR-021; SCR-08.
- **Depends on:** FE-5.1, FE-4.3.
- **API / mock:** `API-21.200.answered`.
- **Deliverable:**
  - Statements as short paragraphs with citation chips.
  - `explanation` statements labelled COPY-37.
  - Notices (COPY-12b, COPY-08).
  - "Questions you could ask your doctor".
  - COPY-02 under every answer.
- **Acceptance:** SCR-08 AC1; every `record_fact` statement shows a working chip.
- **Test:** Fixture walkthrough; open every citation.
- **Handoff:** Mock-first → IC-4.

#### FE-5.3 Ask special states — P0 · 10 min · Sprint 4
- **Implements:** FR-035, FR-039, FR-040, FR-100, FR-101; SCR-08.
- **Depends on:** FE-5.2.
- **API / mock:** `API-21.200.emergency`, `.advice-redirect`, `.not-found`, `.out-of-scope`, `.degraded`, `.withheld`.
- **Deliverable:**
  - Emergency card (COPY-05, assertive announcement, pinned at the top).
  - Advice redirect layout (COPY-06 + "What your documents say" + suggested question).
  - Not-found (COPY-07) and out-of-scope (COPY-07b).
  - Degraded and withheld (COPY-09b or COPY-08b, plus COPY-10, plus evidence lines).
- **Acceptance:** SCR-08 AC2.
- **Test:** Each fixture renders its own layout.
- **Handoff:** Mock-first → IC-4.

## Section 6 — Solo and family profile experience

#### FE-6.1 Role- and scope-aware UI — P1 · 10 min · Sprint 5
- **Implements:** FR-081, FR-005 (UI side).
- **Depends on:** FE-2.4, FE-3.5.
- **API / mock:** `my_role` and `scopes` from API-06 and API-07.
- **Deliverable:** A single helper that decides which controls are visible (upload, review actions, sharing, reminders, delete), plus "Shared with you" badges and caregiver banners.
- **Acceptance:** Karthik (view and reminders) sees no upload, review actions or sharing controls.
- **Test:** Sign in as Karthik against the caregiver fixture.
- **Handoff:** Mock-first → IC-5.

#### FE-6.2 Family sharing screen: people, grant form with consent, revoke (SCR-14) — P1 · 30 min · Sprint 5
- **Implements:** FR-080, FR-082; SCR-14.
- **Depends on:** FE-6.1.
- **API / mock:** API-23, API-24, API-25 (`API-23.200`, `API-24.201`, USER_NOT_FOUND, GRANT_EXISTS).
- **Deliverable:**
  - Owner view: people list, share form (email, scopes with "View records" required, COPY-25 consent), Remove with the COPY-26 confirmation.
  - Caregiver view: "Shared with you", plus a Leave button.
- **Acceptance:** SCR-14 AC1 and AC2.
- **Test:** Grant to Karthik, then revoke; Karthik's window shows Access denied on the next navigation.
- **Handoff:** Mock-first → IC-5.

#### FE-6.3 Access log tab — P1 (cut step 6) · 10 min · Sprint 5
- **Implements:** FR-084; SCR-14.
- **Depends on:** FE-6.2.
- **API / mock:** API-26 (`API-26.200`).
- **Deliverable:** A newest-first list with human-readable labels; denied events highlighted with text and an icon.
- **Acceptance:** SCR-14 AC3.
- **Test:** Fixture walkthrough; after IC-5, compare with the real revoke sequence.
- **Handoff:** Mock-first → IC-5.

## Section 7 — Voice interaction UI

#### FE-7.1 Read-aloud controls (SCR-10) — P1 · 15 min · Sprint 4
- **Implements:** FR-055; SCR-10.
- **Depends on:** FE-5.2, FE-4.4.
- **API / mock:** none.
- **Deliverable:**
  - Play, pause, stop and speed controls on answers, the brief and the Visit Card.
  - Prefers on-device en-IN voices; COPY-21 before using a network voice.
  - Reads citations as "source: …".
  - Stops on navigation.
- **Acceptance:** SCR-10 AC3; TC-VOICE-01 and TC-VOICE-02.
- **Test:** Demo laptop in Chrome; check which voices are listed and whether each is local.
- **Handoff:** Frontend-only.

#### FE-7.2 Speech-to-text microphone button and states — P1 (cut step 3) · 20 min · pull-in
- **Implements:** FR-056; SCR-10.
- **Depends on:** FE-5.1.
- **API / mock:** API-05 (`voice_input` consent).
- **Deliverable:**
  - Microphone button with these states: idle, permission, listening (with interim transcript), processing, error, unsupported.
  - `en-IN`; requests on-device recognition where available.
  - COPY-20 on first use; COPY-22 when denied.
  - Auto-stops after 15 s.
- **Acceptance:** SCR-10 AC1 and AC2.
- **Test:** TC-VOICE-03 and TC-VOICE-04.
- **Handoff:** Frontend-only (plus the consent call).

#### FE-7.3 Transcript confirmation and input mode — P1 (cut step 3) · 10 min · pull-in
- **Implements:** FR-056.
- **Depends on:** FE-7.2.
- **API / mock:** API-21 with `input_mode: "voice"`.
- **Deliverable:** The transcript goes into the editable question box; the user must press Send; the request carries the voice input mode.
- **Acceptance:** Speech is never sent automatically.
- **Test:** Speak, edit, then send; check the request payload.
- **Handoff:** Mock-first → IC-4 or later.

## Section 8 — Sign-language accessibility UI

#### FE-8.1 Visit Card (SCR-11) — P0 · 15 min · Sprint 4
- **Implements:** FR-060; SCR-11.
- **Depends on:** FE-4.4 (reuses brief components).
- **API / mock:** API-19 (`API-19.200`, 404).
- **Deliverable:**
  - Communication-needs checklist (COPY-19), remembered on the device.
  - Optional note.
  - Key facts with source and date (current medicines, allergies, conditions).
  - Quick phrases board.
  - "Show to staff" full-screen mode (text at least 28 px, 7:1 contrast).
  - "Create brief" call to action when no brief exists.
- **Acceptance:** SCR-11 AC1, AC3 and AC4.
- **Test:** TC-ISL-01, TC-ISL-02, TC-ISL-04; sound off throughout.
- **Handoff:** Mock-first → IC-4.

#### FE-8.2 ISL glossary with official videos and fallback (SCR-11) — P0 · 25 min · Sprint 4
- **Implements:** FR-061; SCR-11.
- **Depends on:** the glossary content file from Person C (ready before the event; data pack §7).
- **API / mock:** none (static content).
- **Deliverable:**
  - Searchable term list.
  - Player using the privacy-enhanced embed, with COPY-18 attribution and the source link.
  - Entries without a verified video, and the offline or blocked case, show text plus COPY-18b.
  - About tab with COPY-17 and the video-platform disclosure.
- **Acceptance:** SCR-11 AC2 and AC3.
- **Test:** TC-ISL-03 and TC-ISL-05, including the browser in offline mode.
- **Handoff:** Frontend-only.

#### FE-8.3 ISL term links in the brief and answers — P1 · 15 min · pull-in
- **Implements:** FR-062.
- **Depends on:** FE-8.2, FE-4.4, FE-5.2.
- **API / mock:** none.
- **Deliverable:** When ISL mode is on, whole-word glossary matches get a sign icon that opens the entry.
- **Acceptance:** FR-062 acceptance criteria.
- **Test:** "Thyroid" in Ravi's brief shows the icon.
- **Handoff:** Frontend-only.

## Section 9 — Reminders and mock appointment flow

#### FE-9.1 Reminders list, complete, dismiss (SCR-12) — P1 · 15 min · Sprint 5
- **Implements:** FR-071; SCR-12.
- **Depends on:** FE-10.1.
- **API / mock:** API-27, API-29, API-30 (`API-27.200`).
- **Deliverable:** Groups (Due today, Upcoming, Completed / dismissed); rows showing the "IST" time and a source link; Done and Dismiss actions.
- **Acceptance:** SCR-12 AC1 and AC2.
- **Test:** Complete a once-only reminder; dismiss and restore one.
- **Handoff:** Mock-first → IC-5.

#### FE-9.2 Reminder form and create from follow-up — P1 · 15 min · Sprint 5
- **Implements:** FR-070, FR-072, FR-074; SCR-12.
- **Depends on:** FE-9.1.
- **API / mock:** API-28 (request and response in the contract); follow-up facts from API-17.
- **Deliverable:**
  - Form: type, title, once or daily, times, notes; "IST (Asia/Kolkata)" shown.
  - Medication type requires the COPY-24 checkbox.
  - "Suggested from your documents" panel that pre-fills the form with the source fact. The user always chooses the date; it is never auto-calculated.
- **Acceptance:** SCR-12 AC1–AC3.
- **Test:** TC-REM-01 and TC-REM-02.
- **Handoff:** Mock-first → IC-5.

#### FE-9.3 Browser notifications while the app is open — P1 (cut step 4) · 15 min · pull-in
- **Implements:** FR-073.
- **Depends on:** FE-9.1.
- **API / mock:** API-05 (`notifications` consent), API-27.
- **Deliverable:** "Enable notifications" button that shows COPY-23 before the permission prompt, then polls every 60 s while open and fires a notification for due reminders.
- **Acceptance:** SCR-12 AC4; no notification without permission.
- **Test:** TC-REM-04.
- **Handoff:** Mock-first → IC-5.

#### FE-9.4 Appointments: suggestions, simulated providers, booking (SCR-13) — P1 (cut step 2) · 40 min · pull-in
- **Implements:** FR-090, FR-091, FR-063; SCR-13.
- **Depends on:** FE-4.3.
- **API / mock:** API-31, API-32, API-33 (`API-31.200`, `API-32.201`).
- **Deliverable:**
  - Reason input; category cards with "why" citations; checklist.
  - Provider cards, each with a large "Simulated" badge.
  - Slot picker and ISL interpreter checkbox.
  - Confirmation with COPY-16 and "Add a reminder".
  - Emergency notice state.
- **Acceptance:** SCR-13 AC1–AC3.
- **Test:** TC-APT-01 to TC-APT-03.
- **Handoff:** Only if BE-11.1 and BE-11.2 ship.

## Section 10 — Privacy, error, loading, empty and success states

#### FE-10.1 System-state components (SCR-16) — P0 · 20 min · Sprint 2
- **Implements:** FR-120; SCR-16.
- **Depends on:** FE-1.2, FE-1.3.
- **API / mock:** error fixtures.
- **Deliverable:**
  - Skeletons, empty-state card, error banner (with request ID and Retry), field-error rendering.
  - Success toasts (also announced), confirm dialog, offline banner.
- **Acceptance:** SCR-16 AC1.
- **Test:** Run every MSW failure scenario on SCR-05.
- **Handoff:** Frontend-only.

#### FE-10.2 401, 403 and 404 handling and pages — P0 · 10 min · Sprint 2
- **Implements:** FR-005 (UI side), FR-002; SCR-16.
- **Depends on:** FE-10.1.
- **API / mock:** `API-07.403`, shared errors.
- **Deliverable:** Session-ended redirect (COPY-33); Access denied page (COPY-27) with "Go to my profiles"; Not found page.
- **Acceptance:** Opening another patient's URL shows the Access denied page, with no data flash.
- **Test:** Paste Ravi's patient URL while signed in as Karthik.
- **Handoff:** Mock-first → IC-1.

#### FE-10.3 AI status banner and badges — P0 · 10 min · Sprint 3
- **Implements:** FR-040, FR-121; SCR-16.
- **Depends on:** FE-10.1.
- **API / mock:** API-01 (`API-01.200`, `.ai-off`).
- **Deliverable:**
  - Polls health every 60 s and after any degraded response; shows the COPY-09 banner.
  - Badges: Cached result, Unverified, Corrected, Documents differ, Synthetic sample, Simulated, AI-generated.
- **Acceptance:** SCR-16 AC2.
- **Test:** Switch to the `ai-off` scenario and confirm the banner appears.
- **Handoff:** Mock-first → IC-1 (health is real early).

#### FE-10.4 Settings, consent and privacy screen (SCR-15) — P1 · 20 min · pull-in
- **Implements:** FR-106, FR-051; SCR-15.
- **Depends on:** FE-2.3.
- **API / mock:** API-04, API-05.
- **Deliverable:** Display settings; consent list with Withdraw and its consequence; privacy text per AI design §12; About.
- **Acceptance:** SCR-15 AC1 and AC2.
- **Test:** Withdraw AI consent; the upload then shows the CONSENT_REQUIRED prompt.
- **Handoff:** Mock-first → when real.

## Section 11 — Backend integration

| Task | Checkpoint | Est | What switches from mock to real | Acceptance (all at the checkpoint) |
|---|---|---|---|---|
| **FE-11.1** | IC-1 (Day 1 12:00) | 20 min | `auth`, `me`, `consents`, `patients`, `health` | Sign in as all three demo users against the real backend; logout revokes; Access denied on a foreign patient URL |
| **FE-11.2** | IC-2 (Day 1 16:30) | 20 min | `documents` (list, upload, detail, file, reprocess) | Upload DOC-1 for real and watch it reach `needs_review`; the viewer shows the real PDF |
| **FE-11.3** | IC-3 (Day 1 18:30) | 15 min | `facts` (patch, bulk), document patch, `timeline`; replace clean fixtures with responses recorded from the real backend | Golden path #1: upload → review → timeline, with mocks off |
| **FE-11.4** | IC-4 (Day 2 12:00) | 20 min | `briefs`, `narrative`, `ask` | E2E-04 and E2E-05 pass on the real backend; the Visit Card shows real brief facts |
| **FE-11.5** | IC-5 (Day 2 14:15) | 15 min | `access`, `audit`, `reminders` | E2E-06 and E2E-07 pass on the real backend |

All five are P0, except FE-11.5, which is P1. Test method: Person C runs the listed E2E tests with the mock badge absent. Status values: Mocked → Real-integrated → Verified (C).

## Section 12 — Responsive polish and final demo readiness

#### FE-12.1 Accessibility fixes from audit #1 — P0 · 10 min · Sprint 4
- **Implements:** NFR-A11Y-01 to NFR-A11Y-04.
- **Depends on:** Person C's Day-1 17:30 audit list.
- **API / mock:** none.
- **Deliverable:** Fixes for the critical and serious issues found on SCR-01, 02, 04, 05 and 06.
- **Acceptance:** Axe shows no critical or serious issues on those screens.
- **Test:** Person C re-runs axe.
- **Handoff:** Frontend-only.

#### FE-12.2 Accessibility fixes from audit #2 and keyboard pass — P0 · 20 min · Sprint 6
- **Implements:** NFR-A11Y-01, NFR-A11Y-02.
- **Depends on:** the IC-4 audit list.
- **API / mock:** none.
- **Deliverable:** Fixes on SCR-07, 08, 09 and 11; complete the golden path with the keyboard only.
- **Acceptance:** TC-A11Y-01 and TC-A11Y-02 pass.
- **Test:** Person C runs a keyboard-only walkthrough.
- **Handoff:** Frontend-only.

#### FE-12.3 Responsive pass (360–1440 px) — P0 · 20 min · Sprint 6
- **Implements:** NFR-CMP-02, NFR-A11Y-03.
- **Depends on:** all P0 screens.
- **API / mock:** none.
- **Deliverable:** Layout fixes at 360, 768, 1024 and 1440 px; 200 % zoom check.
- **Acceptance:** TC-CMP-02 and TC-A11Y-03 pass.
- **Test:** Browser device toolbar.
- **Handoff:** Frontend-only.

#### FE-12.4 Mocks-off verification, production build, bundle secret check — P0 · 10 min · Sprint 6
- **Implements:** FR-121, FR-105; readiness checklist.
- **Depends on:** IC-5.
- **API / mock:** none.
- **Deliverable:** Production build with `VITE_MOCK_FEATURES` empty; MSW not loaded; a search of the build output for key patterns finds nothing.
- **Acceptance:** No mock badge; no service worker registered for mocks; TC-SEC-05 passes (frontend part).
- **Test:** Inspect the build and the application panel in developer tools.
- **Handoff:** Frontend-only.

#### FE-12.5 Bug-fix buffer from E2E — P0 · 25 min · Sprint 6
- **Implements:** whatever E2E runs reveal.
- **Depends on:** Person C's triage (one owner per bug).
- **API / mock:** none.
- **Deliverable:** Fixes for bugs assigned to Person A, highest severity first.
- **Acceptance:** Every demo-blocking frontend bug is closed before code freeze.
- **Test:** Person C re-runs the failing E2E step.
- **Handoff:** n/a.
