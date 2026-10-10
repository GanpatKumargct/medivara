# 03 — Problem Statement, Research Assumptions and Personas

> SRD sections 5.2 and 5.3. Owner: **Person C**.
> No statistics are quoted as facts here. Every claim about users is an assumption to validate (§3).

## 1. Problem statement

People living with long-term conditions collect medical documents from many places: clinic prescriptions, laboratory reports, hospital discharge summaries, and photos of paper slips on their phones. The information is **fragmented** (spread across providers and formats), **hard to read** (abbreviations, tables, handwriting), and **hard to use at the moment it matters** (a short consultation with a new or busy doctor).

As a result, patients and the family members who help them:
- cannot easily say which medicines and doses their latest documents list, or notice that documents disagree;
- struggle to describe their history in order, with dates and results;
- miss follow-ups written in a prescription;
- face extra barriers if they have limited reading ability, low vision, or are Deaf and use Indian Sign Language (ISL);
- share records informally (photos on chat apps) with no control over who sees what.

**MediVara's response:** a patient-controlled companion that turns scattered documents into a verified, source-linked history. It helps patients prepare for consultations, including in accessible formats, without ever replacing the clinician's judgement.

## 2. Pain points and why they matter

| # | Pain point | Why it matters | MediVara response | Priority |
|---|---|---|---|---|
| PP-1 | Records scattered across providers and formats | History is incomplete at the point of care; patients repeat tests or forget events | One repository; extraction into structured facts; timeline | P0 |
| PP-2 | Documents disagree (dose, allergies) without anyone noticing | Confusion about what to take; risk when allergies are recorded inconsistently | Deterministic "points to clarify", always phrased as "confirm with your doctor" | P0 |
| PP-3 | Hard to understand reports and abbreviations | Patients disengage or misread results | Plain-language answers, values with their printed reference ranges, sources for everything | P0 |
| PP-4 | Little time in consultations | Important history is not mentioned | Consultation Brief with questions for the doctor | P0 |
| PP-5 | Low trust in AI summaries | People rightly fear invented information | Every statement cites the exact source line; a validator removes anything unsupported | P0 |
| PP-6 | Accessibility barriers (limited reading, low vision, Deaf ISL users) | Unequal access to one's own health information and to consultations | Read-aloud, large text, Visit Card, ISL glossary, interpreter request | P0 (Visit Assist), P1 (voice) |
| PP-7 | Family caregivers help informally, with no control or audit | Privacy loss; caregivers lack an up-to-date picture | Scoped caregiver access with immediate revoke and an access log | P1 |
| PP-8 | Follow-ups written in documents are forgotten | Missed reviews | Follow-up detection, reminders | P1 |

## 3. Research assumptions to validate

These are hypotheses. They shape the design, but they are **not established facts**. The hackathon cannot validate them; the post-hackathon roadmap includes validation.

| ID | Assumption | Why we believe it is plausible | How to validate (post-hackathon) | Status |
|---|---|---|---|---|
| H-01 | Patients with chronic conditions hold documents from three or more providers | Common care pathways involve a GP, a lab and occasional hospital care | 15–20 patient interviews; document inventory exercise | Unvalidated |
| H-02 | Patients struggle to state current medicines and doses accurately at visits | Medicine lists change across prescriptions | Ask participants to list medicines, then compare with their documents | Unvalidated |
| H-03 | Family members, often in other cities, help elderly parents with records | Caregiving by adult children is common in Indian families | Caregiver interviews; diary study | Unvalidated |
| H-04 | Clinicians will read a one-page, sourced summary if it is accurate and short | Time pressure favours brief, structured input | Usability sessions with 5–8 clinicians using synthetic briefs | Unvalidated |
| H-05 | Deaf ISL users face communication barriers in clinics and would use a Visit Card and an interpreter request | Interpreter availability in clinics is limited | Co-design sessions with Deaf community organisations and ISL interpreters | Unvalidated |
| H-06 | Users trust AI summaries more when every statement links to its source | Source transparency builds trust | A/B usability test, sourced vs unsourced summaries | Unvalidated |
| H-07 | Read-aloud plus large text helps people with limited reading ability | Audio and visual alternatives reduce reading burden | Usability test with participants with limited literacy or low vision | Unvalidated |
| H-08 | Users accept reviewing extracted facts if review is fast (bulk confirm, clear sources) | Review is the price of trust | Time-on-task measurement in usability tests | Unvalidated |

The pitch states these as hypotheses (see [../hackathon/demo-and-judging-strategy.md](../hackathon/demo-and-judging-strategy.md)).

## 4. Personas

All personas are **fictional**. The demo accounts use the first three names (Meera, Karthik, Ravi) with synthetic records only.

### P-01 Meera Raman — patient managing records from several providers

