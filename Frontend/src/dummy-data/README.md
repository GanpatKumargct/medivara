# Dummy data

All synthetic sample data the MediVara frontend runs on **before the real backend
exists**. It is deliberately isolated in this one folder so it can be deleted or
swapped out in a single place.

> Everything here is **fictional**. Names, clinics, doctors and values are invented
> (from `docs/hackathon/synthetic-demo-data-pack.md`). Never replace these with real
> medical records.

## How it is wired

```
dummy-data/            ← you are here (the "separate folder" the brief asked for)
  accounts.ts          users, patient profiles, access grants, consents
  documents.ts         per-patient document lists + full detail (facts, source lines)
  timeline.ts          deterministic timeline per patient
  briefs.ts            Consultation Brief snapshots + validated narrative
  ask.ts               canned Ask answers keyed by question intent (incl. safety states)
  reminders.ts         reminders + "suggested from documents"
  access.ts            grants + audit log
  glossary.ts          ISL health-term glossary (static content)
  health.ts            service + AI status
  db.ts                a tiny in-memory mutable store seeded from the above
  index.ts             re-exports

../api/                ← thin async layer that reads this folder with simulated latency
```

The `../api/endpoints.ts` layer returns objects shaped exactly like the responses in
`docs/srd/11-api-contract.md` (API-01…33). To move to the real backend, replace the
bodies in `../api/endpoints.ts` with `fetch('/api/v1/...')` calls — screens and
components do not change.

## Changing the demo

- Edit `accounts.ts` to change who can sign in (passwords are all `MediVara-Demo-2026`).
- Edit `documents.ts` to change what each patient has on file.
- `db.ts` holds the mutable session state (uploads, fact reviews, reminders created
  during a session). It resets on page reload — there is no persistence.
