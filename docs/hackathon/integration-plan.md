# Frontend–Backend Integration and Collaboration Plan

> Owner: **Person C** (integration coordinator). Contract owner: **Person B**. Consumer: **Person A**.
> Purpose: two developers work in parallel without a last-hour integration crisis. Integration happens at **six checkpoints**, starting before lunch on Day 1.

## 1. Contract-first workflow

| Step | When | Who | Output |
|---|---|---|---|
| 1. Contract drafted | Before the event (this pack) | B (owner), reviewed by A and C | [../srd/11-api-contract.md](../srd/11-api-contract.md) v1.0 with canonical examples |
| 2. Homework | Before the event | A reads API-01 to 21; B confirms feasibility; C checks every API maps to a screen and an FR | Questions resolved before Day 1 |
| 3. Fixture extraction | Day 1, 09:00–09:30 | C copies every labelled JSON block into `contracts/`; B reviews (BE-1.3) | 35 fixture files plus shared errors, committed |
| 4. **P0 freeze (IC-0)** | Day 1, 09:45 | B declares; A acknowledges; C records | API-01 to 21 frozen at v1.0 |
| 5. **P1 freeze** | Day 1, 18:45 (G1) | Same | API-22 to 33 frozen |
| 6. Changes | Any time after a freeze | Per §5 | Changelog entry, fixture update, acknowledgement |

**Why the freeze at 09:45 is realistic:** the contract already exists, both developers have read it, and every endpoint has one canonical example per status that the mocks use directly.

## 2. Parallel development with mocks

**Approach:** Person A builds every screen against MSW handlers that return the canonical fixtures. App code is identical in mock and real mode. Each feature switches to the real API at its checkpoint by removing it from `VITE_MOCK_FEATURES`.

**Guardrails (all mandatory):**

