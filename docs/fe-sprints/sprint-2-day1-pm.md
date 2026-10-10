# Frontend Sprint 2 — Day 1, 13:00–16:30 → IC-2

> Person A. Full task details are in [backlog.md](backlog.md).

**Goal:** the records repository: dashboard, upload, processing feedback, original viewer, and the extraction review panel (read view, with actions wired to mocks).

**Entry criteria:** IC-1 passed (real sign-in).

## Tasks in order (205 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | FE-10.1 System-state components (SCR-16) | 20 | Built first; every later screen uses them |
| 2 | FE-10.2 401, 403 and 404 handling and pages | 10 | |
| 3 | FE-2.3 Onboarding (SCR-01) | 15 | Test with `usr_fresh` |
| 4 | FE-2.4 Patient dashboard (SCR-04) | 20 | Tiles fail independently |
| 5 | FE-3.1 Records list and filters (SCR-05) | 25 | |
| 6 | FE-3.2 Upload drop zone and client validation | 25 | COPY-34b to COPY-34e |
| 7 | FE-3.3 Processing polling, stages, failure, retry | 20 | 2 s polling, stops on terminal states |
| 8 | FE-3.4 Document viewer pane | 25 | Blob URL; never put the token in a URL |
| 9 | FE-3.5 Extraction review panel | 45 | Low-confidence facts first; read-only without the scope |

## Dependencies on Person B

| Needed by | Backend task | Endpoint |
|---|---|---|
| 16:30 | BE-4.1 | API-08 |
| 16:30 | BE-4.2 | API-10, API-11 |
| 16:30 | BE-4.3 | API-12 |
| 16:30 | BE-5.1 to BE-5.5 | Live extraction behind API-11 |

## Mocks to use until IC-2

- `API-08.202`, `API-08.409`, `API-10.200`.
- `API-11.200.processing`, `API-11.200.needs-review`, `API-11.200.failed-no-text-layer`.
- `API-15.200`; error fixtures.
- **Realistic facts:** Person C supplies document-detail fixtures for DOC-1 to DOC-5, built from the answer key, by about 13:30. Use them so the review UI is designed for real content lengths.

## Exit criteria (IC-2, 16:30–16:50, task FE-11.2)

1. Upload DOC-1 (`lab_sunrise_mar2025.pdf`) through the UI against the real backend. Stages update until "Ready — please review", and facts appear with source lines and confidence badges.
2. The document list and dashboard counts are real.
3. The viewer shows the real PDF and jumps to the cited page.
4. DOC-7 ends in the scanned-document failure (COPY-14), with no retry button.
5. Uploading DOC-1 again shows the duplicate message with a link.

Review actions may still use mocks until IC-3.

## If ahead

FE-3.6 (bulk confirm, details edit, banners).

## If behind by more than 30 min at 15:30

- Simplify the Correct dialog to `value`, `unit` and `strength` only; finish it in Sprint 3.
- Keep the dashboard to two tiles.
- Tell Person C. The cut ladder is not touched yet.
