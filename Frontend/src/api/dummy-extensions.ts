// Dummy-data implementation of the redesign extensions (contract §5b) for VITE_API_MODE=dummy.
// Same signatures as ./real-endpoints.ts; state lives in memory and resets on reload.
import {
  apiError,
  currentUser,
  delay,
  getCurrentUserId,
  newRequestId,
  requireAccess,
  requireAuth,
  requireOwner,
  requireScope,
  setSession,
} from './client'
import type {
  Chat,
  ChatDetail,
  ChatMessage,
  Grant,
  ListResponse,
  LoginResponse,
  MyInvitation,
  OwnerInvitation,
  PatientSummary,
  Period,
  PeriodInput,
  ProfileDetails,
  ProfileDetailsInput,
  Relationship,
  Scope,
  Sex,
  Vital,
  VitalInput,
  VitalKind,
  VoiceConfig,
  VoiceSession,
  WomensHealth,
  WomensHealthSettingsInput,
} from './types'
import { GRANTS, PATIENTS, USERS, answerQuestion, db, degradedAnswer, health, newId } from '../dummy-data'

const now = () => new Date().toISOString()

// --- Accounts and family profiles -------------------------------------------

export async function register(email: string, password: string, displayName: string, sex: Sex | null = null): Promise<LoginResponse> {
  await delay(400)
  const clean = email.trim().toLowerCase()
  if (USERS.some((u) => u.email === clean)) {
    throw apiError(409, 'EMAIL_TAKEN', 'An account already uses this email. Sign in instead.')
  }
  const userId = newId('usr')
  const patientId = newId('pat')
  USERS.push({
    id: userId,
    email: clean,
    display_name: displayName.trim(),
    is_demo: false,
    password,
    owned_patient_id: patientId,
    onboarding_required: true,
  })
  addOwnedProfile(userId, patientId, displayName.trim(), null, 'self', sex)
  const token = `mvs_${newRequestId()}`
  setSession(token, userId)
  return {
    token,
    token_type: 'bearer',
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    user: { id: userId, email: clean, display_name: displayName.trim(), is_demo: false },
  }
}

function addOwnedProfile(userId: string, patientId: string, name: string, age: number | null, relationship: Relationship, sex: Sex | null = null) {
  const owner = USERS.find((u) => u.id === userId)
  PATIENTS[patientId] = {
    id: patientId,
    display_name: name,
    age_years: age,
    is_synthetic: true,
    owner_display_name: owner?.display_name ?? name,
    created_at: now(),
    stats: {
      documents_total: 0,
      documents_needs_review: 0,
      documents_processing: 0,
      documents_failed: 0,
      upcoming_reminders: 0,
      latest_brief_at: null,
    },
  }
  const scopes: Scope[] = ['view_records', 'upload_documents', 'manage_reminders']
  GRANTS.push({ patient_id: patientId, grantee_user_id: userId, role: 'owner', scopes, status: 'active', granted_at: now() })
  db.grants[patientId] = [
    {
      id: newId('grt'),
      grantee: { user_id: userId, display_name: owner?.display_name ?? name, email: owner?.email ?? '' },
      role: 'owner',
      scopes,
      status: 'active',
      granted_at: now(),
      revoked_at: null,
    },
  ]
  details[patientId] = { ...emptyDetails(patientId), relationship, sex }
}

export async function createPatient(input: {
  display_name: string
  age_years: number | null
  relationship: Relationship
  sex?: Sex | null
}): Promise<PatientSummary> {
  await delay(300)
  const userId = requireAuth()
  const owned = GRANTS.filter((g) => g.grantee_user_id === userId && g.role === 'owner').length
  if (owned >= 10) throw apiError(409, 'PROFILE_LIMIT', 'You can manage up to 10 profiles.')
  const patientId = newId('pat')
  addOwnedProfile(userId, patientId, input.display_name.trim(), input.age_years, input.relationship, input.sex ?? null)
  return { ...PATIENTS[patientId], my_role: 'owner', scopes: ['view_records', 'upload_documents', 'manage_reminders'] }
}

// --- Medical ID -------------------------------------------------------------

const details: Record<string, ProfileDetails> = {}

