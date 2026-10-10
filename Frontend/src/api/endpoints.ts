// The API surface the screens call. By default it talks to the real backend (/api/v1 via the
// Vite proxy). Set VITE_API_MODE=dummy to run on the in-browser dummy data instead (frontend
// work without a backend); a "MOCK DATA" badge then shows on every page (COPY-32).
import * as dummy from './dummy-endpoints'
import * as real from './real-endpoints'

export const API_MODE: 'real' | 'dummy' = import.meta.env.VITE_API_MODE === 'dummy' ? 'dummy' : 'real'

const impl: typeof real = API_MODE === 'dummy' ? dummy : real

export const {
  login,
  logout,
  getMe,
  recordConsent,
  getHealth,
  getPatients,
  getPatient,
  listDocuments,
  getDocument,
  uploadDocument,
  reprocessDocument,
  patchDocument,
  patchFact,
  bulkReview,
  getTimeline,
  createBrief,
  getLatestBrief,
  generateNarrative,
  ask,
  listReminders,
  createReminder,
  completeReminder,
  updateReminder,
  getReminderSuggestions,
  listGrants,
  createGrant,
  revokeGrant,
  listAuditEvents,
} = impl
