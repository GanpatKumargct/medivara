# Two-Day Hackathon Execution Schedule

> Owner: **Person C**. Task IDs refer to [../fe-sprints/backlog.md](../fe-sprints/backlog.md) and [../be-sprints/backlog.md](../be-sprints/backlog.md); checkpoints to [integration-plan.md](integration-plan.md) §4.

## 1. Assumptions

- Both days run 09:00–19:00 (about 10 hours). Judging starts about **17:30 on Day 2** (ASM-02).
- **If the real times differ, shift every block by the same offset.** If judging is earlier, shorten Sprint 5 first, never the rehearsals.
- Roles during the demo: **Person C narrates**, **Person A drives the UI** (both browser windows), **Person B** handles technical questions and operates the backups (snapshot restore, AI mode switch).
- Lunch is a real break. People drink water, and step away from the screen at least once each afternoon.

## 2. Day 1 — Foundations and the document-to-timeline workflow

| Time | Objective | Person A (frontend) | Person B (backend/AI) | Person C (product/integration/QA) | Required output | Dependency or risk | Exit criteria |
|---|---|---|---|---|---|---|---|
| 09:00–09:45 | **Lock scope and contracts (IC-0)** | Walk through SCR and API-01 to 21; confirm the component library (DEC-19); scaffold starts | Confirm the contract; Gemini smoke call with `store=false` (dev key); confirm billing; pin SDK version | Run kickoff; confirm P0 and the cut ladder; **copy fixtures into `contracts/`** (09:00–09:30); set up the board with task IDs | P0 contract frozen; fixtures committed; board live | Contract questions not resolved before the event | IC-0 checklist passed |
| 09:45–11:00 | Skeletons (Sprint 1a) | FE-1.1, FE-1.2, FE-1.3 | BE-1.1, BE-1.2, BE-2.1 | Final synthetic PDFs to B **by 10:30** (if not prepared earlier); set up the INT/DEMO laptop (clone, install, run `main`) | Running app shell; running API with envelope and health | PDF creation late → B can't inspect the line output | Both services start from `main` |
| 11:00–12:00 | Auth and patients (Sprint 1b) | FE-1.4, FE-1.5, FE-2.1, FE-2.2 | BE-2.2, BE-3.1, BE-3.2, BE-3.3 | Answer-key spreadsheet in the fact contract format; IC-1 test script; Swagger permission-matrix template | Real login endpoints; frontend login on mocks | Auth bugs | Sign-in works in Swagger |
| 12:00–12:30 | **IC-1: first real integration** | FE-11.1 (switch auth and patients to real) | BE-3.4 (consent) plus support | Run TC-AUTH-01 to 04 and TC-ACC-01 on the INT laptop | Login real for all three users | Proxy or session issues | IC-1 tests pass (by 12:45 at the latest) |
| 12:30–13:00 | Lunch | | | | | | |
| 13:00–14:00 | Repository foundations (Sprint 2a) | FE-10.1, FE-10.2, FE-2.3, FE-2.4 | BE-2.3, BE-4.1, BE-5.1 | **Realistic document-detail fixtures for DOC-1 to DOC-5 by 13:30**; copy audit of SCR-01 and SCR-02 | Upload endpoint; state components; dashboard | Fixture quality | Upload returns 202 in Swagger |
| 14:00–15:00 | Upload and lines (Sprint 2b) | FE-3.1, FE-3.2, FE-3.3 | BE-5.2, BE-4.2, BE-4.3 | Check that ISL glossary links play on the venue network; demo script v1; slides outline | Line extraction; documents list and detail | PyMuPDF line grouping on tables | DOC-1 lab rows appear as single lines |
| 15:00–16:30 | **Extraction (Sprint 2c), critical path** | FE-3.4, FE-3.5 | BE-5.3 (start by 14:45 at the latest), BE-5.4, BE-5.5 | **Extraction evaluation as soon as AG-04 runs (target 15:45)**; log defects to B | Live Gemini extraction with confidence | Gemini latency or quota; prompt quality | MET-01 first reading |
| 16:30–16:50 | **IC-2: documents live** | FE-11.2 | Support | Run E2E-01 and TC-DOC-01, 05, 06 | Real upload → facts in the UI | Extraction late → integrate list and viewer now, extraction at IC-3 | IC-2 tests pass |
| 16:50–17:30 | Review actions and timeline (Sprint 3a) | FE-3.6, FE-4.3 | BE-5.5 (last part), BE-5.6, BE-6.1 | Permission matrix part 2 (documents and facts, IDOR) in Swagger | Fact actions live | Transition bugs | TC-ACC-02, 03, 09 pass |
| 17:30–18:30 | Timeline (Sprint 3b) | FE-4.1, FE-4.2, FE-10.3 | BE-4.4, BE-6.2, BE-7.1 (if extraction ≥ 90 %) | **Accessibility audit #1 at 17:30** (SCR-01, 02, 04, 05, 06); write E2E-01 to 03 scripts | Timeline endpoint and UI | Extraction tuning steals time from BE-7.1 | Timeline renders real data |
| 18:30–18:45 | **IC-3: golden path #1** | FE-11.3 | Support | Run E2E-01, 02, 03 with **all mocks off**; record real responses for fixture replacement | Document-to-timeline workflow on the real backend | Any red item | E2E-01 to 03 pass |
| 18:45–19:00 | **G1 gate** | Push; note Day-2 first task | Push; **`snapshot-G1`**; confirm the P1 contract | Tag `d1-stable`; record a rough backup video; 10-minute storyline dry run; choose the provisional G2 cut set | Stable tag, snapshot, video | Fatigue | Gate status recorded (green, amber or red) |

