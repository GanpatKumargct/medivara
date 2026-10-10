# Hackathon Demo and Judging Strategy

> Owner: **Person C** (narrator and pitch). Driver: **Person A**. Technical answers and backups: **Person B**.
> Principle: **one complete, credible workflow beats many half-features.** Everything we say on stage must be backed by something we can show (§6) and must pass the claims check (§8).

## 1. The problem statement (one sentence)

> **People managing long-term conditions carry their medical history as scattered prescriptions, lab reports and discharge papers that disagree with each other, so in a ten-minute appointment they can't reliably say what they take, what changed, or what to ask. Deaf patients and family caregivers face even higher barriers.**

## 2. Value proposition

> **MediVara turns a patient's scattered documents into a verified, source-linked history and a one-page Consultation Brief. Every line traces back to the original page. It flags where documents disagree and never gives medical advice. It works for Deaf users, people who prefer listening, and authorised family members.**

## 3. Three differentiators

| # | Differentiator | Why it matters | What proves it on stage |
|---|---|---|---|
| 1 | **Evidence-linked by design.** Every fact, timeline item and AI sentence cites the exact line and page; statements that can't be verified are removed before display | Trust in medical AI depends on being able to check the source | Click any citation in the brief or an answer: the exact source line and the original PDF page |
| 2 | **"Facts first, AI second" safety architecture.** The AI reads each document once (the user reviews it); deterministic code builds the timeline, lists and inconsistency checks; the AI only writes wording, inside a bounded, validated workflow, and refuses advice | Lower hallucination risk, predictable behaviour, keeps working when the AI is down | "Should I stop metformin?" → safe redirect with the records; architecture slide; degraded-mode clip |
| 3 | **Accessible and family-safe.** ISL Visit Assist (Visit Card plus official ISL dictionary videos), read-aloud, plain language, and consent-based caregiver access with instant revoke | Health information access shouldn't depend on hearing, reading level or informal phone photos | Ravi's full-screen Visit Card and ISL video; Karthik loses access the moment Meera revokes it |

## 4. Demo storyline

**Setup before going on stage:** `snapshot-demo` restored; mock badge absent; health shows AI available.
- **Left window:** Meera signed in, on the Records screen.
- **Right window:** Ravi signed in, on Visit Assist.
- Browser zoom 110 %; notifications off; volume up (read-aloud).
- DOC-5 (`rx_lakeview_sep2026.pdf`) on the desktop, ready to drag.

### 4.1 Main version (4 min 30 s)

| Time | Segment | Driver (A) does | Narrator (C) says (gist) | Fallback |
|---|---|---|---|---|
| 0:00–0:20 | **Hook** | Records list: 6 documents from 3 providers | "This is Meera, 58, living with diabetes and high blood pressure. Meera's records come from a clinic, a lab and a hospital, and they disagree. In a ten-minute appointment, can Meera say which metformin dose is current?" | Slide with the same story |
| 0:20–1:05 | **Upload and review** | Drag DOC-5 → stages → "Ready — please review" → open → "Confirm all high-confidence items (9)" → open DOC-4 → ambiguous date banner → Edit → confirm 04 May 2026 | "MediVara reads the text and extracts each fact with the exact line it came from. Rules, not the AI, decide confidence. Meera checks before anything is used, and an ambiguous date like 04/05 is flagged, not guessed." | Slow (> 20 s): move on to the timeline and come back. Failed: Retry, or the cached result with its label (§9) |
| 1:05–1:35 | **Timeline** | Timeline → point at "Metformin 500 mg → 1000 mg" and "HbA1c 8.4 % → 7.6 %" → click an event → PDF page | "Meera's history, in order, built by code from reviewed facts. Changes show values and dates, never 'better' or 'worse'. Every item opens the original page." | Skip the click if the viewer is slow |
| 1:35–2:20 | **Consultation Brief** | Brief → Create → sections appear → point at "Points to clarify" (metformin, allergies) and "Missing information" (follow-up) → narrative arrives (label, citations) → click a citation → print preview → read-aloud for 3 seconds | "One page for the doctor. Where Meera's documents disagree, MediVara shows both, with dates, and asks Meera to confirm with the doctor. It never decides. The short summary is AI-written and labelled, and every sentence was checked against the documents first." | Narrative unavailable: "Without the AI, everything shown comes straight from the documents." |
| 2:20–3:00 | **Ask, with a safety boundary** | Ask "What was my HbA1c last time and before that?" → cited answer → Ask "Should I stop taking metformin?" → advice redirect | "Answers come only from Meera's own records, with sources. Ask for medical advice and MediVara won't give it. It shows what the records say and suggests a question for the doctor. Emergencies get a fixed message with no AI involved." | Slow: evidence-only answer with its label |
| 3:00–3:35 | **ISL Visit Assist** | Right window (Ravi): Visit Card → "Show to staff" (full screen) → back → Glossary → "Thyroid" → official video with attribution | "Ravi is Deaf and uses Indian Sign Language. MediVara doesn't translate sign language, and we don't claim it. It helps Ravi be understood: a Visit Card asking for an interpreter or written communication, and official ISL dictionary signs for key health terms." | Video blocked: show the fallback text and the Visit Card |
| 3:35–4:10 | **Family and privacy** | Right window: sign out → demo card "Karthik" → profiles show Meera as "Shared with you · View · Reminders" → open Meera's timeline (no Upload button) → left window: Family → Remove Karthik → right window: navigate → **Access denied** → left: access log shows the denied attempt | "Meera shared view-only access with Karthik, who helps from another city. Every request is checked against Meera's consent. Meera removes it, and Karthik's very next click is denied. Meera can see who accessed the records." | If the revoke flow fails: show Access denied on Ravi's URL from Karthik's window instead |
| 4:10–4:30 | **Close** | Architecture slide | "MediVara organises; it doesn't diagnose. Every line is traceable, the AI is bounded and checked, and it keeps working when the AI is down. Synthetic data only, with no storage at the AI provider. Next: validate with patients, clinicians and the Deaf community." | n/a |

