# Backend Sprint 3 — Day 1, 16:50–18:30 → IC-3 and G1

> Person B. Full task details are in [backlog.md](backlog.md).

**Goal:** review actions, the timeline and injection screening, completing the **document-to-timeline workflow**. Then the consistency rules, if extraction is stable.

**Entry criteria:** IC-2 passed (live extraction).

## Tasks in order (100 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | BE-5.5 Validation: remaining checks | 5 | Value and strength present in the cited lines |
| 2 | BE-5.6 Injection screening (AG-03) | 10 | Exclude flagged lines from every model input |
| 3 | BE-6.1 Fact review: patch and bulk (API-15, 16) | 20 | Transitions and history |
| 4 | BE-4.4 Reprocess and document metadata patch (API-13, 14) | 15 | |
| 5 | BE-6.2 Timeline builder and endpoint (API-17) | 25 | `change: null` for now |
| 6 | BE-7.1 Consistency and gap rules (AG-07) | 25 | **Only if extraction accuracy is ≥ 90 %.** Otherwise spend this time on extraction prompt fixes and move BE-7.1 to the start of Sprint 4. |

## What Person A needs from you

| By | Endpoint |
|---|---|
| 18:30 | API-13, API-14, API-15, API-16, API-17 |

## Exit criteria (IC-3, 18:30–18:45)

1. **Golden path #1 with mocks off:** upload DOC-5 → bulk confirm → set DOC-4's date → timeline in correct order → event opens its source.
2. Reject and undo work; rejected facts disappear from the timeline.
3. DOC-6 is flagged, and its line p1-l5 is absent from the extraction input (unit test).
4. Person C records extraction accuracy (MET-01) and checks every sample document's facts against the answer key.

## G1 actions (18:45–19:00)

1. Commit and push; Person C tags `d1-stable`.
2. Copy the database and storage folder as-is to **`snapshot-G1`** (the source for the golden-cache export; see the demo data pack §9).
3. Confirm the P1 contract freeze (API-22 to API-33) with Persons A and C.
4. Write the "Day 2 first hour" note: which of BE-7.1, BE-6.3 or extraction fixes come first.

## Cuts at this gate (G1)

Person C maps the outcome to a cut set for G2 ([../hackathon/execution-schedule.md](../hackathon/execution-schedule.md) §4).
