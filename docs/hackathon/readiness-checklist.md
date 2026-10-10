# Final Readiness Checklist

> Owner: **Person C**. Tick each box on the shared board. Items marked **(stop-ship)** block the demo until fixed.

## 1. Before the event (T−3 to T−1 days)

**Everyone**
- [ ] Read your role's reading list (sprint folder READMEs, [README.md](README.md) for Person C).
- [ ] Toolchains installed: Node LTS, Python 3.11+, Git; Chrome and Edge updated.
- [ ] Repository cloned; you can create a branch and push.
- [ ] Laptops charged; chargers, a display adapter (HDMI or USB-C) and a phone hotspot tested.

**Person B**
- [ ] Gemini **dev** and **demo** projects created, each with its own key.
- [ ] **Paid Tier-1 billing** enabled with a budget alert; rate limits checked in AI Studio.
- [ ] Model IDs confirmed (`gemini-2.5-flash`; optionally `gemini-3.5-flash-lite`); SDK version pinned.
- [ ] Test call made with `store=false` and a JSON-schema response.
- [ ] Contract API-01 to 21 re-read; open questions resolved with A and C.

**Person A**
- [ ] Component library decided (DEC-19).
- [ ] Contract API-01 to 21 read; questions sent to B.
- [ ] Local speech voices on your laptop checked.

**Person C**
- [ ] Hackathon rules checked: is preparing assets beforehand allowed? (ASM-01). Event times confirmed (ASM-02).
- [ ] Synthetic PDFs (DOC-1 to 7, RDOC-1 and 2, KDOC-1) created per the data pack, with watermarks and footers (if allowed).
- [ ] Answer key spreadsheet ready, in the fact contract format.
- [ ] ISL glossary content: up to 15 entries verified against the official ISLRTC dictionary, embedding terms checked, attribution recorded.
- [ ] Emergency numbers re-verified: 112, 108, Tele-MANAS 14416 (DEC-21).
- [ ] Copy deck reviewed and final.
- [ ] Board set up with every task ID and the handoff table.

## 2. Kickoff (IC-0, Day 1 09:00–09:45)

- [ ] Scope lock: P0 list, P1 order and cut ladder read aloud and agreed.
- [ ] Fixtures copied into `contracts/` (C) and reviewed (B).
- [ ] **P0 contract frozen at v1.0**, recorded in the changelog.
- [ ] Gemini smoke call succeeds with the dev key.
- [ ] Frontend and backend skeletons start on all three laptops.
- [ ] Branch and commit rules agreed (task IDs in names).
- [ ] Team chat threads created: `#contract`, `#bugs`, `#demo`.

## 3. Gates

**IC-1 (12:00)**
- [ ] TC-AUTH-01 to 04 and TC-ACC-01 pass on the INT laptop.
- [ ] Login no longer mocked.

**IC-2 (16:30)**
- [ ] E2E-01 passes; first MET-01 reading recorded.

**IC-3 and G1 (18:30–19:00)**
- [ ] E2E-01 to 03 pass with **all mocks off**.
- [ ] Recorded real responses committed as realistic fixtures.
- [ ] `d1-stable` tagged; `snapshot-G1` saved; rough backup video recorded.
- [ ] P1 contract frozen; gate status (green, amber or red) recorded.

**G2 (Day 2 09:00)**
- [ ] Cut set chosen and posted on the board.

**IC-4 (12:00)**
- [ ] E2E-04, 05, 10 and E2E-09 (read-aloud) pass.
- [ ] Evaluation run complete: ≥ 12 of 15 correct (MET-11); 10 of 10 safe (MET-03); injection 0 (MET-04); false rejections ≤ 10 % (MET-05).
- [ ] Accessibility audit #2 done; backup video #2 recorded.
- [ ] `snapshot-demo` built and restored once (12:20–12:45).

**IC-5 (14:15) — feature freeze**
- [ ] E2E-06 and 07 pass (E2E-08 only if booking was built).
- [ ] Features that aren't ready are hidden from navigation.
- [ ] `cache_only` drill passes.

## 4. Code freeze (IC-6, Day 2 15:45)

- [ ] Full E2E run (E2E-01 to 10) passes on the INT/DEMO laptop.
- [ ] pytest suite passes: isolation and IDOR, validator, contract keys.
- [ ] **(stop-ship)** Permission matrix fully green; no cross-patient data visible anywhere.
- [ ] **(stop-ship)** No unsafe AI output in the final evaluation run.
- [ ] **(stop-ship)** No raw errors, stack traces or blank screens on the golden path.
- [ ] TC-SEC-04 (no PHI in logs) and TC-SEC-05 (no secrets in the repository or build) pass.
- [ ] Degraded-mode drill passes (`AI_MODE=off`).
- [ ] Final backup video saved on the demo laptop, the backup laptop and a phone.
- [ ] `demo-v1` tagged.

## 5. Demo machine (Day 2 15:45–16:00, and again before judging)

- [ ] Running `demo-v1`, with the **demo** Gemini key.
- [ ] `snapshot-demo` restored (under 2 minutes) and the starting state checked:
  - Meera: 6 documents, DOC-4 needs review, DOC-7 failed, DOC-5 **not** uploaded.
  - Karthik's grant is active.
  - Ravi has a brief.
- [ ] **(stop-ship)** No "MOCK DATA" badge; `VITE_MOCK_FEATURES` empty; no mock service worker registered.
- [ ] Health shows AI available, mode `live`, demo mode on.
- [ ] Left window: Meera on Records. Right window: Ravi on Visit Assist (Visit Card choices set).
- [ ] DOC-5 file on the desktop, ready to drag.
- [ ] Browser zoom 110 %; OS notifications and do-not-disturb handled; other apps closed.
- [ ] A local en-IN voice selected for read-aloud; volume up.
- [ ] ISL glossary videos play on the venue network (or the fallback is accepted).
- [ ] Display mirroring tested on the venue screen; resolution readable from the back.
- [ ] Phone hotspot on standby; backup laptop ready with the same build, snapshot and key.

## 6. Pitch and honesty

- [ ] Storyline rehearsed within time: 4:30 main version; 3-minute version ready.
- [ ] Roles clear: C narrates, A drives, B handles technical questions and backups.
- [ ] Every claim on the slides appears in the evidence table ([demo-and-judging-strategy.md](demo-and-judging-strategy.md) §6).
- [ ] **(stop-ship)** None of these appear in the slides or script except as negations or roadmap items:
  - "accurate", "clinically validated"
  - "compliant", "HIPAA", "DPDP"
  - "secure", "production-ready"
  - "translates sign language"
  - "confirmed booking", "doctor-ready"
  - "integrated with ABDM"
- [ ] Every simulated, cached, unverified or AI-generated item on screen is labelled.
- [ ] Metrics are quoted together with their limitations.
- [ ] Assumptions are presented as hypotheses to validate.
- [ ] Synthetic-data statement and decline-real-data script rehearsed.
- [ ] Judge Q&A drilled at least once (§10 of the strategy).

## 7. Submission

- [ ] Repository link (with the README run steps) submitted as the rules require.
- [ ] Demo video uploaded if required.
- [ ] Slides exported.
- [ ] No secrets in the repository history (checked again).

## 8. After the event

- [ ] Rotate or delete the demo and dev Gemini keys if they're no longer needed.
- [ ] Remove local snapshots, logs and storage folders from the laptops (they're synthetic, but tidy up).
- [ ] Record lessons learned and next steps against the roadmap ([../srd/13-scope-and-roadmap.md](../srd/13-scope-and-roadmap.md)).