### 4.2 Three-minute version

Hook (0:15) → upload and bulk confirm (0:35) → brief with points to clarify, a citation and the narrative label (0:45) → Ask advice redirect only (0:20) → Visit Card full screen (0:20) → revoke and Access denied (0:25) → close (0:20). The timeline and the answered question are skipped.

### 4.3 Five-minute version (add these to the main version)

- After review: open DOC-6 to show the suspicious-content banner. "This note contained hidden instructions to the AI. MediVara flagged them and ignored them." (+0:20)
- After the brief: "Missing information" → create a reminder from the follow-up, shown with "IST" and a source link. (+0:20, only if reminders are built)
- Before the close: 15 seconds of the degraded-mode clip from the backup video. "Here it is with the AI switched off." (+0:15)

## 5. Success metrics

Measured by the team on the synthetic dataset. These are prototype measurements, not product claims.

| ID | Metric | Target | How measured | Limitations (say these if asked) |
|---|---|---|---|---|
| MET-01 | Extraction field accuracy | ≥ 90 % of answer-key fields | TC-EXT-01: compare the extracted facts with the answer key | 10 synthetic, clean, text-layer documents; not representative of real records |
| MET-02 | Source traceability | 100 % of displayed facts and record statements resolve to a document line | Validator design plus C opening every citation in the demo flow (TC-BRF-03, TC-ASK-02) | Shows traceability, not that a reader interprets it correctly |
| MET-03 | Safety handling | 10 / 10 emergency and advice prompts routed to templates; 0 unsafe statements displayed | TC-SAFE-01 to 04 | Small scripted set; novel phrasing could slip past the rules (the validator is the second line) |
| MET-04 | Injection resistance | Injected instruction followed 0 times in 10 runs | TC-INJ-02, 03 | One injection style tested |
| MET-05 | Validator false-rejection rate | ≤ 10 % | TC-SAFE-08 | One evaluator's judgement |
| MET-06 | Access control | 0 failing cells in the permission matrix; IDOR suite passes | TC-ACC-01 to 10, BE-3.5 | Prototype scope; no independent penetration test |
| MET-07 | Latency | Extraction ≤ 30 s typical; Ask p95 ≤ 20 s; deterministic endpoints ≤ 500 ms | TC-PERF-01 to 03 | Depends on venue network and provider load; one laptop |
| MET-08 | Accessibility | 0 critical or serious automated issues on P0 screens; keyboard-only golden path | TC-A11Y-01, 02 | Automated plus team testing; not tested with disabled users |
| MET-09 | Demo reliability | 3 consecutive clean rehearsals, including one failure drill | Rehearsal log; TC-REL-01 | Rehearsal conditions aren't live conditions |
| MET-10 | Time to brief | From the dashboard (processed documents) to a printed brief in ≤ 60 s and ≤ 8 interactions | NFR-USE-01 walkthrough | Team members as users, not patients |
| MET-11 | Ask correctness | ≥ 12 of 15 evaluation questions correct | TC-ASK-01 | Judged by one team member; small question set |

## 6. Minimum evidence for each claim

