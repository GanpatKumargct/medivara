// Consultation Brief snapshots (API-18/19) and validated narrative (API-20).
// Deterministic sections + evidence come straight from the contract fixtures.
import type { Brief, Narrative } from '../api/types'

export const MEERA_NARRATIVE: Narrative = {
  output_id: 'aio_8e1f2a3b-4c5d-4e6f-9a0b-1c2d3e4f5a6b',
  status: 'ready',
  statements: [
    { id: 'S1', kind: 'record_fact', text: 'Your records from Sunrise Diagnostics, Lakeview Family Clinic and Greenfield General Hospital document Type 2 diabetes mellitus and hypertension.', evidence_ids: ['E1'] },
    { id: 'S2', kind: 'record_fact', text: 'You were admitted to Greenfield General Hospital from 27 Jul 2025 to 31 Jul 2025 for acute gastroenteritis with dehydration.', evidence_ids: ['E2', 'E3'] },
    { id: 'S3', kind: 'record_fact', text: 'Your HbA1c was 8.4 % on 18 Mar 2025 and 7.6 % on 04 May 2026.', evidence_ids: ['E4', 'E5'] },
    { id: 'S4', kind: 'uncertainty', text: 'Your documents list different Metformin strengths over time, so it is worth confirming your current dose.', evidence_ids: ['E6', 'E7'] },
  ],
  evidence: [
    { evidence_id: 'E1', document_id: 'doc_meera_rx_2025_03', document_title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025', document_type: 'prescription', document_date: '2025-03-21', page: 1, line_ids: ['p1-l5'], text: 'Diagnosis: Type 2 diabetes mellitus; Hypertension', fact_status: 'confirmed', is_user_correction: false },
    { evidence_id: 'E2', document_id: 'doc_meera_dc_2025_07', document_title: 'Discharge summary · Greenfield General Hospital · 31 Jul 2025', document_type: 'discharge_summary', document_date: '2025-07-31', page: 1, line_ids: ['p1-l3'], text: 'Date of admission: 27-Jul-2025   Date of discharge: 31-Jul-2025', fact_status: null, is_user_correction: false },
    { evidence_id: 'E3', document_id: 'doc_meera_dc_2025_07', document_title: 'Discharge summary · Greenfield General Hospital · 31 Jul 2025', document_type: 'discharge_summary', document_date: '2025-07-31', page: 1, line_ids: ['p1-l5'], text: 'Diagnosis: Acute gastroenteritis with dehydration', fact_status: 'confirmed', is_user_correction: false },
    { evidence_id: 'E4', document_id: 'doc_meera_lab_2025_03', document_title: 'Lab report · Sunrise Diagnostics · 18 Mar 2025', document_type: 'lab_report', document_date: '2025-03-18', page: 1, line_ids: ['p1-l6'], text: 'HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H', fact_status: 'confirmed', is_user_correction: false },
    { evidence_id: 'E5', document_id: 'doc_meera_lab_2026_05', document_title: 'Lab report · Sunrise Diagnostics · 04 May 2026', document_type: 'lab_report', document_date: '2026-05-04', page: 1, line_ids: ['p1-l6'], text: 'HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H', fact_status: 'unverified', is_user_correction: false },
    { evidence_id: 'E6', document_id: 'doc_meera_rx_2025_03', document_title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025', document_type: 'prescription', document_date: '2025-03-21', page: 1, line_ids: ['p1-l8'], text: '1. Tab. Metformin 500 mg — 1 tablet twice daily after meals — 90 days', fact_status: 'confirmed', is_user_correction: false },
    { evidence_id: 'E7', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription', document_date: '2026-09-15', page: 1, line_ids: ['p1-l8'], text: '1. Tab. Metformin 1000 mg — 1 tablet twice daily after meals — 90 days', fact_status: 'confirmed', is_user_correction: false },
  ],
  notices: [
    { code: 'unverified_included', text: 'Some of this comes from information you haven’t reviewed yet.' },
  ],
  templated_text: 'Based on 5 documents from 3 providers between 18 Mar 2025 and 15 Sep 2026.',
  generated_at: '2026-10-24T05:02:52Z',
}

export function buildMeeraBrief(includeUnverified: boolean, visitReason: string | null): Brief {
  return {
    id: 'brf_2c7e9a14-5b3d-4f6e-8a1c-0d9e8f7a6b5c',
    patient_id: 'pat_meera',
    created_at: new Date().toISOString(),
    created_by: { user_id: 'usr_meera', display_name: 'Meera Raman' },
    include_unverified: includeUnverified,
    visit_reason: visitReason,
    stale: false,
    header: {
      patient_display_name: 'Meera Raman',
      age_years: 58,
      documents_count: 5,
      providers_count: 3,
      date_range: { from: '2025-03-18', to: '2026-09-15' },
      unverified_items_count: includeUnverified ? 5 : 0,
    },
    overview: {
      templated_text: 'Based on 5 documents from 3 providers between 18 Mar 2025 and 15 Sep 2026.',
      narrative_status: 'not_requested',
      narrative: null,
    },
    sections: {
      medications_from: {
        document_id: 'doc_meera_rx_2026_09',
        title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026',
      },
      medications: [
        { id: 'B-MED-1', text: 'Metformin 1000 mg · 1 tablet twice daily after meals · 90 days', status: 'confirmed', badges: ['documents_differ'], evidence_ids: ['E1'] },
        { id: 'B-MED-2', text: 'Amlodipine 5 mg · 1 tablet once daily · 90 days', status: 'confirmed', badges: [], evidence_ids: ['E2'] },
        { id: 'B-MED-3', text: 'Atorvastatin 10 mg · 1 tablet at night · 90 days', status: 'confirmed', badges: [], evidence_ids: ['E3'] },
      ],
      other_medications_mentioned: [
        { id: 'B-OMED-1', name: 'ORS sachets', last_seen_date: '2025-07-31', evidence_ids: ['E13'] },
      ],
      conditions: [
        { id: 'B-CON-1', text: 'Type 2 diabetes mellitus (first documented 21 Mar 2025)', status: 'confirmed', badges: [], evidence_ids: ['E4'] },
        { id: 'B-CON-2', text: 'Hypertension (first documented 21 Mar 2025)', status: 'confirmed', badges: [], evidence_ids: ['E4'] },
        { id: 'B-CON-3', text: 'Dyslipidaemia (documented 15 Sep 2026)', status: 'confirmed', badges: [], evidence_ids: ['E1'] },
      ],
      results_over_time: [
        {
          id: 'B-LAB-1',
          test_name: 'HbA1c (Glycated haemoglobin)',
          reference_range_as_written: '4.0 - 5.6',
          values: [
            { date: '2025-03-18', value: '8.4', unit: '%', flag_as_written: 'H', status: 'confirmed', evidence_ids: ['E5'] },
            { date: '2026-05-04', value: '7.6', unit: '%', flag_as_written: 'H', status: 'unverified', evidence_ids: ['E6'] },
          ],
        },
        {
          id: 'B-LAB-2',
          test_name: 'LDL cholesterol',
          reference_range_as_written: '< 100',
          values: [
            { date: '2025-03-18', value: '148', unit: 'mg/dL', flag_as_written: 'H', status: 'confirmed', evidence_ids: ['E14'] },
            { date: '2026-05-04', value: '112', unit: 'mg/dL', flag_as_written: 'H', status: 'unverified', evidence_ids: ['E15'] },
          ],
        },
      ],
      allergies: {
        status: 'conflicting',
        items: [
          { id: 'B-ALG-1', text: 'Sulfa drugs (rash)', status: 'confirmed', badges: ['documents_differ'], evidence_ids: ['E7'] },
        ],
      },
      points_to_clarify: [
        {
          id: 'F-1',
          rule_id: 'RULE-MED-DOSE-DIFF',
          text: 'Your documents list different strengths for Metformin: 500 mg (Prescription, 21 Mar 2025) and 1000 mg (Discharge summary, 31 Jul 2025; Prescription, 15 Sep 2026). The most recent document lists 1000 mg. Please confirm your current dose with your doctor.',
          evidence_ids: ['E8', 'E9', 'E1'],
          suggested_question: 'Which dose of Metformin should I be taking now?',
        },
        {
          id: 'F-2',
          rule_id: 'RULE-ALLERGY-CONFLICT',
          text: 'Your documents differ on allergies: "No known drug allergies" (Prescription, 21 Mar 2025) and "Sulfa drugs (rash)" (Discharge summary, 31 Jul 2025). Please confirm your allergies with your doctor.',
          evidence_ids: ['E10', 'E7'],
          suggested_question: 'Can you confirm whether I am allergic to sulfa drugs?',
        },
      ],
      missing_information: [
        {
          id: 'F-3',
          rule_id: 'RULE-FOLLOWUP-NO-APPT',
          text: 'Your prescription from 15 Sep 2026 says "Review after 6 weeks with fasting glucose report." No later visit, appointment or reminder was found in MediVara.',
          evidence_ids: ['E11'],
          suggested_question: 'When should my next review be, and which tests should I bring?',
        },
        {
          id: 'F-4',
          rule_id: 'RULE-LAB-NO-RANGE',
          text: 'Haemoglobin (04 May 2026) has no reference range printed on the report.',
          evidence_ids: ['E12'],
          suggested_question: null,
        },
      ],
      questions_for_doctor: [
        'Which dose of Metformin should I be taking now?',
        'Can you confirm whether I am allergic to sulfa drugs?',
        'When should my next review be, and which tests should I bring?',
        'What do my recent HbA1c results mean for my care?',
      ],
    },
    evidence: [
      { evidence_id: 'E1', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription', document_date: '2026-09-15', page: 1, line_ids: ['p1-l8'], text: '1. Tab. Metformin 1000 mg — 1 tablet twice daily after meals — 90 days', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E2', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription', document_date: '2026-09-15', page: 1, line_ids: ['p1-l9'], text: '2. Tab. Amlodipine 5 mg — 1 tablet once daily — 90 days', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E3', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription', document_date: '2026-09-15', page: 1, line_ids: ['p1-l10'], text: '3. Tab. Atorvastatin 10 mg — 1 tablet at night — 90 days', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E4', document_id: 'doc_meera_rx_2025_03', document_title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025', document_type: 'prescription', document_date: '2025-03-21', page: 1, line_ids: ['p1-l5'], text: 'Diagnosis: Type 2 diabetes mellitus; Hypertension', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E5', document_id: 'doc_meera_lab_2025_03', document_title: 'Lab report · Sunrise Diagnostics · 18 Mar 2025', document_type: 'lab_report', document_date: '2025-03-18', page: 1, line_ids: ['p1-l6'], text: 'HbA1c (Glycated haemoglobin)   8.4   %   4.0 - 5.6   H', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E6', document_id: 'doc_meera_lab_2026_05', document_title: 'Lab report · Sunrise Diagnostics · 04 May 2026', document_type: 'lab_report', document_date: '2026-05-04', page: 1, line_ids: ['p1-l6'], text: 'HbA1c (Glycated haemoglobin)   7.6   %   4.0 - 5.6   H', fact_status: 'unverified', is_user_correction: false },
      { evidence_id: 'E7', document_id: 'doc_meera_dc_2025_07', document_title: 'Discharge summary · Greenfield General Hospital · 31 Jul 2025', document_type: 'discharge_summary', document_date: '2025-07-31', page: 1, line_ids: ['p1-l7'], text: 'Allergies: Sulfa drugs (rash)', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E8', document_id: 'doc_meera_rx_2025_03', document_title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025', document_type: 'prescription', document_date: '2025-03-21', page: 1, line_ids: ['p1-l8'], text: '1. Tab. Metformin 500 mg — 1 tablet twice daily after meals — 90 days', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E9', document_id: 'doc_meera_dc_2025_07', document_title: 'Discharge summary · Greenfield General Hospital · 31 Jul 2025', document_type: 'discharge_summary', document_date: '2025-07-31', page: 1, line_ids: ['p1-l10'], text: 'Tab. Metformin 1000 mg — twice daily after meals', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E10', document_id: 'doc_meera_rx_2025_03', document_title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025', document_type: 'prescription', document_date: '2025-03-21', page: 1, line_ids: ['p1-l6'], text: 'Allergies: No known drug allergies', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E11', document_id: 'doc_meera_rx_2026_09', document_title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026', document_type: 'prescription', document_date: '2026-09-15', page: 1, line_ids: ['p1-l12'], text: 'Advice: Review after 6 weeks with fasting glucose report.', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E12', document_id: 'doc_meera_lab_2026_05', document_title: 'Lab report · Sunrise Diagnostics · 04 May 2026', document_type: 'lab_report', document_date: '2026-05-04', page: 1, line_ids: ['p1-l10'], text: 'Haemoglobin   12.1   g/dL', fact_status: 'unverified', is_user_correction: false },
      { evidence_id: 'E13', document_id: 'doc_meera_dc_2025_07', document_title: 'Discharge summary · Greenfield General Hospital · 31 Jul 2025', document_type: 'discharge_summary', document_date: '2025-07-31', page: 1, line_ids: ['p1-l13'], text: 'ORS sachets — as needed for 3 days', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E14', document_id: 'doc_meera_lab_2025_03', document_title: 'Lab report · Sunrise Diagnostics · 18 Mar 2025', document_type: 'lab_report', document_date: '2025-03-18', page: 1, line_ids: ['p1-l8'], text: 'LDL cholesterol   148   mg/dL   < 100   H', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E15', document_id: 'doc_meera_lab_2026_05', document_title: 'Lab report · Sunrise Diagnostics · 04 May 2026', document_type: 'lab_report', document_date: '2026-05-04', page: 1, line_ids: ['p1-l8'], text: 'LDL cholesterol   112   mg/dL   < 100   H', fact_status: 'unverified', is_user_correction: false },
    ],
    sources: [
      { document_id: 'doc_meera_rx_2026_09', title: 'Prescription · Lakeview Family Clinic · 15 Sep 2026' },
      { document_id: 'doc_meera_lab_2026_05', title: 'Lab report · Sunrise Diagnostics · 04 May 2026' },
      { document_id: 'doc_meera_dc_2025_07', title: 'Discharge summary · Greenfield General Hospital · 31 Jul 2025' },
      { document_id: 'doc_meera_rx_2025_03', title: 'Prescription · Lakeview Family Clinic · 21 Mar 2025' },
      { document_id: 'doc_meera_lab_2025_03', title: 'Lab report · Sunrise Diagnostics · 18 Mar 2025' },
    ],
    disclaimer:
      'MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.',
  }
}

export function buildRaviBrief(): Brief {
  const now = '2026-10-24T04:20:00Z'
  return {
    id: 'brf_ravi_0001',
    patient_id: 'pat_ravi',
    created_at: now,
    created_by: { user_id: 'usr_ravi', display_name: 'Ravi Menon' },
    include_unverified: true,
    visit_reason: null,
    stale: false,
    header: {
      patient_display_name: 'Ravi Menon',
      age_years: 41,
      documents_count: 2,
      providers_count: 2,
      date_range: { from: '2026-06-10', to: '2026-06-14' },
      unverified_items_count: 0,
    },
    overview: {
      templated_text: 'Based on 2 documents from 2 providers between 10 Jun 2026 and 14 Jun 2026.',
      narrative_status: 'not_requested',
      narrative: null,
    },
    sections: {
      medications_from: { document_id: 'doc_ravi_rx_2026_06', title: 'Prescription · Riverside Clinic · 14 Jun 2026' },
      medications: [
        { id: 'RB-MED-1', text: 'Levothyroxine 25 mcg · 1 tablet once daily before breakfast · 60 days', status: 'confirmed', badges: [], evidence_ids: ['E1'] },
      ],
      other_medications_mentioned: [],
      conditions: [
        { id: 'RB-CON-1', text: 'Hypothyroidism (documented 14 Jun 2026)', status: 'confirmed', badges: [], evidence_ids: ['E2'] },
      ],
      results_over_time: [
        {
          id: 'RB-LAB-1',
          test_name: 'TSH',
          reference_range_as_written: '0.4 - 4.0',
          values: [{ date: '2026-06-10', value: '6.8', unit: 'mIU/L', flag_as_written: 'H', status: 'confirmed', evidence_ids: ['E3'] }],
        },
      ],
      allergies: {
        status: 'documented',
        items: [{ id: 'RB-ALG-1', text: 'No known drug allergies', status: 'confirmed', badges: [], evidence_ids: ['E4'] }],
      },
      points_to_clarify: [],
      missing_information: [],
      questions_for_doctor: ['When should I repeat my TSH test?'],
    },
    evidence: [
      { evidence_id: 'E1', document_id: 'doc_ravi_rx_2026_06', document_title: 'Prescription · Riverside Clinic · 14 Jun 2026', document_type: 'prescription', document_date: '2026-06-14', page: 1, line_ids: ['p1-l8'], text: '1. Tab. Levothyroxine 25 mcg — 1 tablet once daily before breakfast — 60 days', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E2', document_id: 'doc_ravi_rx_2026_06', document_title: 'Prescription · Riverside Clinic · 14 Jun 2026', document_type: 'prescription', document_date: '2026-06-14', page: 1, line_ids: ['p1-l5'], text: 'Diagnosis: Hypothyroidism', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E3', document_id: 'doc_ravi_lab_2026_06', document_title: 'Lab report · City Care Labs · 10 Jun 2026', document_type: 'lab_report', document_date: '2026-06-10', page: 1, line_ids: ['p1-l6'], text: 'TSH   6.8   mIU/L   0.4 - 4.0   H', fact_status: 'confirmed', is_user_correction: false },
      { evidence_id: 'E4', document_id: 'doc_ravi_rx_2026_06', document_title: 'Prescription · Riverside Clinic · 14 Jun 2026', document_type: 'prescription', document_date: '2026-06-14', page: 1, line_ids: ['p1-l6'], text: 'Allergies: No known drug allergies', fact_status: 'confirmed', is_user_correction: false },
    ],
    sources: [
      { document_id: 'doc_ravi_rx_2026_06', title: 'Prescription · Riverside Clinic · 14 Jun 2026' },
      { document_id: 'doc_ravi_lab_2026_06', title: 'Lab report · City Care Labs · 10 Jun 2026' },
    ],
    disclaimer:
      'MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.',
  }
}
