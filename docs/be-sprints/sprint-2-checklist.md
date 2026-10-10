# Backend Sprint 2 — Checklist

> Status of [sprint-2-day1-pm.md](sprint-2-day1-pm.md) on branch `be/BE-1.1-sprint1-foundation`. Last checked 2026-10-10.
> Legend: **[x]** done and verified · **[~]** done, with a note · **[ ]** open (owner shown).
> Automated evidence: `cd backend && uv run pytest` → 68 passed, 8 consecutive runs. Model calls in tests use a fake transport (`tests/fake_model.py`), never the network.

## Entry criteria

- [x] IC-1 backend side passed (see [sprint-1-checklist.md](sprint-1-checklist.md)).
- [~] Synthetic PDFs: generated from the data pack by `demo-data/make_pdfs.py` into `demo-data/pdfs/` (10 files, text layer, synthetic footer, image watermark; DOC-7 image-only). **Person C** to review them against the data pack, or replace them with their own.

## Tasks

| Task | Status | Evidence |
|---|---|---|
| BE-2.3 Document models | [x] | `MedicalDocument`, `DocumentPage`, `ExtractedFact` in `app/models.py` |
| BE-4.1 Upload (API-08) | [x] | `routers/documents.py`: scope + owner AI consent; magic bytes; 10 MB / 10 pages; sanitised name; SHA-256 duplicate check; random storage name; audit; processing queued after commit |
| BE-5.1 Orchestrator | [x] | `pipeline/orchestrator.py`: stages committed one by one; every failure ends `failed` with a code; never stuck in `processing` |
| BE-5.2 Lines (AG-02) | [x] | `pipeline/lines.py`: one line per lab row; stable IDs; `NO_TEXT_LAYER`, `UNREADABLE_PDF`, `low_text_density` |
| BE-4.2 List and detail (API-10, 11) | [x] | Filters, sort (date desc, undated last), fact counts, resolved source lines, `fields` per type, header sources, flags detail |
| BE-4.3 File stream (API-12) | [x] | `nosniff`, `no-store`, inline disposition; `document.file_viewed` audit |
| BE-5.3 Gemini wrapper | [~] | `app/gemini.py`: `store=False`, no background / previous ID, one call in flight, one retry, block detection, typed outcomes, AI_MODE, dev cache, safe logging. **Not yet called against the real API** (see open items) |
| BE-5.4 Extraction (AG-04) | [~] | `pipeline/extraction.py`, prompt `extract-v1`, flat schema, shape check. MET-01 accuracy not measured yet (needs the live model) |
| BE-5.5 Validation (AG-05) | [x] | `pipeline/validation.py`, `normalize.py`: all checks in AI design §6.2, day-first dates, rule-based confidence, discards counted |

## Exit criteria (IC-2)

- [~] 1. Uploading DOC-1 reaches `needs_review` with 4 lab facts, line citations and confidence. Verified with the fake model; **repeat with the live model** and through the frontend.
- [x] 2. DOC-4's date is flagged ambiguous (COPY-28 banner text) and Haemoglobin has `missing_reference_range`.
- [x] 3. DOC-7 fails with `NO_TEXT_LAYER`, COPY-14, and is never sent to the model.
- [x] 4. Uploading DOC-1 again returns 409 `DUPLICATE_DOCUMENT` with `existing_document_id`.
- [x] 5. Polling stays fast during extraction: live server with a 5 s fake model — upload 202 in 27 ms; API-11 and API-10 answered in 3–13 ms throughout.
- [ ] 6. First MET-01 reading — **Person C**, once the live model runs.

## Open items

- [ ] **Live Gemini smoke call** (Person B): put the dev key in `backend/.env`, upload DOC-1, and confirm the Interactions request shape (`response_format` with the JSON schema, `response_mime_type`, `generation_config.thinking_level`) is accepted by `gemini-3.8-flash`. The shape was built from the pinned SDK's types (`google-genai` 2.29.0), not from a real call.
- [ ] Copy deck wording for `UNREADABLE_PDF` (Person C). Placeholder: "MediVara couldn't open this PDF. It may be damaged or password-protected."
- [ ] Derived fixtures `API-11.200.ready`, `.failed-no-text-layer`, `.suspicious`, `.cached` (Person B/C).

## Deviations and notes

- **AG-03 screening** runs as a pass-through stage (`screen_lines`); the injection patterns are BE-5.6 in Sprint 3, as the backlog allows.
- **Golden cache** fallback is not wired yet (BE-5.7, Sprint 5); AI failures go straight to `failed` with Retry text.
- **Soft "missing duration / due_text"** (AI design §5.1) has no reason code in the data model's enum, so it does not lower confidence yet. Raise with Person C if wanted.
- A fact without its own date returns the document date as `event_date` (matches the API-11 fixture), computed on read so API-14 date corrections carry through.
- Corrupt or encrypted PDFs are accepted at upload and fail in processing with `UNREADABLE_PDF`, so the user sees a reason (TC-SEC-03 allows either).
- Request `duration_ms` is logged in whole milliseconds. Decimal timings (for example `18.4`) matched lab values in TC-SEC-04-style log searches and made the PHI-in-logs test flaky; logs never contained document text.
- `demo-data/make_pdfs.py` uses PyMuPDF's built-in Unicode font (subset), because base-14 Helvetica drops "—" and "–" during text extraction.
