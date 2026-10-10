# 06 — System Architecture and Data Flow

> SRD section 5.6. Owners: **Person B** (backend and overall architecture), **Person A** (frontend architecture). Reviewed by Person C.
> Descriptions only. No implementation files belong here.

## 1. Architecture diagram

```text
┌──────────────────────────────── Browser (Chrome / Edge on the demo laptop) ────────────────────────────────┐
│  React + TypeScript single-page app (Vite)                                                                │
│   • Screens SCR-01…16 · shared state components · copy deck module                                        │
│   • TanStack Query (caching, polling) · React Router · react-hook-form + zod (client validation)         │
│   • MSW mock layer (development only, per-feature toggles, "MOCK DATA" badge)                             │
│   • Browser speech: SpeechSynthesis (read-aloud, P1) · SpeechRecognition (speech input, P1)              │
│   • ISL glossary: static content file → privacy-enhanced video embeds (official ISLRTC videos)            │
└───────────────┬───────────────────────────────────────────────────────────────────────────────────────────┘
                │ same-origin /api/v1 through the Vite dev proxy · Bearer token · JSON / multipart
┌───────────────▼───────────────────────────────────────────────────────────────────────────────────────────┐
│  FastAPI backend (Python 3.11+, Uvicorn)                                                                  │
│   Request-ID middleware · error-envelope handlers · allow-list structured logging (no PHI)               │
│   Auth & sessions (opaque tokens, hashed) · Access guard (grant + scope + resource binding) · Audit writer│
│                                                                                                           │
│   Documents API ──► Processing orchestrator (background tasks, one document at a time per upload)        │
│        M1 Intake:  AG-01 file validation · AG-02 PyMuPDF lines (P1: Gemini vision OCR) · AG-03 screening  │
│        M2 Extract: AG-04 Gemini extraction · AG-05 rule validation & confidence · golden cache fallback   │
│   Facts / Timeline / Brief APIs ──► M3 Organise: AG-06 timeline · AG-07 rules · AG-08 brief assembler    │
│   Ask / Narrative APIs ──► M4 Answer: AG-09 intent gate · AG-10 context · AG-11 generator · AG-12 validator│
│   Reminders API (P1) · Access API (P1) · Appointment suggestions & simulated booking (P1)                 │
│                                                                                                           │
│   Gemini client wrapper: store=false · one call in flight · timeouts · retry · block detection · config  │
├────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┤
│  SQLite (WAL mode)                             │  Private file store (local folder outside the web root)  │
│  users · sessions · patient profiles · grants  │  random UUID file names · served only by API-12          │
│  consents · documents · pages · facts · briefs │                                                          │
│  ai_outputs · reminders · simulated providers  │  Golden cache (validated extractions keyed by SHA-256)   │
│  · mock appointments · audit events            │                                                          │
└────────────────────────────────────────────────┴───────────────────────┬──────────────────────────────────┘
                                                                         │ HTTPS · API key held only by the server
                                                              ┌──────────▼───────────┐
                                                              │  Google Gemini API   │
                                                              │  gemini-3.8-flash    │
                                                              └──────────────────────┘
```

## 2. Data flows

### 2.1 Upload → reviewed facts (document-to-timeline workflow)

1. **Upload (SCR-05 → API-08).** The access guard checks the grant, the `upload_documents` scope and the owner's AI-processing consent. AG-01 checks magic bytes, size and page count, computes SHA-256 (duplicate check), stores the file under a random name and creates the document (`queued`). The API returns 202.
2. **Background processing (orchestrator).**
   - Stage `reading_text`: AG-02 extracts the page lines.
   - Stage `screening`: AG-03 flags and excludes instruction-like lines.
   - Stage `extracting`: AG-04 calls Gemini with `store=false`.
   - Stage `validating`: AG-05 checks every fact and sets confidence.
   - The document becomes `needs_review`. On AI failure it uses the golden cache if the file is known; otherwise it becomes `failed`.
3. **Polling (SCR-05 / SCR-06 → API-11 every 2 s)** shows the stages until a terminal status.
4. **Review (SCR-06 → API-15 / API-16 / API-14).** The user confirms, corrects or rejects facts and fixes document details. Each change writes history and an audit event.
5. **Timeline (SCR-07 → API-17).** AG-06 builds it on read from documents and non-rejected facts, with change markers from AG-07.

### 2.2 Consultation Brief

1. SCR-09 → API-18. AG-07 computes the findings and AG-08 assembles the sections, evidence snapshot and fingerprint. The brief is stored and returned in under 500 ms.
2. SCR-09 then calls API-20. AG-10 builds a context from the brief's evidence, AG-11 generates the narrative, AG-12 validates each statement, and the AIOutput is stored and linked to the brief. If anything fails, the templated overview stays.
3. API-19 recomputes `stale` by comparing fingerprints whenever the brief is opened.

### 2.3 Ask

