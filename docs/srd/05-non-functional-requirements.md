# 05 — Non-Functional Requirements

> SRD section 5.5. Owners: Person B (security, privacy, performance, reliability), Person A (accessibility, usability, compatibility), Person C (verification).
> **Prototype targets** are team goals, measured on the demo laptop with the synthetic dataset. They are not industry benchmarks. **Production requirements** describe what a real deployment would need; none of them is claimed for the prototype.

## 1. How to read this document

| Column | Meaning |
|---|---|
| Prototype target | What the hackathon build must achieve. Measurable. |
| How measured | The test or check that proves it (test IDs in [../hackathon/test-plan.md](../hackathon/test-plan.md)). |
| Production requirement | What would be needed beyond the prototype. Roadmap only. |

## 2. Security (NFR-SEC)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-SEC-01 | Authentication on every non-public endpoint | 100 % of endpoints except API-01 and API-02 return 401 without a valid token | Route inventory plus TC-AUTH-03 | SSO or passwordless login, MFA, rate limiting, credential-stuffing protection |
| NFR-SEC-02 | Authorisation per patient and scope | 100 % of patient-scoped endpoints pass the permission matrix (3 roles × all endpoints) | TC-ACC-01…10 run by Person C; pytest IDOR suite (BE-3.5) | Attribute-based access, database row-level security, periodic access reviews |
| NFR-SEC-03 | Upload hardening | File type from magic bytes; 10 MB and 10-page limits; sanitised names; stored outside the web root under random names; served with `nosniff` and `no-store` | TC-SEC-01…03 | Malware scanning, content disarm and reconstruction, quarantine bucket |
| NFR-SEC-04 | Secrets stay server-side | 0 secrets in the repository or frontend bundle | TC-SEC-05 (search the repo and build output) | Managed secret store, rotation, per-environment keys |
| NFR-SEC-05 | Session handling | Opaque random tokens, stored hashed; 12 h expiry; sign-out revokes; never placed in URLs | TC-AUTH-04, TC-AUTH-05 | Short-lived access tokens with refresh rotation, device management, anomaly detection |
| NFR-SEC-06 | Transport security | Local demo uses localhost through the Vite proxy (no network exposure) | Readiness checklist | TLS everywhere, HSTS, certificate management |
| NFR-SEC-07 | Dependency hygiene | Dependency versions pinned at kickoff; only well-known libraries | Code review at IC-0 | Automated vulnerability scanning, SBOM, patch SLAs |

## 3. Privacy (NFR-PRIV)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-PRIV-01 | Data minimisation to the AI service | Extraction sends one document's page lines. Ask and narrative send only this patient's lines and facts. Account data, other patients and audit data are never sent. | Code review of the Gemini wrapper; TC-ACC-07 | De-identification before sending; data-processing agreement |
| NFR-PRIV-02 | No server-side storage at the AI provider beyond what its terms require | 100 % of Gemini calls set `store=false` and are stateless | Wrapper unit test asserts the parameter; review at IC-2 | Enterprise or paid terms with no training on data; residency review; retention guarantees in contract |
| NFR-PRIV-03 | No PHI in logs | 0 occurrences of synthetic patient names, medicine names, lab values or question text in application logs after a full rehearsal | TC-SEC-04 (log search) | Central log pipeline with redaction, access control and retention |
| NFR-PRIV-04 | Synthetic data only | Warning on SCR-01, SCR-02 and SCR-05; every sample PDF watermarked; team script for declining real data | TC-SAFE-09, copy audit | Consent management and a privacy programme aligned with Indian data-protection law (to be assessed by qualified advisers) |
| NFR-PRIV-05 | Deletion | (P1) Document delete hides the document everywhere at once and keeps it in Recently deleted for 30 days (DEC-27); "Delete permanently" removes file, pages, facts and version history in one request, as does the 30-day clean-up; demo reset wipes everything | TC-DOC-08 | Retention schedules, deletion from backups, data-subject request handling |
| NFR-PRIV-06 | Purpose limitation for caregivers | Caregivers see only granted profiles and scopes; every access recorded | TC-ACC-04…06, TC-FAM-04 | Proxy verification, time-limited access, owner notification of access |

