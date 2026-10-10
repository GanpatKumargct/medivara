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
  ProfileDetails,
  ProfileDetailsInput,
  Relationship,
  Scope,
  Vital,
  VitalInput,
  VitalKind,
  VoiceConfig,
  VoiceSession,
} from './types'
import { GRANTS, PATIENTS, USERS, answerQuestion, db, degradedAnswer, health, newId } from '../dummy-data'

const now = () => new Date().toISOString()

// --- Accounts and family profiles -------------------------------------------

export async function register(email: string, password: string, displayName: string): Promise<LoginResponse> {
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
  addOwnedProfile(userId, patientId, displayName.trim(), null, 'self')
  const token = `mvs_${newRequestId()}`
  setSession(token, userId)
  return {
    token,
    token_type: 'bearer',
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    user: { id: userId, email: clean, display_name: displayName.trim(), is_demo: false },
  }
}

function addOwnedProfile(userId: string, patientId: string, name: string, age: number | null, relationship: Relationship) {
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
  details[patientId] = { ...emptyDetails(patientId), relationship }
}

export async function createPatient(input: {
  display_name: string
  age_years: number | null
  relationship: Relationship
}): Promise<PatientSummary> {
  await delay(300)
  const userId = requireAuth()
  const owned = GRANTS.filter((g) => g.grantee_user_id === userId && g.role === 'owner').length
  if (owned >= 10) throw apiError(409, 'PROFILE_LIMIT', 'You can manage up to 10 profiles.')
  const patientId = newId('pat')
  addOwnedProfile(userId, patientId, input.display_name.trim(), input.age_years, input.relationship)
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
  inputMode: 'text' | 'voice' = 'text',
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

export async function startVoiceSession(patientId: string): Promise<VoiceSession> {
  await delay(100)
  requireAccess(patientId)
  throw apiError(503, 'VOICE_UNAVAILABLE', 'Voice conversation isn’t set up on this server.')
}
