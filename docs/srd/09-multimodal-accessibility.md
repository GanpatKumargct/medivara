# 09 — Multimodal Accessibility Specification (Text, Voice, Sign Language)

> SRD section 5.9. Owners: **Person A** (implementation), **Person C** (content, ISL curation and evaluation). Backend touchpoints are minimal by design (Person B).
> **Voice support is not sign-language support.** Voice helps people who find reading hard. It does nothing for Deaf users, who need visual-first design and sign-language support. The three modes are specified separately.

## 1. Two-day MVP recommendation at a glance

| Mode | Hackathon capability | Priority | What we explicitly do **not** claim |
|---|---|---|---|
| Text | Typed questions; written answers, brief and timeline; citations and uncertainty notices; plain language; display preferences | P0 | Medical accuracy beyond the synthetic test set |
| Voice | Read-aloud (planned); speech-to-text question input with transcript confirmation (if ahead) | P1 | A voice assistant, voice navigation, Indian-language speech, reliable recognition of medicine names |
| Sign language (ISL) | **ISL Visit Assist:** Visit Communication Card plus a curated glossary of official ISL dictionary videos; **experimental** sign-assisted questions from a few isolated signs (P1, §4.7) | **P0** | Translation in either direction, sentence-level sign recognition, signing avatars, coverage of ISL grammar |

## 2. Text mode

| Aspect | Specification |
|---|---|
| Direction | Input: typed questions (1–500 chars). Output: written answers, summaries, timeline, reminders, appointment information. |
| User interaction | SCR-08 Ask with example questions; SCR-09 brief; SCR-07 timeline. Citations open the Evidence drawer. |
| Permissions | None beyond sign-in and patient access. |
| Supported language | English (India). Values are kept exactly as written in the documents. |
| Dependencies | API-21 (Ask), API-17 to API-20 (timeline, brief, narrative). Gemini for answers and the narrative; deterministic code for everything else. |
| Expected behaviour | Answers are short (at most 6 statements), cite sources, label general explanations (COPY-37) and AI-written text (COPY-38), and carry COPY-02. Uncertainty is stated explicitly (unverified notice, documents differ). |
| Error handling | `not_found`, `out_of_scope`, `degraded`, `withheld` and the emergency and advice templates (SCR-08). The client gives up waiting after 25 s. |
| Limitations | English only. Single-turn (no follow-up memory). Prototype-scale context cap. |
| Evaluation | 15-question evaluation set (≥ 12 correct); readability check of the copy deck and 10 answers; citation validity 100 %. |
| Requirements | FR-035 to FR-039, FR-050, FR-051 |

## 3. Voice mode (P1)

### 3.1 Read-aloud (text-to-speech): planned

| Aspect | Specification |
|---|---|
| Direction | Text → speech (output only) |
| User interaction | "Read aloud" on Ask answers, the brief and the Visit Card. Play, pause, stop and speed (0.8× / 1× / 1.2×). Citations are spoken as "source: lab report, 04 May 2026". |
| Permissions | None. Read-aloud never starts on its own. |
| Supported language | English. Voice preference: on-device en-IN voice (`localService`), then en-GB or en-US. |
| Dependencies | Browser speech synthesis. No backend. |
| Expected behaviour | Reads only validated text that is visible on screen. Stops immediately on Stop, on navigation or when another reading starts. |
| Error handling | No voices: the button is hidden and a hint is shown. Only network voices: COPY-21 is shown before first use. |
| Privacy | On-device voices keep the text local. Network voices ("Google …" voices in Chrome) send text to a speech service, which is disclosed (COPY-21). |
| Limitations | Voice quality and availability depend on the device. Chrome on Linux may have no usable local voice, so the demo laptop and browser are fixed by gate G1. |
| Evaluation | TC-VOICE-01 and TC-VOICE-02: plays, stops, reads citations, never reads hidden text. |
| Requirement | FR-055 |

### 3.2 Speech-to-text question input: if ahead (cut step 3)

| Aspect | Specification |
|---|---|
| Direction | Speech → text (input only) |
| User interaction | A microphone button on SCR-08. States: idle, requesting permission, listening (pulsing indicator plus "Listening… tap to stop" plus the interim transcript), processing, error, unsupported. Stops automatically after 15 s or on silence. |
| Confirmation of critical information | The transcript is placed in the question box for review and editing. Nothing is sent until the user presses Send. Medicine names are often misrecognised, so the user is expected to check them. |
| Permissions | The microphone is requested only after a user gesture. COPY-20 is shown on first use. A `voice_input` consent record is created (API-05). Permission denied shows COPY-22. |
| Supported language | `en-IN`. On-device recognition is requested where the browser supports it; otherwise the browser's cloud service is used, which is disclosed. |
| Dependencies | Browser speech recognition (Chrome or Edge). Backend: only `input_mode: "voice"` on API-21. |
| Storage of recordings | **None.** MediVara never receives audio, only the final text the user sends. |
| Error handling | "Didn't catch that — try again or type"; unsupported browsers hide the button and show "Voice input works in Chrome or Edge". |
| Limitations | Accuracy varies with accent, noise and medical vocabulary. No Indian-language recognition in the MVP. Chrome's default recognition is a cloud service. |
| Evaluation | TC-VOICE-03 and TC-VOICE-04: 5 scripted questions spoken in a quiet room; record word errors in medicine names; check that nothing is auto-sent and that the permission-denied path works. |
| Requirement | FR-056 |

