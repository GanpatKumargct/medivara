---
name: verify
description: How to run and drive MediVara (PM2 stack + Postgres + Playwright) to verify a change at its real surfaces, including the model path without a live OpenRouter key.
---

# Verifying MediVara

## Stack (already set up on this machine)
- Postgres: `docker compose up -d` (container `medivara-postgres`, 127.0.0.1:5433, user/db `medivara`).
- `pm2 start ecosystem.config.cjs` → backend :8000, frontend :5173 (Vite proxies `/api/v1`), Prisma Studio :5555 (read-only role).
- Health through the frontend: `curl -s http://127.0.0.1:5173/api/v1/health`.
- Demo logins (all `MediVara-Demo-2026`): meera.demo@, karthik.demo@, ravi.demo@, fresh.test@ (needs onboarding) `@medivara.test`.
- Synthetic PDFs: `demo-data/pdfs/` (DOC-4 = `lab_sunrise_may2026.pdf`: ambiguous date, 5 facts).

## Never touch the user's data
Create a throwaway DB and point a separate backend at it:
```bash
docker exec medivara-postgres psql -U medivara -d medivara -c "CREATE DATABASE medivara_verify"
cd backend && DATABASE_URL=postgresql+psycopg://medivara:medivara_local_dev@127.0.0.1:5433/medivara_verify \
  STORAGE_DIR=<scratch>/files uv run python -m app.seed reset
```
Drop it afterwards. Tests use `medivara_test`; never point anything at `medivara`.

## Model path without a key (and without sending data out)
Run a local stand-in for OpenRouter's `/api/v1/chat/completions` (record requests to a file, answer from
`backend/tests/fake_model.py` CANNED for `DOCUMENT_START` inputs, quote matching evidence lines for Ask),
then run the real backend on :8000 (stop PM2's first: `pm2 stop medivara-backend`):
```bash
DATABASE_URL=…/medivara_verify STORAGE_DIR=<scratch>/files OPENROUTER_API_KEY=sk-or-verify-local \
OPENROUTER_BASE_URL=http://127.0.0.1:8899/api/v1 GEMINI_RETRY_BACKOFF_S=0.3 \
uv run --frozen uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```
Probes worth driving via the stand-in: 429 then 200 (retry, attempts 2), `finish_reason: content_filter`
(→ AI_BLOCKED, 1 attempt), 401 (→ Ask `degraded` with evidence lines, 1 attempt). Emergency prompts must make
no request at all. Restore with `pm2 restart medivara-backend`.

## Driving the UI (Playwright MCP)
- Upload: click the drop zone button (name starts "Drop a PDF here"), then `browser_file_upload`.
  The `Choose File` input is visually hidden; clicking it times out.
- Wait for "5 to review" (DOC-4) / "4 to review" (DOC-1); failures show "Try again".
- Ask: type into textbox "Your question" with submit.
- Screenshots must be saved under the repo (`.playwright-mcp/…`); delete `.playwright-mcp/` afterwards.

## Gotchas
- Don't `pkill -f <pattern>` from the Bash tool: it matches its own shell. Find PIDs by port (`ss -ltnp`).
- `npx tsc -b` rewrites tracked `Frontend/tsconfig*.tsbuildinfo`; restore with `git checkout --` if it runs.
- Backend app logs go to `logs/backend.err.log` (Python logs to stderr).
