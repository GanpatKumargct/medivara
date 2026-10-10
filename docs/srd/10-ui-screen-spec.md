# 10 — Screen-by-Screen UI Specification

> SRD section 5.10. UX owner: **Person A**. Copy owner: **Person C** (the copy deck in §19 is final wording; Person A uses it verbatim).
> API IDs refer to [11-api-contract.md](11-api-contract.md). Requirement IDs refer to [04-functional-requirements.md](04-functional-requirements.md).

## 1. Global UX rules

| Topic | Rule |
|---|---|
| Layout | Single-page app. Header contains the product name, current profile name and role badge, the "Aa" display menu and the account menu (sign out). A footer on every page shows COPY-02. A "Skip to main content" link comes first. |
| Navigation | Left sidebar on wide screens (Dashboard, Records, Timeline, Ask, Brief, Visit Assist, then P1 items: Reminders, Family, Appointments, Settings). On narrow screens it becomes a bottom bar showing the five P0 items plus "More". |
| Routing | Patient-scoped routes include the patient ID, for example `/p/pat_meera/timeline`. Opening a profile the user cannot access shows the Access denied page (SCR-16). |
| Visual language | Calm and clinical. One accent colour; status colours always come with text and an icon. Badges: Unverified, Corrected, Documents differ, Cached result, Synthetic sample, Simulated, AI-generated. |
| Reading level | UI copy and AI output aim at roughly grade 6–8 English. Short sentences. Medical terms are kept but explained when space allows. |
| Dates and times | Dates display as `DD Mon YYYY` (for example 04 May 2026). Times carry the "IST" label. Dates the user enters are day-first. |
| Citations | Every AI or derived statement shows citation chips (`E1`, `E2`…). A chip opens the Evidence drawer: document title, date, page, the exact source line text, and an "Open document at page N" link. |
| Mock indicator | While any mock is active, a fixed "MOCK DATA" badge (COPY-32) shows in the corner. It is never visible in the demo build. |
| Accessibility baseline | WCAG 2.1 AA-oriented. Every control is keyboard reachable with a visible focus ring. Processing updates and answers are announced through polite live regions. Touch targets are at least 44×44 px. Reduced-motion preference is respected. Colour is never the only signal. |
| Display preferences | Text size (100 / 125 / 150 %), high contrast, reduced motion and read-aloud speed are stored in the browser per device (DEC-09). |

## 2. Screen index

| ID | Screen | Priority | Main APIs | FE tasks |
|---|---|---|---|---|
| SCR-01 | Welcome and onboarding | P0 | API-04, API-05 | FE-2.3 |
| SCR-02 | Login and demo entry | P0 | API-02 | FE-2.2 |
| SCR-03 | Profile selector and family dashboard | P1 (single-profile users skip it) | API-06 | FE-2.5 |
| SCR-04 | Patient dashboard | P0 | API-07, API-10, API-19, API-27 (P1) | FE-2.4 |
| SCR-05 | Records: upload and processing | P0 | API-08, API-09 (P1), API-10, API-11, API-13 | FE-3.1–FE-3.3, FE-3.7 |
| SCR-06 | Document viewer and extraction review | P0 | API-11, API-12, API-14, API-15, API-16, API-22 (P1) | FE-3.4–FE-3.6, FE-3.8 |
| SCR-07 | Medical timeline | P0 | API-17 | FE-4.1, FE-4.2 |
| SCR-08 | Ask (AI questions) | P0 | API-21 | FE-5.1–FE-5.3 |
| SCR-09 | Consultation Brief (source-linked summary) | P0 | API-18, API-19, API-20 | FE-4.4–FE-4.6 |
| SCR-10 | Voice layer (components) | P1 | API-21 (`input_mode`) | FE-7.1–FE-7.3 |
| SCR-11 | ISL Visit Assist | P0 | API-19, static glossary | FE-8.1–FE-8.3 |
| SCR-12 | Reminders | P1 | API-27–API-30 | FE-9.1–FE-9.3 |
| SCR-13 | Appointments (simulated) | P1 (likely cut) | API-31–API-33 | FE-9.4 |
| SCR-14 | Family sharing and permissions | P1 | API-23–API-26 | FE-6.1–FE-6.3 |
| SCR-15 | Settings, consent and privacy | P1 (logout and display menu are P0, in the header) | API-04, API-05, API-03 | FE-10.4 |
| SCR-16 | System states catalogue | P0 | API-01 | FE-10.1–FE-10.3 |

---

## 3. SCR-01 Welcome and onboarding — P0

**Purpose:** before first use, explain what MediVara is and is not, collect consent, and offer display settings.

**Layout:** a three-step card with a progress indicator:
1. "What MediVara does": COPY-01, plus three icons (organise, understand, prepare) and a "What it doesn't do" list.
2. "Your consent": COPY-03 and COPY-04, each with a checkbox; "Continue" is disabled until both are ticked.
3. "Make it comfortable": text size, high contrast and reduced motion toggles, each with a live preview.