## 3. Day 2 — AI summary, Ask, access control, accessibility and the demo

| Time | Objective | Person A (frontend) | Person B (backend/AI) | Person C (product/integration/QA) | Required output | Dependency or risk | Exit criteria |
|---|---|---|---|---|---|---|---|
| 09:00–09:20 | **G2 gate** | Agree the plan | Agree the plan | Confirm the cut set (§4); update the board | Day-2 plan | Day-1 debt | Cut set recorded |
| 09:20–10:30 | **Brief first (Sprint 4a)** | FE-12.1, FE-4.4, FE-4.5, FE-4.6 | (BE-7.1 if left over), BE-2.4, BE-6.3, BE-7.2 | Evaluation spreadsheet (Q, S, I, X lists); slides draft (problem, solution, architecture, safety, roadmap) | Brief API ready by about 10:30 | Rules not finished on Day 1 | Brief API returns real sections |
| 10:30–11:15 | Accessibility and Ask UI (Sprint 4b) | FE-8.1, FE-8.2, FE-5.1 | BE-7.3, BE-7.4, BE-8.2 | **Early brief integration test** (E2E-05 sections); copy audit of the brief | Visit Assist UI; generator and validator | Validator over-blocking | Brief shows the four planted findings |
| 11:15–12:00 | Ask complete (Sprint 4c) | FE-5.2, FE-5.3, FE-7.1 | BE-7.5, BE-8.1, BE-7.6 | **Run Q-01 to 15, S-01 to 10, I-01 to 03**; mark false rejections → B (MET-03, 04, 05) | Ask and narrative live | Gemini latency; validator tuning | 12 of 15 correct; 10 of 10 safe |
| 12:00–12:20 | **IC-4: brief, Ask, Visit Assist live** | FE-11.4 | Support; `AI_MODE=off` quick drill | Run E2E-04, 05, 10 and E2E-09 (read-aloud); **accessibility audit #2**; **backup video #2** | P0 complete on the real backend | Ask unstable → cut steps 8 or 9 | IC-4 tests pass |
| 12:20–12:45 | Lunch (A, B) · demo snapshot (C) | Lunch | Lunch (runs the reset and snapshot commands on the INT laptop, 3 min) | Build the **demo starting state** on the INT laptop → **`snapshot-demo`**. C eats from 12:45. | `snapshot-demo` | Building the state takes longer than planned | Restore tested once |
| 12:45–13:45 | **Family and reminders (Sprint 5a)** | FE-2.5, FE-6.1, FE-6.2 | BE-5.7, BE-9.1, BE-9.2 | Prepare E2E-06 and 07; demo script v2 with timings; judge Q&A notes | Sharing live | Scope bugs | Grant and revoke work in Swagger |
| 13:45–14:15 | Reminders (Sprint 5b) | FE-6.3, FE-9.1, FE-9.2 | BE-2.5, BE-10.1 | **13:45 decision:** apply cuts if Sprint 5 is behind (§4) | Reminders live | Timezone bugs | Reminder created and listed |
| 14:15–14:30 | **IC-5 · feature freeze · integration deadline** | FE-11.5 | Support (BE-15.2) | Run E2E-06, 07 (and 08 if built); `cache_only` drill; **declare the feature freeze**; list of features to hide → A | Everything shown in the demo is integrated | Late P1 | Freeze declared |
| 14:30–15:15 | Stabilise (Sprint 6a) | FE-12.2, FE-12.3 | BE-3.5, BE-8.3, BE-15.1 | **Full E2E run (E2E-01 to 10)** on the INT laptop; triage bugs with one owner each | Bug list with owners | Many bugs at once → fix demo blockers first | All demo blockers assigned |
| 15:15–15:45 | Stabilise (Sprint 6b) | FE-12.4, FE-12.5 | BE-14.1, BE-14.2, BE-14.3, BE-15.3 | **Final backup video**; TC-SEC-04 and 05 with B; final slides | Video and slides | Recording fails → re-record at 15:50 | Video saved on two devices |
| 15:45 | **IC-6: code freeze** | Stop coding | Stop coding | Tag `demo-v1`; restore `snapshot-demo`; check the demo Definition of Done (D1–D7) | Frozen build | Last-minute fixes | D1–D7 ticked |
| 15:45–16:00 | Demo machine prep | Browser profiles for two windows; zoom 110 %; notifications off | Prepare the backup laptop (A's) with `demo-v1`, `snapshot-demo` and the demo key | Run the demo-machine checklist ([readiness-checklist.md](readiness-checklist.md) §5) | Machine ready | Display or adapter issues | Checklist complete |
| 16:00–16:35 | **Rehearsal 1** (timed) | Drive | Answer technical questions; time the segments | Narrate; note issues | Timing per segment | Over 4.5 min → trim the script | Within 4:45 |
| 16:35–16:40 | Critical fixes only | Only if trivial and re-tested | Only if trivial and re-tested | Approve or reject each fix | | Regressions | No new bugs |
| 16:40–17:15 | **Rehearsal 2 (final)** plus failure drill and Q&A drill | Drive | Run the drill: restore snapshot; switch to `AI_MODE=off`, then back | Narrate; then 5 minutes of judge questions | Confidence | | Clean run and a successful drill |
| 17:15–17:30 | Buffer and submission | Restore `snapshot-demo` | Check the API and health | Submit the repository link, video and slides as required | Submission done | Submission portal issues | Confirmation received |
| ≈17:30 | **Judging** | | | | | | |

## 4. Gates and pre-agreed cut sets

Cut ladder steps refer to [../srd/02-scope-and-priority-matrix.md](../srd/02-scope-and-priority-matrix.md) §7.

| Gate | Status | Meaning | Action |
|---|---|---|---|
| **G1 / G2** (Day 1, 18:45 / Day 2, 09:00) | **Green** | IC-3 passed with mocks off | Plan as scheduled |
| | **Amber** | IC-3 partly passed (for example, extraction is flaky, or review actions are incomplete) | B spends the first 45 min of Sprint 4 fixing it. **Cut now:** steps 1–3 (OCR, booking, speech input); no pull-in items. A continues on mocks. |
| | **Red** | The golden path is broken (no live extraction or no timeline) | **All hands on P0 until 11:00:** A pairs on integration, C tests continuously. **Cut now:** steps 1–7. Day 2 delivers the P0 workflow, Visit Assist and read-aloud. Isolation is shown with two accounts. |
| **IC-4** (Day 2, 12:00) | Brief or Ask not integrated | | Step 8 (templated overview instead of the narrative). If Ask is still failing at 12:20, step 9. Sprint 5 then does family sharing only (step 5: reminders cut). |
| **13:45 decision** | Sprint 5 visibly behind | | Cut in order: step 6 (access log), step 4 (reminder extras), step 5 (reminders), step 7 (family sharing). |
| **IC-5** (14:15) | Anything not integrated | | Hidden from navigation; not mentioned as working |

## 5. Freezes and deadlines

| Milestone | When |
|---|---|
| P0 contract freeze (IC-0) | Day 1, 09:45 |
| First real integration (IC-1) | Day 1, 12:00 |
| Golden path #1 (IC-3) | Day 1, 18:30 |
| P1 contract freeze (G1) | Day 1, 18:45 |
| P0 complete on the real backend (IC-4) | Day 2, 12:00 |
| **Integration deadline and feature freeze (IC-5)** | **Day 2, 14:15** |
| **Code freeze (IC-6)** | **Day 2, 15:45** |
| **Final rehearsal** | **Day 2, 16:40–17:15** |
| Submission | Day 2, by 17:30 |

## 6. Backup demo plan

| Backup | Prepared when | Owner | How it's used |
|---|---|---|---|
| **Backup video** (full storyline, captions on) | Rough at G1; #2 at IC-4; **final at 15:15 on Day 2** | C | Play it if the live demo fails beyond recovery. Saved on the demo laptop, the backup laptop and a phone. |
| **`snapshot-demo`** | Day 2, 12:20–12:45 | C (B runs the commands) | Restore in under 2 minutes before each run, or mid-demo if data goes wrong |
| **Degraded-mode demo path** | Drilled at IC-4 and rehearsal 2 | B | Gemini down: live upload uses the golden cache (labelled), the brief is deterministic, Ask shows evidence only. The narrator explains (script in [demo-and-judging-strategy.md](demo-and-judging-strategy.md) §9). |
| **Phone hotspot** | Tested on Day 1 | C | Venue Wi-Fi fails |
| **Backup laptop** (Person A's) | 15:45–16:00 on Day 2 | B | The demo laptop fails: switch display and restore `snapshot-demo` |
| **Screenshot slides** (key screens) | With the final slides | C | Last resort, if neither laptop works |

## 7. Rehearsal protocol

1. Restore `snapshot-demo`. Check the health endpoint and the AI status, confirm the mock badge is absent, and sign in to both windows (Meera, Karthik).
2. Run the 4.5-minute storyline with a timer, recording time per segment.
3. Run 5 minutes of judge questions (C reads questions from the strategy document; B and A answer).
4. **Failure drill (rehearsal 2 only):** B switches `AI_MODE=off` and restarts. A repeats the upload and Ask segments. The narrator uses the degraded-mode lines. Then B switches back to `live`.
5. Restore `snapshot-demo` again. Note any change needed; only C can approve a change after code freeze.

## 8. Before the event

| When | Who | What |
|---|---|---|
| T−3 days | All | Read the role reading lists (sprint READMEs, hackathon README) |
| T−3 days | B | Gemini dev and demo projects, paid Tier-1 billing, budget alert, model IDs and SDK version checked |
| T−3 days | C | Check the hackathon rules on preparing assets beforehand (ASM-01); confirm the event times; create the synthetic PDFs and answer key, and curate the ISL glossary (if allowed) |
| T−2 days | All (30 min) | Contract question session → final v1.0; A decides the component library |
| T−2 days | C | Re-verify the emergency numbers (112, 108, Tele-MANAS 14416) and the ISL video embedding terms |
| T−1 day | All | Install toolchains; test-clone the repository; charge devices; test the phone hotspot; check the HDMI or USB-C adapter for the venue display |
