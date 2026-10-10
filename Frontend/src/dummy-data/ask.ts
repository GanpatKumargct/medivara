// Canned Ask answers (API-21). A small deterministic matcher mirrors the backend's
// rules-first intent gate: emergency and advice are caught BEFORE any "model" call,
// then grounded answers are returned from the patient's own evidence. The client
// never decides medical meaning — these are pre-authored, evidence-cited answers.
import type { AskResponse, Evidence, Statement } from '../api/types'

const DISCLAIMER =
  'MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.'

let answerSeq = 1000
function base(status: AskResponse['status'], latency: number): AskResponse {
  answerSeq += 1
  return {
    answer_id: `aio_${answerSeq.toString(16)}`,
    status,
    statements: [],
    evidence: [],
    questions_for_doctor: [],
    notices: [],
    disclaimer: DISCLAIMER,
    generated_at: new Date().toISOString(),
    latency_ms: latency,
  }
}

const EMERGENCY_PATTERNS = [
  /chest pain/i, /can'?t breathe/i, /cannot breathe/i, /suicid/i, /end my life/i,
  /harm myself/i, /too many (tablets|pills)/i, /overdose/i, /face is swelling/i,
  /swelling after/i, /unconscious/i, /bleeding heavily/i, /severe/i, /dizzy/i,
]
const ADVICE_PATTERNS = [
  /should i (stop|start|take|change|increase|decrease|double)/i,
  /can i (stop|double|increase|decrease|change)/i,
  /do i have (kidney|heart|liver|cancer|disease)/i,
  /is my doctor (wrong|right)/i,
  /increase my .* dose/i, /change my (medicine|dose)/i,
]

const EMERGENCY_TEXT =
  'If you or someone else may be in danger or need urgent medical help, call 112 (emergency) or 108 (ambulance) now, or go to the nearest emergency department. If you are thinking about harming yourself, call Tele-MANAS on 14416 (free, 24×7). MediVara cannot help in an emergency.'
const ADVICE_TEXT =
  'I can’t advise you to start, stop or change any medicine or dose. Only your doctor can decide that with you. Here is what your documents say, so you can discuss it with them.'
const NOT_FOUND_TEXT =
  'I couldn’t find this in your documents. If you have a report that mentions it, you can upload it, or ask your doctor.'

