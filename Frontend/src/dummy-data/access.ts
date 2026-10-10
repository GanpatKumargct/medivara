// Family access grants (API-23) and the access log (API-26) for Meera's profile.
import type { AuditEvent, Grant } from '../api/types'

export const SEED_GRANTS: Record<string, Grant[]> = {
  pat_meera: [
    {
      id: 'grt_meera_owner',
      grantee: { user_id: 'usr_meera', display_name: 'Meera Raman', email: 'meera.demo@medivara.test' },
      role: 'owner',
      scopes: ['view_records', 'upload_documents', 'manage_reminders'],
      status: 'active',
      granted_at: '2026-10-24T03:00:00Z',
      revoked_at: null,
    },
    {
      id: 'grt_karthik_meera',
      grantee: { user_id: 'usr_karthik', display_name: 'Karthik Raman', email: 'karthik.demo@medivara.test' },
      role: 'caregiver',
      scopes: ['view_records', 'manage_reminders'],
      status: 'active',
      granted_at: '2026-10-24T03:00:00Z',
      revoked_at: null,
    },
  ],
  pat_ravi: [
    {
      id: 'grt_ravi_owner',
      grantee: { user_id: 'usr_ravi', display_name: 'Ravi Menon', email: 'ravi.demo@medivara.test' },
      role: 'owner',
      scopes: ['view_records', 'upload_documents', 'manage_reminders'],
      status: 'active',
      granted_at: '2026-10-24T03:00:00Z',
      revoked_at: null,
    },
  ],
  pat_karthik: [
    {
      id: 'grt_karthik_owner',
      grantee: { user_id: 'usr_karthik', display_name: 'Karthik Raman', email: 'karthik.demo@medivara.test' },
      role: 'owner',
      scopes: ['view_records', 'upload_documents', 'manage_reminders'],
      status: 'active',
      granted_at: '2026-10-24T03:00:00Z',
      revoked_at: null,
    },
  ],
  pat_fresh: [],
}

export const SEED_AUDIT: Record<string, AuditEvent[]> = {
  pat_meera: [
    {
      id: 'aud_seed_2',
      at: '2026-10-24T03:00:05Z',
      actor: { user_id: 'usr_meera', display_name: 'Meera Raman' },
      action: 'access.granted',
      action_label: 'Shared records with Karthik Raman (view, reminders)',
      resource_type: 'grant',
      resource_id: 'grt_karthik_meera',
      outcome: 'success',
    },
    {
      id: 'aud_seed_1',
      at: '2026-10-24T03:00:00Z',
      actor: { user_id: 'usr_meera', display_name: 'Meera Raman' },
      action: 'auth.login',
      action_label: 'Signed in',
      resource_type: 'user',
      resource_id: 'usr_meera',
      outcome: 'success',
    },
  ],
  pat_ravi: [],
  pat_karthik: [],
  pat_fresh: [],
}

// Known MediVara accounts for grant-by-email validation (API-24).
export const KNOWN_EMAILS: Record<string, { user_id: string; display_name: string }> = {
  'meera.demo@medivara.test': { user_id: 'usr_meera', display_name: 'Meera Raman' },
  'karthik.demo@medivara.test': { user_id: 'usr_karthik', display_name: 'Karthik Raman' },
  'ravi.demo@medivara.test': { user_id: 'usr_ravi', display_name: 'Ravi Menon' },
}
