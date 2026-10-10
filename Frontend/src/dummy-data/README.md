# Dummy data

Synthetic sample data for running the MediVara frontend **without the backend**. The app
uses the real backend by default; this folder is only used when `VITE_API_MODE=dummy`.

> Everything here is **fictional**. Names, clinics, doctors and values are invented
> (from `docs/hackathon/synthetic-demo-data-pack.md`). Never replace these with real
> medical records.

## Modes

| Mode | How | Data comes from |
|---|---|---|
| Real (default) | `npm run dev` (or PM2, see `../../../ecosystem.config.cjs`) | FastAPI backend at `/api/v1`, via the Vite proxy to `localhost:8000` |
| Dummy | `VITE_API_MODE=dummy npm run dev` | This folder, in the browser; a "MOCK DATA" badge shows on every page |

```
../api/endpoints.ts        picks the implementation (screens import only this)
../api/real-endpoints.ts   fetch calls to /api/v1 (contract API-01…30)
../api/http.ts             bearer token, error envelope → ApiError, 401 → sign-out
../api/dummy-endpoints.ts  reads this folder with simulated latency
dummy-data/                ← you are here
```

Both implementations have identical signatures and return contract-shaped objects
(`docs/srd/11-api-contract.md`), so screens and components don't change between modes.
Static content that is part of the product itself is used in both modes: the ISL glossary
(`glossary.ts`), the demo account cards on the login screen (`accounts.ts`) and the Ask
example questions (`ask.ts`).

## Folder contents

- `accounts.ts` — users, patient profiles, access grants, consents (passwords: `MediVara-Demo-2026`)
- `documents.ts`, `timeline.ts`, `briefs.ts`, `ask.ts`, `reminders.ts`, `access.ts` — per-feature sample responses
- `glossary.ts` — ISL health-term glossary (static content)
- `health.ts` — service and AI status
- `db.ts` — in-memory mutable store; resets on page reload