| Aspect | Detail |
|---|---|
| Snapshot | 58, retired teacher in Chennai. Lives with Type 2 diabetes and hypertension. Sees a family physician, gets tests at a diagnostic lab, and had a short hospital stay last year. Comfortable with a smartphone and WhatsApp, less so with PDFs. |
| Goals | Know which medicines and doses their latest documents list. See how test results changed. Arrive at appointments prepared. |
| Pain points | Documents disagree on the metformin dose. One prescription says "no known drug allergies" while the discharge summary says "sulfa drugs". Forgets follow-up instructions. |
| Key tasks | Upload documents → review extracted facts → view the timeline → create a Consultation Brief → ask "What was my last HbA1c?" → print the brief. |
| Accessibility needs | Larger text; plain language; a printable summary to hand to the doctor. |
| Success looks like | A one-page brief, with sources, that they trust and hand to the doctor. |
| Served by | FR-010–FR-022, FR-032–FR-041, FR-051 |

### P-02 Karthik Raman — authorised family caregiver

| Aspect | Detail |
|---|---|
| Snapshot | 32, Meera's adult child, a software engineer in Bengaluru. Helps remotely with appointments and reminders. Has a small record of their own. |
| Goals | See Meera's records when Meera allows it. Track follow-ups. Never see records they haven't been given. |
| Pain points | Gets photos of prescriptions on chat with no context. Worries about privacy and about overstepping. |
| Key tasks | Open the family dashboard → open Meera's profile (view only, reminders allowed) → check the brief → create a follow-up reminder. Loses access immediately when Meera revokes it. |
| Accessibility needs | None specific. Values clarity about what they are allowed to do. |
| Success looks like | Clear role and scope badges, useful read access, and immediate loss of access when revoked. |
| Served by | FR-004, FR-005, FR-080–FR-084, FR-070–FR-072 |

### P-03 Saroja Iyer — user with limited reading ability and low vision

| Aspect | Detail |
|---|---|
| Snapshot | 67. Reads Tamil better than English. Has low vision and uses large text on the phone. Relies on a neighbour to read reports aloud. (Not a demo account; the persona drives the accessibility requirements.) |
| Goals | Understand what the latest report says without depending on others. |
| Pain points | Small print, English abbreviations, dense tables. |
| Key tasks | Turn on large text and high contrast → open the brief → press Read aloud → ask a short question. |
| Accessibility needs | 150 % text, high contrast, read-aloud, short plain sentences, large touch targets. Future: Tamil language support (roadmap). |
| Success looks like | Hears the key facts of the latest report read clearly, with no guessing. |
| Served by | FR-050, FR-051, FR-055, FR-056 |

### P-04 Ravi Menon — Deaf user who communicates in Indian Sign Language

| Aspect | Detail |
|---|---|
| Snapshot | 41, graphic designer in Pune. Deaf from birth. ISL is their first language; reads English but prefers visual communication. Has hypothyroidism. |
| Goals | Communicate their needs and history at appointments without relying on family to interpret. Make sure the clinic knows they need an ISL interpreter. |
| Pain points | Clinics rarely arrange interpreters. Spoken explanations are missed. Voice-first apps exclude them. |
| Key tasks | Open ISL Visit Assist → choose communication needs → show the full-screen Visit Card to reception → look up the ISL sign for "thyroid" or "medicine" in the glossary to share with staff → print the brief. |
| Accessibility needs | Everything works without sound. Visual-first layout. Captions or text for any audio. No feature that assumes speech. |
| Success looks like | Reception reads the card and arranges written communication or an interpreter; the doctor gets the brief. |
| Served by | FR-060, FR-061, FR-062, FR-063 |

**Design guardrail:** MediVara must not imply that it translates ISL. The capability is communication **support**, not translation (COPY-17). Co-design with Deaf users is a roadmap commitment (H-05).

### P-05 Dr. Anand Krishnan — healthcare professional receiving a patient-prepared summary

| Aspect | Detail |
|---|---|
| Snapshot | 45, general physician in a busy urban clinic. Sees many patients a day and has a few minutes per consultation. Sceptical of AI-generated documents. |
| Goals | Get an accurate picture of the patient's documented history in under two minutes. Know where each statement came from. Spot discrepancies quickly. |
| Pain points | Patients bring unordered paper stacks. Summaries without sources can't be trusted. |
| Key tasks (as a reader, not a user) | Read the printed brief: medicines, conditions, results over time, points to clarify, sources. Check one source line against the original. |
| Accessibility needs | Readable printed layout; no jargon from the app; clear separation of documented facts from AI-written text. |
| Success looks like | Trusts the brief because every line cites a document and page, and AI-written text is labelled. |
| Served by | FR-033, FR-034, FR-021 |

## 5. Persona-to-demo mapping

| Demo moment | Persona | Account |
|---|---|---|
| Upload, review, timeline, brief, Ask | Meera (P-01) | `meera.demo@medivara.test` |
| Read-aloud and large text | Saroja's needs (P-03), shown on Meera's brief | Meera |
| ISL Visit Assist | Ravi (P-04) | `ravi.demo@medivara.test` |
| Family access, scopes and revoke | Karthik (P-02) with Meera | Karthik and Meera in two browser windows |
| Printed brief handed to the doctor | Dr. Anand (P-05) | Printout or print preview |
