// Real implementation of the API surface the screens call: the FastAPI backend at /api/v1
// (docs/srd/11-api-contract.md, API-01…30). Signatures and return types match
// ./dummy-endpoints.ts exactly, so screens don't change between modes.
import { clearSession, request, setSession } from './http'
import type {
  AskResponse,
  AuditEvent,
  Brief,
  Chat,
  ChatDetail,
  ChatMessage,
  DocumentDetailResponse,
  DocumentSummary,
  Fact,
  Grant,
  HealthResponse,
  ListResponse,
  LoginResponse,
  MeResponse,
  MyInvitation,
  OwnerInvitation,
  PatientSummary,
  Period,
  PeriodInput,
  Sex,
  WomensHealth,
  WomensHealthSettingsInput,
  ProfileDetails,
  ProfileDetailsInput,
  Relationship,
  Reminder,
  TimelineResponse,
  Vital,
  VitalInput,
  VitalKind,
  VoiceConfig,
  VoiceSession,
} from './types'
import type { ReminderSuggestion } from '../dummy-data/reminders'

const p = (patientId: string) => `/patients/${encodeURIComponent(patientId)}`

let policyVersion: string | null = null

async function currentPolicyVersion(): Promise<string> {
  if (!policyVersion) policyVersion = (await getMe()).current_policy_version
  return policyVersion
}

// --- Auth (API-02, 03, 04, 05) ---------------------------------------------

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await request<LoginResponse>('POST', '/auth/login', {
    json: { email, password },
    allowUnauthenticated: true,
  })
  setSession(res.token, res.user.id)
  return res
}

export async function register(email: string, password: string, displayName: string, sex: Sex | null = null): Promise<LoginResponse> {
  const res = await request<LoginResponse>('POST', '/auth/register', {
    json: { email, password, display_name: displayName, sex },
    allowUnauthenticated: true,
  })
  setSession(res.token, res.user.id)
  return res
}

export async function logout(): Promise<void> {
  try {
    await request<void>('POST', '/auth/logout', { allowUnauthenticated: true })
  } finally {
    clearSession() // cleared even if the network call fails (FR-002)
    policyVersion = null
  }
}

export async function getMe(): Promise<MeResponse> {
  const me = await request<MeResponse>('GET', '/me')
  policyVersion = me.current_policy_version
  return me
}

export async function recordConsent(consentType: string, granted: boolean): Promise<void> {
  await request('POST', '/me/consents', {
    json: { consent_type: consentType, granted, policy_version: await currentPolicyVersion() },
  })
}

// --- Health (API-01) --------------------------------------------------------

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('GET', '/health', { allowUnauthenticated: true })
}

// --- Patients (API-06, 07) --------------------------------------------------

export function getPatients(): Promise<ListResponse<PatientSummary>> {
  return request('GET', '/patients')
}

export function getPatient(patientId: string): Promise<PatientSummary> {
  return request('GET', p(patientId))
}

// --- Documents (API-08..16) -------------------------------------------------

export function listDocuments(
  patientId: string,
  opts: { status?: string[]; document_type?: string[] } = {},
): Promise<ListResponse<DocumentSummary>> {
  return request('GET', `${p(patientId)}/documents`, { query: { status: opts.status, document_type: opts.document_type } })
}

export function getDocument(patientId: string, documentId: string): Promise<DocumentDetailResponse> {
  return request('GET', `${p(patientId)}/documents/${encodeURIComponent(documentId)}`)
}

export function uploadDocument(patientId: string, file: File, hint?: string): Promise<{ document: DocumentSummary }> {
  const form = new FormData()
  form.append('file', file)
  if (hint) form.append('document_type_hint', hint)
  return request('POST', `${p(patientId)}/documents`, { form })
}

export function reprocessDocument(patientId: string, documentId: string): Promise<{ document: DocumentSummary }> {
  return request('POST', `${p(patientId)}/documents/${encodeURIComponent(documentId)}/reprocess`)
}

// API-22 (owner only): removes the file, pages and facts. 409 INVALID_STATE while processing.
export function deleteDocument(patientId: string, documentId: string): Promise<void> {
  return request('DELETE', `${p(patientId)}/documents/${encodeURIComponent(documentId)}`)
}