**User actions:** Next, Back, tick consents, Finish.
**Inputs:** two consent checkboxes; display preferences.
**Outputs:** two API-05 calls (`terms_and_disclaimer`, `ai_processing`); preferences saved locally.
**Validation:** both checkboxes are required to continue.
**API dependencies:** API-04 (`onboarding_required`), API-05.
**States:** loading (skeleton card); error (inline banner with retry); success (go to SCR-04, or SCR-03 when more than one profile is accessible).
**Responsive:** full-width card under 600 px; centred 560 px card above.
**Accessibility:** steps announced as "Step 2 of 3"; checkbox labels are the full consent text; focus moves to the step heading on change.

**Acceptance criteria:**
- AC1: A user with `onboarding_required: true` always sees SCR-01 after login, and no patient data loads until consent is recorded.
- AC2: Both consents produce `ConsentRecord` rows with the current policy version.
- AC3: Display preferences apply immediately and persist after reload.

## 4. SCR-02 Login and demo entry — P0

**Purpose:** sign in with real credentials. Demo account cards make switching quick for judges.

**Layout:**
- Product name with the tagline "Your medical documents, organised and explained — with sources."
- Email and password form.
- Below it, a "Demo accounts (synthetic data)" panel with three cards: Meera Raman (patient), Karthik Raman (caregiver), Ravi Menon (Deaf ISL user). Each card shows email, password and a "Sign in as …" button.
- COPY-03 banner at the bottom.

**User actions:** sign in; click a demo card, which fills the form and submits through the same API-02 call.
**Validation:** email format; password required. A 401 shows COPY-34a inline.
**API dependencies:** API-02.
**States:** submitting (button spinner, form disabled); error (inline); session ended (COPY-33 banner when redirected after a 401).
**Responsive:** cards stack vertically under 768 px.
**Accessibility:** form errors are linked through `aria-describedby`; demo cards are buttons with full accessible names, for example "Sign in as Meera Raman, patient, synthetic demo account".

**Acceptance criteria:**
- AC1: A demo card signs in through API-02. There is no client-side bypass.
- AC2: After sign-in the token is held in memory and in session storage only (one session per browser tab, so two windows can hold different users for the family demo).
- AC3: Wrong credentials show one generic message.

## 5. SCR-03 Profile selector and family dashboard — P1

**Purpose:** choose which accessible profile to work in. Each profile card shows the user's role and permissions.

**Layout:** a grid of profile cards. Each card shows display name, "Synthetic" badge, role badge ("You" or "Shared with you"), scope chips (View records · Upload · Reminders), stats (documents, needs review, upcoming reminders) and an "Open" button.

**User actions:** open a profile.
**API dependencies:** API-06.
**States:** loading (card skeletons); empty (cannot happen for an owner; shown defensively); error.
**Behaviour:** users with exactly one accessible profile skip this screen and land on SCR-04.
**Responsive:** one column under 600 px, two columns up to 1024 px, three columns above.
**Accessibility:** each card is a list item with a heading. Scope chips have text labels.

**Acceptance criteria:**
- AC1: Only profiles returned by API-06 appear.
- AC2: Role and scopes match the API exactly.
- AC3: Opening a profile routes to `/p/{patient_id}`.

## 6. SCR-04 Patient dashboard — P0

**Purpose:** the home view for one profile, showing what needs attention.

**Layout:**
- Header: profile name, role badge, and "Synthetic profile" badge.
- Quick actions row: Upload, Timeline, Ask, Create brief, Visit Card.
- Tiles: Documents (total and processing), Needs review (count with link), Latest brief (date, stale flag, "Open").
- P1: an "Upcoming reminders" list (next three).
- An AI status banner when API-01 reports the AI unavailable.

**User actions:** quick actions; open items needing review; open latest brief.
**API dependencies:** API-07 (stats), API-10 (recent five documents), API-19 (latest brief; 404 means none yet), API-27 (P1).
**States:** loading (tile skeletons); empty ("No documents yet" with Upload CTA and COPY-03); error per tile (tiles fail independently).
**Responsive:** tiles in a 3-column grid on wide screens, stacked on mobile.
**Accessibility:** tiles are links with descriptive names, for example "1 document needs review".

**Acceptance criteria:**
- AC1: Counts match API-07.
- AC2: Controls the user's scopes don't allow are hidden (for example, a caregiver without `upload_documents` sees no Upload).
- AC3: The dashboard renders in under 2 seconds on the demo laptop with the demo snapshot.

## 7. SCR-05 Records: upload and processing — P0

**Purpose:** add documents, watch them being read, and handle failures.

