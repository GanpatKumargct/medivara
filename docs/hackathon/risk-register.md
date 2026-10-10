# Risk Register (Delivery, Product and Demo)

> Owner: **Person C**; reviewed at G1, G2, IC-4 and IC-6. Security and safety threats with test scenarios are in [../srd/12-safety-threat-model.md](../srd/12-safety-threat-model.md) (THR IDs). This register covers everything that could stop the team from delivering or demonstrating MediVara credibly.
> Probability and impact: **H** high · **M** medium · **L** low.

| ID | Risk | Prob. | Impact | Mitigation (before it happens) | Owner | Trigger (how we notice) | Contingency (if it happens) | Related |
|---|---|---|---|---|---|---|---|---|
| RSK-01 | Gemini quota or rate limit exhausted during development or the demo | M | H | Paid Tier-1 billing with a budget alert; separate dev and demo projects; development response cache; one call in flight; golden cache | B | 429s in logs; health shows `ai.available: false` | Switch the demo laptop to `cache_only`; enable the fallback model for Ask and narrative only | THR-07 |
| RSK-02 | Gemini outage or latency spike at demo time | M | H | Degraded mode designed in; drilled at IC-4 and rehearsal 2; backup video | B | Health unavailable; answers over 20 s | Narrate the degraded path (strategy §9); play the video if needed | THR-07 |
| RSK-03 | Extraction accuracy below target | M | H | Clean synthetic documents; answer-key-driven prompt tuning before IC-3; human review is part of the design | B (fix), C (measure) | MET-01 under 90 % at IC-2 | Tune the prompt in Sprint 3 (BE-7.1 moves to Day 2); simplify the facts the brief relies on; show review as the trust gate | THR-04 |
| RSK-04 | Frontend and backend don't fit together | M | H | Contract-first; fixtures; mock guardrails; six checkpoints; contract key test | C | A checkpoint test fails | Pair during the checkpoint window; apply the change policy; slip at most 15 min, then cut | n/a |
| RSK-05 | Backend critical path overruns (Person B overloaded) | H | H | Prompt rule lists and schemas written in advance; no extra infrastructure; cut ladder; amber and red cut sets; Person C takes all testing and data work | C | IC-2 or IC-3 missed by more than 20 min | Apply the G2 amber or red cut set; protect P0 and Visit Assist | n/a |
| RSK-06 | Scope creep ("one more feature") | M | M | P0 locked at IC-0; pull-in only from the ranked pool; feature freeze at 14:15 | C | Unplanned items appear on the board | C rejects or defers; anything unfinished is hidden | n/a |
| RSK-07 | Venue Wi-Fi fails, or blocks traffic between laptops | M | H | Phone hotspot tested on Day 1; each developer can run the backend locally; golden cache; backup video | C | No connectivity; local-network proxy fails | Switch to the hotspot; run the demo in `cache_only`; glossary text fallback | n/a |
| RSK-08 | Demo laptop fails | L | H | Backup laptop prepared at 15:45 with `demo-v1`, `snapshot-demo` and the demo key; video on a phone | B, C | Crash, display or adapter failure | Switch laptops (restore in under 2 min) or play the video | n/a |
| RSK-09 | Browser speech features poor or missing on the demo laptop | M | L | Check local voices by G1; read-aloud is the planned voice feature; typing always works | A | No local en-IN voice; recognition errors | Use a network voice with the disclosure, or skip the voice moment | THR-08 |
| RSK-10 | ISL videos can't be embedded, or are blocked at the venue | M | M | Person C checks embedding terms and playback on the venue network on Day 1; text and link fallback built in | C | Video doesn't load | Show the fallback and the Visit Card; explain the curation process | THR-09 |
| RSK-11 | Over-claiming in the pitch (accuracy, sign-language translation, booking, security, compliance) | M | H | Claims checklist (strategy §8); scripted wording; judge Q&A rehearsed | C | A rehearsal reviewer hears a forbidden claim | Correct it immediately in the session; fix the script before the next run | THR-09, THR-10 |
| RSK-12 | AI shows advice, diagnosis or clinician judgement | L | H | Rules-first gate; prompt rules; validator; S-set evaluation; stop-ship rule | B, C | Any unsafe output in an evaluation run | Stop-ship: fix the pattern or prompt before the freeze; worst case, cut Ask (step 9) | THR-05, THR-10, THR-16 |
| RSK-13 | Cross-patient data exposure bug | L | H | Access guard with resource binding; IDOR suite; permission matrix | B, C | Any matrix cell wrong | Stop-ship: fix before showing any patient data | THR-01, THR-02, THR-15 |
| RSK-14 | Prompt injection succeeds | L | H | Screening that excludes flagged lines; delimiting; validator; I-set tests | B | An injected phrase appears in output | Stop-ship: strengthen the patterns; exclude the document from the demo | THR-03 |
| RSK-15 | Day and month swapped in dates | M | M | Day-first parsing; ambiguity flag; user confirmation; month-name display | B | The timeline order looks wrong | Correct through Edit (FR-020); fix the parser | THR-17 |
| RSK-16 | Validator too strict, so the demo keeps showing "withheld" or evidence-only answers | M | M | Calibration with Person C's false-rejection review (target ≤ 10 %) before the freeze | B, C | More than 10 % false rejections | Relax specific patterns (for example, the date matching rule); keep the safety patterns strict | n/a |
| RSK-17 | A team member is unavailable or blocked for hours | L | H | Documentation good enough for handover; independent task lists; C can run every environment | C | Absence or a blocker over 30 min | Re-plan using the cut ladder; C pairs to unblock | n/a |
| RSK-18 | Fatigue errors late on Day 2 | M | M | Code freeze at 15:45; no changes during rehearsal 2; proper lunch; breaks | C | Regressions after small "fixes" | Revert to `demo-v1`; restore the snapshot | n/a |
| RSK-19 | A model is deprecated or renamed close to the event | L | M | Model IDs in configuration; checked on the morning of Day 1; no preview models | B | API errors about the model; deprecation notice | Switch to the current stable Flash ID; re-run a 5-item evaluation smoke test | n/a |
| RSK-20 | The rules don't allow preparing assets before the event | M | M | Check before the event (ASM-01); Day-1 schedule has time to create the documents (09:00–10:30) | C | Rules say no | Create the synthetic PDFs on Day 1; B uses one placeholder PDF until 10:30 | n/a |
| RSK-21 | Someone offers or uploads real health data | L | H | Warnings at sign-in, onboarding and upload; script to decline; synthetic samples offered instead | C | A judge offers a report | Politely decline; delete anything uploaded by mistake (delete feature or reset) | THR-18 |
| RSK-22 | The PDF viewer doesn't jump to the page in the demo browser | M | L | Tested at IC-2 on the demo laptop | A | The page doesn't change | Show "See page N" text; scroll manually during the demo | n/a |
| RSK-23 | The demo runs over the time limit | M | M | Timed rehearsals; 3-minute and 5-minute versions of the script | C | Rehearsal over 4:45 | Switch to the 3-minute script; skip the optional segments (strategy §4) | n/a |
| RSK-24 | Hackathon times differ from the assumption (09:00–19:00, judging about 17:30) | M | M | C confirms the times before the event | C | Different agenda | Shift every block by the same offset; shorten Sprint 5, never the rehearsals | ASM-02 |

## Review log

| Gate | Date and time | Top 3 open risks | Actions | Reviewer |
|---|---|---|---|---|
| G1 | Day 1, 18:45 | | | C |
| G2 | Day 2, 09:00 | | | C |
| IC-4 | Day 2, 12:00 | | | C |
| IC-6 | Day 2, 15:45 | | | C |