export function patchDocument(
  patientId: string,
  documentId: string,
  fields: { document_type?: string; document_date?: string; facility_name?: string; clinician_name?: string },
): Promise<{ document: DocumentSummary }> {
  // Only send fields the user actually filled in (the backend rejects empty strings).
  const body = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ''))
  return request('PATCH', `${p(patientId)}/documents/${encodeURIComponent(documentId)}`, { json: body })
}

export function patchFact(
  patientId: string,
  factId: string,
  action: 'confirm' | 'correct' | 'reject' | 'undo_reject',
  correctedFields?: Record<string, string>,
): Promise<{ fact: Fact; document: { id: string; status: string } }> {
  const json: Record<string, unknown> = { action }
  if (action === 'correct') json.corrected_fields = correctedFields ?? {}
  return request('PATCH', `${p(patientId)}/facts/${encodeURIComponent(factId)}`, { json })
}

export function bulkReview(
  patientId: string,
  documentId: string,
): Promise<{ confirmed_fact_ids: string[]; remaining_unverified: number; document: { id: string; status: string } }> {
  return request('POST', `${p(patientId)}/documents/${encodeURIComponent(documentId)}/review`, {
    json: { action: 'confirm_high_confidence' },
  })
}

// --- Timeline (API-17) ------------------------------------------------------

export function getTimeline(
  patientId: string,
  opts: { include_unverified?: boolean; types?: string[]; order?: 'asc' | 'desc' } = {},
): Promise<TimelineResponse> {
  // The screens' type filter keeps document cards visible alongside the chosen fact types.
  const types = opts.types?.length ? ['document', ...opts.types] : undefined
  return request('GET', `${p(patientId)}/timeline`, {
    query: { include_unverified: opts.include_unverified, types, order: opts.order },
  })
}

// --- Brief (API-18, 19, 20) -------------------------------------------------

export function createBrief(
  patientId: string,
  opts: { include_unverified?: boolean; visit_reason?: string | null } = {},
): Promise<{ brief: Brief }> {
  return request('POST', `${p(patientId)}/briefs`, {
    json: { include_unverified: opts.include_unverified ?? true, visit_reason: opts.visit_reason || null },
  })
}

export async function getLatestBrief(patientId: string): Promise<Brief> {
  return (await request<{ brief: Brief }>('GET', `${p(patientId)}/briefs/latest`)).brief
}

export async function generateNarrative(
  patientId: string,
  briefId: string,
): Promise<{ narrative: Brief['overview']['narrative'] }> {
  const res = await request<{ brief_id: string; narrative: Brief['overview']['narrative'] }>(
    'POST',
    `${p(patientId)}/briefs/${encodeURIComponent(briefId)}/narrative`,
  )
  return { narrative: res.narrative }
}

// --- Ask (API-21) -----------------------------------------------------------

export function ask(patientId: string, question: string, inputMode: 'text' | 'voice' = 'text'): Promise<AskResponse> {
  return request('POST', `${p(patientId)}/ask`, { json: { question, input_mode: inputMode } })
}

// --- Reminders (API-27..30) -------------------------------------------------

export function listReminders(patientId: string, status: string = 'all'): Promise<ListResponse<Reminder>> {
  return request('GET', `${p(patientId)}/reminders`, { query: { status } })
}

export function createReminder(
  patientId: string,
  input: Partial<Reminder> & { title: string; type: Reminder['type']; schedule_kind: 'once' | 'daily'; schedule: Reminder['schedule'] },
): Promise<{ reminder: Reminder }> {
  return request('POST', `${p(patientId)}/reminders`, {
    json: {
      type: input.type,
      title: input.title,
      notes: input.notes ?? null,
      schedule_kind: input.schedule_kind,
      schedule: input.schedule,
      timezone: 'Asia/Kolkata',
      source_fact_id: input.source_fact_id ?? null,
      medication_schedule_attested: input.medication_schedule_attested ?? false,
    },
  })
}

export function completeReminder(patientId: string, reminderId: string): Promise<{ reminder: Reminder }> {
  return request('POST', `${p(patientId)}/reminders/${encodeURIComponent(reminderId)}/complete`)
}