**Layout:**
- Drop zone: "Drop a PDF here or choose a file", with a hint "PDF, up to 10 MB, up to 10 pages" and COPY-03.
- P1: a "Load synthetic sample records" button (visible only when `demo_mode` is true).
- Filter chips: type and status.
- Document list rows: title, type icon, document date (with an "ambiguous" marker when relevant), status chip, a stage progress line while processing, fact counts, and flags (Synthetic sample, Cached result, Suspicious content).

**User actions:** upload; retry a failed document (API-13); open a document (SCR-06); filter.
**Inputs:** a file; optional document type hint (select).
**Validation (client, mirroring the server):** file type by extension and MIME, size up to 10 MB. The server re-checks content and page count.
**Processing feedback:** after API-08 returns 202, the row shows the stages "Waiting to be read" → "Reading text" → "Checking content" → "Extracting information" → "Checking results". It polls API-11 every 2 seconds and stops polling on `needs_review`, `ready` or `failed`.
**Failure states:** each `failure_code` maps to the copy deck (COPY-14 for scans, COPY-09 variants for AI problems, COPY-34b to COPY-34e for upload errors). "Try again" appears for AI failures and internal errors, not for unsupported files.
**API dependencies:** API-08, API-09 (P1), API-10, API-11, API-13.
**Responsive:** on mobile, rows become cards and the drop zone becomes a "Choose file" button.
**Accessibility:** the drop zone is also a button; upload progress and status changes are announced through a live region ("Lab report: extracting information").

**Acceptance criteria:**
- AC1: A valid synthetic PDF appears in the list immediately with status "Waiting to be read" and reaches "Ready — please review" without a page reload.
- AC2: A scanned PDF ends in the failed state showing COPY-14, with no retry button.
- AC3: A duplicate shows COPY-34d with a link to the existing document.
- AC4: Polling never runs faster than once per 2 seconds and stops on terminal states.

## 8. SCR-06 Document viewer and extraction review — P0

**Purpose:** show the original document beside what MediVara extracted, and let the user confirm, correct or reject each item.

**Layout (two panes; tabs on mobile: "Document" | "What we found"):**
- **Left — Document pane:** the PDF in the browser's built-in viewer via an authenticated blob URL. "Go to page N" happens when a fact's "Show in document" link is used.
- **Right — Review pane:**
  - **Banners:** COPY-13 if `suspicious_instructions`; COPY-28 if `date_ambiguous`; COPY-11 if `cached_extraction`.
  - **Document details card:** type, date (as read, with the original text), facility, clinician. Each has an Edit button (API-14).
  - **Bulk action:** "Confirm all high-confidence items (n)" (API-16).
  - **Facts grouped by type** (Medicines, Test results, Conditions, Allergies, Follow-up, Instructions). Each fact card shows:
    - `display_text`
    - a confidence badge: High, Medium or Low, with icon and text
    - uncertainty reasons as plain sentences, for example "No reference range printed"
    - the source line text in a quote style, with "Show in document (page N)"
    - a status badge
    - actions: Confirm · Correct · Reject (Undo for rejected)
  - **Correct dialog:** shows the fields for the fact type, pre-filled; a note (optional); Save.

**User actions:** confirm, correct, reject, undo; bulk confirm; edit document details; P1: delete document (owner only, with confirm dialog).
**Validation:** corrected values are 1–200 chars and the date is not in the future. If the server rejects an action, the server's message is shown.
**API dependencies:** API-11, API-12, API-14, API-15, API-16, API-22 (P1).
**States:** loading (two skeleton panes); processing (review pane shows the stage, reusing the SCR-05 component); failed (failure card with retry when allowed); success toasts ("Confirmed", "Saved correction").
**Responsive:** side by side at 1024 px and wider; tabs below.
**Accessibility:** each fact card is an article with a heading. Confidence is not shown by colour alone. Dialogs trap focus and return it on close. Changes are announced.

**Acceptance criteria:**
- AC1: Every fact shows its exact source line and page.
- AC2: Confirm, correct and reject update the badge without a full reload, and the document status updates from the response.
- AC3: Bulk confirm affects only high-confidence unverified facts.
- AC4: An ambiguous date can be confirmed or changed through Edit, which clears the banner.
- AC5: A caregiver without `upload_documents` sees facts read-only.

## 9. SCR-07 Medical timeline — P0

**Purpose:** a chronological history built from documents and facts. Every item links back to its source.

**Layout:**
- Filter bar: event types (multi-select chips), date range, "Include unverified" toggle (default on), order (Newest first / Oldest first).
- A vertical timeline with date headers. Document events appear as cards (type icon, title, facility, clinician) with child fact rows.
- Change markers appear inline, for example "Strength changed: 500 mg → 1000 mg" or "HbA1c: 8.4 % → 7.6 %". They show values and dates only, never "better" or "worse".
- A "Date unknown" group at the end.

**User actions:** filter; open an event, which goes to SCR-06 at the document with the fact highlighted and the page set.
**API dependencies:** API-17.
**States:** loading (skeleton rows); empty ("Your timeline will appear after your first document is read", with Upload CTA); filtered-empty ("No events match these filters", with Clear filters); error.
**Responsive:** single column; date headers are sticky on mobile.
**Accessibility:** the timeline is an ordered list grouped by date headings. Change markers carry text descriptions.

