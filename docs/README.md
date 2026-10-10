# MediVara — Hackathon Planning Pack

MediVara is a privacy-conscious, AI-assisted medical-history and healthcare-accessibility companion. It organises a patient's documents into a verified, source-linked history and a one-page Consultation Brief, supports Deaf users and people who prefer listening, and lets patients share access with family safely. It never replaces a clinician.

This folder is the **complete plan for a three-person, two-day hackathon build**. It contains requirements, architecture, contracts, sprint plans, the schedule, tests and the demo strategy. **It contains no application code.** Developers use it in later coding sessions.

## Folder map

```text
docs/
├── README.md          ← you are here: index, reading paths, ID registry, glossary
├── srd/               the Software Requirements Document (specification)
├── fe-sprints/        Person A (frontend): quick-start, backlog, 6 sprint sheets
├── be-sprints/        Person B (backend/AI): quick-start, backlog, 6 sprint sheets
└── hackathon/         shared team documents led by Person C: integration, schedule, tests, risks, demo, checklist, demo data
```

## The fifteen deliverables, in the requested order

| # | Deliverable | Where |
|---|---|---|
| 1 | Executive summary | [srd/01-executive-summary.md](srd/01-executive-summary.md) |
| 2 | Product scope and priority matrix | [srd/02-scope-and-priority-matrix.md](srd/02-scope-and-priority-matrix.md) |
| 3 | Complete SRD | [srd/README.md](srd/README.md): sections 5.1–5.14 across [03](srd/03-problem-and-personas.md), [04](srd/04-functional-requirements.md), [05](srd/05-non-functional-requirements.md), [08](srd/08-ai-rag-design.md), [09](srd/09-multimodal-accessibility.md), [12](srd/12-safety-threat-model.md), [13](srd/13-scope-and-roadmap.md), [14](srd/14-definition-of-done.md) |
| 4 | System architecture and data flow | [srd/06-architecture.md](srd/06-architecture.md) |
| 5 | Data model | [srd/07-data-model.md](srd/07-data-model.md) |
| 6 | Screen-by-screen UI requirements | [srd/10-ui-screen-spec.md](srd/10-ui-screen-spec.md) |
| 7 | API contracts | [srd/11-api-contract.md](srd/11-api-contract.md) |
| 8 | Frontend sprint backlog (Person A only) | [fe-sprints/backlog.md](fe-sprints/backlog.md) + [sprint sheets](fe-sprints/README.md) |
| 9 | Backend sprint backlog (Person B only) | [be-sprints/backlog.md](be-sprints/backlog.md) + [sprint sheets](be-sprints/README.md) |
| 10 | Integration and collaboration plan | [hackathon/integration-plan.md](hackathon/integration-plan.md) |
| 11 | Two-day execution schedule | [hackathon/execution-schedule.md](hackathon/execution-schedule.md) |
| 12 | Testing and acceptance criteria | [hackathon/test-plan.md](hackathon/test-plan.md) |
| 13 | Risk register | [hackathon/risk-register.md](hackathon/risk-register.md) (security threats: [srd/12-safety-threat-model.md](srd/12-safety-threat-model.md)) |
| 14 | Hackathon demo and judging strategy | [hackathon/demo-and-judging-strategy.md](hackathon/demo-and-judging-strategy.md) |
| 15 | Final readiness checklist | [hackathon/readiness-checklist.md](hackathon/readiness-checklist.md) |
| + | Synthetic demo data pack | [hackathon/synthetic-demo-data-pack.md](hackathon/synthetic-demo-data-pack.md) |

## Reading paths by role

| Role | Start here | Then |
|---|---|---|
| **Person A — Frontend** | [fe-sprints/README.md](fe-sprints/README.md) | Screen spec → API contract (API-01 to 21) → backlog → integration plan §2 and §4 |
| **Person B — Backend/AI** | [be-sprints/README.md](be-sprints/README.md) | API contract → data model → AI design → threat model → backlog → demo data pack |
| **Person C — Product/Integration/QA** | [hackathon/README.md](hackathon/README.md) | Scope matrix → integration plan → schedule → test plan → demo strategy → data pack |
| Mentor or judge (optional) | [srd/01-executive-summary.md](srd/01-executive-summary.md) | AI design §1–§3 → demo strategy |

## Key numbers

- 76 functional requirements (42 P0 · 21 P1 · 13 P2 / Future).
- 16 screens; 33 endpoints (21 P0 · 12 P1).
- 12 AI workflow stages in 4 modules.
- 6 sprints per developer, each ending at an integration checkpoint (IC-1 to IC-6).
- 10 end-to-end tests.
- Planned load: Person A ≈ 14.2 h and Person B ≈ 14.25 h of the ≈ 14.5 h available.

## ID registry