const REMINDER_PATCH_KEYS = [
  'type', 'title', 'notes', 'schedule_kind', 'schedule', 'timezone', 'source_fact_id', 'medication_schedule_attested', 'status',
] as const

export function updateReminder(patientId: string, reminderId: string, patch: Partial<Reminder>): Promise<{ reminder: Reminder }> {
  const json = Object.fromEntries(REMINDER_PATCH_KEYS.filter((k) => k in patch).map((k) => [k, patch[k]]))
  return request('PATCH', `${p(patientId)}/reminders/${encodeURIComponent(reminderId)}`, { json })
}

/** FR-072: follow-up facts (from the timeline) that no reminder was created from yet. */
export async function getReminderSuggestions(patientId: string): Promise<ReminderSuggestion[]> {
  const [timeline, reminders] = await Promise.all([
    getTimeline(patientId, { types: ['follow_up'] }),
    listReminders(patientId, 'all'),
  ])
  const used = new Set(reminders.items.filter((r) => r.status !== 'dismissed').map((r) => r.source_fact_id))
  const titles: Record<string, string> = {}
  const events = [...timeline.groups.flatMap((g) => g.events), ...timeline.undated]
  events.filter((e) => e.event_type === 'document').forEach((e) => (titles[e.document_id] = e.title))
  return events
    .filter((e) => e.event_type === 'follow_up' && e.fact_id && !used.has(e.fact_id))
    .map((e) => ({
      source_fact_id: e.fact_id!,
      title: e.title,
      document_title: titles[e.document_id] ?? 'Your documents',
      due_text: e.summary || e.title,
      type: 'follow_up' as const,
    }))
}

// --- Access / family (API-23..26) ------------------------------------------

export async function listGrants(patientId: string): Promise<{ grants: Grant[] }> {
  const res = await request<{ grants: Grant[] }>('GET', `${p(patientId)}/access`)
  return { grants: res.grants.filter((g) => g.status === 'active') }
}

export async function createGrant(patientId: string, email: string, scopes: string[]): Promise<{ grant: Grant }> {
  return request('POST', `${p(patientId)}/access`, {
    // The screen only calls this once the owner has ticked the COPY-25 consent.
    json: { grantee_email: email, scopes, consent_confirmed: true, policy_version: await currentPolicyVersion() },
  })
}

export function revokeGrant(patientId: string, grantId: string): Promise<void> {
  return request('DELETE', `${p(patientId)}/access/${encodeURIComponent(grantId)}`)
}

export function listAuditEvents(patientId: string): Promise<ListResponse<AuditEvent>> {
  return request('GET', `${p(patientId)}/audit-events`)
}

// --- Redesign extensions (contract §5b) -------------------------------------

export async function createPatient(input: {
  display_name: string
  age_years: number | null
  relationship: Relationship
  sex?: Sex | null
}): Promise<PatientSummary> {
  return (await request<{ patient: PatientSummary }>('POST', '/patients', { json: input })).patient
}

export async function getProfileDetails(patientId: string): Promise<ProfileDetails> {
  return (await request<{ details: ProfileDetails }>('GET', `${p(patientId)}/details`)).details
}

export async function updateProfileDetails(patientId: string, input: ProfileDetailsInput): Promise<ProfileDetails> {
  return (await request<{ details: ProfileDetails }>('PUT', `${p(patientId)}/details`, { json: input })).details
}

export function listVitals(patientId: string, kind?: VitalKind): Promise<{ items: Vital[]; total: number }> {
  return request('GET', `${p(patientId)}/vitals`, { query: { kind, limit: 500 } })
}

export async function createVital(patientId: string, input: VitalInput): Promise<Vital> {
  return (await request<{ vital: Vital }>('POST', `${p(patientId)}/vitals`, { json: input })).vital
}

export function deleteVital(patientId: string, vitalId: string): Promise<void> {
  return request('DELETE', `${p(patientId)}/vitals/${encodeURIComponent(vitalId)}`)
}

export function listChats(patientId: string): Promise<ListResponse<Chat>> {
  return request('GET', `${p(patientId)}/chats`, { query: { limit: 100 } })
}

export async function createChat(patientId: string, title?: string): Promise<Chat> {
  return (await request<{ chat: Chat }>('POST', `${p(patientId)}/chats`, { json: title ? { title } : {} })).chat
}