SCR-08 → API-21:
1. **AG-09 gate.** Emergency or advice requests get a fixed template response, with no model call.
2. **AG-10.** Builds the patient-scoped context with short keys, filtered by patient in the query.
3. **AG-11.** Calls Gemini with a 20 s timeout.
4. **AG-12.** Validates each statement and maps the cited keys to evidence objects.
5. **Store and return.** The AIOutput is stored and the response returned. If the AI fails, the response is evidence-only (`degraded`).

### 2.4 Sharing (P1)

1. SCR-14 → API-24. The owner grants access to an existing account; the `sharing` consent and the audit event are recorded.
2. The caregiver's API-06 now lists the profile.
3. API-25 revokes the grant. The caregiver's next request fails the access guard with 403 and an `access.denied` audit event.

### 2.5 Reminders (P1)

SCR-12 → API-28. The server converts the local schedule and the `Asia/Kolkata` timezone into `next_due_at` (UTC). The client lists reminders (API-27) and, while the app is open, polls every 60 s for due ones. Browser notifications fire only if permission was granted.

## 3. Component responsibilities

| Component | Responsibilities | Owner | Key references |
|---|---|---|---|
| Frontend client | Screens, navigation, client validation, state components, accessibility, API integration, mock layer, read-aloud and speech input, ISL glossary rendering, print layouts | A | [10-ui-screen-spec.md](10-ui-screen-spec.md), [../fe-sprints/backlog.md](../fe-sprints/backlog.md) |
| Backend API | REST endpoints per the contract, request IDs, error envelope, server-side validation | B | [11-api-contract.md](11-api-contract.md) |
| Authentication | Password check against seeded accounts, opaque token issue, hashed session storage, expiry, sign-out | B | FR-001, FR-002 |
| Authorisation | Access guard: active grant, scope, resource–patient binding, owner-only actions, audit on denial | B | FR-005, [07-data-model.md](07-data-model.md) §4 |
| Document ingestion | AG-01 validation, private storage, duplicate detection, background orchestration with stages and failure codes | B | FR-010, FR-012 |
| OCR and document parsing | AG-02 PyMuPDF line model with table-row reconstruction; P1 Gemini vision for images | B | FR-015, FR-024 |
| Structured medical-history storage | Documents, pages, facts with status and history; derived timeline | B | [07-data-model.md](07-data-model.md) |
| Private document storage | Local folder outside the web root, random names, served only through API-12 with safe headers | B | FR-014, THR-12 |
| Retrieval and RAG | AG-10 patient-scoped context (full context under a cap; ranking tiers are P2) | B | [08-ai-rag-design.md](08-ai-rag-design.md) §7 |
| AI workflow orchestration | Fixed sequence of AG stages; no agent framework; model calls only through the wrapper | B | FR-030 |
| Output validation and safety | AG-09 gate, AG-12 validator, AG-05 extraction checks, AG-03 screening | B (rules), C (review) | FR-035, FR-038, [12-safety-threat-model.md](12-safety-threat-model.md) |
| Voice services | Browser speech synthesis and recognition in the frontend; backend records `input_mode` only | A | [09-multimodal-accessibility.md](09-multimodal-accessibility.md) §3 |
| Sign-language support | Visit Card and ISL glossary in the frontend; content curated by C; no backend in the MVP | A (UI), C (content) | [09-multimodal-accessibility.md](09-multimodal-accessibility.md) §4 |
| Reminders and appointments | Reminder CRUD with timezone logic; deterministic specialty mapping; simulated providers and booking | B (API), A (UI) | FR-070–074, FR-090–091 |
| Logging and error handling | Allow-list structured logs with request IDs; audit events; error envelope; degraded-mode banner driven by API-01 | B (server), A (client states) | FR-104, FR-105, FR-120 |

## 4. External services and dependencies

| Service | Used for | Data it sees | Failure impact | Fallback |
|---|---|---|---|---|
| Google Gemini API | Extraction, Ask answers, brief narrative | Per [08-ai-rag-design.md](08-ai-rag-design.md) §12.2 | AI features degrade | Golden cache, evidence-only answers, deterministic brief |
| Browser speech recognition (Chrome / Edge) | Speech input (P1) | The user's voice (sent to the browser vendor's service unless on-device) | Voice input unavailable | Typing |
| Browser speech synthesis | Read-aloud (P1) | Text being read (only for network voices) | No read-aloud | Text on screen |
| Video platform (official ISLRTC channel) | ISL glossary videos | That a video was played | Glossary videos unavailable | Text plus dictionary link |
| Google Fonts (optional) | Typography | Font requests | Falls back to system fonts | System font stack |

There are no other third-party services: no analytics, no error-tracking SaaS and no cloud hosting in the demo.

## 5. Technology stack and trade-offs

