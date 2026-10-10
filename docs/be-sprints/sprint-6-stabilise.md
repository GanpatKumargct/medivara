# Backend Sprint 6 — Day 2, 14:15–15:45 → IC-6 code freeze

> Person B. Full task details are in [backlog.md](backlog.md). **No new features.**

**Goal:** prove isolation, safety and privacy with tests and checks, and fix the bugs Person C assigns.

**Entry criteria:** feature freeze declared at 14:15.

## Tasks in order (90 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | BE-15.2 IC-5 integration support | 15 | Together with Person A |
| 2 | BE-3.5 Isolation and IDOR test suite | 20 | About 6 cases; all must pass |
| 3 | BE-8.3 Validator and gate unit tests | 10 | |
| 4 | BE-15.1 Contract key test | 10 | API-01 to API-21 |
| 5 | BE-14.1 Log hygiene and PHI check | 10 | Search the logs after a full run |
| 6 | BE-14.2 AI failure-drill support | 10 | `off` and `cache_only` verified on the demo laptop |
| 7 | BE-14.3 Security headers and upload hardening check | 5 | |
| 8 | BE-15.3 Bug-fix buffer | 10 | Only bugs Person C assigns to Person B |

## Rules for this sprint

- No contract changes. A demo-blocking fix that needs one requires Person A's acknowledgement and a changelog entry.
- From 15:30, only demo-blocking fixes are merged.
- Prompt or pattern-list changes are frozen, unless Person C's evaluation shows an unsafe output.

## Exit criteria (IC-6, 15:45)

- The pytest suite passes (isolation, validator, contract keys).
- TC-SEC-04 (no PHI in logs) and TC-SEC-05 (no secrets) pass on the demo laptop.
- The degraded-mode drill passes.
- `snapshot-demo` restores in under 2 minutes.
- Person C tags `demo-v1`.

## After code freeze

Rehearsal 1 (16:00): critical fixes only, re-tested before merging. Rehearsal 2 (16:40): no changes.
