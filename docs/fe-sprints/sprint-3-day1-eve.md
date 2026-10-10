# Frontend Sprint 3 — Day 1, 16:50–18:30 → IC-3 and G1

> Person A. Full task details are in [backlog.md](backlog.md).

**Goal:** complete the review actions and build the source-linked timeline, so the **document-to-timeline golden path** works end to end on Day 1.

**Entry criteria:** IC-2 passed (upload → extraction → review read view on the real backend).

## Tasks in order (95 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | FE-3.6 Bulk confirm, document details edit, flag banners | 20 | COPY-13, COPY-28, COPY-11 banners |
| 2 | FE-4.3 Evidence drawer (shared) | 15 | Reused by the timeline, brief and Ask |
| 3 | FE-4.1 Timeline view (SCR-07) | 35 | Values and dates only in change markers |
| 4 | FE-4.2 Timeline filters, unverified toggle, deep links | 15 | Event → SCR-06 at the right page |
| 5 | FE-10.3 AI status banner and badges | 10 | |

**17:30:** Person C runs accessibility audit #1 on SCR-01, 02, 04, 05 and 06. Keep working; the fixes come in Sprint 4 (FE-12.1).

## Dependencies on Person B

| Needed by | Backend task | Endpoint |
|---|---|---|
| 18:30 | BE-6.1 | API-15, API-16 |
| 18:30 | BE-4.4 | API-13, API-14 |
| 18:30 | BE-6.2 | API-17 (`change` may be null until Day 2) |
| 18:30 | BE-5.6 | DOC-6 flagged |

## Mocks to use until IC-3

`API-15.200`, `API-16.200`, `API-17.200`, `API-11.200.suspicious`, `API-11.200.cached`.

## Exit criteria (IC-3, 18:30–18:45, task FE-11.3)

1. **Golden path #1 with all mocks off:** sign in as Meera → upload DOC-5 → review (bulk confirm) → open DOC-4 → confirm the ambiguous date through Edit → the timeline shows the events in order → clicking an event opens the source page.
2. Reject one fact: it disappears from the timeline; Undo brings it back.
3. DOC-6 shows the suspicious-content banner.
4. Clean fixtures are replaced with responses recorded from the real backend (realistic mock data for Day 2 work).

## G1 actions (18:45–19:00, the whole team)

- Tag `d1-stable`.
- Person B captures snapshot G1.
- Person C records a rough backup video of the golden path and runs a 10-minute storyline dry run.
- P1 contract frozen.

## If ahead

Start FE-8.2 (ISL glossary; frontend-only), or FE-4.4 (brief) on mocks.

## Cuts at this gate (G1)

Decided by Person C using the cut ladder in [../srd/02-scope-and-priority-matrix.md](../srd/02-scope-and-priority-matrix.md) §7. If the golden path is not green, Day 2 starts with all hands on P0 (G2 "red").
