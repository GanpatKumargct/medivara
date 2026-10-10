# Backend Sprint 5 — Day 2, 12:45–14:15 → IC-5 and feature freeze

> Person B. Full task details are in [backlog.md](backlog.md).

**Goal:** the golden-cache safety net, then caregiver sharing and reminders, in the mandated order.

**Entry criteria:** IC-4 passed, or the cut decision has been made.

## Tasks in order (90 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | BE-5.7 Golden cache (fallback plus exporter from `snapshot-G1`) | 15 | P0 safety net for the live upload in the demo |
| 2 | BE-9.1 Access list, grant, revoke (API-23, 24, 25) | 30 | Owner only; `sharing` consent; immediate effect |
| 3 | BE-9.2 Audit events list (API-26) | 10 | `action_label`, no PHI |
| 4 | BE-2.5 Reminder model | 5 | |
| 5 | BE-10.1 Reminders endpoints and timezone logic (API-27 to 30) | 30 | 10:00 IST is stored as 04:30Z |

## What Person A needs from you

| By | Endpoint |
|---|---|
| 14:15 | API-23 to API-30 |

## Exit criteria (IC-5, 14:15–14:30, together with Person A)

1. **E2E-06:** grant, scoped view, Access denied for a foreign profile, revoke takes effect on the next request, access log entries.
2. **E2E-07:** a reminder created from the DOC-5 follow-up, with "IST" display, then completed.
3. With `AI_MODE=cache_only`, uploading DOC-5 gives the cached facts with the "Cached result" label.

## Feature freeze at 14:15

No new endpoints after this point. Anything unfinished stays out of the demo (its routes may stay in the code but are not linked from the UI).

## If ahead (before 14:15 only)

BE-4.6 (delete), BE-4.5 (sample import), BE-11.1 and BE-11.2 (simulated booking).

## Cuts at this gate

Ladder steps 4 to 7: reminder extras → reminders → access log → family sharing. Person C decides at 13:45 if this sprint is visibly behind. The golden cache (task 1) is never skipped.
