# Backend Sprint 1 — Checklist

> Status of [sprint-1-day1-am.md](sprint-1-day1-am.md) on branch `be/BE-1.1-sprint1-foundation`. Last checked 2026-10-10.
> Legend: **[x]** done and verified · **[~]** done, with a note · **[ ]** open (owner shown).
> Automated evidence: `cd backend && uv run pytest` → 30 passed.

## Entry criteria (IC-0)

- [x] P0 contract read; no changes needed for Sprint 1 endpoints.
- [~] Fixtures (BE-1.3): `scripts/extract_fixtures.py` wrote 34 files (32 endpoint + 2 shared errors) into `contracts/`. Still to hand-derive from prose: `API-11.200.ready`, `.failed-no-text-layer`, `.suspicious`, `.cached`; `API-19.200`; `API-21.200.withheld`, `.out-of-scope`. First needed: API-11 variants (Sprint 2), API-19 (Sprint 4).
- [ ] Live Gemini smoke call with `store=false` using the dev key — **Person B**; needs the key in `backend/.env`.
- [ ] Paid Tier-1 billing and budget alert confirmed — **Person B**.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| BE-1.1 Scaffold: settings, request IDs, error envelope, safe logging | [x] | `app/config.py`, `errors.py`, `middleware.py`; tests: 404 / 422 / 400 / 500 envelopes, `X-Request-ID`, no body or password in logs |
| BE-1.2 Health and AI mode switch (API-01) | [x] | `routers/health.py`, `ai_state.py`; test for `live`, `cache_only`, `off` |
| BE-1.3 Contract fixtures | [~] | See entry criteria |
| BE-2.1 Core models, SQLite WAL | [x] | `app/models.py`, `db.py`; partial unique index on active grants |
| BE-2.2 Seed and demo reset | [x] | `uv run python -m app.seed reset`; refuses without `DEMO_MODE=true`; fixed IDs incl. `usr_fresh`, `grt_karthik_meera` |
| BE-3.1 Login, logout, me (API-02, 03, 04) | [x] | `routers/auth.py`, `app/auth.py`; argon2 passwords; SHA-256 token hashes; 12 h expiry |
| BE-3.2 Access guard and audit writer | [x] | `app/access.py` (`require_access`, `load_owned`), `app/audit.py` |
| BE-3.3 Patients list and detail (API-06, 07) | [x] | `routers/patients.py`; stats are zeros until documents exist |
| BE-3.4 Consent endpoint and AI-consent check (API-05) | [x] | `routers/auth.py`, `app/consents.py` (`require_ai_consent` for API-08) |

## Exit criteria (IC-1)

- [ ] 1. Meera, Karthik and Ravi sign in **through the frontend** — **Person A + B** at IC-1 (backend side verified via tests and curl).
- [x] 2. Karthik's `GET /patients` returns two profiles with correct `my_role` and `scopes`.
- [x] 3. Ravi → `GET /patients/pat_meera` gives 403 `ACCESS_DENIED` and an `access.denied` audit row.
- [x] 4. Logout makes the token return 401 `SESSION_EXPIRED`.
- [x] 5. `usr_fresh` shows `onboarding_required: true`; API-05 records the consents.
- [ ] 6. Person C runs TC-AUTH-01 to 04 and TC-ACC-01 in Swagger on the INT laptop — **Person C** (automated equivalents pass).

## Definition of Done (backend, B1–B9)

- [x] B1 Contract shape: key test against fixtures for API-01, 02, 04, 05, 06, 07.
- [x] B2 Server-side validation on every field (email/password lengths, consent enum, policy version).
- [x] B3 Access guard on patient-scoped routes, with the scope and owner-only rules tested.
- [x] B4 Failure behaviour: all error codes from the contract used where applicable.
- [x] B5 Audit events: `auth.login`, `auth.login_failed`, `auth.logout`, `consent.recorded`, `access.denied`.
- [x] B6 No PHI in logs (allow-list formatter; run uvicorn with `--no-access-log`); secrets only from `.env` (git-ignored).
- [—] B7 Gemini wrapper: not applicable until BE-5.3.
- [—] B8 No contract changes made.
- [ ] B9 Merge to `main` through the task branch — **Person B** (not committed yet).

## Notes and deviations

- Unknown patient IDs return 403 `ACCESS_DENIED` (not 404), so profile IDs can't be probed.
- Routers carry the `/api/v1` prefix themselves: this FastAPI version does not expose included-router prefixes in route templates, which the safe log needs.
- Timestamps are timezone-aware UTC (required by the pinned SQLModel); SQLite returns them naive and `as_utc()` normalises.
- Swagger lives at `/api/v1/docs` so it works through the Vite proxy.