**Acceptance criteria:**
- AC1: Events appear in date order with correct grouping.
- AC2: Rejected facts never appear.
- AC3: Unverified items carry the badge and disappear when the toggle is off.
- AC4: Every event opens its source document at the right page.

## 10. SCR-08 Ask (AI questions) — P0

**Purpose:** ask questions about this profile's documents and get answers with sources, or a safe redirect.

**Layout:**
- **Thread area:** for the current session only, cleared on sign-out.
- **Example question chips:** "What was my latest HbA1c?", "Which medicines are listed in my latest prescription?", "Do my documents mention allergies?"
- **Input area:** text box with a 500-character counter, Send button, and a mic button (P1, SCR-10).
- **Answer card:**
  - statements as short paragraphs, each followed by citation chips
  - an "Explanation" label on `explanation` statements ("General information — not from your documents")
  - notices
  - "Questions you could ask your doctor"
  - COPY-02
  - read-aloud button (P1)
- **Status-specific layouts:**
  - `emergency`: a full-width red-bordered card with COPY-05, at the top of the thread
  - `advice_redirect`: COPY-06, then "What your documents say" (evidence lines), then the suggested question
  - `not_found`: COPY-07
  - `out_of_scope`: COPY-07b
  - `degraded` / `withheld`: COPY-09 / COPY-08 plus the COPY-10 header and evidence lines
- **Loading state:** progressive text "Checking your documents…" → "Writing an answer…" → "Checking every statement against your documents…" (changing about every 3 s, purely client-side), and a Cancel button that stops waiting for the response.

**User actions:** type and send; use example chips; open citations; P1: voice input and read-aloud.
**Validation:** 1–500 characters after trimming; Send is disabled while waiting.
**API dependencies:** API-21.
**Responsive:** the input is pinned to the bottom on mobile; the Evidence drawer is a bottom sheet on mobile and a side panel on desktop.
**Accessibility:** new answers are announced through a polite live region (the emergency card through an assertive one). Citation chips have names like "Source 1: Lab report, 04 May 2026". Focus stays in the input after sending.

**Acceptance criteria:**
- AC1: Every `record_fact` statement shows at least one working citation chip.
- AC2: Every status value has its own layout using the copy deck.
- AC3: The client stops waiting after 25 seconds and shows the timeout state with a "Try again" button. The server limit is 20 seconds.
- AC4: The question text never appears in the browser console or in analytics.

## 11. SCR-09 Consultation Brief — P0

**Purpose:** a visit-preparation summary of what the documents say, with sources, points to clarify and questions for the doctor. It is printable.

**Layout:**
- **Top bar:** "Create new brief" (API-18) with an "Include unverified items" toggle and a "Reason for visit (optional, your words)" input; Print; Read aloud (P1); "Open Visit Card".
- **Stale banner:** COPY-31 when `stale` is true.
- **Header:** patient name, age (synthetic), number of documents and providers, date range, created at, number of unverified items.
- **Overview:** shows `templated_text` at once. When the brief is opened, the client calls API-20 once. While waiting it shows "Writing a short summary…". When ready, the validated narrative replaces the templated text, carries an "AI-generated, checked against your documents" label and citation chips. If unavailable or withheld, the templated text stays and the notice is shown.
- **Sections:**
  - Medicines: "Medicines in your most recent prescription ({document title})", plus a collapsed "Also mentioned in older documents" list showing last-seen dates. Older medicines are never presented as current.
  - Conditions (as documented)
  - Test results over time: a small table per test (date, value, unit, flag as written, reference range), with no colour coding of "good" or "bad"
  - Allergies: documented / not documented / documents differ
  - Points to clarify
  - Missing information
  - Questions for your doctor
  - Sources
- **Badges:** Unverified, Documents differ, Corrected.
- **Footer:** COPY-02.

**Print layout:** A4, black and white friendly. Navigation and buttons are hidden. Citation chips print as `[E1]`, and a "Sources" appendix lists each evidence line with document and page. The page footer shows "Created with MediVara (prototype) · synthetic data · not medical advice".

**User actions:** create, print, read aloud, open citations, open the Visit Card.
**API dependencies:** API-18, API-19 (404 shows the empty state), API-20.
**States:** loading; empty ("Create your first brief" CTA); stale; narrative loading / ready / unavailable / withheld; error.
**Responsive:** one column; section tables scroll horizontally inside their own container on small screens.
**Accessibility:** section headings form a logical outline; tables have header cells; the narrative update is announced politely.

