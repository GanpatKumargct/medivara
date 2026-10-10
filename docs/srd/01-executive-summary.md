# 01 — Executive Summary, Recommended MVP, Assumptions and Decisions

> SRD section 5.1. Owner: **Person C**. Applies to the two-day hackathon build of **MediVara**.

## 1. Executive summary

**The problem.** People living with long-term conditions collect prescriptions, lab reports and discharge summaries from several providers. The documents are scattered, hard to read and sometimes contradictory, for example different medicine doses or conflicting allergy notes. In a short consultation, patients struggle to say what they take, what changed and what to ask. Deaf patients, people with limited reading ability and the family members who help them face even higher barriers. ([03-problem-and-personas.md](03-problem-and-personas.md))

**Intended users.** Patients managing records from several providers; authorised family caregivers; users with accessibility needs (limited reading, low vision, Deaf ISL users); and, as readers, the clinicians who receive a patient-prepared summary.

**Product value.** MediVara turns scattered documents into a **verified, source-linked medical history** and a one-page **Consultation Brief** (a visit-preparation summary).
- Every line traces back to the original page.
- MediVara flags where documents disagree or are missing information.
- It answers questions only from the patient's own records.
- It never diagnoses, prescribes or decides which document or clinician is right.

**Proposed solution (hackathon prototype).** A React web app and a FastAPI backend, using Google Gemini inside a **bounded, validated AI workflow**:
1. Upload synthetic PDFs.
2. Line-level text extraction.
3. Gemini extracts facts with line citations.
4. Rule-based validation and confidence.
5. Human review.
6. Deterministic timeline, consistency findings and brief.
7. Grounded Q&A and a short narrative, each validated per statement before display.

Also included:
- **Accessibility:** ISL Visit Assist (Visit Card plus official ISL dictionary videos), read-aloud, plain language.
- **Privacy:** consent-based caregiver access with instant revoke; an audit log.
- **Resilience:** a degraded mode that keeps the app useful when the AI service is unavailable.

**Differentiators.**
1. **Evidence-linked by design:** every claim resolves to a document line.
2. **"Facts first, AI second":** deterministic organisation, with the AI limited to reading and wording, and validated.
3. **Accessible and family-safe:** sign-language-aware visit support and scoped, revocable sharing.

**Hackathon objective.** Demonstrate one complete, reliable, honest workflow on synthetic data: fragmented records → organised timeline → source-linked brief and answers, followed by accessibility and safe family access. Do this within 4.5 minutes, backed by measured evidence (MET-01 to MET-11) and with no unsupported claims.

## 2. Recommended MVP scope

| Layer | In the MVP (P0, never cut unless stated) | Added if the core is stable (P1, in order) | Roadmap only (P2 / Future) |
|---|---|---|---|
| Records | PDF upload; processing states; line extraction; Gemini extraction with citations; rule validation; review (confirm, correct, reject, bulk); document detail edits | Sample import; delete; photo and scan OCR | Encounter merging; health-record network imports |
| Organisation | Deterministic timeline with change markers; consistency and gap findings | Reminders from follow-up facts | Push notifications |
| AI help | Consultation Brief (deterministic) with print; validated narrative (cut step 8); Ask with intent gate, citations, not-found, advice redirect (cut step 9); degraded mode | Speech input for Ask | Ranked and semantic retrieval; LLM classifier; identifier redaction |
| Accessibility | WCAG-oriented baseline; display preferences; plain language; **ISL Visit Assist** | Read-aloud; ISL term links | Voice navigation; Indian languages; ISL recognition research |
| Family and privacy | Sign-in, isolation, consent, audit, synthetic-only safeguards | Caregiver grants, scopes, revoke, access log | Invitations and identity verification; dependent profiles |
| Appointments | n/a | Simulated suggestions and booking (likely cut) | Real booking integrations |

Full matrix: [02-scope-and-priority-matrix.md](02-scope-and-priority-matrix.md). Roadmap: [13-scope-and-roadmap.md](13-scope-and-roadmap.md).