### 3.3 Voice: future path

Voice navigation (FR-058); server-side transcription and speech with Gemini models for consistent cross-browser behaviour and Indian-language voices (FR-059); Tamil and Hindi support after user research.

## 4. Sign-language mode: Indian Sign Language (ISL)

### 4.1 Language choice and principles

| Topic | Decision |
|---|---|
| Chosen sign language | **Indian Sign Language (ISL)**, the sign language of Deaf communities in India. Sign languages are not universal: ISL differs from American or British Sign Language and has its own grammar and regional variation. |
| Principle 1 | **Support communication, never claim translation.** The prototype helps a Deaf user tell staff what they need and helps staff and families see official signs for key health terms. It does not convert between ISL and text or speech. |
| Principle 2 | **Use official, attributed content only.** Glossary videos come from the ISL dictionary published by the Indian Sign Language Research and Training Centre (ISLRTC), shown through its public video channel, with attribution and a terms-of-use check before the event. |
| Principle 3 | **Everything works without sound.** No Deaf-relevant feature depends on audio. |
| Principle 4 | **Nothing about us without us.** Real development requires co-design with Deaf community organisations and qualified ISL interpreters. This is a roadmap commitment, not something done in the hackathon. |

### 4.2 Options considered

| Option | Feasible in 2 days? | Credible? | Decision |
|---|---|---|---|
| Prerecorded ISL guidance videos made by the team | No: the team members are not qualified signers | Low; risks incorrect signs | Rejected |
| **Official ISL dictionary videos for selected health terms** | Yes: curation plus embedding | High, if attributed and verified | **Chosen (P0, FR-061)** |
| **Visit Communication Card with interpreter request** | Yes: frontend only | High; addresses a real barrier at clinics | **Chosen (P0, FR-060)** |
| Limited sign-to-text recognition (a few isolated signs, in the browser) | Yes, as an experimental question picker (DEC-28) | Moderate when signs only *choose* a question the user then confirms; never presented as translation | **Chosen as experimental P1 (FR-064, §4.7)**; originally not chosen |
| Signing avatar (text to ISL) | No | Very low without linguists and the community | **Roadmap only** (FR-065) |

### 4.3 Specification of the MVP capability (SCR-11 ISL Visit Assist)

| Aspect | Visit Communication Card (FR-060) | ISL health-term glossary (FR-061) |
|---|---|---|
| Direction | Text shown to hearing staff, chosen by the Deaf user | ISL video shown for an English term (one term at a time; no sentences) |
| Interaction | Choose communication needs (COPY-19) → card with key facts from the latest brief → "Show to staff" full screen or Print | Search or pick a term → the official video plays with attribution (COPY-18) |
| Permissions | None. The card choices are stored on the device. | None. The video player loads from the public video channel in privacy-enhanced mode, and this is disclosed. |
| Supported languages | English text on the card; ISL is the user's language and is named on the card | Up to 15 English health terms mapped to official ISL signs |
| Dependencies | API-19 (latest brief) for the key facts | Static glossary file prepared by Person C ([../hackathon/synthetic-demo-data-pack.md](../hackathon/synthetic-demo-data-pack.md) §7); internet access for the videos |
| Expected behaviour | Full screen: text of at least 28 px, 7:1 contrast, portrait and landscape; prints on one A4 page; key facts show source and date | Every video shows its source; terms without a verified video show text and a dictionary link only |
| Error handling | No brief: card without facts, plus "Create brief". Device storage unavailable: default statements. | Offline or video blocked: COPY-18b with the dictionary link |
| Limitations | Does not guarantee an interpreter will be provided; it states the need clearly | Single terms only; video availability depends on the official source; not reviewed by a Deaf ISL user during the hackathon (stated in About) |
| Evaluation | TC-ISL-01, TC-ISL-02, TC-ISL-04: content, print, full-screen contrast, works with sound off | TC-ISL-03, TC-ISL-05: attribution on every video, no unverified videos, offline fallback, copy audit for translation claims |