**Acceptance criteria:**
- AC1: The deterministic sections render within 1 second of creation, without waiting for the narrative.
- AC2: Every item shows citations that resolve to source lines.
- AC3: The planted metformin dose difference and allergy conflict appear under "Points to clarify" with the copy deck wording.
- AC4: The print preview fits the brief on at most two A4 pages for the demo dataset.
- AC5: The narrative never appears without the "AI-generated, checked against your documents" label.

## 12. SCR-10 Voice layer — P1 (components used in SCR-08, SCR-09, SCR-11)

**Purpose:** voice input for questions and read-aloud for outputs, with an equivalent text path for every voice feature.

**Components:**
- **ReadAloudControls (FE-7.1):**
  - Play / Pause / Stop and speed (0.8× / 1× / 1.2×).
  - Reads only text already validated and on screen. Citations are read as "source: lab report, 04 May 2026".
  - Prefers on-device voices (`localService`) for en-IN, then en-GB / en-US.
  - When only network voices exist, shows COPY-21 before the first use.
- **MicButton (FE-7.2):** states:
  - Idle
  - Requesting permission: the browser prompt, plus COPY-20 shown the first time
  - Listening: pulsing indicator, "Listening… tap to stop", interim transcript
  - Processing
  - Error: COPY-22 for permission denied; "Didn't catch that — try again or type"
  - Unsupported: the button is hidden and replaced by the hint "Voice input works in Chrome or Edge"
  - Auto-stops after 15 seconds or on silence. Language `en-IN`. Requests on-device recognition where the browser supports it.
- **TranscriptConfirm (FE-7.3):** the transcript goes into the question box for review and editing. The user must press Send; nothing is sent automatically. The request sets `input_mode: "voice"`.

**Permissions and privacy:** the microphone is requested only after a user gesture. MediVara never receives audio, only the final text the user sends. A `voice_input` consent record is created on first use (API-05).

**Accessibility:** recording state is announced ("Recording started", "Recording stopped"). Every control works from the keyboard.

**Acceptance criteria:**
- AC1: Speech is never sent without the user pressing Send.
- AC2: Denying the microphone leaves typing fully usable, and COPY-22 is shown.
- AC3: Read-aloud can be stopped at any time and never reads hidden or unvalidated text.

## 13. SCR-11 ISL Visit Assist — P0

**Purpose:** help Deaf and hard-of-hearing patients, especially ISL users, communicate at appointments. **It does not translate sign language** (COPY-17).

**Layout (tabs: Visit Card · ISL Glossary · About):**
- **Visit Card (FE-8.1):**
  - **Communication needs checklist** (choices remembered on this device): "I am Deaf and use Indian Sign Language (ISL)", "Please arrange a qualified ISL interpreter", "Please write things down or type on my phone", "Please look at me when you speak", "I am hard of hearing", "Please give me extra time". The default wording is COPY-19.
  - **Optional free-text note** (max 140 characters).
  - **Key facts from the latest brief:** current medicines, allergies (including "documents differ"), conditions. Each item is marked with its source document and date. If no brief exists, the card offers "Create brief".
  - **Quick phrases board:** large tappable cards ("Please write it down", "Please repeat", "Please slow down", "I need an interpreter", "Thank you").
  - **"Show to staff"** opens a full-screen, high-contrast, extra-large-text view with an Exit button.
  - **Print** uses the A4 card layout.
- **ISL Glossary (FE-8.2):**
  - A searchable list of up to 15 health terms (content by Person C, static file).
  - Each term opens a player with the official ISL dictionary video, embedded in privacy-enhanced mode, plus an attribution line and source link (COPY-18).
  - Terms without a video, or used offline, show text plus "ISL video not available here — see the ISL dictionary link" (COPY-18b).
  - The videos load from YouTube (disclosed in About).
- **About:** COPY-17 limitations; what MediVara does and doesn't do for ISL users; future plans (co-design with Deaf community organisations; no translation claims).

**User actions:** choose needs; show full screen; print; search and play glossary videos.
**API dependencies:** API-19 (latest brief); static glossary content.
**States:** no brief (CTA); glossary offline (text fallback); video blocked (link fallback).
**Responsive:** the Visit Card full-screen mode is optimised for a phone held up to staff (portrait and landscape).
**Accessibility:** the full-screen mode meets AAA-level contrast (7:1) and text of at least 28 px; videos have a text title and description; nothing relies on audio.

**Acceptance criteria:**
- AC1: The Visit Card shows the chosen statements and the key facts with sources, prints on one A4 page, and opens a working full-screen view.
- AC2: Every glossary video shows source attribution; terms without verified videos never show a video.
- AC3: No screen or copy says or implies that MediVara translates ISL.
- AC4: Everything works without sound.

## 14. SCR-12 Reminders — P1

**Purpose:** keep track of appointments, follow-ups and user-entered medicine times.