## 3. Key technical choices

| Choice | Decision | Detail |
|---|---|---|
| Frontend | React + TypeScript + Vite; Tailwind + shadcn/ui; TanStack Query; MSW mocks | [06-architecture.md](06-architecture.md) |
| Backend | Python FastAPI; SQLite (WAL); PyMuPDF; local private file store | [06-architecture.md](06-architecture.md) |
| AI | Gemini (`gemini-3.8-flash`) through the official SDK; `store=false`; JSON schemas; one call in flight; no agent framework; no vector database in the MVP | [08-ai-rag-design.md](08-ai-rag-design.md) |
| Contract | 33 endpoints (21 P0, 12 P1); P0 frozen Day 1 09:45 | [11-api-contract.md](11-api-contract.md) |
| Demo | One laptop runs everything; snapshot restore; backup video | [../hackathon/execution-schedule.md](../hackathon/execution-schedule.md) |

## 4. What MediVara will not claim

- Medical accuracy (beyond measured synthetic results), clinical benefit or validation.
- Regulatory compliance or production-grade security.
- Sign-language translation.
- Live booking.
- Guaranteed reminders.
- Integration with health-record networks or hospitals.

Full list with alternative wording: [../hackathon/demo-and-judging-strategy.md](../hackathon/demo-and-judging-strategy.md) §8.

## 5. Assumptions

| ID | Assumption | Impact if wrong | Owner / check |
|---|---|---|---|
| ASM-01 | Planning documents may be prepared before the event; whether synthetic assets and prompt texts may also be prepared in advance must be confirmed | Day-1 time is needed to create the PDFs (schedule allows 09:00–10:30) | C, before the event |
| ASM-02 | Both days run 09:00–19:00; judging about 17:30 on Day 2 | Shift all blocks by the same offset; shorten Sprint 5 first | C, before the event |
| ASM-03 | The venue has internet; a phone hotspot is available as backup | Degraded mode and the backup video | C, Day 1 |
| ASM-04 | All three laptops can run Node LTS and Python 3.11+; one has reliable display output | Use another laptop as the demo machine | All, T−1 |
| ASM-05 | Paid Tier-1 Gemini billing is available (team card or hackathon credits) | Free-tier quotas may be too low, and free-tier content may be used by Google; synthetic data only in any case | B, T−3 |
| ASM-06 | Developers use AI-assisted coding (for example Claude Code); estimates assume this | Apply the cut ladder earlier | All |
| ASM-07 | The demo runs in desktop Chrome or Edge | Speech input unavailable in other browsers | A |
| ASM-08 | Target users are in India; English UI in the prototype; Indian Sign Language | Re-scope the language and sign-language content | C |
| ASM-09 | Judges value a working end-to-end flow, credibility and safety over breadth | Breadth-first plans risk an unfinished demo | C |
| ASM-10 | No real patient data; no user or clinical validation is possible in two days; user needs are hypotheses H-01 to H-08 | Claims are limited accordingly | C |
| ASM-11 | Official ISLRTC dictionary videos can be embedded with attribution | Glossary shows text and links only (fallback) | C, before the event |
| ASM-12 | Team skills are mixed; ownership is by role; Person C is not a full-time engineer | Estimates and the cut ladder already assume this | C |

## 6. Decision log

