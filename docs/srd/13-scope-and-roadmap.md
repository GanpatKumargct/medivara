# 13 — Scope and Roadmap

> SRD section 5.13. Owner: **Person C**. Priorities and the cut ladder are defined in [02-scope-and-priority-matrix.md](02-scope-and-priority-matrix.md); this document places them on a timeline.

## 1. Two-day hackathon MVP (P0, never cut)

The single end-to-end workflow, built on synthetic data:

1. Sign in with demo accounts; onboarding with disclaimer and consent; per-patient isolation (FR-001–FR-006).
2. Upload text-layer PDFs; visible processing; honest failures (FR-010, FR-012–FR-014).
3. Line-level text extraction; Gemini structured extraction; rule-based validation and confidence (FR-015–FR-017, FR-031).
4. Side-by-side review with confirm, correct, reject, bulk confirm and document-detail correction (FR-018–FR-020).
5. Source links everywhere; deterministic timeline with change markers (FR-021, FR-022).
6. Consultation Brief: deterministic sections, points to clarify, missing information, questions, print, validated narrative (FR-032–FR-034, FR-041).
7. Ask: emergency and advice gate, grounded answers with citations, not-found and uncertainty handling (FR-035–FR-039).
8. Degraded mode and golden cache (FR-040).
9. ISL Visit Assist: Visit Card and official ISL glossary (FR-060, FR-061).
10. Safety and privacy basics: emergency message, advice boundary, disclaimers, synthetic-only safeguards, audit, log hygiene (FR-100–FR-105).
11. Accessible, polished UI with every state (FR-050, FR-051, FR-120, FR-121).

## 2. Stretch goals if time permits (P1, in build order)

| Order | Item | Requirements | Expected |
|---|---|---|---|
| 1 | Caregiver sharing, family dashboard, revoke, access log | FR-080–FR-084 | Planned (Sprint 5) |
| 2 | Reminders: once and daily, IST, from follow-up facts | FR-070–FR-072, FR-074 | Planned (Sprint 5) |
| 3 | Read-aloud | FR-055 | Planned (Sprint 4) |
| 4 | Speech-to-text question input | FR-056 | Only if ahead |
| 5 | Browser notifications while open | FR-073 | Only if ahead |
| 6 | Sample import, document delete, settings screen, ISL term links, consent withdrawal | FR-011, FR-023, FR-062, FR-106 | Only if ahead |
| 7 | Appointment suggestions, simulated booking, interpreter request | FR-090, FR-091, FR-063 | Likely cut |
| 8 | Photos and scanned PDFs (vision OCR); more document types | FR-024, FR-025 | Likely cut |

## 3. Post-hackathon development

| Phase | Goal | Main work | Exit criteria |
|---|---|---|---|
| **Phase 1 — Validate (about 4–6 weeks)** | Confirm the problem and the design with real users, still on synthetic or consented test data | Interviews and usability tests for H-01–H-08; clinician review of sample briefs; co-design sessions with Deaf community organisations and ISL interpreters; fix usability issues | Evidence for or against each hypothesis; prioritised backlog |
| **Phase 2 — Harden (about 2–3 months)** | Make the core workflow robust | Vision OCR and more document types; ranked and semantic retrieval; invitation acceptance; consent management; production identity; encrypted storage; managed database with row-level security; evaluation datasets and regression tests; security testing | Agreed accuracy targets on a larger labelled set; security review passed |
| **Phase 3 — Accessibility and language** | Broaden access | Tamil and Hindi UI and voice; expanded ISL glossary with expert review; interpreter-service integration; push notifications | Accessibility audit; tests with target users |
| **Phase 4 — Ecosystem (requires partnerships)** | Connect to the health system | Interoperability with national health-record networks (patient-consented record exchange); real provider directories and booking; clinic-facing view of briefs | Partnerships, legal and compliance work completed by qualified advisers |

Durations are indicative planning ranges, not commitments.

## 4. Must not be represented as complete until properly validated

| Capability | Status | What would be required before claiming it |
|---|---|---|
| Medical accuracy of extraction or answers | Measured only on a small synthetic set | Large labelled real-world evaluation, clinical review, monitoring |
| Clinical benefit or safety | Not studied | Clinical studies and a clinical safety case |
| Regulatory compliance (data protection, medical device or other) | Not assessed | Assessment by qualified legal and regulatory advisers |
| Production-grade security | Prototype controls only | Security architecture, penetration testing, certification as appropriate |
| Sign-language translation, recognition or avatars | Not built | Co-design with Deaf communities, linguistic expertise, large datasets, validation across signers |
| Live appointment booking, provider availability, prices, credentials | Simulated only | Partner integrations, provider verification |
| Reliable reminder delivery | In-app only while open | Push infrastructure, delivery tracking, fallbacks |
| Health-record network or hospital integration | Not built | Partnerships, standards conformance, certification |
| Indian-language support | Not built | Translation, localisation, testing with users |
| Caregiver identity or legal authority verification | Not built | Identity verification and guardian processes |