**Layout:**
- Groups: Due today · Upcoming · Completed / dismissed (collapsed).
- **Reminder row:** type icon, title, next due ("27 Oct 2026, 10:00 IST"), source link if created from a document, and actions Done · Edit · Dismiss.
- **"Suggested from your documents" panel:** follow-up facts without a reminder, each with "Create reminder", which pre-fills the form.
- **Create/edit form:**
  - Fields: type, title, schedule (Once: date and time; Daily: up to four times and a start date), notes. The timezone is shown as "IST (Asia/Kolkata)".
  - The medication type requires the COPY-24 checkbox.
- **"Enable browser notifications" button** (FE-9.3) with COPY-23. Notifications fire only while the app is open (polling every 60 seconds).

**Validation:** title 1–120 chars; date today or later; times in `HH:MM`; attestation required for medication.
**API dependencies:** API-27, API-28, API-29, API-30; suggestions use follow-up facts from API-17.
**States:** loading; empty ("No reminders yet"); error; success toasts.
**Accessibility:** form errors are linked to their fields; due reminders are announced when the page opens.

**Acceptance criteria:**
- AC1: Times display in IST with the label.
- AC2: A reminder created from a follow-up links back to the source document.
- AC3: MediVara never creates or edits a medication reminder without the user's explicit action and attestation.
- AC4: COPY-23 appears before the notification permission request.

## 15. SCR-13 Appointments (simulated) — P1, likely cut

**Purpose:** suggest relevant specialty categories and demonstrate a simulated booking flow, clearly labelled.

**Layout:**
- Reason input (optional), then "Suggested categories" cards, each with a "why" line and citations.
- Preparation checklist.
- Providers list: every card carries a large "Simulated" badge (COPY-15) and an "ISL interpreter on request (simulated)" marker where relevant.
- Slot picker, a "I need an ISL interpreter" checkbox, and Book.
- Confirmation screen with COPY-16 (the word "confirmed" is never used), plus "Add a reminder".

**API dependencies:** API-31, API-32, API-33.
**States:** emergency notice (when `emergency_notice` is true: COPY-05 and no suggestions); empty (no documented conditions: show only the general-medicine category and the checklist); error.

**Acceptance criteria:**
- AC1: Every provider and booking shows "Simulated".
- AC2: The disclaimer COPY-16b is always visible next to suggestions.
- AC3: No prices, ratings, credentials or real names are shown.

## 16. SCR-14 Family sharing and permissions — P1

**Purpose:** the owner decides who can see the profile and what they can do, and can see who accessed it.

**Layout (owner view):**
- **People with access:** the owner row first (cannot be removed), then caregivers: name, email, scope chips, granted date, and a Remove button (COPY-26 confirm dialog).
- **"Share with someone" form:**
  - email of an existing MediVara account
  - scope checkboxes: View records is required and pre-ticked; Upload documents and Manage reminders are optional
  - the COPY-25 consent checkbox
  - a Share button
- **Access log tab (FE-6.3):** newest first, showing who, what and when, with denied attempts highlighted.

**Caregiver view:** a "Shared with you by Meera Raman" panel listing their scopes, and a "Leave" button.

**API dependencies:** API-23, API-24, API-25, API-26.
**Validation:** email format; consent ticked; View records always included.
**States:** loading; error (USER_NOT_FOUND shows "No MediVara account uses this email"); success toasts.
**Accessibility:** destructive actions need confirmation; the scope checkboxes form a group with a legend.

**Acceptance criteria:**
- AC1: Removing access takes effect on the caregiver's next request: their next navigation shows the Access denied page.
- AC2: A caregiver cannot see the sharing controls.
- AC3: The access log shows grant, revoke and denied events without any medical content.

## 17. SCR-15 Settings, consent and privacy — P1

The header display menu ("Aa") and sign-out are P0 and live in the header (FE-2.1).

