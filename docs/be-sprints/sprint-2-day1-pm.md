# Backend Sprint 2 — Day 1, 13:00–16:30 → IC-2

> Person B. Full task details are in [backlog.md](backlog.md). This sprint is on the **critical path**.

**Goal:** upload → background processing → line extraction → Gemini extraction → validation, with document list, detail and file endpoints.

**Entry criteria:**
- IC-1 passed.
- Synthetic PDFs available from Person C (needed by 10:30 at the latest, so you could inspect the PyMuPDF output during Sprint 1 if time allowed).

## Tasks in order (210 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | BE-2.3 Document models | 15 | |
| 2 | BE-4.1 Upload endpoint (API-08) | 30 | Magic bytes, limits, SHA-256 duplicate check, consent check |
| 3 | BE-5.1 Processing orchestrator | 20 | Never blocks the server; stages visible |
| 4 | BE-5.2 Text and line extraction (AG-02) | 30 | Rebuild table rows from position; detect a missing text layer |
| 5 | BE-4.2 Documents list and detail (API-10, 11) | 25 | Facts with resolved line texts |
| 6 | BE-4.3 File stream (API-12) | 10 | Safe headers |
| 7 | BE-5.3 Gemini client wrapper | 30 | `store=false`, timeouts, one retry, block detection, one call in flight |
| 8 | BE-5.4 Structured extraction (AG-04) | 25 | Flat schema, `extract-v1` rules |
| 9 | BE-5.5 Validation and confidence (AG-05) | 25 (+5 in Sprint 3) | Day-first dates, rule-based confidence |

**Why this order:** upload and listing (tasks 1–6) let Person A integrate the repository even if extraction is late. Tasks 7–9 are the risky part, so start task 7 no later than 14:45.

## What Person A needs from you

| By | What |
|---|---|
| 16:30 | API-08, API-10, API-11, API-12 live, with real extraction for DOC-1 to DOC-5 |

## What Person C needs from you

As soon as AG-04 runs (target 15:45), process the synthetic documents so Person C can compare them with the answer key (MET-01) before IC-2.

## Exit criteria (IC-2, 16:30–16:50)

1. Uploading DOC-1 through the frontend reaches `needs_review` with 4 lab facts, line citations and confidence.
2. DOC-4's date is flagged as ambiguous, and Haemoglobin is flagged `missing_reference_range`.
3. DOC-7 fails with `NO_TEXT_LAYER`.
4. Uploading DOC-1 again returns 409 `DUPLICATE_DOCUMENT`.
5. Polling API-10 and API-11 keeps responding in under 500 ms during extraction.
6. First extraction accuracy reading recorded by Person C (target ≥ 90 % by IC-3 at the latest).

## If behind at 15:30

- Ship BE-5.5 with the line-ID and required-field checks first; finish the value-in-line checks in Sprint 3.
- Tell Person C. If extraction is not live by 16:30, Person A integrates the list and the viewer, and extraction is integrated in the IC-3 window.

## If ahead

BE-5.6 (injection screening), BE-6.1 (fact review).