| ID | Decision | Owner | Rationale | Reference |
|---|---|---|---|---|
| DEC-01 | Use the Google Gemini API as the LLM provider | Team (confirmed) · B implements | The provider the team has access to | [08-ai-rag-design.md](08-ai-rag-design.md) §12 |
| DEC-02 | React + TypeScript + Vite frontend; Python FastAPI backend | A (frontend), B (backend) | Common skills; Python suits PDF and AI work | [06-architecture.md](06-architecture.md) §5 |
| DEC-03 | "Facts first, AI second" architecture | B · reviewed by C | Traceability, safety, works when the AI is down | [08-ai-rag-design.md](08-ai-rag-design.md) §1 |
| DEC-04 | No embeddings or vector database in the MVP; full patient context under a cap | B | Small records; exact recall; less infrastructure | [08-ai-rag-design.md](08-ai-rag-design.md) §7 |
| DEC-05 | Ask is P0 but built after the brief | C | Text mode and E2E-04, while respecting the mandated build order | [02-scope-and-priority-matrix.md](02-scope-and-priority-matrix.md) §5 |
| DEC-06 | ISL Visit Assist promoted to P0 | C | Sign language must not fall off the queue; cheap and frontend-only; honest capability | [09-multimodal-accessibility.md](09-multimodal-accessibility.md) §4 |
| DEC-07 | Reminders before simulated booking; booking is the second cut | C | The mandated sequence allows "reminder or mock appointment"; reminders are real utility | [02-scope-and-priority-matrix.md](02-scope-and-priority-matrix.md) §6 |
| DEC-08 | Owner grants access directly (no invitation acceptance) in the MVP | C (product) · B (implementation) | Saves time; explicit owner consent is still captured; invitations are P2 | FR-080, FR-085 |
| DEC-09 | Display preferences and Visit Card choices stored on the device | A | Per-viewer conveniences; no extra endpoint | [10-ui-screen-spec.md](10-ui-screen-spec.md) §1 |
| DEC-10 | Gemini runtime: `store=false`, paid Tier-1, separate demo project and key, `thinking_level` low, default sampling | B | Privacy, quota isolation, latency, Google's guidance | [08-ai-rag-design.md](08-ai-rag-design.md) §12.1 |
| DEC-11 | P0 contract freezes at IC-0 (09:45 Day 1), P1 at G1 (18:45 Day 1); change policy | C (process) · B (contract owner) | Parallel work without drift | [../hackathon/integration-plan.md](../hackathon/integration-plan.md) §1, §5 |
| DEC-12 | Synthetic data only; decline real reports | C | Prototype, cloud AI, no production safeguards | FR-103 |
| DEC-13 | Sample import is P1; the demo uses a snapshot plus one live upload | C | Speed and repeatability | [../hackathon/synthetic-demo-data-pack.md](../hackathon/synthetic-demo-data-pack.md) §9 |
| DEC-14 | Opaque session tokens stored hashed; 12-hour expiry | B | Revocable and simple | FR-001, FR-002 |
| DEC-15 | P0 accepts PDFs only; photos and scans are P1 | C | Reduces risk; honest failure for scans | FR-024 |
| DEC-16 | Day-first date parsing with an ambiguity flag | B | Indian date convention; avoids silent swaps | [08-ai-rag-design.md](08-ai-rag-design.md) §6 |
| DEC-17 | Emergency and advice requests handled by rules with fixed text before any AI call | B (rules) · C (copy) | Safety must not depend on the model | FR-035, FR-100 |
| DEC-18 | Demo machine and integration environment = Person C's laptop (confirm at G1) | C | Continuous verification of the exact demo setup | [../hackathon/integration-plan.md](../hackathon/integration-plan.md) §6 |
| DEC-19 | Component library: shadcn/ui recommended (Mantine acceptable), decided by IC-0 | A | Accessible primitives and speed; no mid-build switch | [06-architecture.md](06-architecture.md) §5 |
| DEC-20 | Family demo uses two browser windows with per-tab sessions | C (demo) · A (session design) | No sign-out and sign-in mid-demo | [../hackathon/demo-and-judging-strategy.md](../hackathon/demo-and-judging-strategy.md) §4 |
| DEC-21 | Emergency numbers (112, 108, Tele-MANAS 14416) re-verified before the event | C | Fixed safety text must be correct | COPY-05 |
| DEC-22 | Brief medicines come only from the most recent document that lists medicines; older ones are labelled as such | B · reviewed by C | Never present outdated medicines as current | [08-ai-rag-design.md](08-ai-rag-design.md) §9.2 |

New decisions are added by Person C during the hackathon, with an owner and a reason ([../hackathon/integration-plan.md](../hackathon/integration-plan.md) §8).