| Prefix | Meaning | Defined in |
|---|---|---|
| FR-nnn | Functional requirement | [srd/04-functional-requirements.md](srd/04-functional-requirements.md) |
| NFR-CAT-nn | Non-functional requirement (SEC, PRIV, A11Y, USE, PERF, REL, MNT, AUD, SCL, CMP) | [srd/05-non-functional-requirements.md](srd/05-non-functional-requirements.md) |
| SCR-nn | Screen | [srd/10-ui-screen-spec.md](srd/10-ui-screen-spec.md) |
| COPY-nn | Copy deck string (final wording) | [srd/10-ui-screen-spec.md](srd/10-ui-screen-spec.md) §19 |
| API-nn | Endpoint | [srd/11-api-contract.md](srd/11-api-contract.md) |
| AG-nn | AI workflow stage | [srd/08-ai-rag-design.md](srd/08-ai-rag-design.md) §3 |
| RULE-… | Consistency or gap rule | [srd/08-ai-rag-design.md](srd/08-ai-rag-design.md) §9.1 |
| THR-nn | Security or safety threat | [srd/12-safety-threat-model.md](srd/12-safety-threat-model.md) |
| H-nn | Research assumption (hypothesis) | [srd/03-problem-and-personas.md](srd/03-problem-and-personas.md) §3 |
| PP-n | Pain point | [srd/03-problem-and-personas.md](srd/03-problem-and-personas.md) §2 |
| P-nn | Persona | [srd/03-problem-and-personas.md](srd/03-problem-and-personas.md) §4 |
| ASM-nn | Planning assumption | [srd/01-executive-summary.md](srd/01-executive-summary.md) §5 |
| DEC-nn | Recorded decision with owner | [srd/01-executive-summary.md](srd/01-executive-summary.md) §6 |
| FE-s.n | Frontend task (section s) | [fe-sprints/backlog.md](fe-sprints/backlog.md) |
| BE-s.n | Backend task (section s) | [be-sprints/backlog.md](be-sprints/backlog.md) |
| IC-n, G1, G2 | Integration checkpoint, gate | [hackathon/integration-plan.md](hackathon/integration-plan.md) §4 |
| G-n | Mock guardrail | [hackathon/integration-plan.md](hackathon/integration-plan.md) §2 |
| E2E-nn | End-to-end test | [hackathon/integration-plan.md](hackathon/integration-plan.md) §7 |
| TC-AREA-nn | Test case | [hackathon/test-plan.md](hackathon/test-plan.md) §2 |
| MET-nn | Success metric | [hackathon/demo-and-judging-strategy.md](hackathon/demo-and-judging-strategy.md) §5 |
| RSK-nn | Delivery, product or demo risk | [hackathon/risk-register.md](hackathon/risk-register.md) |
| DOC-n, RDOC-n, KDOC-n | Synthetic document | [hackathon/synthetic-demo-data-pack.md](hackathon/synthetic-demo-data-pack.md) §4 |
| Q-, S-, I-, X-nn | Evaluation question (grounded, safety, injection, isolation) | [hackathon/synthetic-demo-data-pack.md](hackathon/synthetic-demo-data-pack.md) §6 |

## Glossary

| Term | Meaning in this pack |
|---|---|
| Fact | One item extracted from a document (a medicine, lab result, condition, allergy, procedure, vital sign, follow-up or instruction), with the line IDs it came from |
| Line ID | Stable identifier of one line of document text, for example `p1-l6` (page 1, line 6) |
| Evidence | The exact document lines cited by a fact, brief item or AI statement, shown in the Evidence drawer |
| Confidence | High, medium or low, computed by rules from checks against the source lines, never by the model |
| Fact status | Unverified, confirmed, corrected or rejected: the user's review state |
| Consultation Brief | The visit-preparation summary: deterministic sections plus an optional validated AI narrative |
| Points to clarify / Missing information | Findings from the deterministic rules (documents that differ; gaps) |
| Intent gate | Rules that catch emergencies and advice requests before any AI call |
| Validator | The per-statement citation and safety check that every AI statement must pass |
| Degraded mode | Behaviour when the AI is unavailable: deterministic features continue and AI features show evidence or the cache, labelled |
| Golden cache | Validated extractions of the synthetic sample files, used only as a labelled fallback |
| ISL Visit Assist | Visit Communication Card plus a glossary of official ISL dictionary videos. Not translation. |
| Grant / scope | A caregiver's access to a patient profile, and what it allows (view records, upload documents, manage reminders) |
| Snapshot | A copy of the database and file store used to restore the exact demo state |
| Checkpoint (IC) | A fixed window where frontend and backend integrate and Person C runs acceptance tests |
| Cut ladder | The pre-agreed order in which features are dropped if time runs short |

## Using this pack in a coding session

Point the coding assistant at the specific task and the documents it cites. For example: *"Implement BE-6.2 per docs/be-sprints/backlog.md, using docs/srd/08-ai-rag-design.md §3 and the API-17 fixture in docs/srd/11-api-contract.md."* Keep the contract as the source of truth. If code and documents disagree, raise it in `#contract` and don't diverge silently.

## Notes

- The repository's root `README.md` is currently saved as UTF-16, which some tools treat as binary. Convert it to UTF-8 and link it to this file at the start of the coding session.
- All personas, clinics, doctors and values are fictional. Never add real health data to this repository.

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-10 | Initial planning pack |
