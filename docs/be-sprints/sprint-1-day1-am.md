# Backend Sprint 1 — Day 1, 09:45–12:00 → IC-1

> Person B. Full task details are in [backlog.md](backlog.md). Checkpoint tests are in [../hackathon/integration-plan.md](../hackathon/integration-plan.md) §4.

**Goal:** a running FastAPI service with the error envelope, core models, seeded demo users, real authentication, the access guard, and patient endpoints.

**Entry criteria (IC-0, 09:45):**
- P0 contract frozen.
- Fixtures copied and reviewed (BE-1.3).
- One live Gemini smoke call with `store=false` succeeded using the dev key.
- Paid billing and the budget alert confirmed.

## Tasks in order (135 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | BE-1.1 Service scaffold: settings, request IDs, error envelope, safe logging | 25 | Example environment file committed; real one excluded |
| 2 | BE-1.2 Health endpoint and AI mode switch (API-01) | 10 | |
| 3 | BE-2.1 Core models and SQLite (WAL) | 25 | User, Session, PatientProfile, PatientAccessGrant, ConsentRecord, AuditEvent |
| 4 | BE-2.2 Seed and demo reset command | 10 | Fixed IDs, including `usr_fresh` |
| 5 | BE-3.1 Login, logout, me (API-02, 03, 04) | 30 | Opaque token, stored hashed |
| 6 | BE-3.2 Access guard and audit writer | 15 | Grant, scope, resource binding |
| 7 | BE-3.3 Patients list and detail (API-06, 07) | 20 | Stats are zero until documents exist |

During the IC-1 window: BE-3.4 consent endpoint (10 min) plus integration support (20 min).

## What Person A needs from you

| By | Endpoint |
|---|---|
| 12:00 | API-01, API-02, API-03, API-04, API-06, API-07 running locally, plus the README run steps |
| 12:30 | API-05 |

`main` must start with a fresh clone, the example environment file and one command, so Person A and Person C can run it.

## Exit criteria (IC-1, 12:00–12:30)

1. Meera, Karthik and Ravi sign in through the frontend against your backend.
2. Karthik's `GET /patients` returns two profiles with `my_role` and `scopes` correct.
3. Ravi calling `GET /patients/pat_meera` gets 403 `ACCESS_DENIED`, and an `access.denied` audit row exists.
4. Logout makes the token return 401 `SESSION_EXPIRED`.
5. `usr_fresh` shows `onboarding_required: true`; API-05 records the consents.
6. Person C runs TC-AUTH-01 to TC-AUTH-04 and TC-ACC-01 in Swagger.

## If ahead

BE-2.3 (document models).

## Cuts at this gate

None. Sprint 1 is foundational P0.
