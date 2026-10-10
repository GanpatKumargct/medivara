# MediVara Software Requirements Document (SRD)

> Version 1.0 (pre-hackathon). Owner of the overall SRD: **Person C**. Section owners are named at the top of each file.
> This SRD contains requirements, architecture descriptions, data model tables, screen specifications, API contracts with JSON examples, and safety analysis. It contains **no application code**.

## Section map

| SRD section | Title | File |
|---|---|---|
| 5.1 | Executive summary (plus recommended MVP, assumptions, decision log) | [01-executive-summary.md](01-executive-summary.md) |
| (2) | Product scope and priority matrix | [02-scope-and-priority-matrix.md](02-scope-and-priority-matrix.md) |
| 5.2, 5.3 | Problem statement, research assumptions, personas | [03-problem-and-personas.md](03-problem-and-personas.md) |
| 5.4 | Functional requirements (FR-001 to FR-121) | [04-functional-requirements.md](04-functional-requirements.md) |
| 5.5 | Non-functional requirements (NFR-…) | [05-non-functional-requirements.md](05-non-functional-requirements.md) |
| 5.6 | System architecture and data flow | [06-architecture.md](06-architecture.md) |
| 5.7 | Data model | [07-data-model.md](07-data-model.md) |
| 5.8 | AI and RAG design (stages AG-01 to AG-12) | [08-ai-rag-design.md](08-ai-rag-design.md) |
| 5.9 | Multimodal accessibility: text, voice, sign language | [09-multimodal-accessibility.md](09-multimodal-accessibility.md) |
| 5.10 | Screen-by-screen UI specification (SCR-01 to 16) and copy deck | [10-ui-screen-spec.md](10-ui-screen-spec.md) |
| 5.11 | API contract (API-01 to 33) | [11-api-contract.md](11-api-contract.md) |
| 5.12 | Safety, threat model and testing (THR-01 to 18) | [12-safety-threat-model.md](12-safety-threat-model.md) |
| 5.13 | Scope and roadmap | [13-scope-and-roadmap.md](13-scope-and-roadmap.md) |
| 5.14 | Definition of Done | [14-definition-of-done.md](14-definition-of-done.md) |

## Suggested reading order

- **New to the project:** 01 → 02 → 03 → 06 → 08.
- **Building:** 07 → 11 → 10 → 04 → 14.
- **Reviewing safety:** 08 §8–§13 → 12 → 09 §4.

## Conventions

- IDs are unique across the whole pack (see the registry in [../README.md](../README.md)).
- Priorities: P0 (must work) · P1 (if core is stable) · P2 / Future (roadmap only), as defined in 02 §2.
- All data is synthetic. Fictional personas are referred to by name or with they/them.
- JSON appears only in the API contract, as canonical examples that are copied into fixture files.
- Changes after the contract freeze follow [../hackathon/integration-plan.md](../hackathon/integration-plan.md) §5 and are logged in [11-api-contract.md](11-api-contract.md) §6.