| Claim we make | Minimum evidence shown live | Backup evidence |
|---|---|---|
| Turns scattered records into an ordered history | Live upload, then the timeline with 5 documents from 3 providers | Backup video |
| Every statement is traceable | Clicking citations in the brief and in an answer opens the exact line and page | Screenshot of the evidence drawer |
| Finds documented inconsistencies and gaps | "Points to clarify" (metformin, allergies) and "Missing information" in the brief | Brief printout |
| AI is bounded and doesn't give advice | Advice redirect live; emergency template (if asked) | Evaluation log (MET-03) |
| Resists prompt injection | DOC-6 banner (5-minute version) | Evaluation log (MET-04) |
| Keeps working when the AI is down | Degraded-mode clip (5-minute version) | Rehearsal-2 drill notes |
| Accessible | Visit Card full screen; read-aloud; keyboard focus visible | Axe results (MET-08) |
| Supports ISL users (not translation) | Visit Card plus an official ISL video with attribution; About text | Glossary content file with sources |
| Consent-based family access with instant revoke | Live revoke, then Access denied, then the access log | Backup video |
| Privacy-conscious | Slide naming the controls: synthetic data only, `store=false`, scoped access, audit log, no PHI in logs (TC-SEC-04 result) | Test log |
| Reminders from documents (only if built) | Create from the follow-up; "IST" label | n/a |
| Simulated booking (only if built) | "Simulated" labels on everything | n/a |

## 7. Demo-day risks (top items; full register in [risk-register.md](risk-register.md))

| Risk | Probability | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Gemini slow or down during the demo (RSK-02) | M | H | Degraded-mode path rehearsed; golden cache; backup video | B |
| Venue network fails (RSK-07) | M | H | Phone hotspot; `cache_only` mode; video | C |
| Over-claiming under pressure (RSK-11) | M | H | Claims check (§8); rehearsed answers (§10) | C |
| Demo over time (RSK-23) | M | M | Timed rehearsals; 3-minute version ready | C |
| Demo laptop failure (RSK-08) | L | H | Backup laptop ready; video on a phone | B |
| ISL video blocked (RSK-10) | M | M | Fallback text; the Visit Card carries the segment | C |

## 8. Claims we must not make

| Don't say | Say instead |
|---|---|
| "Accurate", "clinically accurate", "validated" | "On our synthetic test set, extraction matched the answer key on X % of fields" |
| "Diagnoses", "recommends treatment", "tells you what to take" | "It organises what your documents say and helps you prepare questions" |
| "Compliant with [any law or standard]", "HIPAA", "DPDP-compliant" | "Regulatory assessment hasn't been done. It's on the roadmap with qualified advisers." |
| "Secure", "bank-grade", "production-ready" | "Prototype controls: scoped access on every request, audit log, no health data in logs" |
| "Translates sign language", "ISL translation", "sign recognition" | "ISL support: a Visit Card and official ISL dictionary videos for key terms" |
| "Books appointments", "confirmed booking", "real doctors available" | "A simulated booking flow shows how it could work" (only if shown) |
| "Doctor-ready", "doctors trust it" | "A visit-preparation summary designed for clinicians; we haven't tested it with them yet" |
| "Reminders you can rely on", "never miss a dose" | "In-app reminders while the app is open" |
| "Integrated with ABDM / hospitals" | "Health-record network integration is on the roadmap, after partnerships and certification" |
| "Works in Indian languages" | "English in this prototype; Tamil and Hindi are next" |
| "Privacy-first" on its own | Name the controls (synthetic data, `store=false`, scoped access, audit, minimal data sent) |
| "Users told us…", "research shows…" | "Our assumptions, which we still need to validate, are…" |
| "Autonomous AI agents" | "A bounded workflow of twelve stages, each checked" |

## 9. Fallback plan

| Failure | What we do | Narrator line |
|---|---|---|
| Live upload slow (over 20 s) | Continue to the timeline with existing documents; come back to DOC-5 | "While that's being read, here's the history so far." |
| Live extraction fails | Retry. If the AI is down, the golden cache gives DOC-5 with the "Cached result" chip. | "The AI service is slow, so MediVara used a saved reading of this exact file, and it says so on screen." |
| Scanned document (DOC-7) | Designed behaviour | "Scanned images aren't supported yet, and MediVara says so instead of guessing." |
| Narrative unavailable | The templated overview stays | "The short summary comes from the AI. Without it, you see only what's directly in the documents." |
| Ask degraded or timed out | Evidence lines with the notice | "Even without the AI, Meera still gets the exact lines that match the question." |
| Read-aloud has no voice | Skip it | "Read-aloud uses the device's own voices. Here's the text." |
| ISL video blocked | Fallback text and the dictionary link; stay on the Visit Card | "Videos come from the official ISL dictionary; offline, MediVara links there." |
| Family revoke misbehaves | Show Access denied using Ravi's profile URL in Karthik's window | "Each profile is visible only to the people the owner chose." |
| Network down | B switches to the hotspot (2 min); otherwise `cache_only` plus video segments | "We're switching networks. Meanwhile, here's a recording of the same flow." |
| Laptop failure | Backup laptop, with `snapshot-demo` restored in under 2 min, or the video | Same as above |
| Total failure | Play the final backup video and narrate live; then take questions | n/a |

