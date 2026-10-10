# Frontend Sprint 6 — Day 2, 14:15–15:45 → IC-6 code freeze

> Person A. Full task details are in [backlog.md](backlog.md). **No new features.**

**Goal:** a stable, accessible, responsive demo build with mocks completely off.

**Entry criteria:** feature freeze declared at 14:15.

## Tasks in order (90 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | FE-11.5 IC-5 integration: access, audit, reminders | 15 | Together with Person B |
| 2 | FE-12.2 Accessibility fixes from audit #2 and keyboard pass | 20 | Golden path with the keyboard only |
| 3 | FE-12.3 Responsive pass (360–1440 px) | 20 | Plus 200 % zoom |
| 4 | FE-12.4 Mocks-off verification, production build, bundle secret check | 10 | No mock badge; no key patterns in the build |
| 5 | FE-12.5 Bug-fix buffer | 25 | Only bugs Person C assigns to Person A |

## Rules for this sprint

- Every change fixes a logged bug or an accessibility, responsive or polish item. No refactors.
- Each fix is re-tested by Person C on the demo laptop before merging.
- From 15:30, only demo-blocking fixes are merged.

## Exit criteria (IC-6, 15:45)

- Demo Definition of Done D1–D7 ([../srd/14-definition-of-done.md](../srd/14-definition-of-done.md) §3), frontend parts:
  - golden path three times in a row with mocks off;
  - degraded-mode drill shows the banner and the evidence-only states;
  - features that aren't ready are hidden.
- Build tagged `demo-v1` (by Person C).

## After code freeze

- **16:00–16:35 rehearsal 1:** fix only critical bugs, on a branch, merged only if trivial and re-tested.
- **16:40–17:15 rehearsal 2:** no changes at all.
