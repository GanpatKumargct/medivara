// Seeded demo accounts, patient profiles and grants (synthetic-demo-data-pack §2).
// Fixed, readable IDs so everything lines up with the contract fixtures.
import type { PatientSummary, UserSummary } from '../api/types'

export const DEMO_PASSWORD = 'MediVara-Demo-2026'
export const POLICY_VERSION = '2026-10-demo-1'

export interface DemoUser extends UserSummary {
  password: string
  owned_patient_id: string
  onboarding_required: boolean
}

export const USERS: DemoUser[] = [
  {
    id: 'usr_meera',
    email: 'meera.demo@medivara.test',
    display_name: 'Meera Raman',
    is_demo: true,
    password: DEMO_PASSWORD,
    owned_patient_id: 'pat_meera',
    onboarding_required: false,
  },
  {
    id: 'usr_karthik',
    email: 'karthik.demo@medivara.test',
    display_name: 'Karthik Raman',
    is_demo: true,
    password: DEMO_PASSWORD,
    owned_patient_id: 'pat_karthik',
    onboarding_required: false,
  },
  {
    id: 'usr_ravi',
    email: 'ravi.demo@medivara.test',
    display_name: 'Ravi Menon',
    is_demo: true,
    password: DEMO_PASSWORD,
    owned_patient_id: 'pat_ravi',
    onboarding_required: false,
  },
  {
    id: 'usr_fresh',
    email: 'fresh.test@medivara.test',
    display_name: 'Test User',
    is_demo: true,
    password: DEMO_PASSWORD,
    owned_patient_id: 'pat_fresh',
    onboarding_required: true,
  },
]

// Demo cards shown on the login screen (SCR-02). usr_fresh is for onboarding tests
// only and is deliberately not offered as a card.
export const DEMO_CARDS = [
  { user_id: 'usr_meera', role: 'Patient' },
  { user_id: 'usr_karthik', role: 'Caregiver' },
  { user_id: 'usr_ravi', role: 'Deaf ISL user' },
] as const

// Base patient profiles with their seeded stats. Keyed by patient id.
// my_role / scopes are filled per-viewer by the api layer.
export const PATIENTS: Record<string, Omit<PatientSummary, 'my_role' | 'scopes'>> = {
  pat_meera: {
    id: 'pat_meera',
    display_name: 'Meera Raman',
    age_years: 58,
    is_synthetic: true,
    owner_display_name: 'Meera Raman',
    created_at: '2026-10-24T03:00:00Z',
    stats: {
      documents_total: 7,
      documents_needs_review: 1,
      documents_processing: 0,
      documents_failed: 1,
      upcoming_reminders: 1,
      latest_brief_at: null,
    },
  },
  pat_karthik: {
    id: 'pat_karthik',
    display_name: 'Karthik Raman',
    age_years: 32,
    is_synthetic: true,
    owner_display_name: 'Karthik Raman',
    created_at: '2026-10-24T03:00:00Z',
    stats: {
      documents_total: 1,
      documents_needs_review: 0,
      documents_processing: 0,
      documents_failed: 0,
      upcoming_reminders: 0,
      latest_brief_at: null,
    },
  },
  pat_ravi: {
    id: 'pat_ravi',
    display_name: 'Ravi Menon',
    age_years: 41,
    is_synthetic: true,
    owner_display_name: 'Ravi Menon',
    created_at: '2026-10-24T03:00:00Z',
    stats: {
      documents_total: 2,
      documents_needs_review: 0,
      documents_processing: 0,
      documents_failed: 0,
      upcoming_reminders: 0,
      latest_brief_at: '2026-10-24T04:20:00Z',
    },
  },
  pat_fresh: {
    id: 'pat_fresh',
    display_name: 'Test User',
    age_years: null,
    is_synthetic: true,
    owner_display_name: 'Test User',
    created_at: '2026-10-24T03:00:00Z',
    stats: {
      documents_total: 0,
      documents_needs_review: 0,
      documents_processing: 0,
      documents_failed: 0,
      upcoming_reminders: 0,
      latest_brief_at: null,
    },
  },
}

export interface AccessGrantSeed {
  patient_id: string
  grantee_user_id: string
  role: 'owner' | 'caregiver'
  scopes: ('view_records' | 'upload_documents' | 'manage_reminders')[]
  status: 'active' | 'revoked'
  granted_at: string
}

// Owner grants + the seeded caregiver grant (Karthik → Meera).
export const GRANTS: AccessGrantSeed[] = [
  {
    patient_id: 'pat_meera',
    grantee_user_id: 'usr_meera',
    role: 'owner',
    scopes: ['view_records', 'upload_documents', 'manage_reminders'],
    status: 'active',
    granted_at: '2026-10-24T03:00:00Z',
  },
  {
    patient_id: 'pat_karthik',
    grantee_user_id: 'usr_karthik',
    role: 'owner',
    scopes: ['view_records', 'upload_documents', 'manage_reminders'],
    status: 'active',
    granted_at: '2026-10-24T03:00:00Z',
  },
  {
    patient_id: 'pat_ravi',
    grantee_user_id: 'usr_ravi',
    role: 'owner',
    scopes: ['view_records', 'upload_documents', 'manage_reminders'],
    status: 'active',
    granted_at: '2026-10-24T03:00:00Z',
  },
  {
    patient_id: 'pat_fresh',
    grantee_user_id: 'usr_fresh',
    role: 'owner',
    scopes: ['view_records', 'upload_documents', 'manage_reminders'],
    status: 'active',
    granted_at: '2026-10-24T03:00:00Z',
  },
  {
    patient_id: 'pat_meera',
    grantee_user_id: 'usr_karthik',
    role: 'caregiver',
    scopes: ['view_records', 'manage_reminders'],
    status: 'active',
    granted_at: '2026-10-24T03:00:00Z',
  },
]
