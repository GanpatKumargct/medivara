# 14 — Definition of Done

> SRD section 5.14. Owner: **Person C** (verifies). Applies to every task in [../fe-sprints/backlog.md](../fe-sprints/backlog.md) and [../be-sprints/backlog.md](../be-sprints/backlog.md).
> "Done" means demonstrably working against the real backend, not only "code written". Person C marks a feature **Verified** at an integration checkpoint.

## 1. Task-level Definition of Done

### Frontend task (Person A)

| # | Criterion | How it is checked |
|---|---|---|
| F1 | The screen or component matches its SCR specification, including every listed state (loading, empty, error, success, and any special states) | Person C walks through the states using MSW scenarios |
| F2 | Copy comes from the copy deck module, verbatim | Spot check against [10-ui-screen-spec.md](10-ui-screen-spec.md) §19 |
| F3 | Client-side validation mirrors the contract; server field errors display under their fields | Submit invalid input |
| F4 | Works against the real endpoint with mocks off for that feature (once the backend is ready) | Integration checkpoint |
| F5 | Controls hidden according to `my_role` and `scopes` | Sign in as Karthik |
| F6 | Keyboard operable, visible focus, labelled controls, no colour-only meaning | Keyboard pass; axe scan shows no critical or serious issues |
| F7 | Usable at 360 px and 1440 px | Responsive check |
| F8 | No console errors; no question text, document text or tokens logged to the console | Browser console during the walkthrough |
| F9 | Merged to `main` through a short-lived branch named with the task ID | Git history |

### Backend task (Person B)

| # | Criterion | How it is checked |
|---|---|---|
| B1 | Request and response match the contract exactly (keys, types, nulls, status codes, error codes) | Contract key test (BE-15.1); compare with the fixture |
| B2 | Server-side validation for every field listed in the contract | Swagger "try it out" with invalid input |
| B3 | Access guard applied: grant, scope, resource binding, owner-only actions | Permission matrix rows for the endpoint pass (TC-ACC) |
| B4 | Defined failure behaviour implemented (error codes, degraded responses, document failure codes) | Failure scenario from the backlog task |
| B5 | Audit events written for the actions in the audit list | Inspect the audit table or API-26 |
| B6 | No PHI in logs; secrets only from the environment | Log inspection after exercising the endpoint |
| B7 | Gemini calls (if any) go through the wrapper with `store=false`, timeout, retry and block detection | Code review |
| B8 | Fixture updated in the same commit if the contract changed (with a changelog entry and Person A's acknowledgement) | Contract changelog |
| B9 | Merged to `main` through a short-lived branch named with the task ID | Git history |

## 2. Feature-level Definition of Done (verified by Person C)

A feature, meaning an FR or a group of FRs, is **Done** when:

1. Every acceptance criterion in its FR passes on the integrated build.
2. Its frontend and backend tasks meet their task-level DoD.
3. Its entry in the integration handoff table is **Verified** ([../hackathon/integration-plan.md](../hackathon/integration-plan.md) §3).
4. Its test cases pass ([../hackathon/test-plan.md](../hackathon/test-plan.md)), including at least one failure path.
5. Its security checks pass: unauthorised access returns 403 or 404 and is audited; no PHI is logged.
6. Its error states are visible and use the copy deck; no raw errors appear.
7. Labels are honest: anything simulated, cached, AI-generated or unverified is labelled.
8. It can be demonstrated in under 60 seconds following the demo script.

## 3. Demo-level Definition of Done (before code freeze, IC-6)

| # | Criterion |
|---|---|
| D1 | The golden path (E2E-01 to E2E-05, E2E-10) passes three times in a row on the demo laptop with mocks off |
| D2 | The failure drill passes: with `AI_MODE=off`, the timeline and brief work, Ask shows evidence only, and the banner appears |
| D3 | Every P1 feature shown in the demo has passed its E2E test; features not ready are hidden from navigation |
| D4 | The demo snapshot restores in under 2 minutes and was restored successfully at least once |
| D5 | The backup video is recorded from the current build |
| D6 | The honesty checklist in [../hackathon/readiness-checklist.md](../hackathon/readiness-checklist.md) is fully ticked |
| D7 | The `demo-v1` tag points to the build being demonstrated |

## 4. What "not done" looks like (common traps)

- The screen works only with mocks. → Not done.
- The happy path works, but errors show raw text or a blank screen. → Not done.
- The endpoint returns data for another patient's resource IDs. → Not done, and a demo blocker.
- The AI answer is shown without citations, or with a broken citation. → Not done, and a demo blocker.
- A simulated booking or a cached extraction is not labelled. → Not done, and a demo blocker.
- The feature works but isn't in the demo script and hasn't been verified. → Hide it from navigation before the freeze.
