# Frontend Sprint 5 — Day 2, 12:45–14:15 → IC-5 and feature freeze

> Person A. Full task details are in [backlog.md](backlog.md).

**Goal:** family sharing with visible scopes and instant revoke, then reminders. These follow the mandated order: access control first, then the reminder flow.

**Entry criteria:** IC-4 passed, or the IC-4 cut decision has been made.

## Tasks in order (90 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | FE-2.5 Profile selector and family dashboard (SCR-03) | 10 | Karthik sees two cards |
| 2 | FE-6.1 Role- and scope-aware UI | 10 | One helper decides control visibility |
| 3 | FE-6.2 Family sharing screen (SCR-14) | 30 | COPY-25 consent; COPY-26 confirmation |
| 4 | FE-6.3 Access log tab | 10 | Cut step 6 if short of time |
| 5 | FE-9.1 Reminders list, complete, dismiss (SCR-12) | 15 | "IST" labels |
| 6 | FE-9.2 Reminder form and create from follow-up | 15 | The user chooses the date; COPY-24 for medication |

## Dependencies on Person B

| Needed by | Backend task | Endpoint |
|---|---|---|
| 14:15 | BE-9.1 | API-23, API-24, API-25 |
| 14:15 | BE-9.2 | API-26 |
| 14:15 | BE-10.1 | API-27 to API-30 |

## Mocks to use until IC-5

`API-06.200` (caregiver view), `API-23.200`, `API-24.201`, `API-26.200`, `API-27.200`, plus the API-28 request and response examples.

## Exit criteria (IC-5, 14:15–14:30, task FE-11.5 at the start of Sprint 6)

1. **E2E-06:** Meera's window shows Karthik with "View records" and "Reminders". Karthik's window shows Meera's profile with a "Shared with you" badge and no Upload. Karthik opens Ravi's profile URL and gets Access denied. Meera removes Karthik. Karthik's next navigation shows Access denied. The access log shows grant, revoke and denied entries.
2. **E2E-07:** create a reminder from DOC-5's follow-up suggestion. It shows "IST" and a source link. Mark it done.

## Feature freeze at 14:15

- No new features after this point. Anything not integrated and verified is **hidden from navigation**: Appointments, Settings and speech input, unless they are done.
- Only bug fixes, accessibility fixes, responsive fixes and polish happen in Sprint 6.

## If ahead (before 14:15 only)

FE-7.2 and FE-7.3 (speech input), FE-9.3 (notifications), FE-3.8 (delete), FE-10.4 (settings), FE-9.4 (appointments, only if BE-11 is done).

## Cuts at this gate

Ladder steps 3 to 7 as needed: speech input → reminder extras → reminders → access log → family sharing. Person C decides at 13:45 if the sprint is visibly behind.
