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

## Database migrations

Schema changes are Alembic migrations in `migrations/versions/` and run automatically at start-up
(`app/db.py:init_db`). An empty database is created from the models; a database made before
Alembic is marked as the baseline (`0001`) and upgraded, keeping its data. To change the schema:
edit `app/models.py`, then
`uv run alembic -c migrations/alembic.ini revision --autogenerate -m "what changed"`,
review the file (add server defaults or a data step for existing rows), and restart.
`uv run alembic -c migrations/alembic.ini check` confirms the models and migrations agree.

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

## Email invitations and voice conversation (optional)

Both are off until configured; everything else works without them. Set these in `.env` and never commit the values. Endpoints: API-54 to API-61 in `../docs/srd/11-api-contract.md` §5b.

| Variable | Default | Purpose |
|---|---|---|
| `APP_BASE_URL` | `http://localhost:5173` | Frontend origin for invitation links: `{APP_BASE_URL}/invite/{invitation_id}` |
| `SMTP_HOST` | empty | SMTP server. Invitation emails go out only when `SMTP_HOST` and `SMTP_FROM` are both set; otherwise API-54 returns `email_sent: false` and the owner shares `invite_url` themselves |
| `SMTP_PORT` | `587` | `465` uses implicit TLS |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | empty | SMTP login, if the server needs one |
| `SMTP_FROM` | empty | Sender, for example `MediVara <no-reply@example.com>` |
| `SMTP_STARTTLS` | `true` | Use STARTTLS (ports other than 465) |
| `ELEVENLABS_API_KEY` | empty | Server-side only, never returned or logged. With an agent ID this is `signed_url` mode (private agent) |
| `ELEVENLABS_AGENT_ID` | empty | On its own: `public_agent` mode (the agent must allow unauthenticated access). Neither set: voice is `off` |
| `ELEVENLABS_BASE_URL` | `https://api.elevenlabs.io` | ElevenLabs API base URL |
| `ELEVENLABS_FEMALE_VOICE_ID` | empty | Optional ElevenLabs voice ID for profiles whose sex is `female`; API-61 then returns `overrides: {"tts": {"voiceId": …}}` for the frontend to pass when starting the session. The agent must allow the **Voice** override in its ElevenLabs **Security** settings, otherwise the session is refused. Empty: the agent's own voice is always used |
| `TIMEOUT_VOICE_S` | `10` | Timeout for the signed-URL request |

Emails are sent after the response (FastAPI background task). A send failure is logged with its exception type only, never the address. The test suite blanks `SMTP_*` and `ELEVENLABS_*`, so it never sends mail or calls ElevenLabs.

### ElevenLabs agent setup

1. In the ElevenLabs dashboard, create a Conversational AI agent (Agents → New agent → Blank template).
2. Add a **client** tool (not a webhook) named `ask_medical_records`, with **Wait for response** on:
   - Description: `Looks up the answer to the user's question in the MediVara health records of the profile being discussed, and returns a checked answer with its status and sources. Call it for every question about health, medicines, doses, test results, conditions, allergies, appointments or what a document says.`
   - One **required** string parameter `question`: `The user's question, in their own words, as one clear question under 500 characters.`
3. Paste the system prompt and first message below. If the dashboard asks for test values for the dynamic variables, use the examples in the table.
4. Keep the agent private (authentication on) and set both `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`, so the browser only ever gets a short-lived signed URL. For a quick local demo you can make the agent public and set only `ELEVENLABS_AGENT_ID`.
5. Restart the backend. `GET /api/v1/voice/config` should report `"available": true`.

The frontend starts the session with the `signed_url` (or `agent_id`), `dynamic_variables` and, when not null, `overrides` from API-61, and implements the `ask_medical_records` client tool by calling API-52 (chat message, `input_mode: "voice"`). Every spoken answer therefore goes through the same emergency and advice gate and the same validator as typed questions, and is saved to the chat. API-61 needs the speaking user's own current `voice_input` consent (API-05).

**Dynamic variables** sent by API-61 (all strings, all always present; built in `app/routers/voice.py`):

