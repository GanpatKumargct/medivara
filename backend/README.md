# MediVara backend

FastAPI service for the MediVara hackathon prototype. Specs: `../docs/srd/11-api-contract.md` (API), `../docs/srd/07-data-model.md` (data), `../docs/be-sprints/backlog.md` (tasks).

## Run

1. Install [uv](https://docs.astral.sh/uv/).
2. `cd backend`
3. `uv sync` (installs Python 3.11 dependencies, pinned in `uv.lock`)
4. `cp .env.example .env`, then set `OPENROUTER_API_KEY` (models run through OpenRouter, default `google/gemini-2.5-flash`; never commit the key)
5. `docker compose up -d` at the repo root (PostgreSQL 16 on `127.0.0.1:5433`), then `uv run python -m app.seed reset` (wipes and seeds the demo users; needs `DEMO_MODE=true`)
6. `uv run uvicorn app.main:app --reload --port 8000 --no-access-log` (our own allow-list log replaces uvicorn's, which would print raw paths and query strings)
7. Open Swagger at http://localhost:8000/api/v1/docs, call `POST /auth/login` with `meera.demo@medivara.test` / `MediVara-Demo-2026`, then use **Authorize** with the token.

## Test

`uv run pytest` runs on throwaway SQLite files (fast). To run the same suite on PostgreSQL:
`TEST_DATABASE_URL=postgresql+psycopg://medivara:medivara_local_dev@127.0.0.1:5433/medivara_test uv run pytest`.
Every test wipes that database, so only a database named `*_test` is accepted.

## Database

- **PostgreSQL** when `DATABASE_URL` is set (the default in `.env.example`); container `medivara-postgres`, volume `medivara-pgdata`.
- **SQLite** at `DATABASE_PATH` when `DATABASE_URL` is empty (tests, or no Docker).
- **Browse it:** Prisma Studio, read-only, at http://localhost:5555 (`../db-studio/README.md`).
- **Shell:** `docker exec -it medivara-postgres psql -U medivara -d medivara`.
- The SQLModel models in `app/models.py` own the schema (created on startup). Snapshots
  (`app.snapshot`) work on either engine and can move data between them.

## Synthetic demo PDFs

`uv run python ../demo-data/make_pdfs.py` writes DOC-1 to DOC-7, RDOC-1, RDOC-2 and KDOC-1 to `../demo-data/pdfs/` from the data pack. Upload them through Swagger or the frontend. Tests generate them in memory.

## Golden cache (degraded-mode safety net)

After the sample PDFs have been extracted live and checked against the answer key (G1), run
`uv run python -m app.pipeline.golden_cache export`. It writes one file per sample listed in
`../demo-data/manifest.json` into `golden_cache/` (synthetic, safe to commit). When Gemini fails,
or with `AI_MODE=cache_only` / `off`, uploads of those exact files use the saved reading,
labelled "Cached result".

## Demo snapshots (FR-006)

- Save: `uv run python -m app.snapshot save G1` (or `demo`); safe while the server runs.
- Restore: stop the backend, then `uv run python -m app.snapshot restore demo`, start it again and check `/api/v1/health`. Target under 2 minutes.
- List: `uv run python -m app.snapshot list`. Snapshots live in `snapshots/` and are never committed.

## Failure drills (AI mode)

Restart the backend with one variable changed; nothing else is needed:
- `AI_MODE=off`: no model calls. Timeline and brief work, the narrative stays templated, Ask shows matching lines only, known sample files use the golden cache.
- `AI_MODE=cache_only`: extraction from the golden cache only, labelled "Cached result".
- `AI_MODE=live`: normal.

## Evaluation run (Person C)

With the demo state loaded and the server running: `uv run python scripts/eval_run.py http://127.0.0.1:8000 eval-run.csv`. It runs Q-01–Q-15, S-01–S-10, I-01/I-02 (5 runs each) and X-01/X-02, checks statuses automatically and leaves `correct` and `false_rejection` for you to judge.

## Contract fixtures

`python3 ../scripts/extract_fixtures.py` regenerates `../contracts/` from the API contract, and `python3 ../scripts/derive_fixtures.py` builds the 7 fixtures the contract describes only in prose. Only Person B edits fixtures, in the same commit as any contract change.

## Demo accounts

| Email | Role |
|---|---|
| `meera.demo@medivara.test` | Patient (owner of `pat_meera`) |
| `karthik.demo@medivara.test` | Owner of `pat_karthik`; caregiver on `pat_meera` (view, reminders) |
| `ravi.demo@medivara.test` | Deaf ISL user (owner of `pat_ravi`) |
| `fresh.test@medivara.test` | No consents; onboarding tests only |

All use the password `MediVara-Demo-2026`. All data is synthetic.