function emptyDetails(patientId: string): ProfileDetails {
  return {
    patient_id: patientId,
    relationship: null,
    date_of_birth: null,
    sex: null,
    blood_group: null,
    height_cm: null,
    emergency_contacts: [],
    allergies_note: null,
    conditions_note: null,
    medications_note: null,
    organ_donor: null,
    updated_at: null,
  }
}

export async function getProfileDetails(patientId: string): Promise<ProfileDetails> {
  await delay(120)
  requireScope(requireAccess(patientId), 'view_records')
  return details[patientId] ?? { ...emptyDetails(patientId), relationship: 'self' }
}

export async function updateProfileDetails(patientId: string, input: ProfileDetailsInput): Promise<ProfileDetails> {
  await delay(200)
  requireOwner(requireAccess(patientId))
  details[patientId] = { ...input, patient_id: patientId, updated_at: now() }
  return details[patientId]
}

// --- Vitals -----------------------------------------------------------------

const vitals: Record<string, Vital[]> = {}

export async function listVitals(patientId: string, kind?: VitalKind): Promise<{ items: Vital[]; total: number }> {
  await delay(120)
  requireScope(requireAccess(patientId), 'view_records')
  const items = (vitals[patientId] ?? []).filter((v) => !kind || v.kind === kind)
  items.sort((a, b) => b.measured_at.localeCompare(a.measured_at))
  return { items, total: items.length }
}

export async function createVital(patientId: string, input: VitalInput): Promise<Vital> {
  await delay(180)
  const ctx = requireAccess(patientId)
  requireScope(ctx, 'upload_documents')
  const vital: Vital = {
    id: newId('vit'),
    kind: input.kind,
    value: input.value,
    value2: input.value2 ?? null,
    unit: input.unit,
    context: input.context ?? null,
    notes: input.notes ?? null,
    measured_at: new Date(input.measured_at).toISOString(),
    created_by: { user_id: ctx.userId, display_name: currentUser()?.display_name ?? '' },
    created_at: now(),
  }
  vitals[patientId] = [vital, ...(vitals[patientId] ?? [])]
  return vital
}

export async function deleteVital(patientId: string, vitalId: string): Promise<void> {
  await delay(150)
  requireScope(requireAccess(patientId), 'upload_documents')
  vitals[patientId] = (vitals[patientId] ?? []).filter((v) => v.id !== vitalId)
}

// --- Chats ------------------------------------------------------------------

interface StoredChat {
  chat: Chat
  patientId: string
  userId: string
  messages: ChatMessage[]
}
const chats: StoredChat[] = []

function ownChat(patientId: string, chatId: string): StoredChat {
  requireScope(requireAccess(patientId), 'view_records')
  const uid = getCurrentUserId()
  const found = chats.find((c) => c.chat.id === chatId && c.patientId === patientId && c.userId === uid)
  if (!found) throw apiError(404, 'NOT_FOUND', 'We couldn’t find that.')
  return found
}

function touch(stored: StoredChat) {
  stored.chat.updated_at = now()
  stored.chat.message_count = stored.messages.length
  const lastQuestion = [...stored.messages].reverse().find((m) => m.kind === 'question')
  stored.chat.last_message_preview = lastQuestion?.text?.slice(0, 120) ?? null
}

function titleFrom(text: string): string {
  if (text.length <= 60) return text
  const cut = text.slice(0, 60)
  const space = cut.lastIndexOf(' ')
  return `${space > 20 ? cut.slice(0, space) : cut}…`
}

