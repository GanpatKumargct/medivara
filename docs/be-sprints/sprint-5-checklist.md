# Backend Sprint 5 — Checklist

> Status of [sprint-5-day2-mid.md](sprint-5-day2-mid.md) on branch `be/BE-1.1-sprint1-foundation`. Last checked 2026-10-10.
> Legend: **[x]** done and verified · **[~]** done, with a note · **[ ]** open (owner shown).
> Automated evidence: `cd backend && uv run pytest` → 160 passed, 2 consecutive runs. Mutation check: disabling the cache lookup or loosening the reminder scope makes 3 tests fail. Model calls use the fake transport.

## Entry criteria

- [~] IC-4 passed with the fake model (see [sprint-4-checklist.md](sprint-4-checklist.md)); live-model evaluation still open.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| BE-5.7 Golden cache | [x] | `pipeline/golden_cache.py`: lookup by SHA-256 after any live failure, and in `cache_only` / `off`; labelled `extraction_source: cache`, `cached_extraction` flag, COPY-11. Exporter writes only manifest samples extracted live. A later live reprocess clears the label |
| BE-9.1 Access list, grant, revoke (API-23, 24, 25) | [x] | `routers/access.py`: owner-only list and grant; `view_records` required; `sharing` ConsentRecord linked to the grant; `USER_NOT_FOUND`, `GRANT_EXISTS`, self-grant 422; revoke by owner or the caregiver leaving; owner grant can't be revoked; effective on the next request |
| BE-9.2 Access log (API-26) | [x] | Owner only; newest first; `action_label` built from IDs and codes ("Shared access with Ravi Menon", "Revoked Karthik Raman's access", "Access denied after revoke"); no medical content |
| BE-2.5 Reminder model | [x] | `Reminder` in `app/models.py` (providers and appointments not built — booking stays cut) |
| BE-10.1 Reminders (API-27 to 30) | [x] | `routers/reminders.py`, `app/reminders.py`: IST wall-clock + `Asia/Kolkata` → UTC; once and daily (1–4 times, start/end); medication attestation (COPY-24); source fact must be this patient's; dismiss / restore; daily completion moves to the next time; reminders from a follow-up clear RULE-FOLLOWUP-NO-APPT in the next brief; dashboard counts upcoming reminders and the latest brief |

## Exit criteria (IC-5)

- [x] 1. **E2E-06:** grant and scoped view (Karthik: view + reminders, no upload, no sharing controls); foreign profile denied; revoke → Karthik's next request 403; access log shows the denied attempt and the revoke without medical content. Live server: part of 15/15 checks.
- [x] 2. **E2E-07:** reminder created from the DOC-5 follow-up (by the caregiver), "10:00 IST" stored as 04:30Z, source linked, follow-up gap gone in a new brief, then completed. Part of 15/15.
- [x] 3. **`cache_only` drill:** golden cache exported from the live run, server restarted with `AI_MODE=cache_only`, DOC-5 uploaded again → 9 cached facts with the "Cached result" label, no model call; a file not in the cache fails honestly. 3/3.
- [x] Log check on both servers: no names, medicines, values, emails or tokens.

## Feature freeze notes

- Not built (pull-in pool, as planned): BE-4.6 delete, BE-4.5 sample import, BE-11.1/11.2 simulated booking. Their routes don't exist, so nothing needs hiding in the backend.

## Open items

- [ ] **Fill the real golden cache** (Person B with Person C): after live extraction of DOC-1 to DOC-7, RDOC-1/2 and KDOC-1 is checked against the answer key, run `uv run python -m app.pipeline.golden_cache export` and commit `backend/golden_cache/`. It is empty now.
- [ ] Regenerated PDFs: `demo-data/make_pdfs.py` is now byte-for-byte reproducible, so committed PDFs, the manifest and the cache keys stay in step. If Person C replaces the PDFs, re-run the generator's manifest step (or update hashes) and re-export the cache.

## Deviations and notes

- **Access list emails** are shown in full to the owner, as in the API-23 fixture. The contract text says emails are masked "for anyone except the owner of that email", which contradicts the fixture; Person B to settle in the contract.
- **Revoking an already-revoked grant** returns 409 `INVALID_STATE` (the contract doesn't say).
- **Completed reminders** can't be edited (409); dismissed ones can be restored.
- **Daily reminders past their end date** keep `status: active` with `next_due_at: null` until completed; they don't count as upcoming.
- **`tzdata`** is pinned so `Asia/Kolkata` resolves on laptops without a system timezone database (Windows).
- The PDF generator now writes `demo-data/manifest.json` (sample IDs, fixed document IDs, patient, sample set, SHA-256) — also usable for BE-4.5 sample import later.
