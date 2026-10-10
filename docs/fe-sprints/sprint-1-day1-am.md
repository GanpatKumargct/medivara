# Frontend Sprint 1 — Day 1, 09:45–12:00 → IC-1

> Person A. Full task details are in [backlog.md](backlog.md). Checkpoint tests are in [../hackathon/integration-plan.md](../hackathon/integration-plan.md) §4.

**Goal:** a running app shell with design foundations, a mock layer, and **real sign-in** by the end of the sprint.

**Entry criteria (IC-0, 09:45):**
- P0 contract v1.0 frozen.
- Fixtures copied into `contracts/` (Person C) and reviewed (Person B).
- Component library confirmed (DEC-19).
- Branch rules agreed.

## Tasks in order (135 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | FE-1.1 Project scaffold and conventions | 25 | Set up the dev proxy to the backend immediately |
| 2 | FE-1.2 Design tokens and base components | 20 | Badges with text and icon from the start |
| 3 | FE-1.3 API client, session handling, error envelope | 20 | Session storage, not local storage |
| 4 | FE-1.4 MSW mock layer, fixtures, scenarios, mock badge | 25 | Per-feature toggles; pass-through for unmocked routes |
| 5 | FE-1.5 Copy deck module | 5 | Paste the copy deck verbatim |
| 6 | FE-2.1 App shell, routing, header, footer | 20 | Patient ID in routes; "Aa" menu; sign-out |
| 7 | FE-2.2 Login and demo entry (SCR-02) | 20 | Demo cards submit through API-02 |

## Dependencies on Person B

| Needed by | Backend task | Endpoint |
|---|---|---|
| 12:00 | BE-3.1 | API-02, API-03, API-04 |
| 12:00 | BE-3.3 | API-06, API-07 |
| 12:00 | BE-1.2 | API-01 |
| 12:30 (during IC-1) | BE-3.4 | API-05 |

## Mocks to use until IC-1

`API-01.200`, `API-02.200`, `API-02.401`, `API-04.200`, `API-06.200`, `API-07.200`, `API-07.403` and the shared error fixtures.

## Exit criteria (IC-1, 12:00–12:30, task FE-11.1)

1. Sign in as Meera, Karthik and Ravi against the **real** backend (mock toggles for auth and patients off).
2. The header shows the real profile name and role badge.
3. Karthik's profile list contains two profiles with the correct roles. (The UI may still go straight to the first profile; SCR-03 comes in Sprint 5.)
4. Opening `/p/pat_meera` while signed in as Ravi shows the Access denied page.
5. Sign-out revokes the session (the old token returns 401).
6. The health banner reads the real API-01.

**Never mock login after IC-1 passes.**

## If ahead

Start FE-10.1 (system-state components), then FE-2.3 (onboarding).

## Cuts at this gate

None. Everything in Sprint 1 is foundational P0.