export function getChat(patientId: string, chatId: string): Promise<ChatDetail> {
  return request('GET', `${p(patientId)}/chats/${encodeURIComponent(chatId)}`)
}

export async function renameChat(patientId: string, chatId: string, title: string): Promise<Chat> {
  return (await request<{ chat: Chat }>('PATCH', `${p(patientId)}/chats/${encodeURIComponent(chatId)}`, { json: { title } })).chat
}

export function deleteChat(patientId: string, chatId: string): Promise<void> {
  return request('DELETE', `${p(patientId)}/chats/${encodeURIComponent(chatId)}`)
}

export function sendChatMessage(
  patientId: string,
  chatId: string,
  question: string,
  inputMode: 'text' | 'voice' = 'text',
): Promise<{ user_message: ChatMessage; assistant_message: ChatMessage; chat: Chat }> {
  return request('POST', `${p(patientId)}/chats/${encodeURIComponent(chatId)}/messages`, {
    json: { question, input_mode: inputMode },
  })
}

export function attachDocumentToChat(
  patientId: string,
  chatId: string,
  documentId: string,
): Promise<{ message: ChatMessage; chat: Chat }> {
  return request('POST', `${p(patientId)}/chats/${encodeURIComponent(chatId)}/attachments`, {
    json: { document_id: documentId },
  })
}

export async function createInvitation(
  patientId: string,
  input: { email: string; scopes: string[]; relationship: Relationship },
): Promise<{ invitation: OwnerInvitation; invite_url: string; email_sent: boolean }> {
  return request('POST', `${p(patientId)}/invitations`, {
    // The screen only calls this once the owner has ticked the COPY-25 consent.
    json: { ...input, consent_confirmed: true, policy_version: await currentPolicyVersion() },
  })
}

export async function listInvitations(patientId: string): Promise<OwnerInvitation[]> {
  return (await request<{ invitations: OwnerInvitation[] }>('GET', `${p(patientId)}/invitations`)).invitations
}

export function cancelInvitation(patientId: string, invitationId: string): Promise<void> {
  return request('DELETE', `${p(patientId)}/invitations/${encodeURIComponent(invitationId)}`)
}

export async function listMyInvitations(): Promise<MyInvitation[]> {
  return (await request<{ invitations: MyInvitation[] }>('GET', '/me/invitations')).invitations
}

export function acceptInvitation(invitationId: string): Promise<{ patient_id: string }> {
  return request('POST', `/me/invitations/${encodeURIComponent(invitationId)}/accept`)
}

export function declineInvitation(invitationId: string): Promise<void> {
  return request('POST', `/me/invitations/${encodeURIComponent(invitationId)}/decline`)
}

export function getVoiceConfig(): Promise<VoiceConfig> {
  return request('GET', '/voice/config')
}

export function startVoiceSession(patientId: string): Promise<VoiceSession> {
  return request('POST', `${p(patientId)}/voice/session`)
}

// --- Women's health (API-62 to API-67) ---------------------------------------

export async function getWomensHealth(patientId: string): Promise<WomensHealth> {
  return (await request<{ womens_health: WomensHealth }>('GET', `${p(patientId)}/womens-health`)).womens_health
}

export async function updateWomensHealth(patientId: string, input: WomensHealthSettingsInput): Promise<WomensHealth> {
  return (await request<{ womens_health: WomensHealth }>('PUT', `${p(patientId)}/womens-health`, { json: input })).womens_health
}

export function listPeriods(patientId: string): Promise<{ items: Period[]; total: number }> {
  return request('GET', `${p(patientId)}/periods`, { query: { limit: 60 } })
}

export async function createPeriod(patientId: string, input: PeriodInput): Promise<Period> {
  return (await request<{ period: Period }>('POST', `${p(patientId)}/periods`, { json: input })).period
}

export async function updatePeriod(patientId: string, periodId: string, patch: Partial<PeriodInput>): Promise<Period> {
  return (await request<{ period: Period }>('PATCH', `${p(patientId)}/periods/${encodeURIComponent(periodId)}`, { json: patch })).period
}

export function deletePeriod(patientId: string, periodId: string): Promise<void> {
  return request('DELETE', `${p(patientId)}/periods/${encodeURIComponent(periodId)}`)
}
