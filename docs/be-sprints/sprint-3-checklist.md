# Backend Sprint 3 — Checklist

> Status of [sprint-3-day1-eve.md](sprint-3-day1-eve.md) on branch `be/BE-1.1-sprint1-foundation`. Last checked 2026-10-10.
> Legend: **[x]** done and verified · **[~]** done, with a note · **[ ]** open (owner shown).
> Automated evidence: `cd backend && uv run pytest` → 89 passed, 3 consecutive runs. Model calls use the fake transport (`tests/fake_model.py`), whose canned outputs follow the data-pack answer key.

## Entry criteria

- [~] IC-2 passed — backend side yes; the live-model items from [sprint-2-checklist.md](sprint-2-checklist.md) are still open.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| BE-5.5 Remaining checks (value and strength in cited lines) | [x] | Done in Sprint 2 (`pipeline/validation.py`) |
| BE-5.6 Injection screening (AG-03) | [x] | `pipeline/screening.py`; flagged lines excluded from the model input **and** rejected as citations; `suspicious_instructions` flag with COPY-13 and `line_ids`. Only DOC-6 p1-l5 is flagged across all 9 text demo PDFs |
| BE-6.1 Fact review (API-15, API-16) | [x] | `routers/facts.py`, `review.py`: data-model §6 transitions (409 otherwise); field-key and length checks; history keeps the original; document becomes `ready` when nothing is unverified; audit events (field names only, never values) |
| BE-4.4 Reprocess and document patch (API-13, API-14) | [x] | Reprocess only from `failed`, or `needs_review` with nothing reviewed. Patch: type, date (not future), facility, clinician; title rebuilt; setting the date clears the ambiguity flag and banner and re-scores the facts; user-corrected fields survive reprocessing |
| BE-6.2 Timeline (API-17) | [x] | `organise/records.py`, `organise/timeline.py`, `routers/timeline.py`: date groups, newest/oldest first, undated group, type and date filters, include-unverified toggle; rejected facts never shown; `change` is null until BE-6.3 |
| BE-7.1 Consistency and gap rules (AG-07) | [~] | `organise/rules.py`: all 7 rules. The 4 planted findings match the API-18 fixture texts and suggested questions word for word. **Gate not evaluated:** the sheet runs this task only if extraction accuracy is ≥ 90 %, which needs the live model |

## Exit criteria (IC-3)

- [~] 1. Golden path #1 — live server, fake model: 5 uploads (202 in 18–30 ms) → 33 facts → bulk confirm DOC-5 (9 confirmed, `ready`) → DOC-4 date set (ambiguity cleared) → timeline in date order (9 ms) → the Metformin 1000 mg event opens DOC-5 page 1 at its exact line. **Repeat with mocks off in the frontend and the live model.**
- [x] 2. Reject and undo work; rejected facts disappear from the timeline.
- [x] 3. DOC-6 is flagged, and p1-l5 never appears in any model request.
- [ ] 4. Person C records MET-01 and checks every sample document against the answer key — needs the live model.

## G1 actions

- [ ] Commit, push, tag `d1-stable` — **Person B / C** (nothing committed yet).
- [ ] `snapshot-G1` of the database and storage folder — needs a run with real extractions.
- [x] P1 contract freeze: no contract changes were made in Sprints 1–3.
- [ ] "Day 2 first hour" note — suggested: the live-model smoke call and MET-01, then BE-6.3 and BE-2.4 as planned.

## Open decision (Person C)

**DOC-6 hides the planted follow-up gap.** RULE-FOLLOWUP-NO-APPT fires only when no later document exists. DOC-6 (clinic note, 16 Sep 2026) is one day after DOC-5's "Review after 6 weeks…" (15 Sep 2026), so once DOC-6 is processed — and it is in the demo starting state — the "Missing information" follow-up item disappears. The API-18 fixture was built without DOC-6. Options:
1. Date DOC-6 15-Sep-2026 (same visit as DOC-5). Smallest change; data pack only. **Recommended.**
2. Leave DOC-6 out of the demo starting state.
3. Redefine "later visit" (for example, ignore notes from the same clinic within a few days). Needs a rule decision.

The current behaviour follows the rule as written and is pinned by `test_clinic_note_after_the_prescription_counts_as_a_later_document`.

## Deviations and notes

- **Frequency comparison:** "at night" (and HS, at bedtime) normalise to "once daily". Without this, Atorvastatin "once daily" + "at night" (DOC-3) vs "at night" (DOC-5) would be a false "documents differ" finding.
- **COPY-30d punctuation** follows the API-18 fixture (`says "…report." No later visit…`), not the copy deck's `says "{instruction}". …`, which would print two full stops. Person C to align the copy deck.
- **Allergy conflict text** quotes the most recent "no known allergies" statement and the earliest listed allergen (matches the fixture); the evidence includes every conflicting line, so DOC-5's "Sulfa drugs" is cited too.
- **Undo reject** is audited as `fact.rejected` with `undo: true`; the audit action list has no separate undo action.
- **Document patch while processing** returns 409 so the pipeline can't overwrite a correction mid-run.
- **Reminders and simulated appointments** are accepted as optional inputs to the follow-up rule; they arrive in Sprint 5.

## End-to-end run of Sprints 1–3 (2026-10-10)

HTTP flow script against live servers (fresh databases), plus the unit suite:

| Run | Result |
|---|---|
| `uv sync --frozen` + `uv run pytest` | 89 passed |
| Live server, fake model: login → isolation → consent → 7 uploads → failures (409, 413, 415, scan, corrupt) → file stream → caregiver limits → bulk confirm → date fix → correct / reject / undo → reprocess guard → timeline → logout | **51/51 checks passed** |
| Live server started exactly as the README says, **no Gemini key**: same flow; text PDFs fail honestly with `AI_UNAVAILABLE` + COPY-09c, retry is offered, health shows AI unavailable, everything else works | **32/32 checks passed** |
| TC-SEC-04 log search (names, medicines, values, file names, emails, password, tokens, injected text) on both server logs | 0 hits |
| TC-SEC-05 secrets: `.env` ignored by Git; no Google API key pattern in the repo | Pass |

**Note for TC-SEC-04:** search logs with a literal (fixed-string) match, for example `grep -F "8.4"`. A regex search treats `.` as any character and matches request IDs such as `req_88814…`, which looks like a hit but isn't.
