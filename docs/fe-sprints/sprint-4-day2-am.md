# Frontend Sprint 4 — Day 2, 09:20–12:00 → IC-4

> Person A. Full task details are in [backlog.md](backlog.md).

**Goal:** the Consultation Brief with narrative and print, ISL Visit Assist, the Ask interface, and read-aloud.

**Entry criteria:** G2 decision at 09:00 (green, amber or red, mapped to a cut set; see [../hackathon/execution-schedule.md](../hackathon/execution-schedule.md) §4).

## Tasks in order (160 min)

| Order | Task | Est | Notes |
|---|---|---|---|
| 1 | FE-12.1 Accessibility fixes from audit #1 | 10 | Critical and serious issues only |
| 2 | FE-4.4 Consultation Brief screen (SCR-09) | 25 | `medications_from` plus the older-medicines list |
| 3 | FE-4.5 Brief narrative block | 10 | Never block the sections |
| 4 | FE-4.6 Print layouts (brief, Visit Card) | 10 | A4; sources appendix |
| 5 | FE-8.1 Visit Card (SCR-11) | 15 | Full-screen mode: ≥ 28 px text, 7:1 contrast |
| 6 | FE-8.2 ISL glossary with official videos and fallback | 25 | Content file from Person C; COPY-17 and COPY-18 |
| 7 | FE-5.1 Ask screen and input (SCR-08) | 20 | Client timeout 25 s |
| 8 | FE-5.2 Answer rendering with citations | 20 | |
| 9 | FE-5.3 Ask special states | 10 | Emergency card is assertive |
| 10 | FE-7.1 Read-aloud controls (P1) | 15 | Check local voices on the demo laptop |

## Dependencies on Person B

| Needed by | Backend task | Endpoint |
|---|---|---|
| About 10:30 (early brief integration) | BE-7.1, BE-7.2 | API-18, API-19 |
| 12:00 | BE-7.5 | API-20 |
| 12:00 | BE-8.1, BE-7.3, BE-7.4, BE-8.2, BE-7.6 | API-21 |
| 12:00 | BE-6.3 | `change` markers in API-17 |

## Mocks to use until IC-4

`API-18.201`, `API-19.200` (and 404), `API-20.200.ready`, `API-20.200.unavailable`, and every `API-21.200.*` variant.

## Exit criteria (IC-4, 12:00–12:20, task FE-11.4)

1. **E2E-05:** create a brief for Meera. The metformin dose difference and the allergy conflict appear under "Points to clarify". The narrative arrives labelled with citations. The print preview fits on 2 pages or fewer.
2. **E2E-04:** Ask "What was my most recent HbA1c?" gives a cited answer. "Should I stop taking metformin?" gives the advice redirect. "I have chest pain" gives the emergency card. "What is my blood group?" gives not-found.
3. **E2E-10:** as Ravi, the Visit Card shows the chosen statements and real key facts, and the glossary plays an attributed official video (or shows the offline fallback).
4. Read-aloud reads the brief and stops on command (E2E-09, read-aloud part).
5. The timeline shows the change markers.

**12:00:** Person C runs accessibility audit #2 on SCR-07, 08, 09 and 11 (fixes in FE-12.2) and records backup video #2.

## If ahead

FE-7.2 and FE-7.3 (speech input), then FE-8.3 (ISL term links).

## Cuts at this gate (IC-4)

If brief, Ask or Visit Assist isn't integrated by 12:20, Person C applies the ladder: the LLM narrative falls back to the templated overview, and so on. Visit Assist is **never cut**.