## 4. Accessibility (NFR-A11Y)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-A11Y-01 | WCAG 2.1 AA-oriented interface | 0 critical or serious automated accessibility violations on P0 screens (SCR-01, 02, 04–09, 11, 16) | Axe browser extension at the Day-1 17:30 audit and at IC-4 (TC-A11Y-01) | Formal WCAG 2.2 AA audit including manual testing; accessibility statement |
| NFR-A11Y-02 | Keyboard operability | The golden path (sign in → upload → review → timeline → brief → print) can be completed with the keyboard only, with visible focus throughout | TC-A11Y-02 | Same, plus switch-access and voice-control testing |
| NFR-A11Y-03 | Text resize and reflow | At 200 % browser zoom and at 320 px width, no loss of content or function on P0 screens | TC-A11Y-03 | Same |
| NFR-A11Y-04 | Screen reader support | Landmarks, labelled controls, polite live regions for processing status and answers, assertive for emergencies; smoke-tested with one screen reader (NVDA, VoiceOver or Orca) | TC-A11Y-04 | Testing with several screen readers and with disabled users |
| NFR-A11Y-05 | Plain language | Copy deck and sample answers target grade 6–8 reading level | TC-A11Y-05 (readability check by Person C) | Testing with users with limited literacy; Indian-language versions |
| NFR-A11Y-06 | No colour-only meaning | Every status or badge has text or an icon | TC-A11Y-06 | Same |
| NFR-A11Y-07 | Deaf accessibility | Every feature works without sound; Visit Card full-screen mode at 7:1 contrast with text of at least 28 px | TC-ISL-01, TC-ISL-04 | Co-design with Deaf users; ISL content reviewed by qualified interpreters |
| NFR-A11Y-08 | Motion | Reduced-motion preference respected; no flashing content | TC-A11Y-06 | Same |

## 5. Usability (NFR-USE)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-USE-01 | Efficient golden path | From the dashboard with processed documents to a printed brief takes 8 interactions or fewer | Timed walkthrough by Person C | Task-success and time-on-task targets from usability studies |
| NFR-USE-02 | Actionable errors | Every error message says what happened and what to do next | Copy audit against the copy deck | Same, in every supported language |
| NFR-USE-03 | Fast review | Bulk confirm reduces the review of a typical 5-fact document to 3 interactions or fewer when facts are high confidence | Timed walkthrough | Measured in usability tests (H-08) |
| NFR-USE-04 | Consistency | One component set and one set of badges, used everywhere | Design review at IC-3 | Design system with documentation |

## 6. Performance (NFR-PERF)

Measured on the demo laptop, with the demo dataset, over the venue network.

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-PERF-01 | Deterministic endpoints | API-06, 07, 10, 11, 17, 18 and 19 respond in 500 ms or less (95th percentile over 20 calls) | Browser developer tools during rehearsal (TC-PERF-01) | Service-level objectives with monitoring |
| NFR-PERF-02 | Extraction time | A 1–2 page synthetic PDF reaches `needs_review` in 30 s or less typically; hard timeout 60 s | Stopwatch over 5 uploads (TC-PERF-02) | Queue-based processing with progress events; capacity planning |
| NFR-PERF-03 | Ask latency | Answer in 20 s or less; otherwise the evidence-only fallback | TC-PERF-03 over the evaluation set | Streaming with incremental validation; caching |
| NFR-PERF-04 | Narrative latency | 25 s or less; the brief sections never wait for it | TC-PERF-03 | Same |
| NFR-PERF-05 | Responsiveness during processing | Polling and other requests keep responding (NFR-PERF-01) while extraction runs | TC-PERF-04 | Separate worker processes |
| NFR-PERF-06 | Frontend load | First meaningful screen in 2 s or less on the demo laptop | Developer tools (TC-PERF-05) | Performance budgets, CDN |

