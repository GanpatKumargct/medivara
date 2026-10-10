// Reminders (API-27). Seeded with Meera's one follow-up reminder.
import type { Reminder } from '../api/types'

export const SEED_REMINDERS: Record<string, Reminder[]> = {
  pat_meera: [
    {
      id: 'rem_0a1b2c3d-4e5f-4a6b-7c8d-9e0f1a2b3c4d',
      type: 'follow_up',
      title: 'Review with Dr. Arun Kumar (bring fasting glucose report)',
      notes: null,
      schedule_kind: 'once',
      schedule: { date: '2026-10-27', time: '10:00', times: null, start_date: null, end_date: null },
      timezone: 'Asia/Kolkata',
      next_due_at: '2026-10-27T04:30:00Z',
      next_due_local: '27 Oct 2026, 10:00 IST',
      last_completed_at: null,
      status: 'active',
      source_fact_id: 'fct_meera_rx_2026_09_08',
      medication_schedule_attested: false,
      created_by: { user_id: 'usr_meera', display_name: 'Meera Raman' },
      created_at: '2026-10-24T05:09:00Z',
    },
  ],
  pat_ravi: [],
  pat_karthik: [],
  pat_fresh: [],
}

// Follow-up facts that have no reminder yet → "Suggested from your documents".
export interface ReminderSuggestion {
  source_fact_id: string
  title: string
  document_title: string
  due_text: string
  type: Reminder['type']
}

export const REMINDER_SUGGESTIONS: Record<string, ReminderSuggestion[]> = {
  pat_meera: [],
  pat_ravi: [
    {
      source_fact_id: 'fct_ravi_rx_2026_06_04',
      title: 'Repeat TSH after 6 weeks',
      document_title: 'Prescription · Riverside Clinic · 14 Jun 2026',
      due_text: 'after 6 weeks',
      type: 'follow_up',
    },
  ],
  pat_karthik: [],
  pat_fresh: [],
}