**Layout:**
- **Display:** text size, contrast, reduced motion, read-aloud voice and speed.
- **Consents:** current consents from API-04, each with "Withdraw" (API-05 with `granted: false`) and its consequence explained: "Withdrawing AI processing stops new documents being read; existing information stays".
- **Privacy:** what is sent to the AI model through OpenRouter (page text of one document at a time; the profile's document lines when you ask a question); only providers that don't store or train on requests (`data_collection: deny`); synthetic data only; Chrome speech is a cloud service.
- **Data:** link to delete documents (P1, from SCR-06).
- **About:** COPY-01, version, contract version.

**Acceptance criteria:**
- AC1: Every consent change creates a ConsentRecord.
- AC2: The privacy text matches [08-ai-rag-design.md](08-ai-rag-design.md) §12.

## 18. SCR-16 System states catalogue — P0

Shared components used by every screen (FE-10.1–FE-10.3):

| State | Component | Trigger | Copy |
|---|---|---|---|
| Loading | Skeleton blocks shaped like the final content; spinners only inside buttons | Any pending query | none |
| Empty | Illustration-free card with title, one sentence and one CTA | Empty list or 404 latest brief | Per screen (above) |
| Error banner | Inline banner showing the request ID and Retry | 5xx or network error | "Something went wrong. Try again." plus "Reference: req_…" |
| Field errors | Under each field | 422 `details.fields` | Server message |
| Session ended | Redirect to SCR-02 with banner | 401 | COPY-33 |
| Access denied page | Full page with "Go to my profiles" | 403 `ACCESS_DENIED` | COPY-27 |
| Not found page | Full page | 404 on a route | "We couldn't find that." |
| Offline | Top banner | Browser offline event | "You're offline. Some features won't work until you reconnect." |
| AI degraded banner | Top banner on AI screens | API-01 `ai.available` false (checked every 60 s and after any degraded response) | COPY-09 |
| Processing progress | Stage line with labels | Document processing | COPY-36 |
| Success toast | Bottom toast, auto-dismissed after 4 s, also announced | Mutations | Short past tense ("Confirmed") |
| Confirm dialog | Modal with explicit verbs | Destructive actions | COPY-26, delete text |
| Badges | Unverified · Corrected · Documents differ · Cached result · Synthetic sample · Simulated · AI-generated | Data flags | COPY-11, COPY-12, COPY-15, COPY-35 |
| Mock badge | Fixed corner badge | Any MSW handler active | COPY-32 |

**Acceptance criteria:**
- AC1: Every screen uses these components; no raw error text or stack trace is ever shown.
- AC2: Every badge has visible text, not just colour.

---

## 19. Copy deck (final wording, owner Person C)

Use these strings verbatim. Placeholders appear in `{braces}`. Strings that also appear in API fixtures must match exactly.

| ID | Where | Text |
|---|---|---|
| COPY-01 | Onboarding step 1, About | "MediVara helps you organise your medical documents, see your history on a timeline, and prepare questions for your doctor. It shows where every piece of information came from. MediVara does not diagnose, treat or give medical advice, and it can make mistakes. Always check important information with a qualified healthcare professional. In an emergency, call 112." |
| COPY-02 | Footer, answers, brief | "MediVara organises what your documents say. It is not medical advice. Check important information with your doctor." |
| COPY-03 | Login, upload, onboarding | "This is a hackathon prototype. Use only the synthetic sample documents provided by the team. Do not upload real medical records — yours or anyone else's." |
| COPY-04 | Onboarding consent | "To read your documents, MediVara sends the text of each document to an AI model (Google Gemini) through the OpenRouter service. When you ask a question, the text of this profile's documents is sent too. MediVara asks OpenRouter to use only AI providers that don't store or train on these requests, but their terms may allow limited logging to prevent abuse. Use synthetic documents only. You can withdraw this consent in Settings." |
| COPY-05 | Ask emergency | "If you or someone else may be in danger or need urgent medical help, call 112 (emergency) or 108 (ambulance) now, or go to the nearest emergency department. If you are thinking about harming yourself, call Tele-MANAS on 14416 (free, 24×7). MediVara cannot help in an emergency." |
| COPY-06 | Ask advice redirect | "I can't advise you to start, stop or change any medicine or dose. Only your doctor can decide that with you. Here is what your documents say, so you can discuss it with them." |
| COPY-07 | Ask not found | "I couldn't find this in your documents. If you have a report that mentions it, you can upload it, or ask your doctor." |
| COPY-07b | Ask out of scope | "I can only help with questions about the documents in this MediVara profile." |
| COPY-08 | Partly withheld (notice) | "Some content was withheld because MediVara couldn't check it against your documents." |
| COPY-08b | Fully withheld (notice) | "MediVara couldn't check an answer against your documents, so here are the most relevant lines instead." |
| COPY-09 | Global AI banner | "AI features are unavailable right now. You can still view your documents, timeline and brief." |
| COPY-09a | Narrative unavailable (notice) | "The AI summary isn't available right now. Everything below comes directly from your documents." |
| COPY-09b | Ask degraded (notice) | "The AI assistant isn't available right now. These lines from your documents match your question." |
| COPY-09c | Document failed: AI problem | "MediVara couldn't read this document right now because the AI service didn't respond. Try again in a minute." |
| COPY-10 | Evidence-only header | "Lines from your documents that match your question" |
| COPY-11 | Cached chip and tooltip | "Cached result" — "The AI service didn't respond, so MediVara used a saved reading of this same file from earlier testing." |
| COPY-12 | Unverified badge and tooltip | "Unverified" — "MediVara read this from your document, but you haven't checked it yet." |
| COPY-12b | Unverified notice | "Some of this comes from information you haven't reviewed yet." |
| COPY-13 | Suspicious document banner | "This document contains text that looks like instructions to an AI system. MediVara ignored those instructions and treated the document as information only. Please check that the document is genuine." |
| COPY-14 | Scanned PDF failure | "This looks like a scanned image. Reading scanned documents isn't available in this prototype yet." |
| COPY-15 | Simulated badge and tooltip | "Simulated" — "Not a real provider. Shown for demonstration only." |
| COPY-16 | Simulated booking confirmation | "Simulated booking for demonstration only. No appointment has been made with a real healthcare provider, and no provider has been contacted." |
| COPY-16b | Suggestions disclaimer | "These are general categories based on what your documents mention. They are not a diagnosis or a referral. Providers shown are simulated for this demo." |
| COPY-17 | ISL limitations | "MediVara does not translate between Indian Sign Language and text or speech. The ISL glossary shows official sign videos for selected health terms from the ISLRTC Indian Sign Language dictionary. For conversations with healthcare staff, please ask for a qualified ISL interpreter." |
| COPY-18 | ISL video attribution | "Sign video: Indian Sign Language Research and Training Centre (ISLRTC), ISL Dictionary. Shown for learning and communication support. Videos load from YouTube." |
| COPY-18b | ISL video unavailable | "ISL video not available here. You can look up this term in the ISLRTC ISL Dictionary." |
| COPY-19 | Visit Card statements | "I am Deaf. I use Indian Sign Language (ISL)." · "Please arrange a qualified ISL interpreter for my appointment." · "Please write things down or type on my phone." · "Please look at me when you speak." · "I am hard of hearing." · "Please give me a little extra time." |
| COPY-20 | Voice input disclosure | "Voice input uses your browser's speech recognition. In Chrome, your voice may be sent to Google's speech service to turn it into text. MediVara never receives or stores your audio — only the text you choose to send. You can always type instead." |
| COPY-21 | Read-aloud disclosure | "Read-aloud uses your device's voices. Some voices work online, which means the text is sent to a speech service. MediVara uses on-device voices when available." |
| COPY-22 | Microphone denied | "MediVara can't use your microphone. You can allow it in your browser settings, or type your question instead." |
| COPY-23 | Notification explainer | "MediVara can show reminders while this app is open in your browser. Reminders may not appear if the app or browser is closed, your device is asleep, or notifications are blocked. Don't rely on MediVara alone for important medicines or appointments." |
| COPY-24 | Medication reminder attestation | "I am entering this schedule exactly as my doctor or pharmacist told me. MediVara will not change my medicines or doses." |
| COPY-25 | Sharing consent | "I agree to share {patient}'s MediVara records with {name} ({email}) with the permissions ticked above. I can remove their access at any time, and they will lose access immediately." |
| COPY-26 | Revoke confirmation | "Remove {name}'s access to {patient}'s records? They will lose access immediately. You can share again later." |
| COPY-27 | Access denied page | Title: "You don't have access to this profile." Body: "This profile hasn't been shared with you, or access was removed. Ask the profile owner to share it with you." |
| COPY-28 | Ambiguous date | "The date {as_written} was read as {DD Mon YYYY} (day first). Please check it." |
| COPY-29 | Documents differ: dose | "Your documents list different strengths for {medicine}: {strength A} ({document type A}, {date A}) and {strength B} ({document type B}, {date B}). The most recent document lists {latest strength}. Please confirm your current dose with your doctor." |
| COPY-29b | Documents differ: frequency | "Your documents list different instructions for how often to take {medicine}: \"{frequency A}\" ({document A}, {date A}) and \"{frequency B}\" ({document B}, {date B}). Please confirm with your doctor." |
| COPY-29c | Documents differ: allergies | "Your documents differ on allergies: \"{statement A}\" ({document A}, {date A}) and \"{statement B}\" ({document B}, {date B}). Please confirm your allergies with your doctor." |
| COPY-30a | Missing: no allergy information | "None of your documents mention allergies." |
| COPY-30b | Missing: undated document | "{document title} has no date we could read." |
| COPY-30c | Missing: lab without range | "{test} ({date}) has no reference range printed on the report." |
| COPY-30d | Missing: follow-up without appointment | "Your {document type} from {date} says \"{instruction}\". No later visit, appointment or reminder was found in MediVara." |
| COPY-31 | Brief stale | "Your documents changed after this brief was created. Create a new brief to include the changes." |
| COPY-32 | Mock badge | "MOCK DATA — not connected to the server" |
| COPY-33 | Session ended | "Your session ended. Please sign in again." |
| COPY-34a | Login failed | "That email and password don't match a MediVara account." |
| COPY-34b | Upload too large | "This file is larger than 10 MB. Please choose a smaller file." |
| COPY-34c | Upload unsupported | "Only PDF files can be added in this prototype." |
| COPY-34d | Upload duplicate | "This file is already in {patient}'s records." |
| COPY-34e | Upload too many pages | "This PDF has more than 10 pages. Please split it into smaller files." |
| COPY-35 | Sample badge | "Synthetic sample" |
| COPY-36 | Processing stages | queued: "Waiting to be read" · reading_text: "Reading text" · screening: "Checking content" · extracting: "Extracting information" · validating: "Checking results" |
| COPY-37 | Explanation label | "General information — not from your documents" |
| COPY-38 | Narrative label | "AI-generated, checked against your documents" |