// Evidence snippets reused across answers, keyed per patient.
const EV = {
  meera_hba1c_latest: { evidence_id: 'E1', document_id: 'doc_meera_lab_2026_05', document_title: 'Lab report · Sunrise Diagnostics · 04 May 2026', document_type: 'lab_report' as const, document_date: '2026-05-04', page: 1, line_ids: ['p1-l6'], text: 'HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H', fact_status: 'unverified' as const, is_user_correction: false },
  meera_hba1c_prev: { evidence_id: 'E2', document_id: 'doc_meera_lab_2025_03', document_title: 'Lab report · Sunrise Diagnostics · 18 Mar 2025', document_type: 'lab_report' as const, document_date: '2025-03-18', page: 1, line_ids: ['p1-l6'], text: 'HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H', fact_status: 'confirmed' as const, is_user_correction: false },
  meera_met_new: { evidence_id: 'E1', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription' as const, document_date: '2026-09-15', page: 1, line_ids: ['p1-l8'], text: '1. Tab. Metformin 1000 mg — 1 tablet twice daily after meals — 90 days', fact_status: 'confirmed' as const, is_user_correction: false },
  meera_met_old: { evidence_id: 'E2', document_id: 'doc_meera_rx_2025_03', document_title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025', document_type: 'prescription' as const, document_date: '2025-03-21', page: 1, line_ids: ['p1-l8'], text: '1. Tab. Metformin 500 mg — 1 tablet twice daily after meals — 90 days', fact_status: 'confirmed' as const, is_user_correction: false },
  meera_allergy_none: { evidence_id: 'E1', document_id: 'doc_meera_rx_2025_03', document_title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025', document_type: 'prescription' as const, document_date: '2025-03-21', page: 1, line_ids: ['p1-l6'], text: 'Allergies: No known drug allergies', fact_status: 'confirmed' as const, is_user_correction: false },
  meera_allergy_sulfa: { evidence_id: 'E2', document_id: 'doc_meera_dc_2025_07', document_title: 'Discharge summary · Greenfield General Hospital · 31 Jul 2025', document_type: 'discharge_summary' as const, document_date: '2025-07-31', page: 1, line_ids: ['p1-l7'], text: 'Allergies: Sulfa drugs (rash)', fact_status: 'confirmed' as const, is_user_correction: false },
  meera_rx_meds: { evidence_id: 'E1', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription' as const, document_date: '2026-09-15', page: 1, line_ids: ['p1-l8', 'p1-l9', 'p1-l10'], text: '1. Tab. Metformin 1000 mg; 2. Tab. Amlodipine 5 mg; 3. Tab. Atorvastatin 10 mg — 90 days', fact_status: 'confirmed' as const, is_user_correction: false },
  meera_followup: { evidence_id: 'E1', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription' as const, document_date: '2026-09-15', page: 1, line_ids: ['p1-l12'], text: 'Advice: Review after 6 weeks with fasting glucose report.', fact_status: 'confirmed' as const, is_user_correction: false },
  ravi_tsh: { evidence_id: 'E1', document_id: 'doc_ravi_lab_2026_06', document_title: 'Lab report · City Care Labs · 10 Jun 2026', document_type: 'lab_report' as const, document_date: '2026-06-10', page: 1, line_ids: ['p1-l6'], text: 'TSH   6.8   mIU/L   0.4 - 4.0   H', fact_status: 'confirmed' as const, is_user_correction: false },
}

const S = (id: string, kind: Statement['kind'], text: string, evidence_ids: string[] = []): Statement => ({ id, kind, text, evidence_ids })

interface Canned {
  patterns: RegExp[]
  build: () => Partial<AskResponse>
}

const MEERA_ANSWERS: Canned[] = [
  {
    patterns: [/most recent hba1c/i, /latest hba1c/i, /^what.*hba1c$/i, /hba1c now/i],
    build: () => ({
      statements: [
        S('S1', 'record_fact', 'Your most recent HbA1c was 7.6 % on the lab report dated 04 May 2026.', ['E1']),
        S('S2', 'record_fact', 'Before that, your HbA1c was 8.4 % on the lab report dated 18 Mar 2025.', ['E2']),
        S('S3', 'record_fact', 'Both reports mark the result with "H" next to a reference range of 4.0 - 5.6.', ['E1', 'E2']),
      ],
      evidence: [EV.meera_hba1c_latest, EV.meera_hba1c_prev],
      questions_for_doctor: ['What do my recent HbA1c results mean for my diabetes care?', 'When should I repeat my HbA1c test?'],
      notices: [{ code: 'unverified_included', text: 'Some of this comes from information you haven’t reviewed yet.' }],
    }),
  },
  {
    patterns: [/hba1c.*(over time|chang|history|before)/i, /how has my hba1c/i],
    build: () => ({
      statements: [
        S('S1', 'record_fact', 'Your HbA1c was 8.4 % on 18 Mar 2025 (DOC: Sunrise Diagnostics).', ['E2']),
        S('S2', 'record_fact', 'Your HbA1c was 7.6 % on 04 May 2026 (DOC: Sunrise Diagnostics).', ['E1']),
      ],
      evidence: [EV.meera_hba1c_latest, EV.meera_hba1c_prev],
      questions_for_doctor: ['What do my HbA1c results mean for my care?'],
    }),
  },
  {
    patterns: [/medicines.*(latest|prescription)/i, /which medicines/i, /what medicines/i, /current medicines/i],
    build: () => ({
      statements: [
        S('S1', 'record_fact', 'Your latest prescription (15 Sep 2026) lists Metformin 1000 mg, Amlodipine 5 mg and Atorvastatin 10 mg.', ['E1']),
      ],
      evidence: [EV.meera_rx_meds],
      questions_for_doctor: ['Should I continue all three medicines at these doses?'],
    }),
  },
  {
    patterns: [/dose of metformin.*march/i, /metformin.*2025/i, /metformin.*march/i],
    build: () => ({
      statements: [S('S1', 'record_fact', 'In March 2025 you were prescribed Metformin 500 mg, 1 tablet twice daily after meals.', ['E2'])],
      evidence: [{ ...EV.meera_met_old, evidence_id: 'E2' }],
      questions_for_doctor: [],
    }),
  },
  {
    patterns: [/allerg/i],
    build: () => ({
      statements: [
        S('S1', 'uncertainty', 'Your documents differ on allergies: one prescription from 21 Mar 2025 says "No known drug allergies", while the discharge summary from 31 Jul 2025 lists "Sulfa drugs (rash)".', ['E1', 'E2']),
        S('S2', 'record_fact', 'Your most recent prescription (15 Sep 2026) also lists "Sulfa drugs".', []),
      ],
      evidence: [EV.meera_allergy_none, EV.meera_allergy_sulfa],
      questions_for_doctor: ['Can you confirm whether I am allergic to sulfa drugs?'],
    }),
  },
  {
    patterns: [/next follow.?up/i, /when.*review/i, /next appointment/i],
    build: () => ({
      statements: [S('S1', 'record_fact', 'Your prescription from 15 Sep 2026 says "Review after 6 weeks with fasting glucose report."', ['E1'])],
      evidence: [EV.meera_followup],
      questions_for_doctor: ['When exactly should my next review be?'],
    }),
  },
  {
    patterns: [/what is hba1c/i, /explain hba1c/i, /meaning of hba1c/i],
    build: () => ({
      statements: [
        S('S1', 'explanation', 'HbA1c is a blood test that reflects your average blood sugar over about the past three months. A doctor interprets it alongside your other results.', []),
        S('S2', 'record_fact', 'In your records, HbA1c was 8.4 % (18 Mar 2025) and 7.6 % (04 May 2026).', ['E1', 'E2']),
      ],
      evidence: [EV.meera_hba1c_latest, EV.meera_hba1c_prev],
      questions_for_doctor: [],
    }),
  },
  {
    patterns: [/blood group/i, /blood type/i],
    build: () => ({ status: 'not_found', statements: [S('S1', 'not_found', NOT_FOUND_TEXT)] }),
  },
]

const RAVI_ANSWERS: Canned[] = [
  {
    patterns: [/tsh/i, /thyroid/i],
    build: () => ({
      statements: [S('S1', 'record_fact', 'Your TSH was 6.8 mIU/L on 10 Jun 2026, with a reference range of 0.4 - 4.0 and marked "H" on the report.', ['E1'])],
      evidence: [EV.ravi_tsh],
      questions_for_doctor: ['When should I repeat my TSH test?'],
    }),
  },
  {
    patterns: [/hba1c/i, /diabetes/i, /blood group/i],
    build: () => ({ status: 'not_found', statements: [S('S1', 'not_found', NOT_FOUND_TEXT)] }),
  },
]

/** Resolve an Ask question to a canned response for the given patient. */
export function answerQuestion(patientId: string, question: string): AskResponse {
  const q = question.trim()

  // 1. Emergency gate (no model call, ~12 ms).
  if (EMERGENCY_PATTERNS.some((p) => p.test(q))) {
    const r = base('emergency', 12)
    r.statements = [S('S1', 'safety_notice', EMERGENCY_TEXT)]
    return r
  }
  // 2. Advice / diagnosis / clinician-judgement gate (no model call).
  if (ADVICE_PATTERNS.some((p) => p.test(q))) {
    const r = base('advice_redirect', 41)
    r.statements = [S('S1', 'safety_notice', ADVICE_TEXT)]
    if (patientId === 'pat_meera' && /metformin/i.test(q)) {
      r.evidence = [EV.meera_met_new, EV.meera_met_old]
      r.questions_for_doctor = ['Is my current dose of Metformin still right for me?']
    }
    return r
  }

  // 3. Grounded answers.
  const table = patientId === 'pat_ravi' ? RAVI_ANSWERS : patientId === 'pat_meera' ? MEERA_ANSWERS : []
  for (const canned of table) {
    if (canned.patterns.some((p) => p.test(q))) {
      const partial = canned.build()
      const r = base(partial.status ?? 'answered', 5200 + Math.round(q.length * 20))
      return { ...r, ...partial }
    }
  }

  // 4. Fallback: not found in this profile's documents.
  const r = base('not_found', 3200)
  r.statements = [S('S1', 'not_found', NOT_FOUND_TEXT)]
  return r
}

export const ASK_EXAMPLE_QUESTIONS: Record<string, string[]> = {
  pat_meera: [
    'What was my most recent HbA1c?',
    'Which medicines are listed in my latest prescription?',
    'Do I have any allergies?',
    'Should I stop taking metformin?',
  ],
  pat_ravi: ['What is my TSH?', 'Which medicines am I taking?'],
  pat_karthik: ['What was my latest vitamin D result?'],
  pat_fresh: [],
}

/** Degraded (AI off) fallback: evidence lines only, no model statements. */
export function degradedAnswer(patientId: string): AskResponse {
  const r = base('degraded', 20015)
  if (patientId === 'pat_meera') r.evidence = [EV.meera_hba1c_latest, EV.meera_hba1c_prev]
  else if (patientId === 'pat_ravi') r.evidence = [EV.ravi_tsh]
  r.notices = [{ code: 'ai_unavailable', text: 'The AI assistant isn’t available right now. These lines from your documents match your question.' }]
  return r
}

export type { Evidence }
