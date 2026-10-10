# Hackathon Folder — Person C Quick-Start

You are the **product, integration and QA lead**. You don't build frontend or backend features. You keep scope tight, run every integration checkpoint, own the test results, prepare the demo data and the pitch, and decide cuts. You may help a developer only once your own duties are covered.

## 1. What's in this folder

| Document | Use it for |
|---|---|
| [integration-plan.md](integration-plan.md) | Contract-first flow, mock guardrails, handoff table, checkpoints IC-0 to IC-6, change policy, environments, E2E-01 to E2E-10, decision owners |
| [execution-schedule.md](execution-schedule.md) | The two-day plan for all three people, gates and cut sets, freezes, backup plan, rehearsals |
| [test-plan.md](test-plan.md) | Test case catalogue, permission matrix, AI evaluation protocol, sign-off, traceability matrix |
| [risk-register.md](risk-register.md) | Delivery, product and demo risks with owners and triggers |
| [demo-and-judging-strategy.md](demo-and-judging-strategy.md) | Problem statement, value proposition, differentiators, storylines, metrics, evidence per claim, judge Q&A, forbidden claims, fallbacks |
| [readiness-checklist.md](readiness-checklist.md) | Ticking off pre-event, gate, freeze, demo-machine and pitch items |
| [synthetic-demo-data-pack.md](synthetic-demo-data-pack.md) | Synthetic documents (line by line), seed IDs, answer key, evaluation questions, ISL glossary spec, snapshot procedure |

## 2. Your responsibilities at a glance

| Area | What you do | When |
|---|---|---|
| Scope | Guard P0; apply the cut ladder at gates; approve pull-ins | IC-0, G1, G2, IC-4, 13:45 on Day 2, IC-5 |
| Contract | Copy the fixtures into `contracts/` at kickoff; record freezes and changes; arbitrate disputes (10-minute rule) | IC-0, G1, ad hoc |
| Data | Synthetic PDFs, answer key, realistic fixtures (13:30 Day 1), ISL glossary content, demo snapshot | Before the event, Day 1, Day 2 12:20 |
| Integration | Run the INT/DEMO laptop; run checkpoint tests; keep the handoff table current | Every checkpoint |
| Quality | E2E runs, permission matrix in Swagger, AI evaluation and false-rejection review, accessibility audits, security checks | See [test-plan.md](test-plan.md) |
| Bugs | Triage every bug in `#bugs`; assign exactly one owner | Continuously; strictly after the freeze |
| Demo | Script, slides, backup videos, rehearsals, narrating | G1, IC-4, 15:15 Day 2, 16:00–17:15 Day 2 |
| Honesty | Copy audit; claims check; decline real data | Before every rehearsal |

## 3. Your Day-1 timeline in one view

- **09:00** Run the kickoff; copy fixtures; IC-0.
- **10:30** PDFs to Person B.
- **12:00** IC-1 tests.
- **13:30** Realistic fixtures to Person A.
- **15:45** Extraction evaluation.
- **16:30** IC-2.
- **17:30** Accessibility audit #1.
- **18:30** IC-3.
- **18:45** G1: tag, snapshot, rough video, storyline dry run.

## 4. Your Day-2 timeline in one view

- **09:00** G2 cut set.
- **10:30** Brief integration check.
- **11:15** Full AI evaluation.
- **12:00** IC-4, audit #2, video #2.
- **12:20** Build `snapshot-demo`.
- **13:45** Sprint-5 cut decision.
- **14:15** IC-5 and feature freeze.
- **14:30** Full E2E run and triage.
- **15:15** Final video.
- **15:45** Code freeze and `demo-v1`.
- **16:00 and 16:40** Rehearsals.
- **≈17:30** Judging.

## 5. Decisions you own

Scope, priorities and cuts · copy wording · test pass/fail and "Verified" status · demo content and machine · tie-breaks on any schedule-affecting dispute.