## 10. Likely judge questions and honest answers

| Question | Answer (owner) |
|---|---|
| How do you know the extraction is accurate? | (B) "We measured it on our synthetic answer key: X % field accuracy. That set is small and clean, so it shows the pipeline works as designed, not real-world accuracy. That's why every fact shows its source line and the user reviews it before relying on it." |
| What stops the AI from making things up? | (B) "Facts first. Code builds the timeline and the brief from reviewed facts. The AI only writes wording from this patient's lines, must cite a line for every statement, and a validator checks that numbers and medicine names appear in the cited lines. Anything unsupported is dropped before display, and nothing is streamed unchecked." |
| Isn't this medical advice? Is it regulated? | (C) "It organises what documents say and never diagnoses or suggests changes. Emergencies and advice requests are handled by fixed rules before any AI call. We haven't assessed regulatory status; that's a roadmap item with qualified advisers, and we're not claiming compliance." |
| Where's the RAG? Why no vector database? | (B) "Retrieval here is patient-scoped evidence selection. One patient's record fits in context, so we retrieve all of it with line-level citations: exact recall, nothing missed by ranking. Ranked and semantic retrieval, with per-patient row-level security, is the scale-up path." |
| You're sending medical data to Google? | (B) "Only synthetic data in this prototype. Calls use `store=false` on a paid project and send only the text needed. Production would need enterprise terms, a data-processing agreement, identifier redaction and a legal review under Indian data-protection law." |
| Can I try it with my own report? | (C) "We'd rather not. It's a prototype and we don't want real health data going through it. Here's a synthetic sample you can upload instead." |
| Does it translate sign language? | (C) "No, and we deliberately don't claim that. It supports Deaf users with a Visit Card and official ISL dictionary videos for key terms. Real translation needs co-design with the Deaf community and validated models, so it's research on our roadmap." |
| Two documents disagree: which one is right? | (C) "MediVara never decides. It shows both with dates and sources, points out the most recent by date, and asks the patient to confirm with their doctor." |
| How is family access secured? | (B) "The owner grants scoped access with explicit consent. Every request checks the grant, revoking works on the next request, and the owner sees an access log. Production would add invitations and identity verification." |
| What happens when Gemini is down? | (B) "The timeline and brief still work, because they're deterministic. Ask shows the matching lines. Known files use a labelled cache. We rehearsed exactly this." |
| How would doctors use it? | (C) "A one-page brief where every line cites a document and page, with discrepancies flagged. We haven't tested it with clinicians yet; that's our first study after the hackathon." |
| Why Gemini? | (B) "Strong document understanding and structured outputs, and it's what we have access to. All model calls go through one wrapper, so the provider can be switched." |
| What about photos and handwriting? | (B) "Not in this prototype. Scans fail with an honest message. Vision OCR is designed, with confidence capped lower because it can't be checked against a text layer." |
| How did you test safety? | (C) "Ten scripted emergency and advice prompts (all handled by templates), adversarial prompts, an injection document across five runs each, validator unit tests, and a stop-ship rule for any unsafe output." |
| Is the timeline generated by AI? | (B) "No. It's built by code from facts the user reviewed. The AI is used to read documents and to word answers, nothing else." |
| Who would pay for this? | (C) "We haven't validated a model yet. Options we'd test: free for patients, with clinic or care-programme partnerships later. Our first step is proving the value with users." |
| What would you build next? | (C) "Validation with patients, clinicians and Deaf community organisations; photo OCR and Indian languages; production security; health-record network integration after partnerships." |
| Who did what? | (C) "Person A built the frontend and accessibility, Person B the backend, AI pipeline and safety layer, and Person C product, integration, testing and this demo." |

## 11. Pitch slides (keep to 6–8)

1. **Problem:** Meera's scattered, conflicting records (the §1 statement).
2. **Live demo** (§4).
3. **How it works:** "Facts first, AI second" diagram (12 bounded stages in 4 modules).
4. **Safety and privacy, named controls:** evidence citations, validator, rules-first emergency and advice handling, `store=false`, synthetic data, scoped access, audit log.
5. **Accessibility:** ISL Visit Assist, read-aloud, plain language; what we deliberately don't claim.
6. **Evidence:** the metrics table with limitations (§5).
7. **Roadmap:** validate → harden → languages and accessibility → ecosystem (from [../srd/13-scope-and-roadmap.md](../srd/13-scope-and-roadmap.md)).
8. **Team and thanks.**
