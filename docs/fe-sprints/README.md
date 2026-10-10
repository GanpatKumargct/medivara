# Frontend Sprints — Person A Quick-Start

You own the MediVara frontend: architecture, UX, screens, navigation, accessibility, client-side validation, API integration and responsive design. You build against **mock responses** until each backend feature is ready, then switch to the real API at the integration checkpoints.

## 1. Read first (in this order, about 60 minutes before the event)

1. [../srd/02-scope-and-priority-matrix.md](../srd/02-scope-and-priority-matrix.md): what is P0, P1, P2, and the cut ladder.
2. [../srd/10-ui-screen-spec.md](../srd/10-ui-screen-spec.md): every screen, its states, and the **copy deck** (§19).
3. [../srd/11-api-contract.md](../srd/11-api-contract.md): read API-01 to API-21 closely (they freeze at 09:45 on Day 1); skim API-22 to API-33.
4. [backlog.md](backlog.md): your tasks, with estimates and acceptance criteria.
5. [../hackathon/integration-plan.md](../hackathon/integration-plan.md): the mock rules and the checkpoint tests.
6. [../srd/14-definition-of-done.md](../srd/14-definition-of-done.md): what "done" means.

## 2. Pre-event homework

- [ ] Node LTS and a package manager installed; Chrome and Edge updated.
- [ ] Read API-01 to API-21 and note any question for Person B before IC-0.
- [ ] Decide the component library (shadcn/ui recommended; Mantine acceptable) and tell the team (DEC-19).
- [ ] Python 3.11+ installed, so you can run the backend locally from `main` during integration (see integration plan §6).
- [ ] Check which speech voices Chrome lists as local on your laptop.

## 3. Sprint map

| Sprint | Window | Focus | Ends with |
|---|---|---|---|
| [Sprint 1](sprint-1-day1-am.md) | Day 1 09:45–12:00 | Scaffold, design foundation, mocks, shell, login | **IC-1:** real sign-in |
| [Sprint 2](sprint-2-day1-pm.md) | Day 1 13:00–16:30 | States, onboarding, dashboard, records, upload, viewer, review panel | **IC-2:** real upload and extraction |
| [Sprint 3](sprint-3-day1-eve.md) | Day 1 16:50–18:30 | Review actions, evidence drawer, timeline | **IC-3:** golden path #1; **G1** |
| [Sprint 4](sprint-4-day2-am.md) | Day 2 09:20–12:00 | Brief, narrative, print, Visit Assist, Ask, read-aloud | **IC-4:** brief and Ask real |
| [Sprint 5](sprint-5-day2-mid.md) | Day 2 12:45–14:15 | Family sharing, reminders | **IC-5:** feature freeze |
| [Sprint 6](sprint-6-stabilise.md) | Day 2 14:15–15:45 | Accessibility, responsive, mocks off, bug fixes | **IC-6:** code freeze |

Planned load: P0 about 12.2 h, P1 about 2.0 h, against about 14.5 h available. There is little slack. If you fall behind, tell Person C early; the cut ladder protects the core demo.

## 4. Rules

**Do**
- Use copy deck strings verbatim (FE-1.5).
- Show every state the screen spec lists: loading, empty, error, success, plus the special states.
- Hide controls based on `my_role` and `scopes`, and still handle 403 gracefully.
- Keep the token in memory and session storage only; never put it in a URL.
- Name branches and commits with task IDs (for example `fe/FE-3.5-review-panel`).

**Don't**
- Build backend logic, database code, AI calls or authorisation in the browser.
- Compute medical meaning: no inconsistency rules, no "normal" or "abnormal" colouring, no date interpretation of document content.
- Hardcode document or fact IDs (they differ between uploads and fixtures).
- Mix mocked login with real features after IC-1.
- Ship anything with the "MOCK DATA" badge visible.

## 5. Mock guardrails (summary; full list in the integration plan)

- Fixtures in `contracts/` are copied from the contract and owned by Person B. Never edit them by hand; ask Person B.
- Use per-feature toggles (`VITE_MOCK_FEATURES`). Switch each feature to real at its checkpoint.
- Exercise slow, failure, empty and degraded scenarios for every screen.
- After IC-2 and IC-3, replace the clean fixtures with responses recorded from the real backend.

## 6. Decision owners you'll need

| Question | Owner |
|---|---|
| API shape or field meaning | Person B (contract owner) |
| Scope, priority, cuts, copy wording | Person C |
| UX, layout, component choices | You (Person A), reviewed by Person C |

Disputes are timeboxed to 10 minutes, then the owner decides.

## 7. Using these docs in a coding session

Give your coding assistant the sprint sheet and the documents it references. For example: *"Implement FE-3.5 as specified in docs/fe-sprints/backlog.md, using screen SCR-06 in docs/srd/10-ui-screen-spec.md and the fixtures for API-11 and API-15 in docs/srd/11-api-contract.md. Use the copy deck verbatim. Don't add backend logic."* Then check the acceptance criteria yourself before marking the task done.
