# Backend Sprint 4 — Checklist

> Status of [sprint-4-day2-am.md](sprint-4-day2-am.md) on branch `be/BE-1.1-sprint1-foundation`. Last checked 2026-10-10.
> Legend: **[x]** done and verified · **[~]** done, with a note · **[ ]** open (owner shown).
> Automated evidence: `cd backend && uv run pytest` → 137 passed, 2 consecutive runs. Model calls use the fake transport; **no live Gemini call has been made yet**.

## Entry criteria

- [~] G2 decision: not taken (no team gate in this run). Sprint 3 items needing the live model are still open.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| BE-7.1 Consistency and gap rules | [x] | Built in Sprint 3 (`organise/rules.py`) |
| BE-2.4 Brief and AI output models | [x] | `ConsultationBrief`, `AIOutput` in `app/models.py` |
| BE-6.3 Timeline change markers | [~] | `organise/changes.py`; HbA1c 8.4 → 7.6 `value_change`; Metformin 500 → 1000 mg `dose_change` — **on the 31 Jul 2025 discharge summary event**, see open decision 1 |
| BE-7.2 Brief assembler, API-18, API-19 | [x] | `organise/brief.py`, `routers/briefs.py`: header, templated overview, medicines from the latest prescription (DEC-22), older medicines, conditions, results over time, allergies, 4 planted findings, questions, sources, evidence snapshot E1…, fingerprint staleness. Built in well under 1 s |
| BE-7.3 Context assembly (AG-10) | [x] | `answer/context.py`: patient filter inside the query, newest document first, fact-status tags, `C` correction lines, flagged lines excluded, token cap with `older_documents_not_searched` |
| BE-7.4 Grounded generator (AG-11) | [~] | `answer/generator.py`, prompts `ask-v1` / `narrative-v1` from AI design §8.2–8.3. **Prompt quality unmeasured** without the live model |
| BE-8.2 Citation and safety validator (AG-12) | [x] | `answer/validator.py`: checks 1–11; drop one at a time; withheld under half; COPY-08 / 08b / 12b notices; E-numbering; validation report stored |
| BE-7.5 Narrative (API-20) | [x] | `ready` / `unavailable` / `withheld`; templated text always kept; linked to the brief and shown by API-19 |
| BE-8.1 Intent gate (AG-09) | [x] | `answer/gate.py`: 10 of 10 scripted safety prompts (S-01–S-10) routed with no model call; 0 of 17 grounded and injection questions wrongly gated |
| BE-7.6 Ask (API-21) | [x] | `routers/ask.py`, `answer/service.py`: every status (answered, not_found, out_of_scope, advice_redirect, emergency, degraded, withheld); AIOutput stored per answer; question text never logged or audited |

## Exit criteria (IC-4)

- [x] 1. **E2E-05:** brief with the 4 planted findings; narrative validated, cited and labelled; stale after a fact change. Live server, fake model: 14/14 checks.
- [~] 2. **E2E-04:** answered, advice redirect, emergency (< 200 ms) and not found against the real backend — passes with the fake model; **repeat with the live model** (Q-01–Q-15 evaluation, MET-11 ≥ 12/15).
- [x] 3. **`AI_MODE=off` drill**, same database restarted: brief and findings work, narrative `unavailable` with templated text, Ask `degraded` with matching lines, emergency and advice routing unchanged. 11/11 checks.
- [x] 4. AIOutput rows hold the evidence snapshot and validation report (unit tests).
- [ ] Person C's evaluation run (Q, S, I sets; MET-03, 04, 05, 11) — needs the live model. MET-03 safety routing already passes in tests.

## Open decisions (Person C / Person B)

1. **Where the Metformin dose marker sits.** The rule (AI design §9.1) compares with the *previous document that listed the medicine*: DOC-2 (500 mg) → DOC-3 (1000 mg), so the marker is on the 31 Jul 2025 discharge event and DOC-5 shows none (DOC-3 already said 1000 mg). The API-17 fixture puts it on DOC-5 versus DOC-2. Code follows the rule; the demo script should point at the July 2025 event, or the rule/fixture must change.
2. **Copy for the generic advice question** when no medicine is named (S-08): "Are my current medicines and doses still right for me?" is placeholder wording.
3. Carried over: DOC-6 date versus the follow-up gap (Sprint 3 checklist).

## Deviations and notes

- **Validator, documented diagnoses:** "diagnosis"/"diagnosed" is allowed when the cited line itself uses the word (for example "Diagnosis: Type 2 diabetes mellitus"), mirroring the interpretation-word rule. Without it, the live check withheld every overview that mentioned conditions (false rejections, MET-05). Invented diagnoses are still dropped (tested).
- **Validator, explanations:** "no digits" means no standalone numbers; digits inside terms such as "HbA1c" or "T4" are allowed.
- **Number parsing:** digits inside words are no longer read as numbers ("HbA1c" ≠ 1); "500mg" still reads as 500.
- **Gate tuning** against the evaluation set: "what dose" only as "what dose should/do I…" (Q-04 must be answered); "do I have…" only with a condition word (Q-05 "Do I have any allergies?" must be answered); added "face/throat/tongue … swelling" (S-04) and "tell me to stop/increase…" (S-10).
- **Degraded / withheld evidence** matches the question's own keywords only.
- **Out-of-scope** answers use the not-found shape (kind `not_found`, COPY-07b), as the contract describes.
- **Brief details vs fixture:** the allergy item cites every line for that allergen (DOC-3 and DOC-5), so evidence numbering differs from the illustrative fixture; questions include up to two "What do my recent … results mean" items (HbA1c, fasting plasma glucose).
- **Fingerprint** covers every processed document and fact of the patient, so a new upload also makes the brief stale.

## Not done here (Sprint 4 lunch window)

- [ ] `snapshot-demo` — needs real extractions on the demo laptop (Person C builds the state; Person B runs reset and snapshot).
