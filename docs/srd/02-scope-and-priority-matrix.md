# 02 — Product Scope and Priority Matrix

> Part of the MediVara SRD. Owner: **Person C** (product). Requirement IDs refer to [04-functional-requirements.md](04-functional-requirements.md).
> Status: v1.0 (pre-hackathon). Changes after IC-0 follow the change policy in [../hackathon/integration-plan.md](../hackathon/integration-plan.md).

## 1. Purpose

This document separates the **complete product vision** from what the team will **build and demonstrate in two days**. It records every priority decision so the SRD, API contract, backlogs, tests and demo stay consistent.

## 2. Priority definitions

| Priority | Meaning in this plan | Rule of thumb |
|---|---|---|
| **P0 — Must work** | Part of the single end-to-end demo on synthetic data. Without it, the demo fails or makes claims the product cannot back up. | Built on Day 1 and Day 2 morning. Never cut (see §7). |
| **P1 — Add if core is stable** | Valuable features shown only after P0 passes its integration checkpoints. | Built in Day 2 midday sprint, in the order in §6. Cut from the bottom of the ladder first. |
| **P2 — Stretch / future** | Specified so the roadmap is credible, but **not built** in the hackathon. | Appears in the roadmap and judge Q&A only. |
| **Future** | Requires partners, validation or regulation work beyond a prototype. | Never shown as working. |

## 3. Product vision vs. hackathon demo

| Dimension | Complete product vision | Two-day hackathon prototype |
|---|---|---|
| Records | Any document (PDF, photo, scan, handwritten), any provider, auto-imported through health-record networks | Synthetic, text-layer PDFs (prescription, lab report, discharge summary); uploaded or restored from a demo snapshot |
| Extraction | High-accuracy extraction across formats and languages, clinically reviewed | Gemini extraction with line-level citations, rule-based checks and mandatory human review |
| Timeline | Encounters merged across providers, de-duplicated | Deterministic chronological timeline grouped by document date |
| AI help | Grounded Q&A, summaries, consultation preparation in Indian languages | English Q&A and Consultation Brief, grounded and validated per statement |
| Family | Verified caregivers, legal proxies, dependants, emergency access | Owner grants scoped access to an existing account; immediate revoke; access log |
| Reminders | Reliable multi-channel notifications | In-app list and browser notifications only while the app is open |
| Appointments | Real provider discovery and booking | Deterministic specialty suggestions; **simulated** providers and booking (built only if ahead) |
| Voice | Multilingual voice assistant | Read-aloud; browser speech-to-text question input (if ahead) |
| Sign language | Co-designed ISL support, possibly recognition and signing avatars | **ISL Visit Assist:** Visit Card plus a glossary of official ISL dictionary videos. **No translation.** |
| Security | Production-grade, audited, regulatory programme | Prototype controls: auth, per-patient grants, audit log, no PHI in logs, synthetic data only |

## 4. Feature inventory and priorities

Legend for the **Demo** column: **Live** = demonstrated working · **If built** = shown only if completed before feature freeze · **Spec** = specified, not built · **Roadmap** = mentioned as future work.

### A. Patient medical repository

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Upload PDF documents (prescription, lab report, discharge summary) | P0 | FR-010 | Live |
| Validate files and store them privately | P0 | FR-010, FR-014 | Live |
| Processing status, failure states and retry | P0 | FR-012 | Live |
| Document list with type/status filters | P0 | FR-013 | Live |
| Original document viewer next to extracted information | P0 | FR-014 | Live |
| Text and line extraction from text-layer PDFs | P0 | FR-015 | Live |
| Structured fact extraction with line citations | P0 | FR-016 | Live |
| Rule-based validation, confidence and uncertainty flags | P0 | FR-017 | Live |
| Review: confirm / correct / reject facts | P0 | FR-018 | Live |
| Bulk-confirm high-confidence facts | P0 | FR-019 | Live |
| Correct document details (type, date, facility, clinician) | P0 | FR-020 | Live |
| Link every fact and statement to its source page and lines | P0 | FR-021 | Live |
| Chronological, source-linked medical timeline | P0 | FR-022 | Live |
| Import the synthetic sample set with one click | P1 | FR-011 | If built |
| Delete a document | P1 | FR-023 | If built |
| Read photos and scanned PDFs (vision OCR) | P1 | FR-024 | If built (first cut) |
| Additional document types (consultation note, imaging report) | P1 | FR-025 | Spec |
| Merge encounters across documents | P2 | FR-026 | Roadmap |