export async function listChats(patientId: string): Promise<ListResponse<Chat>> {
  await delay(100)
  requireScope(requireAccess(patientId), 'view_records')
  const uid = getCurrentUserId()
  const items = chats
    .filter((c) => c.patientId === patientId && c.userId === uid)
    .map((c) => ({ ...c.chat }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return { items, total: items.length, limit: 100, offset: 0 }
}

export async function createChat(patientId: string, title?: string): Promise<Chat> {
  await delay(100)
  const ctx = requireAccess(patientId)
  requireScope(ctx, 'view_records')
  const chat: Chat = {
    id: newId('cht'),
    title: title?.trim() || 'New chat',
    created_at: now(),
    updated_at: now(),
    message_count: 0,
    last_message_preview: null,
  }
  chats.push({ chat, patientId, userId: ctx.userId, messages: [] })
  return { ...chat }
}

export async function getChat(patientId: string, chatId: string): Promise<ChatDetail> {
  await delay(100)
  const stored = ownChat(patientId, chatId)
  return { chat: { ...stored.chat }, messages: stored.messages.map((m) => withLiveDocument(patientId, m)) }
}

function withLiveDocument(patientId: string, m: ChatMessage): ChatMessage {
  if (m.kind !== 'attachment' || !m.document) return m
  const doc = (db.documents[patientId] ?? []).find((d) => d.id === m.document!.id)
  return {
    ...m,
    document: doc
      ? { id: doc.id, title: doc.title, status: doc.status, document_type: doc.document_type, document_date: doc.document_date }
      : null,
  }
}

export async function renameChat(patientId: string, chatId: string, title: string): Promise<Chat> {
  await delay(100)
  const stored = ownChat(patientId, chatId)
  stored.chat.title = title.trim()
  return { ...stored.chat }
}

export async function deleteChat(patientId: string, chatId: string): Promise<void> {
  await delay(100)
  const stored = ownChat(patientId, chatId)
  chats.splice(chats.indexOf(stored), 1)
}

export async function sendChatMessage(
  patientId: string,
  chatId: string,
  question: string,
  inputMode: 'text' | 'voice' | 'sign' = 'text',
): Promise<{ user_message: ChatMessage; assistant_message: ChatMessage; chat: Chat }> {
  const stored = ownChat(patientId, chatId)
  const text = question.trim()
  const answer = health.ai.available ? answerQuestion(patientId, text) : degradedAnswer(patientId)
  await delay(answer.latency_ms < 100 ? 200 : 900)
  const base = { chat_id: chatId, document: null, created_at: now() }
  const user_message: ChatMessage = { ...base, id: newId('msg'), role: 'user', kind: 'question', text, input_mode: inputMode, answer: null }
  const assistant_message: ChatMessage = { ...base, id: newId('msg'), role: 'assistant', kind: 'answer', text: null, input_mode: null, answer }
  stored.messages.push(user_message, assistant_message)
  if (stored.chat.title === 'New chat') stored.chat.title = titleFrom(text)
  touch(stored)
  return { user_message, assistant_message, chat: { ...stored.chat } }
}

export async function attachDocumentToChat(
  patientId: string,
  chatId: string,
  documentId: string,
): Promise<{ message: ChatMessage; chat: Chat }> {
  await delay(100)
  const stored = ownChat(patientId, chatId)
  const doc = (db.documents[patientId] ?? []).find((d) => d.id === documentId)
  if (!doc) throw apiError(404, 'NOT_FOUND', 'We couldn’t find that.')
  const message: ChatMessage = {
    id: newId('msg'),
    chat_id: chatId,
    role: 'user',
    kind: 'attachment',
    text: null,
    input_mode: null,
    answer: null,
    document: { id: doc.id, title: doc.title, status: doc.status, document_type: doc.document_type, document_date: doc.document_date },
    created_at: now(),
  }
  stored.messages.push(message)
  if (stored.chat.title === 'New chat') stored.chat.title = titleFrom(`Document: ${doc.title}`)
  touch(stored)
  return { message, chat: { ...stored.chat } }
}

// --- Invitations ------------------------------------------------------------

interface StoredInvitation extends OwnerInvitation {
  patient_id: string
  invited_by: string
}
const invitations: StoredInvitation[] = []

function effectiveStatus(inv: StoredInvitation): OwnerInvitation['status'] {
  return inv.status === 'pending' && inv.expires_at < now() ? 'expired' : inv.status
}

export async function createInvitation(
  patientId: string,
  input: { email: string; scopes: string[]; relationship: Relationship },
): Promise<{ invitation: OwnerInvitation; invite_url: string; email_sent: boolean }> {
  await delay(250)
  const ctx = requireAccess(patientId)
  requireOwner(ctx)
  const email = input.email.trim().toLowerCase()
  if (currentUser()?.email === email) {
    throw apiError(422, 'VALIDATION_ERROR', 'Some fields need attention.', { fields: [{ field: 'email', issue: 'you can’t invite yourself' }] })
  }
  if (invitations.some((i) => i.patient_id === patientId && i.email === email && effectiveStatus(i) === 'pending')) {
    throw apiError(409, 'INVITATION_EXISTS', 'An invitation to this email is already pending.')
  }
  const existing = (db.grants[patientId] ?? []).find((g) => g.grantee.email === email && g.status === 'active')
  if (existing) throw apiError(409, 'GRANT_EXISTS', 'This person already has access to this profile.')
  const id = `inv_${crypto.randomUUID()}`
  const inv: StoredInvitation = {
    id,
    email,
    relationship: input.relationship,
    scopes: input.scopes as Scope[],
    status: 'pending',
    created_at: now(),
    expires_at: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
    responded_at: null,
    invite_url: `/invite/${id}`,
    patient_id: patientId,
    invited_by: ctx.userId,
  }
  invitations.unshift(inv)
  return { invitation: publicInvitation(inv), invite_url: inv.invite_url, email_sent: false }
}

function publicInvitation(inv: StoredInvitation): OwnerInvitation {
  const { patient_id: _p, invited_by: _i, ...rest } = inv
  return { ...rest, status: effectiveStatus(inv) }
}

export async function listInvitations(patientId: string): Promise<OwnerInvitation[]> {
  await delay(120)
  requireOwner(requireAccess(patientId))
  return invitations.filter((i) => i.patient_id === patientId).map(publicInvitation)
}

export async function cancelInvitation(patientId: string, invitationId: string): Promise<void> {
  await delay(120)
  requireOwner(requireAccess(patientId))
  const inv = invitations.find((i) => i.id === invitationId && i.patient_id === patientId)
  if (!inv) throw apiError(404, 'NOT_FOUND', 'We couldn’t find that.')
  if (inv.status !== 'pending') throw apiError(409, 'INVALID_STATE', 'This invitation is no longer pending.')
  inv.status = 'cancelled'
  inv.responded_at = now()
}

function mine(invitationId: string): StoredInvitation {
  requireAuth()
  const email = currentUser()?.email
  const inv = invitations.find((i) => i.id === invitationId && i.email === email && effectiveStatus(i) === 'pending')
  if (!inv) throw apiError(404, 'NOT_FOUND', 'We couldn’t find that.')
  return inv
}

export async function listMyInvitations(): Promise<MyInvitation[]> {
  await delay(120)
  requireAuth()
  const email = currentUser()?.email
  return invitations
    .filter((i) => i.email === email && effectiveStatus(i) === 'pending')
    .map((i) => ({
      id: i.id,
      patient: { id: i.patient_id, display_name: PATIENTS[i.patient_id]?.display_name ?? 'Profile' },
      invited_by: { display_name: USERS.find((u) => u.id === i.invited_by)?.display_name ?? 'Someone' },
      relationship: i.relationship,
      scopes: i.scopes,
      created_at: i.created_at,
      expires_at: i.expires_at,
    }))
}

export async function acceptInvitation(invitationId: string): Promise<{ patient_id: string }> {
  await delay(200)
  const inv = mine(invitationId)
  const user = currentUser()!
  const grants = db.grants[inv.patient_id] ?? (db.grants[inv.patient_id] = [])
  if (!grants.some((g) => g.grantee.user_id === user.id && g.status === 'active')) {
    const grant: Grant = {
      id: newId('grt'),
      grantee: { user_id: user.id, display_name: user.display_name, email: user.email },
      role: 'caregiver',
      scopes: inv.scopes,
      status: 'active',
      granted_at: now(),
      revoked_at: null,
    }
    grants.push(grant)
  }
  inv.status = 'accepted'
  inv.responded_at = now()
  return { patient_id: inv.patient_id }
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await delay(150)
  const inv = mine(invitationId)
  inv.status = 'declined'
  inv.responded_at = now()
}

// --- Voice (not available without the backend) ------------------------------

export async function getVoiceConfig(): Promise<VoiceConfig> {
  await delay(50)
  return { available: false, mode: 'off' }
}

// --- Women's health (same rules as backend app/womens_health.py) --------------

const whSettings: Record<string, WomensHealthSettingsInput & { updated_at: string | null }> = {}
const periods: Record<string, Period[]> = {}
const DAY = 86_400_000

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10)
}
function parseDay(s: string) {
  return new Date(`${s}T00:00:00Z`)
}
function todayDay() {
  const now = new Date(Date.now() + 5.5 * 3600_000) // IST
  return parseDay(now.toISOString().slice(0, 10))
}
function addDays(s: string, n: number) {
  return isoDay(new Date(parseDay(s).getTime() + n * DAY))
}
function diffDays(a: string, b: Date) {
  return Math.round((parseDay(a).getTime() - b.getTime()) / DAY)
}
const human = (s: string) => {
  const d = parseDay(s)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function summarise(patientId: string): WomensHealth {
  const st = whSettings[patientId] ?? {
    mode: 'off', cycle_length_days: null, period_length_days: null, lmp_date: null, due_date: null, delivery_date: null, updated_at: null,
  }
  const today = todayDay()
  const logs = [...(periods[patientId] ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const gaps = logs.slice(1).map((l, i) => diffDays(l.start_date, parseDay(logs[i].start_date))).filter((g) => g >= 15 && g <= 60).slice(-6)
  const lengths = logs.filter((l) => l.end_date).map((l) => diffDays(l.end_date!, parseDay(l.start_date)) + 1).slice(-6)
  const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
  const last = logs.length ? logs[logs.length - 1].start_date : null
  const avgCycle = last ? (gaps.length ? mean(gaps) : st.cycle_length_days) : null
  const avgPeriod = last ? (lengths.length ? mean(lengths) : st.period_length_days) : null
  const next = last && avgCycle ? addDays(last, avgCycle) : null
  const ovulation = next ? addDays(next, -14) : null
  const cycle = {
    last_period_start: last,
    cycle_day: last ? -diffDays(last, today) + 1 : null,
    average_cycle_days: avgCycle,
    average_period_days: avgPeriod,
    next_period_estimate: next,
    next_period_end_estimate: next && avgPeriod ? addDays(next, avgPeriod - 1) : null,
    days_until_next_period: next ? diffDays(next, today) : null,
    fertile_window_start: ovulation ? addDays(ovulation, -5) : null,
    fertile_window_end: ovulation ? addDays(ovulation, 1) : null,
    logged_periods: logs.length,
  }
  let pregnancy: WomensHealth['summary']['pregnancy'] = null
  if (st.mode === 'pregnancy' && (st.lmp_date || st.due_date)) {
    const due = st.due_date ?? addDays(st.lmp_date!, 280)
    const lmp = st.lmp_date ?? addDays(due, -280)
    const ga = Math.max(0, -diffDays(lmp, today))
    const weeks = Math.floor(ga / 7)
    pregnancy = { due_date: due, lmp_date: lmp, weeks, days: ga % 7, trimester: weeks < 13 ? 1 : weeks < 27 ? 2 : 3, days_to_go: diffDays(due, today) }
  }
  let postpartum: WomensHealth['summary']['postpartum'] = null
  if (st.mode === 'postpartum' && st.delivery_date) {
    const since = Math.max(0, -diffDays(st.delivery_date, today))
    postpartum = { delivery_date: st.delivery_date, days_since_delivery: since, weeks_since_delivery: Math.floor(since / 7) }
  }
  let voice = 'Not in use.'
  if (st.mode === 'cycle') {
    if (!last) voice = 'Period tracker is on, but no periods have been logged yet.'
    else if (!next) voice = `Period tracker: cycle day ${cycle.cycle_day}. Last period started ${human(last)}. There isn't enough information yet to estimate the next period.`
    else {
      const d = cycle.days_until_next_period!
      const when = d > 0 ? `in ${plural(d, 'day')}` : d === 0 ? 'today' : `${plural(-d, 'day')} late`
      voice = `Period tracker: cycle day ${cycle.cycle_day}. Last period started ${human(last)}. Next period estimated around ${human(next)} (${when}). Average cycle ${avgCycle} days. These are estimates from dates the user entered, not medical advice.`
    }
  } else if (pregnancy) {
    const tri = ['first', 'second', 'third'][pregnancy.trimester - 1]
    const due = pregnancy.days_to_go >= 0 ? `Due date ${human(pregnancy.due_date)}, ${plural(pregnancy.days_to_go, 'day')} to go.` : `Due date ${human(pregnancy.due_date)} has passed.`
    voice = `Pregnancy tracker: week ${pregnancy.weeks} and ${plural(pregnancy.days, 'day')} (${tri} trimester). ${due} Calculated from dates the user entered.`
  } else if (postpartum) {
    voice = `After-birth tracker: ${plural(postpartum.weeks_since_delivery, 'week')} since delivery on ${human(postpartum.delivery_date)}.`
  }
  return { ...st, patient_id: patientId, summary: { cycle, pregnancy, postpartum, voice_context: voice } }
}

export async function getWomensHealth(patientId: string): Promise<WomensHealth> {
  await delay(120)
  requireScope(requireAccess(patientId), 'view_records')
  return summarise(patientId)
}

export async function updateWomensHealth(patientId: string, input: WomensHealthSettingsInput): Promise<WomensHealth> {
  await delay(180)
  requireScope(requireAccess(patientId), 'upload_documents')
  if (input.mode === 'pregnancy' && !input.lmp_date && !input.due_date) {
    throw apiError(422, 'VALIDATION_ERROR', 'Some fields need attention.', { fields: [{ field: 'lmp_date', issue: 'pregnancy mode needs lmp_date or due_date' }] })
  }
  if (input.mode === 'postpartum' && !input.delivery_date) {
    throw apiError(422, 'VALIDATION_ERROR', 'Some fields need attention.', { fields: [{ field: 'delivery_date', issue: 'postpartum mode needs delivery_date' }] })
  }
  whSettings[patientId] = { ...input, updated_at: now() }
  return summarise(patientId)
}

function periodOut(p: Period): Period {
  return { ...p, length_days: p.end_date ? diffDays(p.end_date, parseDay(p.start_date)) + 1 : null }
}

function overlaps(patientId: string, start: string, end: string | null, except?: string) {
  const s = parseDay(start).getTime()
  const e = parseDay(end ?? addDays(start, 6)).getTime()
  return (periods[patientId] ?? []).some((p) => {
    if (p.id === except) return false
    const ps = parseDay(p.start_date).getTime()
    const pe = parseDay(p.end_date ?? addDays(p.start_date, 6)).getTime()
    return s <= pe && ps <= e
  })
}

export async function listPeriods(patientId: string): Promise<{ items: Period[]; total: number }> {
  await delay(100)
  requireScope(requireAccess(patientId), 'view_records')
  const items = [...(periods[patientId] ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date)).map(periodOut)
  return { items, total: items.length }
}

export async function createPeriod(patientId: string, input: PeriodInput): Promise<Period> {
  await delay(150)
  const ctx = requireAccess(patientId)
  requireScope(ctx, 'upload_documents')
  if (overlaps(patientId, input.start_date, input.end_date ?? null)) {
    throw apiError(409, 'PERIOD_OVERLAP', 'This overlaps a period you’ve already logged.')
  }
  const period: Period = {
    id: newId('per'),
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    length_days: null,
    flow: input.flow ?? null,
    symptoms: input.symptoms ?? [],
    notes: input.notes ?? null,
    created_by: { user_id: ctx.userId, display_name: currentUser()?.display_name ?? '' },
    created_at: now(),
    updated_at: now(),
  }
  periods[patientId] = [...(periods[patientId] ?? []), period]
  return periodOut(period)
}

export async function updatePeriod(patientId: string, periodId: string, patch: Partial<PeriodInput>): Promise<Period> {
  await delay(120)
  requireScope(requireAccess(patientId), 'upload_documents')
  const p = (periods[patientId] ?? []).find((x) => x.id === periodId)
  if (!p) throw apiError(404, 'NOT_FOUND', 'We couldn’t find that.')
  const next = { ...p, ...patch, symptoms: patch.symptoms ?? p.symptoms, updated_at: now() } as Period
  if (overlaps(patientId, next.start_date, next.end_date, p.id)) {
    throw apiError(409, 'PERIOD_OVERLAP', 'This overlaps a period you’ve already logged.')
  }
  Object.assign(p, next)
  return periodOut(p)
}

export async function deletePeriod(patientId: string, periodId: string): Promise<void> {
  await delay(100)
  requireScope(requireAccess(patientId), 'upload_documents')
  periods[patientId] = (periods[patientId] ?? []).filter((p) => p.id !== periodId)
}

export async function startVoiceSession(patientId: string): Promise<VoiceSession> {
  await delay(100)
  requireAccess(patientId)
  throw apiError(503, 'VOICE_UNAVAILABLE', 'Voice conversation isn’t set up on this server.')
}