**P1 additions:** ISL term links inside the brief and answers when ISL mode is on (FR-062); an "I need an ISL interpreter" option on simulated bookings (FR-063).

### 4.4 Consent and privacy for sign-language features

- Sign-assisted questions (§4.7) use the camera only after a separate `camera_input` consent; the video never leaves the device and no frames are stored. Recorded sign examples are hand and body point positions, kept in the browser.
- Glossary videos load from a third-party video platform, which can see that a video was played. This is disclosed in About and in Settings.
- Recognition (FR-064) runs on the device and stores no frames. Evaluation with Deaf signers is still required before any claim beyond "experimental".

### 4.7 Sign-assisted questions (experimental, FR-064, DEC-28)

| Aspect | Specification |
|---|---|
| What it does | In **Sign mode** (the camera button in the chat composer; a full-screen view like voice mode), the camera recognises a few **isolated** ISL signs. Each recognised sign is shown as up to 3 guesses to tap; chosen signs build **one question about the user's records** (for example Medicine → "Which medicines are listed in my most recent document?"), placed in the composer's editable box. Nothing is sent until the user presses Send. Sign mode has an Ask view (camera, "Did you sign…" guesses, question builder, words grouped as topics / question words / controls, and a separate Emergency section) and a Teach view (record 3 examples per word). It never translates sentences. |
| Vocabulary | 16 words (`Frontend/src/lib/signs/vocabulary.ts`): topics (medicine, test, sugar/diabetes, blood pressure, allergy, doctor, hospital), question words (what, when, change), safety (emergency, chest pain, can't breathe) and control (yes, no, again). To be confirmed with a qualified ISL signer. Every word can also be tapped without the camera. |
| Emergency signs | A safety sign recognised with high confidence, or tapped, sends a fixed phrase at once (for example "I have chest pain."); the existing safety check answers with the emergency card and makes no model call. |
| How recognition works | MediaPipe hand and pose landmarks in the browser (files served by the app from `/mediapipe/`, fetched by `scripts/fetch-mediapipe.mjs`) → body-relative features → a sign is the time between hands appearing and being lowered → nearest recorded example by dynamic time warping. A sign far from every example is reported as "not sure", never guessed. |
| Examples | The team pack `/signs/pack.json` (empty until a qualified ISL signer records it, using "Teach signs" and "Export") plus the user's own examples recorded in "Teach signs" and kept in the browser. The INCLUDE dataset (CC BY 4.0) has no health category, so it can't supply this vocabulary; a trained model can replace matching once enough recordings exist. |
| Consent and privacy | Separate `camera_input` consent (API-05), off by default, revocable in Settings. Video stays on the device; only the confirmed question text is sent, tagged `input_mode: "sign"` (API-21, API-52). |
| Copy | COPY-47 (camera consent), COPY-48 (experimental notice). COPY-17 stays true. |
| Evaluation | `npm run test:signs` checks the maths on synthetic movements. Real accuracy is unknown until signs are recorded: target ≥ 90 % top-3 on two held-out signers and < 5 % non-signs accepted. Not validated with Deaf users (H-05). |

### 4.5 Fallback when sign-language content is unavailable

| Situation | Fallback |
|---|---|
| Venue network blocks the video platform | Glossary shows text and the dictionary link (COPY-18b); the Visit Card is unaffected |
| A term has no verified official video | Text only, never a guessed or unofficial video |
| The ISL glossary feature is broken at demo time | Show the Visit Card (never cut) and the About tab's limitations; explain the curation process on a slide |

### 4.6 Future path for ISL (roadmap)

1. Partner with Deaf community organisations and ISL interpreters to co-design the Visit Assist flow and validate the content (assumption H-05).
2. Expand the glossary to the full medical vocabulary of the official dictionary, with expert review and regional variants.
3. Integrate video-relay interpreter services for live consultations, booked through real appointment integrations.
4. Research isolated-sign recognition for simple intents (for example "yes", "no", "repeat", "help") using open datasets such as INCLUDE (AI4Bharat and IIT Madras; 263 isolated ISL word signs, about 4,300 videos). It would be evaluated across different signers before any user-facing use.
5. Treat sentence-level translation and signing avatars as long-term research, never as product claims.

## 5. Cross-mode accessibility requirements

| Requirement | Applies to | Reference |
|---|---|---|
| Every voice feature has a text equivalent; every audio output has visible text | All | NFR-A11Y-07 |
| No feature depends on sound | All Deaf-relevant flows | NFR-A11Y-07 |
| Keyboard operability and visible focus | All | NFR-A11Y-02 |
| Live-region announcements for status changes | Upload, Ask, brief narrative | NFR-A11Y-04 |
| Display preferences (text size, contrast, reduced motion) | All | FR-051 |
| Plain language | Copy deck, AI output | FR-050 |
