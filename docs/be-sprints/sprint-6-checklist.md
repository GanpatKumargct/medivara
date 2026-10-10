# Backend Sprint 6 — Checklist

> Status of [sprint-6-stabilise.md](sprint-6-stabilise.md) on branch `be/BE-1.1-sprint1-foundation`. Last checked 2026-10-10.
> Legend: **[x]** done and verified · **[~]** done, with a note · **[ ]** open (owner shown).
> Automated evidence: `cd backend && uv run pytest` → **269 passed** (15 test files). Mutation checks: disabling the validator's safety patterns, the golden-cache lookup or the reminder scope each makes tests fail. Model calls use the fake transport.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| BE-15.2 IC-5 integration support | [—] | No frontend in this run |
| BE-3.5 Isolation and IDOR suite | [x] | `tests/test_isolation.py`: the 6 named cases; the **full permission matrix** (21 endpoints × owner / caregiver / no grant, with the expected error codes); resource-binding rows both ways (15 calls → 404); every denial audited; revoke rows |
| BE-8.3 Validator and gate tests; evaluation helper | [x] | `tests/test_validator_gate.py`: a failing and a passing case for every AG-12 check (19 pairs), withholding thresholds, question filtering, 46 gate cases across the emergency, advice and continue families. `scripts/eval_run.py` runs Q / S / I / X sets over HTTP and writes Person C's CSV |
| BE-15.1 Contract key test | [x] | `tests/test_contract_p0.py`: **every** P0 fixture file (API-01 to API-21, 39 files incl. the 7 derived ones) against a real response, plus status checks; fails if a P0 fixture has no producer. Shared error fixtures, API-03, API-12, API-13, API-14 shapes |
| BE-14.1 Log hygiene and PHI check | [x] | `tests/test_security.py`: one flow through every feature (upload, review, brief, narrative, Ask incl. safety prompts, reminders, sharing, revoke, access log, failed login, logout); 24 search terms, literal match → 0 hits |
| BE-14.2 AI failure-drill support | [x] | `off` and `cache_only` verified on live servers in Sprints 4 and 5 (11/11 and 3/3 checks) and in unit tests; README "Failure drills" section |
| BE-14.3 Security headers and upload hardening | [x] | No route or mount serves storage; storage keys validated; type from content (real PDF named `.txt` accepted; HTML and PNG named `.pdf` rejected); control characters, back-slashes and long names sanitised; safe `Content-Disposition` |
| BE-15.3 Bug-fix buffer | [x] | Independent code review → 10 findings, each reproduced by a failing test first, all fixed (below); snapshot tooling gap closed |

## Code-review findings fixed (`tests/test_review_fixes.py`, 22 tests)

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **High** | Imperative advice passed the validator ("Stop Metformin now.", "Consider stopping Metformin.", "Double your Metformin.") | Medicine verb shortly before a patient medicine name → `prescriptive`; "best to / consider / no longer needed" patterns. Quoting a prescription ("says to take Metformin…") still passes |
| 2 | Medium | Emergency gate missed "heart attack", "want to die", "not breathing", "chest hurts", "took double my dose" | Added to the emergency patterns |
| 3 | Medium | `questions_for_doctor` only had the phrase check ("Should I take 1000 mg of Insulin instead?" passed) | Questions with numbers, interpretation words, diagnosis words, "too / instead / more…" or medicine verbs are dropped |
| 4 | Medium | Explanations could name the patient's medicines when they cited a line | Explanations never mention a patient medicine |
| 5 | Medium | Correcting a fact's date did not move it on the timeline or brief | `event_date` re-parsed on correction (422 if it isn't a date) |
| 6 | Low | Gate and validator ignored user-corrected medicine names | Both the written and the corrected names are used |
| 7 | Low | "Today" used the server's local date, not IST (UTC host, 00:00–05:30 IST) | `today_ist()` for the future-date checks in validation and API-14 |
| 8 | Low | Reprocessing could delete facts that reminders link to | Reprocess returns 409 while a reminder uses the document's facts |
| 9 | Low | Oversized uploads were spooled to disk before the 413 | Middleware refuses bodies over 10 MB + 64 KB by `Content-Length` before reading |
| 10 | Low (beyond spec) | Ask and the narrative still sent records to Gemini after AI consent was withdrawn | No model call without the owner's current `ai_processing` consent: Ask returns matching lines (`consent_required` notice), narrative `unavailable`; emergency routing unaffected |

Review result with no findings: cross-patient leaks / IDOR, PHI in logs.

## Also added

- **Demo snapshots** (`app/snapshot.py`; FR-006, missing since BE-2.2): `save` (consistent while running), `restore` (DEMO_MODE only, under 2 s for the test data), `list`. Round-trip test restores documents, files and grants.
- **Derived fixtures** (`scripts/derive_fixtures.py`): API-11 ready / failed-no-text-layer / suspicious / cached, API-19, API-21 withheld / out-of-scope — the Sprint 1 open item.

## Exit criteria (IC-6)

- [x] The pytest suite passes: isolation, validator, contract keys — 269 tests.
- [~] TC-SEC-04 (no PHI in logs) and TC-SEC-05 (no secrets) pass here; **repeat on the demo laptop** after a rehearsal.
- [x] Degraded-mode drill passes (Sprint 4 and 5 live runs; unit tests).
- [~] Snapshot restore works and is fast; **`snapshot-demo` itself needs real extractions** on the demo laptop.
- [ ] Person C tags `demo-v1` — **nothing is committed yet**.

## Open items for the team

1. **Live Gemini key** (Person B): every AI path is verified only with the fake model. Then run `scripts/eval_run.py` for MET-03/04/05/11 and fill the golden cache.
2. **Copy for Person C:** the `consent_required` notice text, the `UNREADABLE_PDF` message, and the generic advice question are placeholders.
3. **Contract notes for Person B:** API-21 withheld uses COPY-08b (AI design §8.4) where the contract's prose says COPY-08; access-list emails are shown unmasked to the owner (as in the fixture).
4. Decisions carried over: DOC-6 date versus the follow-up gap; where the Metformin dose marker sits.