## 7. Reliability and error handling (NFR-REL)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-REL-01 | Degraded mode | With the AI mode set to `off`: timeline and brief work; Ask returns evidence only; uploads of sample files use the cache; no crash | Failure drill in rehearsal 2 (TC-REL-01) | Multi-provider fallback; circuit breakers |
| NFR-REL-02 | No raw errors | 0 raw errors, stack traces or blank screens in E2E runs | TC-REL-02 | Error monitoring and alerting |
| NFR-REL-03 | Demo recovery | Snapshot restore in 2 minutes or less | TC-REL-03 | Backups with tested restore, disaster recovery |
| NFR-REL-04 | Demo repeatability | 3 consecutive clean rehearsals of the golden path | Rehearsal log (MET-09) | Availability targets with an error budget |
| NFR-REL-05 | AI failure detection | Blocked, filtered, empty or schema-invalid model responses are treated as failures even when HTTP succeeds | Wrapper unit tests with recorded failure responses (TC-REL-04) | Same, with provider status monitoring |

## 8. Maintainability (NFR-MNT)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-MNT-01 | Contract discipline | All changes after IC-0 recorded in the contract changelog; fixtures updated in the same commit | Integration checkpoints | API versioning and generated clients |
| NFR-MNT-02 | Configuration | Model IDs, thinking level, timeouts, AI mode and demo mode set through environment variables, never hard-coded | Review at IC-2 | Configuration service, feature flags |
| NFR-MNT-03 | Prompt versioning | Every AI output stores `prompt_version`; prompt texts live in one module per stage | Review at IC-4 | Prompt registry with evaluation gates |
| NFR-MNT-04 | Runbook | README run instructions of 10 steps or fewer for each service | Person C follows them on a clean laptop before the event | Full operational documentation |
| NFR-MNT-05 | Traceable work | Commit messages and branch names include task IDs (for example `BE-5.4`) | Spot check at gates | Same |

## 9. Auditability and traceability (NFR-AUD)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-AUD-01 | Audit events | Every action in the audit list ([07-data-model.md](07-data-model.md) §3.14) writes an event with no PHI | TC-SEC-06 | Tamper-evident, append-only audit store with retention |
| NFR-AUD-02 | AI output records | 100 % of displayed answers and narratives have an AIOutput row with evidence snapshot and validation report | TC-ASK-08 | Same, plus reviewer tooling |
| NFR-AUD-03 | Source traceability | 100 % of displayed facts and record statements resolve to a document, page and line (MET-02) | TC-BRF-03, TC-ASK-02 | Same, with visual highlighting in the original |

## 10. Scalability considerations (NFR-SCL)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-SCL-01 | Prototype scale | Single machine; up to 10 demo users and about 50 documents | Not load-tested | Horizontal API scaling, managed Postgres, object storage, task queue, read replicas |
| NFR-SCL-02 | Context cap | When a patient's lines exceed the cap, the most recent documents are used and a notice is shown | TC-ASK-09 | Ranked and semantic retrieval (FR-045, FR-046) |
| NFR-SCL-03 | AI throughput | One model call in flight at a time; one retry with backoff | Wrapper review | Rate-limit-aware queues, batch processing, quota monitoring |

## 11. Compatibility and responsive design (NFR-CMP)

| ID | Requirement | Prototype target | How measured | Production requirement |
|---|---|---|---|---|
| NFR-CMP-01 | Browsers | Latest desktop Chrome and Edge fully supported; latest Firefox and Safari support everything except speech input | TC-CMP-01 (smoke test in two browsers) | Defined support matrix including older Android devices |
| NFR-CMP-02 | Screen sizes | P0 screens usable from 360 px to 1440 px wide | TC-CMP-02 | Same, plus native apps where justified |
| NFR-CMP-03 | Print | Brief and Visit Card print correctly on A4 | TC-BRF-05, TC-ISL-02 | Same |
| NFR-CMP-04 | Locale | English (India); dates as `DD Mon YYYY`; day-first parsing; IST labels | TC-TL-04, TC-REM-03 | Indian-language localisation, right-to-left not required |
