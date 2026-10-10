# Backend Sprints — Person B Quick-Start

You own the MediVara backend and AI workflow: the API contract and fixtures, authentication and authorisation, data models, document processing, the Gemini integration, retrieval and validation, reminders logic, and server-side safety. You are on the **critical path**, so protect your time and escalate slips early.

## 1. Read first (in this order, about 90 minutes before the event)

1. [../srd/02-scope-and-priority-matrix.md](../srd/02-scope-and-priority-matrix.md): P0, P1, P2 and the cut ladder.
2. [../srd/11-api-contract.md](../srd/11-api-contract.md): you own it. Confirm or adjust it **before** IC-0; after that it is frozen.
3. [../srd/07-data-model.md](../srd/07-data-model.md): entities, access rules, fact status semantics.
4. [../srd/08-ai-rag-design.md](../srd/08-ai-rag-design.md): stages AG-01 to AG-12, schemas, prompt rules, validator, Gemini runtime rules.
5. [../srd/12-safety-threat-model.md](../srd/12-safety-threat-model.md): what each control must prevent.
6. [backlog.md](backlog.md): your tasks, with estimates and acceptance criteria.
7. [../hackathon/integration-plan.md](../hackathon/integration-plan.md): checkpoints, change policy, environments.
8. [../hackathon/synthetic-demo-data-pack.md](../hackathon/synthetic-demo-data-pack.md): seed IDs, documents, answer key.

## 2. Pre-event homework (owner: you)

- [ ] Google AI Studio: create two projects, **dev** and **demo**, each with an API key.
- [ ] Enable **paid Tier-1 billing** with a budget alert. Check the rate limits in AI Studio.
- [ ] Confirm the current model IDs (`gemini-2.5-flash`, `gemini-3.5-flash-lite`) and the SDK version; pin it.
- [ ] Make one test call with `store=false` and a JSON schema response.
- [ ] Python 3.11+ ready; confirm PyMuPDF installs on your OS.
- [ ] Re-read API-01 to API-21 and fix any contract problem **now** (with Person A and Person C).
- [ ] Prepare the prompt texts from the rule lists in AI design §5.2, §8.2 and §8.3, if the event rules allow pre-written assets.

## 3. Sprint map

| Sprint | Window | Focus | Ends with |
|---|---|---|---|
| [Sprint 1](sprint-1-day1-am.md) | Day 1 09:45–12:00 | Scaffold, models, seed, auth, access guard, patients | **IC-1** |
| [Sprint 2](sprint-2-day1-pm.md) | Day 1 13:00–16:30 | Upload, orchestrator, lines, Gemini wrapper, extraction, validation | **IC-2** |
| [Sprint 3](sprint-3-day1-eve.md) | Day 1 16:50–18:30 | Screening, review actions, reprocess, timeline, rules | **IC-3, G1** |
| [Sprint 4](sprint-4-day2-am.md) | Day 2 09:20–12:00 | Brief, context, generator, validator, narrative, gate, Ask | **IC-4** |
| [Sprint 5](sprint-5-day2-mid.md) | Day 2 12:45–14:15 | Golden cache, sharing, audit list, reminders | **IC-5, feature freeze** |
| [Sprint 6](sprint-6-stabilise.md) | Day 2 14:15–15:45 | Tests, privacy checks, drills, bug fixes | **IC-6, code freeze** |

Planned load: P0 about 12.75 h, P1 about 1.5 h, buffer about 0.25 h, against about 14.5 h available.

## 4. Rules

**Do**
- Make every model call through the wrapper: `store=false`, timeouts, one retry, one call in flight, block detection.
- Apply the access guard to every patient-scoped route, including the resource-belongs-to-patient check.
- Keep logs to request ID, route, status, duration and error code. No document text, prompts, outputs or questions.
- Keep `main` runnable from a fresh clone with the example environment file (Persons A and C run it).
- Name branches and commits with task IDs (for example `be/BE-5.4-extraction`).

**Don't**
- Change the contract silently. Follow the change policy (integration plan §5).
- Add a vector database, agent framework or task queue. They are not needed for the MVP.
- Let model output reach a response without passing AG-05 (extraction) or AG-12 (answers and narrative).
- Use preview models in the demo, or change sampling defaults (keep the defaults, per Google's Gemini 3 guidance).
- Put real keys in the repository or send anything to the frontend that it doesn't need.

## 5. Contract ownership

- You author and maintain [../srd/11-api-contract.md](../srd/11-api-contract.md) and the `contracts/` fixtures.
- **P0 freezes at IC-0 (Day 1, 09:45); P1 at G1 (Day 1, 18:45).**
- After a freeze:
  - **Additive changes** (new optional fields, new endpoints): changelog entry plus a fixture update in the same commit, and a heads-up to Person A.
  - **Breaking changes** (rename, remove, change type, change status semantics): Person A must acknowledge first. None after IC-4 except demo blockers.

## 6. Decision owners you'll need

| Question | Owner |
|---|---|
| API shape, data model, AI pipeline, prompts, safety patterns | You (Person B); safety reviewed by Person C |
| Scope, priority, cuts, copy wording | Person C |
| UX behaviour, screen states | Person A |

## 7. Using these docs in a coding session

Give your coding assistant the task block and the documents it references. For example: *"Implement BE-5.5 (AG-05 validation and confidence) exactly as specified in docs/be-sprints/backlog.md and docs/srd/08-ai-rag-design.md §6, storing results per docs/srd/07-data-model.md §3.8. Add unit tests for each uncertainty reason."* Then check the acceptance criteria yourself before marking the task done.