### B. RAG-based AI workflow

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Bounded, orchestrated AI workflow (12 stages, no autonomous agents) | P0 | FR-030 | Live (explained) |
| Prompt-injection screening of uploaded documents | P0 | FR-031 | Live (injection test document) |
| Consistency and gap findings (deterministic rules) | P0 | FR-032 | Live |
| Consultation Brief: deterministic snapshot, questions for the doctor, print | P0 | FR-033 | Live |
| Brief narrative (LLM, validated) | P0 | FR-034 | Live |
| Ask: rules-first intent gate (emergency, advice requests) | P0 | FR-035 | Live |
| Ask: patient-scoped evidence context | P0 | FR-036 | Live |
| Ask: grounded answer with citations | P0 | FR-037 | Live |
| Per-statement citation and safety validator | P0 | FR-038 | Live |
| "Not found" and uncertainty communication | P0 | FR-039 | Live |
| Degraded mode and golden extraction cache | P0 | FR-040 | Live (failure drill) |
| AI output traceability and staleness | P0 | FR-041 | Live |
| Ranked retrieval beyond the context cap (BM25) | P2 | FR-045 | Roadmap |
| Hybrid semantic retrieval (embeddings) | P2 | FR-046 | Roadmap |
| LLM intent classifier | P2 | FR-047 | Roadmap |
| Remove identifiers before AI calls | P2 | FR-048 | Roadmap |

### C. Multimodal interaction

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Plain-language text output standards | P0 | FR-050 | Live |
| Display preferences (text size, contrast, reduced motion) | P0 | FR-051 | Live |
| **Visit Communication Card** (Deaf/ISL-aware, printable) | **P0** | FR-060 | Live |
| **ISL health-term glossary** (official ISLRTC dictionary videos) | **P0** | FR-061 | Live |
| Read-aloud of answers, brief and Visit Card | P1 | FR-055 | If built (planned) |
| Speech-to-text question input with transcript confirmation | P1 | FR-056 | If built (likely cut) |
| ISL term links inside brief and answers | P1 | FR-062 | If built |
| ISL interpreter request on simulated booking | P1 | FR-063 | If built (with booking) |
| Voice navigation commands | P2 | FR-058 | Roadmap |
| Server-side speech services | P2 | FR-059 | Roadmap |
| Experimental isolated-sign recognition | P2 | FR-064 | Roadmap (not built in 2 days) |
| ISL sentence translation / signing avatar | Future | FR-065 | Roadmap |

### D. Reminders

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Create reminders (appointment, medication, follow-up, other) | P1 | FR-070 | If built (planned) |
| List, edit, dismiss, complete | P1 | FR-071 | If built (planned) |
| Create a reminder from an extracted follow-up instruction | P1 | FR-072 | If built (planned) |
| Browser notifications while the app is open | P1 | FR-073 | If built |
| Timezone handling (IST default, explicit labels) | P1 | FR-074 | If built (planned) |
| Push notifications when the app is closed | P2 | FR-075 | Roadmap |

### E. Solo and family profiles

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Individual patient profile with strict isolation | P0 | FR-004, FR-005 | Live |
| Grant caregiver access to an existing account (consent + scopes) | P1 | FR-080 | If built (planned) |
| Enforce caregiver scopes | P1 | FR-081 | If built (planned) |
| Revoke access, effective on the next request | P1 | FR-082 | If built (planned) |
| Family dashboard (only permitted profiles) | P1 | FR-083 | If built (planned) |
| Access log for the owner | P1 | FR-084 | If built |
| Invitation acceptance and identity verification | P2 | FR-085 | Roadmap |
| Managed dependent profiles (child, elderly parent without account) | P2 | FR-086 | Roadmap |