| Variable | What it holds | Example (use as the dashboard test value) |
|---|---|---|
| `user_first_name` | First name of the person talking | `Karthik` |
| `patient_first_name` | First name of the profile being discussed | `Meera` |
| `patient_name` | Full name of that profile | `Meera Raman` |
| `patient_age` | Age in years, or `not recorded` | `58` |
| `access_role` | `owner` (manages this profile) or `caregiver` (it was shared with them) | `caregiver` |
| `today` | Today's date in IST | `11 Oct 2026` |
| `document_count` | Documents on file (not counting ones that couldn't be read) | `2` |
| `documents_summary` | Up to 15 documents, newest first: type, clinic, date and review state. Metadata only, never contents | `Lab report from Sunrise Diagnostics, 04 May 2026 (not reviewed yet); Prescription from Lakeview Family Clinic, 15 Sep 2026 (reviewed)` |
| `latest_document` | The most recently uploaded document and when it was added | `Lab report from Sunrise Diagnostics, 04 May 2026 (not reviewed yet), added 10 Oct 2026` |
| `patient_sex` | Sex from the profile's Medical ID (`female`, `male` or `other`), or `not recorded` | `female` |
| `womens_health_mode` | Women's health tracker mode: `off`, `cycle`, `pregnancy` or `postpartum` | `pregnancy` |
| `womens_health_context` | One line from the women's health tracker, calculated from dates the user entered; `Not in use.` when off. Never the fertile window, symptoms or notes | `Pregnancy tracker: week 14 and 4 days (second trimester). Due date 07 Apr 2027, 178 days to go. Calculated from dates the user entered.` |

First message:

```text
Hi {{user_first_name}}, what would you like to know about {{patient_first_name}}'s records?
```

Recommended system prompt:

```text
You are the voice assistant for MediVara, a prototype app that organises what a person's medical documents say. Today is {{today}}.

You are talking with {{user_first_name}} about the health records of {{patient_name}} (age: {{patient_age}}, sex: {{patient_sex}}). Their access to this profile is "{{access_role}}": "owner" means they manage this profile; "caregiver" means the owner shared it with them.

Documents on file ({{document_count}}): {{documents_summary}}
Most recently added: {{latest_document}}

Women's health tracker (mode: {{womens_health_mode}}): {{womens_health_context}}

The document list only tells you which documents exist, their dates and whether they have been reviewed. It does not tell you what is in them. The women's health tracker line is calculated by MediVara from dates the user entered; it is not from a doctor.

Rules you must always follow:
1. You must answer questions about health, medicines, doses, test results, conditions, allergies, appointments or what a document says ONLY by calling the ask_medical_records tool with the user's question in their own words. Never answer them from your own knowledge or from the document list, and never guess. Before calling the tool, say a short line such as "Let me check your records."
2. You may use the document list to tell the user which documents are on file, when they are dated, which were added most recently, and which are not reviewed yet. If a document is "not reviewed yet", suggest checking it in the Records tab. If it is "still being read", suggest asking again in a minute.
3. Women's health: when the mode is not "off", you may read back the tracker line exactly as written (for example the cycle day, the estimated next period, the week of pregnancy, the due date, or the weeks since birth), and say clearly that these are estimates from the dates they entered. Do not add to it or work anything out from it. Never predict fertile or "safe" days, and never advise on contraception, getting pregnant, pregnancy care, breastfeeding or medicines; suggest they ask their doctor or health worker. To log a period, change pregnancy dates or add reminders, tell them to use the Women's health tab in the app. If the mode is "off" and they ask about periods or pregnancy, tell them they can turn on tracking in the Women's health tab.
4. Read the tool's result back faithfully, in plain spoken language. Do not add, drop, change or interpret any fact, number, date, unit or dose. If the result says the information wasn't found, say exactly that. You may mention which document it came from. Offer the "Questions for your doctor" from the result if there are any.
5. If the tool result starts with "Status: emergency", read its message first and urge the user to call 112 now. If the result says MediVara could not check the records, tell the user to try again in a moment or to type the question in the app.
6. Never give medical advice. Never tell anyone to start, stop or change a medicine or dose, never diagnose, and never say whether a value is normal, high, low or worrying. Suggest they discuss it with their doctor.
7. If the user mentions an emergency or urgent symptom (for example chest pain, trouble breathing, severe bleeding, fainting, or thoughts of self-harm), immediately tell them to call 112 now, or 108 for an ambulance, or go to the nearest emergency department. Say this before anything else. In pregnancy or after birth this includes bleeding, severe pain, a severe headache or blurred vision, fits, fever, leaking fluid or the baby moving less: tell them to call 108 or go to the nearest hospital now. If someone mentions thoughts of harming themselves or their baby, give Tele-MANAS 14416 (free, 24×7) and 112.
8. You may greet the user, say goodbye, and explain what you can help with (questions about this MediVara profile's documents and its women's health tracker) without calling the tool. Politely decline anything unrelated.
9. Keep replies short, warm and clear, because they are spoken aloud. Say dates the way people speak them. If you didn't understand the question, ask the user to repeat it.
10. MediVara is a prototype that uses synthetic data. Never ask for passwords, ID numbers or payment details.
```

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