| # | Guardrail | Why |
|---|---|---|
| G-1 | Fixture IDs equal the seeded IDs (`usr_meera`, `pat_meera`, `grt_karthik_meera`, …) | No ID mismatch when switching to real |
| G-2 | Login goes real at IC-1 and is **never mocked again**; mocked login is never mixed with real features | Prevents token and 401 confusion |
| G-3 | Same-origin Vite proxy; MSW passes unmocked routes through to the backend | No CORS problems; features switch independently |
| G-4 | Every screen is exercised with slow, failure, empty and degraded scenarios | The UI isn't built only for perfect data |
| G-5 | After IC-2 and IC-3, clean fixtures are replaced with responses recorded from the real backend (Person C records them, Person B commits them) | Realistic lengths and edge cases for the Day-2 screens |
| G-6 | A visible "MOCK DATA" badge whenever any handler is active; "mocks off" is on the readiness checklist | Mocks are never demoed by accident |
| G-7 | Person B's contract key test checks that real responses contain at least the fixture keys and types (BE-15.1) | Catches drift automatically |
| G-8 | Fixtures are edited only by Person B (or by C on B's request), in the same commit as any contract change | One source of truth |
| G-9 | The frontend never hardcodes document or fact IDs | Uploads get random IDs |

**Realistic data early:** by about 13:30 on Day 1, Person C provides document-detail fixtures for DOC-1 to DOC-5 built from the answer key, so the review UI is designed around real content.

## 3. Handoff table

Status values:
- **Not started**
- **Mock-ready:** frontend built against fixtures with every state.
- **BE-ready:** endpoint passes the contract key test and Swagger checks.
- **Integrated:** mocks off for this feature and the checkpoint test passes.
- **Verified:** Person C re-ran the test on the demo laptop and the Definition of Done is met.

Person C keeps the live copy of this table on the team board.

| Feature | Frontend (A) | Backend (B) | APIs | Mock ready from | Checkpoint | Acceptance test | Priority |
|---|---|---|---|---|---|---|---|
| Sign-in, sign-out, session | FE-1.3, FE-2.1, FE-2.2 | BE-3.1 | API-02, 03, 04 | IC-0 | IC-1 | TC-AUTH-01 to 04 | P0 |
| Health and AI banner | FE-10.3 | BE-1.2 | API-01 | IC-0 | IC-1 | TC-REL-01 (banner part) | P0 |
| Onboarding and consent | FE-2.3 | BE-3.4 | API-04, 05 | IC-0 | IC-1 / IC-2 | FR-003 acceptance criteria | P0 |
| Profiles and dashboard | FE-2.4 | BE-3.3 | API-06, 07 | IC-0 | IC-1 (profiles), IC-2 (counts) | TC-ACC-01, FR-004 acceptance criteria | P0 |
| Isolation (access denied) | FE-10.2 | BE-3.2, BE-3.5 | all patient-scoped | IC-0 | IC-1 onwards | TC-ACC-01 to 10 | P0 |
| Upload and processing | FE-3.1, 3.2, 3.3 | BE-4.1, 4.2, 5.1, 5.2 | API-08, 10, 11, 13 | IC-0 | IC-2 | E2E-01; TC-DOC-01 to 06 | P0 |
| Original viewer | FE-3.4 | BE-4.3 | API-12 | IC-0 | IC-2 | TC-SEC-02 | P0 |
| Extraction and review | FE-3.5, 3.6 | BE-5.3 to 5.6, BE-6.1, BE-4.4 | API-11, 14, 15, 16 | IC-0 (realistic data 13:30) | IC-2 (read), IC-3 (actions) | E2E-02; TC-EXT-01 to 07 | P0 |
| Timeline | FE-4.1, 4.2, 4.3 | BE-6.2, 6.3 | API-17 | IC-0 | IC-3 (markers IC-4) | E2E-03; TC-TL-01 to 04 | P0 |
| Consultation Brief | FE-4.4, 4.6 | BE-7.1, 7.2 | API-18, 19 | IC-0 | IC-4 (early integration about 10:30) | E2E-05; TC-BRF-01 to 03, 05, 06 | P0 |
| Brief narrative | FE-4.5 | BE-7.3, 7.4, 7.5, 8.2 | API-20 | IC-0 | IC-4 | TC-BRF-04 | P0 |
| Ask | FE-5.1, 5.2, 5.3 | BE-7.3, 7.4, 7.6, 8.1, 8.2 | API-21 | IC-0 | IC-4 | E2E-04; TC-ASK-01 to 08; TC-SAFE-01 to 08 | P0 |
| Degraded mode and golden cache | FE-10.3, FE-3.6 | BE-5.7, BE-14.2 | API-01, 11, 20, 21 | IC-0 | IC-5 (drill at IC-4) | TC-REL-01 | P0 |
| ISL Visit Assist | FE-8.1, 8.2 | (none; BE-13.1 contract) | API-19 + static glossary | IC-0 | IC-4 | E2E-10; TC-ISL-01 to 05 | P0 |
| Read-aloud | FE-7.1 | (none) | none | n/a | IC-4 | E2E-09 (read-aloud); TC-VOICE-01, 02 | P1 |
| Family sharing | FE-2.5, 6.1, 6.2 | BE-9.1 | API-06, 23, 24, 25 | G1 | IC-5 | E2E-06; TC-FAM-01 to 05 | P1 |
| Access log | FE-6.3 | BE-9.2 | API-26 | G1 | IC-5 | TC-FAM-04 | P1 |
| Reminders | FE-9.1, 9.2 | BE-10.1 | API-27 to 30 | G1 | IC-5 | E2E-07; TC-REM-01 to 03 | P1 |
| Speech input | FE-7.2, 7.3 | BE-12.1 | API-21 (`input_mode`), 05 | n/a | If built before freeze | E2E-09 (speech); TC-VOICE-03, 04 | P1 |
| Notifications | FE-9.3 | (none) | API-05, 27 | G1 | If built | TC-REM-04 | P1 |
| Sample import | FE-3.7 | BE-4.5 | API-09 | G1 | If built | FR-011 acceptance criteria | P1 |
| Delete document | FE-3.8 | BE-4.6 | API-22 | G1 | If built | TC-DOC-08 | P1 |
| Settings and consent withdrawal | FE-10.4 | BE-3.4 | API-04, 05 | IC-0 | If built | FR-106 acceptance criteria | P1 |
| Appointments (simulated) | FE-9.4 | BE-11.1, 11.2 | API-31, 32, 33 | G1 | If built | E2E-08; TC-APT-01 to 03 | P1 |
| Image and scan OCR | FE-3.9 | BE-5.8 | API-08, 11 | G1 | If built | FR-024 acceptance criteria | P1 |

## 4. Integration milestones (checkpoints)

Each checkpoint is a fixed window in which A and B sit together. Person C runs the acceptance tests on the **integration/demo laptop** (§6) and records pass or fail on the board.

| ID | When | Scope | Acceptance tests (all must pass) | If it fails |
|---|---|---|---|---|
| **IC-0** | Day 1, 09:45 | Contract freeze and setup | P0 contract frozen; fixtures committed; component library chosen; Gemini smoke call with `store=false` works with the dev key; backend and frontend skeletons start on all three laptops | Fix before Sprint 1 continues; C escalates |
| **IC-1** | Day 1, 12:00–12:30 | Auth, profiles, health, consent | Sign in as Meera, Karthik and Ravi on the real backend; logout revokes; Karthik sees two profiles with the correct roles; Ravi opening Meera's profile URL sees Access denied; health banner is real; TC-AUTH-01 to 04; TC-ACC-01 | Pair until green; Sprint 2 starts late by at most 15 min |
| **IC-2** | Day 1, 16:30–16:50 | Documents and extraction | E2E-01; DOC-4 ambiguous date and Haemoglobin flagged; DOC-7 shows `NO_TEXT_LAYER`; duplicate gives 409; polling responsive; first MET-01 reading | If extraction isn't live: integrate list and viewer now, extraction in the IC-3 window; C flags it as a G1 risk |
| **IC-3** | Day 1, 18:30–18:45 | Review and timeline: **golden path #1** | E2E-02, E2E-03 with all mocks off; DOC-6 flagged; recorded responses replace clean fixtures | G1 marks the day "amber" or "red" (execution schedule §4) |
| **G1** | Day 1, 18:45–19:00 | Day-1 gate | Tag `d1-stable`; `snapshot-G1`; rough backup video; 10-minute storyline dry run; P1 contract frozen | Day-2 cut set chosen at G2 |
| **IC-4** | Day 2, 12:00–12:20 | Brief, narrative, Ask, Visit Assist, read-aloud | E2E-04, E2E-05, E2E-10, E2E-09 (read-aloud); `AI_MODE=off` quick drill; backup video #2; accessibility audit #2 | Apply cut ladder steps 8 or 9 if needed; Visit Assist never cut |
| **IC-5** | Day 2, 14:15–14:30 | Family and reminders; **feature freeze** | E2E-06, E2E-07 (and E2E-08 if booking was built); `cache_only` drill | Unfinished P1 hidden from navigation |
| **IC-6** | Day 2, 15:45 | **Code freeze** | Demo Definition of Done D1–D7 ([../srd/14-definition-of-done.md](../srd/14-definition-of-done.md) §3); tag `demo-v1`; `snapshot-demo` restore verified | Only demo-blocking fixes during rehearsal 1 |

**Integration deadline:** every feature shown in the demo must be integrated by **IC-5 (14:15, Day 2)**. Anything later is hidden.

## 5. Contract-change policy

| Change type | Examples | Allowed when | Procedure |
|---|---|---|---|
| **Additive** | New optional response field; new endpoint; new enum value the UI can ignore | Any time before IC-6 | B updates the contract and fixture in **the same commit**, adds a changelog row (minor version, for example 1.1.0) and posts in the `#contract` thread. A adopts when convenient (clients ignore unknown fields). |
| **Breaking** | Rename or remove a field; change a type or nullability; change a route; change status-code meaning | Before IC-4 only, and only if unavoidable | B proposes in `#contract` with the reason → **A acknowledges** → C records the decision → B keeps the old field or route working alongside the new one until A switches (same day) → changelog (major version) → C re-runs the affected tests |
| **Emergency (demo blocker)** | A bug that needs a contract change after IC-4 | Only to fix a demo-blocking defect | As for breaking changes, plus C's explicit approval; re-test the full golden path |

Hard rules:
- No silent changes; the contract key test (BE-15.1) runs after every contract edit.
- The frontend never "works around" a contract mismatch without telling B.
- Disagreements follow §8.

## 6. Environments, branching and releases

| Environment | Where | Runs | Gemini key | Data | Owner |
|---|---|---|---|---|---|
| DEV-B | Person B's laptop | Backend from feature branches | **dev** project | Dev database (reset as needed) | B |
| DEV-A | Person A's laptop | Frontend dev server (mocks per feature); backend from `main` for integration | **dev** project | Seeded dev database | A |
| INT / DEMO | Person C's laptop (DEC-18) | Frontend production build plus backend from `main` at each checkpoint; from `demo-v1` for the demo | **demo** project | `snapshot-demo` for rehearsals and the demo | C |

- **Fallback if Person A can't run the backend locally:** point the dev proxy at Person B's laptop. Venue Wi-Fi often blocks traffic between devices, so use a phone hotspot for the LAN.
- **Why separate projects:** Gemini quotas are counted per project, so development and evaluation traffic can't use up the demo's quota.
- **Branching:**
  - `main` is always runnable. Short-lived branches are named with task IDs (`fe/FE-4.1-timeline`, `be/BE-6.2-timeline`).
  - Merge after self-test and before each checkpoint. Light review: the other developer or C looks at anything touching contracts or auth.
  - No force-push to `main`. `contracts/` is changed only by B.
- **Tags:** `d1-stable` (G1) and `demo-v1` (IC-6). If something breaks after IC-6, demo from `demo-v1` plus `snapshot-demo`.

## 7. End-to-end tests

Person C runs these manually, using scripted steps, on the INT/DEMO laptop. Automation is optional and never blocks a freeze. Data is from [synthetic-demo-data-pack.md](synthetic-demo-data-pack.md).

| ID | Covers (your list) | Steps | Expected result | Checkpoint |
|---|---|---|---|---|
| **E2E-01** | 1. Upload a synthetic medical document | Sign in as Meera → Records → upload `rx_lakeview_sep2026.pdf` (DOC-5) → watch the stages | Row appears as "Waiting to be read"; stages progress; reaches "Ready — please review" within 30 s typically; dashboard count +1 | IC-2 |
| **E2E-02** | 2. Extract and verify information | Open DOC-5 → check the 9 facts against the answer key → bulk confirm → open DOC-4 → confirm the date 04 May 2026 through Edit → correct one value and undo → reject one fact and undo | Facts match the answer key; every fact shows its source line and page; bulk confirm confirms the high-confidence facts; the ambiguity banner clears; history kept | IC-3 |
| **E2E-03** | 3. Source-linked medical timeline | Open Timeline → check order → toggle "Include unverified" → click the Metformin 1000 mg event | Events in date order; change markers "500 mg → 1000 mg" and "8.4 % → 7.6 %" (from IC-4); unverified items hide with the toggle off; the event opens DOC-5 at page 1 with the fact highlighted | IC-3 (markers IC-4) |
| **E2E-04** | 4. Ask a question about stored records | Ask Q-01, Q-05, Q-08, S-01, S-06 | Q-01 cited answer (7.6 %); Q-05 uncertainty with both sources; Q-08 not-found; S-01 emergency card with no model call; S-06 advice redirect with metformin lines and a template question; every citation opens the right line | IC-4 |
| **E2E-05** | 5. Evidence-grounded summary | Brief → Create → wait for the narrative → open 3 citations → print preview → correct a fact → reopen the brief | Sections render in about 1 s; points to clarify show the metformin difference and the allergy conflict; missing information shows the follow-up and lab range; narrative labelled AI-generated with citations; print fits 2 A4 pages or fewer; stale banner after the correction | IC-4 |
| **E2E-06** | 6. Family profile without unauthorised exposure | Window 1: Meera → Family → grant Karthik "View records" and "Reminders" (or use the seeded grant). Window 2: Karthik → profiles → open Meera → try Upload → paste Ravi's profile URL. Window 1: remove Karthik. Window 2: navigate. Window 1: access log | Karthik sees two profiles with correct badges; no Upload control; Ravi's URL shows Access denied; after removal, Karthik's next navigation shows Access denied; the log shows grant, revoke and denied entries without medical content | IC-5 |
| **E2E-07** | 7. Create or view a reminder | Meera → Reminders → "Suggested from your documents" → create from the DOC-5 follow-up (pick 27 Oct 2026, 10:00) → view → mark done | Reminder shows "27 Oct 2026, 10:00 IST" and a source link; Done moves it to completed; the brief's follow-up gap disappears after a new brief | IC-5 |
| **E2E-08** | 8. Appointment suggestions or mock booking | **If built:** Appointments → reason "diabetes review" → choose Demo Endocrinology Clinic A → slot → tick "ISL interpreter" → book. **If cut:** confirm the Appointments item is hidden and the pitch doesn't mention booking as working | If built: categories with citations; "Simulated" everywhere; confirmation uses COPY-16 and never "confirmed". If cut: no trace in the UI | IC-5 |
| **E2E-09** | 9. Voice support, if implemented | Read aloud on the brief → stop. If speech input is built: microphone → speak Q-03 → edit the transcript → Send; deny the microphone in a second run | Read-aloud plays and stops; citations read as "source: …". Speech: transcript editable and not auto-sent; the request has `input_mode` voice; denial shows COPY-22 and typing still works | IC-4 (read-aloud), IC-5 (speech) |
| **E2E-10** | 10. Supported sign-language capability without over-claiming | Ravi → Visit Assist → choose the ISL statements → Show to staff (sound off) → print preview → Glossary: "thyroid", "medicine" → switch the browser offline → open a term → About tab | Card shows the chosen statements plus key facts with sources, full screen and high contrast; print on 1 page; videos show attribution; offline shows COPY-18b; About shows COPY-17; **no screen claims translation** | IC-4 |

## 8. Decision owners and conflict resolution

| Area | Decision owner | Consulted | Examples |
|---|---|---|---|
| Scope, priorities, cut ladder, demo content, copy wording | **Person C** | A, B | Promote or cut a P1 item; change COPY text |
| API contract, data model, AI pipeline, prompts, safety patterns | **Person B** | A (contract), C (safety) | Field names; validator thresholds |
| UX, layout, component library, client behaviour | **Person A** | C | Navigation structure; component choices |
| Test pass or fail, Definition of Done, "Verified" status | **Person C** | A, B | Whether a feature can be shown |
| Demo machine, snapshots, rehearsals | **Person C** | B (snapshots) | Which laptop presents |

**Conflict rule:** discuss for at most **10 minutes**, then the area owner decides and Person C records the decision on the board. If the decision affects schedule or scope, Person C has the final say. The recorded decision log starts with DEC-01 to DEC-22 in [../srd/01-executive-summary.md](../srd/01-executive-summary.md).

**Open decisions at kickoff (and who closes them):**

| Decision | Owner | Deadline |
|---|---|---|
| Component library (DEC-19) | A | IC-0 |
| Is preparing assets before the event allowed? (ASM-01) | C | Before the event |
| Exact hackathon start, freeze and judging times | C | Before the event; shift the schedule if needed |
| Demo laptop confirmed (DEC-18) | C | G1 |
| Final emergency-number wording verified (DEC-21) | C | Before the event |

## 9. Communication cadence

| When | What | Length |
|---|---|---|
| Day 1, 09:00 | Kickoff: scope lock, contract walk-through, IC-0 | 45 min |
| Day 1, 13:00 / 16:50 | Stand-up: blockers only | 5 min |
| Each checkpoint | A and B pair; C tests | 15–30 min |
| Day 1, 18:45 | G1 gate | 15 min |
| Day 2, 09:00 | G2 gate: choose the cut set | 20 min |
| Day 2, 12:45 | Stand-up | 5 min |

**Channels:** one team chat with three threads: `#contract` (changes, questions), `#bugs` (C triages and assigns one owner per bug), `#demo` (script, timing, assets).
**Board columns:** Backlog → In progress → Mock-ready / BE-ready → Integrated → Verified → Done.