### F. Appointment suggestions and booking

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Specialty category suggestions and preparation checklist | P1 | FR-090 | If built (second cut) |
| Simulated providers and simulated booking | P1 | FR-091 | If built (second cut) |
| Real booking integrations | Future | FR-092 | Roadmap |

### G. Privacy, safety and security

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Fixed emergency message (no AI involved) | P0 | FR-100 | Live |
| Medical-advice boundary | P0 | FR-101 | Live |
| Disclaimers at every AI touchpoint | P0 | FR-102 | Live |
| Synthetic-data-only safeguards | P0 | FR-103 | Live |
| Audit events without PHI | P0 | FR-104 | Live (via access log if built) |
| Log hygiene and server-side secrets | P0 | FR-105 | Explained |
| Consent withdrawal | P1 | FR-106 | Spec |
| Sign-in, sign-out, session lifecycle | P0 | FR-001, FR-002 | Live |
| Onboarding disclaimer and consent | P0 | FR-003 | Live |
| Demo reset and seed | P0 | FR-006 | Operator only |

### Cross-cutting user experience

| Feature | Priority | FR | Demo |
|---|---|---|---|
| Loading, empty, error and success states everywhere | P0 | FR-120 | Live |
| Demo and simulation indicators (synthetic, simulated, cached, mock) | P0 | FR-121 | Live |

## 5. Priority adjustments and why

The user's priority rules were followed except where noted below. Each adjustment is a recorded decision (see the decision log in [01-executive-summary.md](01-executive-summary.md)).