| Layer | Choice | Why | Trade-off accepted |
|---|---|---|---|
| Frontend framework | React + TypeScript + Vite | Widely known; fast dev server; types mirror the contract | No server rendering (not needed) |
| UI components | Tailwind CSS + shadcn/ui (Radix primitives) | Accessible primitives (focus, ARIA) out of the box; polished look quickly | Person A may swap in Mantine if more familiar (DEC-19); decide at kickoff, not later |
| Data fetching | TanStack Query | Polling, caching and error states with little code | One more library to learn |
| Forms | react-hook-form + zod | Client validation that mirrors server rules | None significant |
| Mocking | MSW (Mock Service Worker) | Intercepts at the network level, so app code is identical in mock and real mode; per-feature toggles | Small setup cost on Day 1 |
| PDF viewing | Browser built-in viewer through a blob URL, `#page=N` | No extra library | Page jumping varies by browser; react-pdf as the P1 fallback |
| Backend framework | Python FastAPI + Pydantic v2 | Python suits PDF and AI libraries and the team's skills; automatic API docs (Swagger) help Person C test | Single process; background tasks share the process |
| Persistence | SQLite (WAL) through SQLModel | Zero setup; one file to snapshot and restore | Not for concurrent production load |
| PDF text | PyMuPDF | Fast, gives word coordinates for line reconstruction | Text-layer PDFs only in P0 |
| File type check | `filetype` (magic bytes, pure Python) | Cross-platform | Limited to common types (sufficient) |
| AI | Gemini through the official `google-genai` SDK | The provider the team has access to; strong document understanding | Cloud dependency, mitigated by degraded mode |
| Retrieval | Full patient context; no vector database | Small records; exact recall; fewer moving parts | Needs ranking tiers at scale (P2) |
| Agent framework | None; plain orchestrated functions | Predictable, testable, no hidden prompts | Less "agentic" flash, deliberately |
| Auth | Opaque random tokens stored hashed | Revocable, simple | Not federated; no MFA |
| Tests | pytest + FastAPI test client; manual scripted E2E | Quick to write | No automated browser tests unless time allows |

## 6. Repository layout (monorepo)

```text
medivara/
├── frontend/          React app (Person A)
├── backend/           FastAPI service (Person B)
│   ├── storage/       private files (excluded from version control)
│   └── golden_cache/  validated extractions for synthetic samples (committed: synthetic only)
├── contracts/         canonical JSON fixtures copied from 11-api-contract.md (owned by B)
├── demo-data/         synthetic PDFs, answer key, ISL glossary content, eval questions (owned by C)
└── docs/              this planning pack
```

## 7. Runtime configuration (environment variables, backend)

| Variable | Example | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | (secret) | Server-side only |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Primary model |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite` (empty = disabled) | Optional quota fallback |
| `GEMINI_THINKING_LEVEL` | `low` | Latency control |
| `AI_MODE` | `live` · `cache_only` · `off` | Failure drills |
| `DEMO_MODE` | `true` | Enables demo-only features (sample import, demo cards) |
| `ASK_CONTEXT_TOKEN_CAP` | `24000` | Context cap |
| `TIMEOUT_EXTRACT_S` / `TIMEOUT_ASK_S` / `TIMEOUT_NARRATIVE_S` | `60` / `20` / `25` | Model call timeouts |
| `SESSION_HOURS` | `12` | Session expiry |
| `POLICY_VERSION` | `2026-10-demo-1` | Consent policy version |
| `STORAGE_DIR`, `DATABASE_PATH`, `GOLDEN_CACHE_DIR` | local paths | Persistence locations |

The frontend reads only `VITE_MOCK_FEATURES` (comma-separated features served by MSW; empty in the demo build) and the API base path.

## 8. Deployment for the demo

- Both services run on **one demo laptop** (Chrome, chosen at gate G1). The frontend runs a production build or the dev server with mocks off. The backend runs with `DEMO_MODE=true` and the demo Gemini key.
- No public hosting. This removes deployment risk and keeps the data local.
- A phone hotspot is the backup network. The golden cache and deterministic features keep the demo working if the network fails completely.
- **Demo snapshot:** a copy of the SQLite file plus the storage folder, captured at G1 and IC-4. Restore takes under 2 minutes (FR-006).

## 9. Production path (future, not claimed)

| Concern | Prototype | Production direction |
|---|---|---|
| Hosting | One laptop | Containerised services in a managed cloud region chosen after data-residency review |
| Database | SQLite | Managed Postgres with row-level security per patient; pgvector for semantic retrieval |
| Files | Local folder | Encrypted object storage with managed keys and short-lived signed URLs |
| Processing | In-process background tasks | Task queue with workers, retries and dead-letter handling |
| AI | Gemini API, paid tier, `store=false` | Enterprise terms or Vertex AI, data-processing agreement, identifier redaction, multi-provider fallback, evaluation gates |
| Identity | Seeded accounts, passwords | Phone or email OTP, MFA, proxy and guardian verification |
| Interoperability | None | FHIR-based exchange with national health-record networks and hospitals, after partnership and compliance work |
| Observability | Local logs | Central logging with redaction, metrics, tracing, alerting |
| Security assurance | Prototype controls | Threat modelling, penetration testing, secure SDLC, incident response |
| Clinical safety | Design rules | Clinical safety case, clinician review of outputs, post-market monitoring as applicable |
