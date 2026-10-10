# Backend Sprint 4 — Day 2, 09:20–12:00 → IC-4

> Person B. Full task details are in [backlog.md](backlog.md). This sprint is on the **critical path**.

**Goal:** the deterministic Consultation Brief (early), then the shared generator and validator, the narrative, and Ask.

**Entry criteria:** G2 decision (green, amber or red, with its cut set).

## Tasks in order (145 min + 15 min buffer)

| Order | Task | Est | Notes |
|---|---|---|---|
| 0 | BE-7.1 Consistency and gap rules | (25) | Only if not finished in Sprint 3; it then uses the buffer and part of task 7's slack |
| 1 | BE-2.4 Brief and AI output models | 5 | |
| 2 | BE-6.3 Timeline change markers | 5 | Reuses AG-07 |
| 3 | BE-7.2 Brief assembler and endpoints (API-18, 19) | 30 | **Integrate with Person A by about 10:30** |
| 4 | BE-7.3 Evidence context assembly (AG-10) | 15 | Patient filter inside the query |
| 5 | BE-7.4 Grounded generator (AG-11) | 20 | `ask-v1`, `narrative-v1` |
| 6 | BE-8.2 Citation and safety validator (AG-12) | 30 | Calibrate with Person C's evaluation results |
| 7 | BE-7.5 Narrative endpoint (API-20) | 10 | 25 s limit |
| 8 | BE-8.1 Intent gate (AG-09) | 10 | Fixed copy, no model call |
| 9 | BE-7.6 Ask endpoint (API-21) | 20 | 20 s limit, evidence-only fallback |

## What Person A needs from you

| By | Endpoint |
|---|---|
| About 10:30 | API-18, API-19 (brief without narrative) |
| 12:00 | API-20, API-21; `change` markers in API-17 |

## What Person C needs from you

Ask running by about 11:15, so Person C can run the evaluation questions Q-01 to Q-15, S-01 to S-10 and I-01 to I-03, and report false rejections before IC-4.

## Exit criteria (IC-4, 12:00–12:20)

1. **E2E-05:** the brief contains the four planted findings; the narrative is validated and labelled; the brief shows stale after a fact correction.
2. **E2E-04:** answered, advice redirect, emergency and not-found all work against the real backend.
3. With `AI_MODE=off`, Ask returns `degraded` with evidence lines and the narrative returns `unavailable`. Quick drill with Person C.
4. AIOutput rows hold the evidence snapshot and validation report.

## Lunch window after IC-4

Person C builds the demo starting state on the demo laptop. You run the reset and snapshot commands there (3 minutes): **`snapshot-demo`**.

## If ahead

BE-5.7 (golden cache), then BE-9.1.

## Cuts at this gate (IC-4)

If Ask is unstable at 12:00, Person C may apply ladder step 8 first (templated overview instead of the narrative) to free time for Ask. Step 9 (cut Ask) is a last resort.