| Decision | Adjustment | Reason | Owner |
|---|---|---|---|
| DEC-05 | **Ask (text Q&A) is P0**, but it is built **after** the Consultation Brief | It is the text interaction mode and end-to-end test E2E-04. The mandated build order puts the summary first. Ask reuses the brief's generator and validator. | C |
| DEC-06 | **ISL Visit Assist (Visit Card + ISL glossary) promoted to P0** | Sign language must not fall off the end of the queue. It is frontend-only (~40 min of Person A's time), and Person C prepares the content before the event. It is the only credible sign-language capability that fits in two days. | C |
| DEC-07 | **Reminders before mock booking**; booking is the second item cut | The mandated sequence asks for "a reminder **or** mock appointment flow". Reminders are real utility; booking is simulated by nature. | C |
| DEC-08 | **Direct grants** instead of invitation acceptance | It saves three endpoints and a screen. The owner's explicit grant with consent still satisfies "authorization before sharing". Invitation acceptance and identity verification are P2. | C |
| DEC-13 | **Sample import demoted to P1**; the demo uses a database snapshot plus one live upload | Upload already proves the pipeline. The snapshot makes the demo fast and repeatable. | C |
| DEC-15 | **P0 accepts PDFs only**; photos and scans are P1 | Vision OCR adds risk and was the first item on the cut ladder. Scanned PDFs fail clearly with an honest message (COPY-14). | C |
| DEC-04 | **No embeddings or vector database in the MVP** | A patient's whole record (≈5–15k tokens) fits in one request. Retrieval is patient-scoped and exact. Embeddings are the scale-up path. | B |

## 6. P1 build order

Follows the mandated sequence: family/access control → reminder → voice and sign language → others.

| Order | P1 item | Frontend | Backend | Expected outcome |
|---|---|---|---|---|
| 1 | Caregiver sharing (grant, scopes, revoke, family dashboard, access log) | FE-2.5, FE-6.1–6.3 | BE-9.1, BE-9.2 | Planned for Sprint 5 |
| 2 | Reminders (once/daily, IST, from follow-up facts) | FE-9.1, FE-9.2 | BE-10.1 | Planned for Sprint 5 |
| 3 | Read-aloud | FE-7.1 | none | Planned for Sprint 4 (15 min, no dependencies) |
| 4 | Speech-to-text question input | FE-7.2, FE-7.3 | none (`input_mode` already in API-21) | Pull in only if ahead |
| 5 | Browser notifications | FE-9.3 | none | Pull in only if ahead |
| 6 | Sample import, delete document, settings screen, ISL term links | FE-3.7, FE-3.8, FE-10.4, FE-8.3 | BE-4.5, BE-4.6 | Pull in only if ahead |
| 7 | Appointment suggestions and simulated booking | FE-9.4 | BE-11.1, BE-11.2 | Likely cut |
| 8 | Photo and scanned-PDF reading | FE-3.9 | BE-5.8 | Likely cut |

## 7. Cut ladder and never-cut list

Applied at gate **G1** (Day 1, 18:45), gate **G2** (Day 2, 09:00) and integration checkpoint **IC-4** (Day 2, 12:00). Cut from the top. Each cut has a pre-agreed replacement so the demo stays honest.

| Step | Cut | What replaces it in the demo |
|---|---|---|
| 1 | Photo and scanned-PDF reading (FR-024) | Scanned PDF shows the honest "not supported yet" state (COPY-14) |
| 2 | Appointment suggestions and simulated booking (FR-090, FR-091) | Roadmap slide; Visit Card already covers the interpreter request |
| 3 | Speech-to-text input (FR-056) | Read-aloud only; typed questions |
| 4 | Reminder recurrence and browser notifications (FR-073) | One-off in-app reminders |
| 5 | Reminders entirely (FR-070–FR-074) | The follow-up gap appears in the brief's "Missing information" |
| 6 | Access-log screen (FR-084) | Audit events still recorded; mentioned verbally |
| 7 | Caregiver sharing (FR-080–FR-083) | Isolation shown with two separate accounts (access denied page) |
| 8 | LLM narrative in the brief (FR-034) | Templated overview sentence |
| 9 | Ask (FR-035–FR-039) | Brief and timeline carry the demo; the safety boundary is explained with the copy deck |

**Never cut (the demo is not shown without these):**

- Sign-in and per-patient isolation (FR-001, FR-002, FR-005)
- PDF upload, processing and failure states (FR-010, FR-012)
- Extraction, validation and human review (FR-015–FR-020)
- Source links (FR-021) and the timeline (FR-022)
- Deterministic Consultation Brief with citations and print layout (FR-033)
- ISL Visit Assist (FR-060, FR-061)
- Safety text, disclaimers and emergency message (FR-100–FR-103)
- Degraded mode (FR-040)

## 8. Must not be represented as complete

These may appear in the roadmap or judge answers, but never as working features:

- Medical accuracy of extraction or answers beyond the measured synthetic test set
- Diagnosis, treatment advice or medication recommendations (by design, never)
- Live appointment booking, real provider availability, prices or credentials
- Sign-language translation in either direction, sign recognition or signing avatars
- Regulatory compliance of any kind, clinical validation or clinical benefit
- Production-grade security, encryption at rest or penetration-tested controls
- Reliable reminder delivery when the app is closed
- Integration with national health-record networks or hospital systems
- Support for languages other than English

## 9. Capacity summary

Detailed estimates are in [../fe-sprints/backlog.md](../fe-sprints/backlog.md) and [../be-sprints/backlog.md](../be-sprints/backlog.md). All estimates assume AI-assisted coding (ASM-06).

| Person | Available build time (Sprints 1–6 plus integration windows) | P0 demand | P1 demand (planned items) | Buffer |
|---|---|---|---|---|
| A — Frontend | ≈ 14.5 h | ≈ 12.2 h | ≈ 2.0 h | ≈ 0.3 h |
| B — Backend/AI | ≈ 14.5 h | ≈ 12.75 h | ≈ 1.5 h | ≈ 0.25 h |

Person B is the critical path. If B falls behind at a gate, apply the cut ladder immediately rather than borrowing time from stabilisation or rehearsal.
