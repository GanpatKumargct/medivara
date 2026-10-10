// Dummy-data implementation of the API surface (VITE_API_MODE=dummy). Each function returns
// a contract-shaped response from the in-browser store. The real implementation is
// ./real-endpoints.ts; ./endpoints.ts picks one. Signatures must stay identical.
import {
  apiError,
  clearSession,
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
  AskResponse,
  AuditEvent,
  Brief,
  DocumentDetailResponse,
  DocumentSummary,
  Fact,
  Grant,
  HealthResponse,
  ListResponse,
  LoginResponse,
  MeResponse,
  PatientSummary,
  Reminder,
  TimelineResponse,
} from './types'
import {
  GRANTS,
  PATIENTS,
  POLICY_VERSION,
  USERS,
  answerQuestion,
  buildMeeraBrief,
  buildRaviBrief,
  db,
  degradedAnswer,
  getDocumentDetail,
  health,
  KNOWN_EMAILS,
  MEERA_NARRATIVE,
  newId,
  pushAudit,
  refreshDocumentStatus,
  REMINDER_SUGGESTIONS,
  TIMELINES,
} from '../dummy-data'

// --- Auth (API-02, 03, 04, 05) ---------------------------------------------

export async function login(email: string, password: string): Promise<LoginResponse> {
  await delay(450)
  const user = USERS.find((u) => u.email === email.trim().toLowerCase())
  if (!user || user.password !== password) {
    throw apiError(401, 'INVALID_CREDENTIALS', 'That email and password don’t match a MediVara account.')
  }
  const token = `mvs_${newRequestId()}`
  setSession(token, user.id)
  return {
    token,
    token_type: 'bearer',
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    user: { id: user.id, email: user.email, display_name: user.display_name, is_demo: user.is_demo },
  }
}

export async function logout(): Promise<void> {
  await delay(120)
  clearSession()
}

const sessionConsents: Record<string, Record<string, { granted: boolean; policy_version: string; at: string }>> = {}

export async function getMe(): Promise<MeResponse> {
  await delay(150)
  const uid = requireAuth()
  const user = USERS.find((u) => u.id === uid)!
  const given = sessionConsents[uid] ?? {}
  const onboardingDone =
    !user.onboarding_required || (given.terms_and_disclaimer?.granted && given.ai_processing?.granted)
  return {
    user: { id: user.id, email: user.email, display_name: user.display_name, is_demo: user.is_demo },
    owned_patient_id: user.owned_patient_id,
    current_policy_version: POLICY_VERSION,
    onboarding_required: !onboardingDone,
    consents: {
      terms_and_disclaimer: user.onboarding_required ? given.terms_and_disclaimer ?? null : { granted: true, policy_version: POLICY_VERSION, at: '2026-10-24T04:32:10Z' },
      ai_processing: user.onboarding_required ? given.ai_processing ?? null : { granted: true, policy_version: POLICY_VERSION, at: '2026-10-24T04:32:10Z' },
      voice_input: given.voice_input ?? null,
      notifications: given.notifications ?? null,
    },
  }
}

export async function recordConsent(consentType: string, granted: boolean): Promise<void> {
  await delay(150)
  const uid = requireAuth()
  sessionConsents[uid] = sessionConsents[uid] ?? {}
  sessionConsents[uid][consentType] = { granted, policy_version: POLICY_VERSION, at: new Date().toISOString() }
}

// --- Health (API-01) --------------------------------------------------------

export async function getHealth(): Promise<HealthResponse> {
  await delay(80)
  return { ...health, time: new Date().toISOString() }
}

// --- Patients (API-06, 07) --------------------------------------------------

function patientFor(viewerId: string, patientId: string): PatientSummary | null {
  const grant =
    db.grants[patientId]?.find((g) => g.grantee.user_id === viewerId && g.status === 'active') ??
    GRANTS.find((g) => g.patient_id === patientId && g.grantee_user_id === viewerId && g.status === 'active')
  if (!grant) return null
  const p = PATIENTS[patientId]
  if (!p) return null
  const role = 'role' in grant ? grant.role : (grant as { role: 'owner' | 'caregiver' }).role
  const scopes = 'scopes' in grant ? grant.scopes : []
  return { ...p, my_role: role, scopes }
}

export async function getPatients(): Promise<ListResponse<PatientSummary>> {
  await delay(200)
  const uid = requireAuth()
  const ids = new Set<string>()
  GRANTS.forEach((g) => {
    if (g.grantee_user_id === uid && g.status === 'active') ids.add(g.patient_id)
  })
  Object.values(db.grants).flat().forEach((g) => {
    if (g.grantee.user_id === uid && g.status === 'active') {
      const pid = Object.keys(db.grants).find((k) => db.grants[k].includes(g))
      if (pid) ids.add(pid)
    }
  })
  const items = [...ids].map((id) => patientFor(uid, id)).filter(Boolean) as PatientSummary[]
  items.sort((a, b) => (a.my_role === 'owner' ? -1 : 1) - (b.my_role === 'owner' ? -1 : 1))
  return { items, total: items.length, limit: 50, offset: 0 }
}

export async function getPatient(patientId: string): Promise<PatientSummary> {
  await delay(150)
  const ctx = requireAccess(patientId)
  const p = patientFor(ctx.userId, patientId)
  if (!p) throw apiError(404, 'NOT_FOUND', 'Profile not found.')
  return p
}

// --- Documents (API-08..16) -------------------------------------------------

export async function listDocuments(
  patientId: string,
  opts: { status?: string[]; document_type?: string[] } = {},
): Promise<ListResponse<DocumentSummary>> {
  await delay(200)
  requireAccess(patientId)
  requireScope(requireAccess(patientId), 'view_records')
  let items = [...(db.documents[patientId] ?? [])]
  if (opts.status?.length) items = items.filter((d) => opts.status!.includes(d.status))
  if (opts.document_type?.length) items = items.filter((d) => opts.document_type!.includes(d.document_type))
  return { items, total: items.length, limit: 50, offset: 0 }
}

export async function getDocument(patientId: string, documentId: string): Promise<DocumentDetailResponse> {
  await delay(180)
  requireScope(requireAccess(patientId), 'view_records')
  const detail = getDocumentDetail(patientId, documentId)
  if (!detail) throw apiError(404, 'NOT_FOUND', 'Document not found.')
  return { document: detail, facts: db.facts[documentId] ?? [] }
}

const STAGE_SEQUENCE: DocumentSummary['stage'][] = ['queued', 'reading_text', 'screening', 'extracting', 'validating', 'done']

/** Simulated upload: creates a processing doc and advances its stage on a timer. */
export async function uploadDocument(
  patientId: string,
  file: File,
  _hint?: string,
): Promise<{ document: DocumentSummary }> {
  await delay(500)
  const ctx = requireAccess(patientId)
  requireScope(ctx, 'upload_documents')

  const id = newId('doc')
  const doc: DocumentSummary = {
    id,
    patient_id: patientId,
    title: `Uploaded document · ${file.name}`,
    document_type: 'unknown',
    document_date: null,
    date_ambiguous: false,
    facility_name: null,
    clinician_name: null,
    status: 'queued',
    stage: 'queued',
    failure_code: null,
    failure_message: null,
    flags: [],
    is_sample: false,
    extraction_source: 'none',
    page_count: 1,
    fact_counts: { total: 0, unverified: 0, low_confidence: 0 },
    created_at: new Date().toISOString(),
    processed_at: null,
  }
  db.documents[patientId] = [doc, ...(db.documents[patientId] ?? [])]
  db.facts[id] = []
  // Give the uploaded file a readable "page" so the viewer isn't blank.
  db.pages[id] = [
    { line_id: 'p1-l1', text: `UPLOADED DOCUMENT — ${file.name}` },
    { line_id: 'p1-l2', text: 'SYNTHETIC DEMO — uploaded in dummy-data mode.' },
    { line_id: 'p1-l3', text: 'In the real app the AI would read this file and extract facts here.' },
  ]
  pushAudit(patientId, {
    actor: { user_id: ctx.userId, display_name: currentUser()?.display_name ?? '' },
    action: 'document.uploaded',
    action_label: 'Uploaded a document',
    resource_type: 'document',
    resource_id: id,
    outcome: 'success',
  })

  // Advance the processing stages in the background.
  let step = 1
  const tick = () => {
    const d = (db.documents[patientId] ?? []).find((x) => x.id === id)
    if (!d) return
    if (step < STAGE_SEQUENCE.length - 1) {
      d.stage = STAGE_SEQUENCE[step]
      d.status = 'processing'
      step += 1
      setTimeout(tick, 1400)
    } else {
      d.stage = 'done'
      d.status = 'needs_review'
      d.extraction_source = 'live'
      d.processed_at = new Date().toISOString()
      d.document_type = 'other'
      d.title = `Uploaded document · ${file.name}`
      // One sample unverified fact so review has something to act on.
      const f: Fact = {
        id: newId('fct'),
        document_id: id,
        fact_type: 'instruction',
        display_text: 'Document uploaded — no facts could be extracted in dummy-data mode.',
        fields: { name: 'Uploaded document (dummy-data mode)' },
        event_date: null,
        source: { page: 1, line_ids: ['p1-l2'], lines: [{ line_id: 'p1-l2', text: db.pages[id][1].text }] },
        confidence: 'medium',
        uncertainty_reasons: ['model_note'],
        status: 'unverified',
        corrected_fields: null,
        extraction_note: 'Dummy-data mode does not run real extraction.',
        reviewed_at: null,
      }
      db.facts[id] = [f]
      refreshDocumentStatus(patientId, id)
    }
  }
  setTimeout(tick, 1400)
  return { document: doc }
}

export async function reprocessDocument(patientId: string, documentId: string): Promise<{ document: DocumentSummary }> {
  await delay(300)
  requireScope(requireAccess(patientId), 'upload_documents')
  const d = (db.documents[patientId] ?? []).find((x) => x.id === documentId)
  if (!d) throw apiError(404, 'NOT_FOUND', 'Document not found.')
  d.status = 'needs_review'
  d.stage = 'done'
  return { document: d }
}

export async function deleteDocument(patientId: string, documentId: string): Promise<void> {
  await delay(300)
  requireOwner(requireAccess(patientId))
  const docs = db.documents[patientId] ?? []
  const d = docs.find((x) => x.id === documentId)
  if (!d) throw apiError(404, 'NOT_FOUND', 'Document not found.')
  if (d.status === 'queued' || d.status === 'processing') {
    throw apiError(409, 'INVALID_STATE', 'This document is still being read. Try again when it has finished.')
  }
  const factIds = new Set((db.facts[documentId] ?? []).map((f) => f.id))
  for (const r of db.reminders[patientId] ?? []) if (r.source_fact_id && factIds.has(r.source_fact_id)) r.source_fact_id = null
  db.documents[patientId] = docs.filter((x) => x.id !== documentId)
  delete db.facts[documentId]
  pushAudit(patientId, {
    actor: { user_id: getCurrentUserId()!, display_name: currentUser()?.display_name ?? '' },
    action: 'document.deleted',
    action_label: 'Deleted a document',
    resource_type: 'document',
    resource_id: documentId,
    outcome: 'success',
  })
}

export async function patchDocument(
  patientId: string,
  documentId: string,
  fields: { document_type?: string; document_date?: string; facility_name?: string; clinician_name?: string },
): Promise<{ document: DocumentSummary }> {
  await delay(200)
  requireScope(requireAccess(patientId), 'upload_documents')
  const d = (db.documents[patientId] ?? []).find((x) => x.id === documentId)
  if (!d) throw apiError(404, 'NOT_FOUND', 'Document not found.')
  if (fields.document_date) {
    if (fields.document_date > '2026-12-31') {
      throw apiError(422, 'VALIDATION_ERROR', 'Some fields need attention.', {
        fields: [{ field: 'document_date', issue: 'must not be in the future' }],
      })
    }
    d.document_date = fields.document_date
    d.date_ambiguous = false
    d.flags = d.flags.filter((f) => f !== 'date_ambiguous')
  }
  if (fields.document_type) d.document_type = fields.document_type as DocumentSummary['document_type']
  if (fields.facility_name) d.facility_name = fields.facility_name
  if (fields.clinician_name) d.clinician_name = fields.clinician_name
  return { document: d }
}

export async function patchFact(
  patientId: string,
  factId: string,
  action: 'confirm' | 'correct' | 'reject' | 'undo_reject',
  correctedFields?: Record<string, string>,
): Promise<{ fact: Fact; document: { id: string; status: string } }> {
  await delay(180)
  requireScope(requireAccess(patientId), 'upload_documents')
  const docId = Object.keys(db.facts).find((k) => db.facts[k].some((f) => f.id === factId))
  if (!docId) throw apiError(404, 'NOT_FOUND', 'Fact not found.')
  const fact = db.facts[docId].find((f) => f.id === factId)!
  switch (action) {
    case 'confirm':
      fact.status = 'confirmed'
      break
    case 'reject':
      fact.status = 'rejected'
      break
    case 'undo_reject':
      fact.status = 'unverified'
      break
    case 'correct':
      fact.status = 'corrected'
      fact.corrected_fields = correctedFields ?? {}
      if (correctedFields) {
        fact.fields = { ...fact.fields, ...correctedFields }
      }
      break
  }
  fact.reviewed_at = new Date().toISOString()
  refreshDocumentStatus(patientId, docId)
  const d = (db.documents[patientId] ?? []).find((x) => x.id === docId)!
  return { fact, document: { id: docId, status: d.status } }
}

export async function bulkReview(patientId: string, documentId: string): Promise<{ confirmed_fact_ids: string[]; remaining_unverified: number; document: { id: string; status: string } }> {
  await delay(220)
  requireScope(requireAccess(patientId), 'upload_documents')
  const facts = db.facts[documentId] ?? []
  const confirmed: string[] = []
  facts.forEach((f) => {
    if (f.status === 'unverified' && f.confidence === 'high') {
      f.status = 'confirmed'
      f.reviewed_at = new Date().toISOString()
      confirmed.push(f.id)
    }
  })
  refreshDocumentStatus(patientId, documentId)
  const d = (db.documents[patientId] ?? []).find((x) => x.id === documentId)!
  const remaining = facts.filter((f) => f.status === 'unverified').length
  return { confirmed_fact_ids: confirmed, remaining_unverified: remaining, document: { id: documentId, status: d.status } }
}

// --- Timeline (API-17) ------------------------------------------------------

export async function getTimeline(
  patientId: string,
  opts: { include_unverified?: boolean; types?: string[]; order?: 'asc' | 'desc' } = {},
): Promise<TimelineResponse> {
  await delay(200)
  requireScope(requireAccess(patientId), 'view_records')
  const base = TIMELINES[patientId] ?? TIMELINES.pat_fresh
  let groups = base.groups.map((g) => ({
    ...g,
    events: g.events.filter((e) => {
      if (opts.include_unverified === false && e.status === 'unverified') return false
      if (opts.types?.length && e.event_type !== 'document' && !opts.types.includes(e.event_type)) return false
      return true
    }),
  }))
  groups = groups.filter((g) => g.events.length > 0)
  if (opts.order === 'asc') groups = [...groups].reverse()
  return { ...base, groups }
}

// --- Brief (API-18, 19, 20) -------------------------------------------------

const sessionBriefs: Record<string, Brief> = {}

export async function createBrief(
  patientId: string,
  opts: { include_unverified?: boolean; visit_reason?: string | null } = {},
): Promise<{ brief: Brief }> {
  await delay(350)
  requireScope(requireAccess(patientId), 'view_records')
  const includeUnverified = opts.include_unverified ?? true
  const brief =
    patientId === 'pat_ravi'
      ? buildRaviBrief()
      : patientId === 'pat_meera'
        ? buildMeeraBrief(includeUnverified, opts.visit_reason ?? null)
        : emptyBrief(patientId)
  sessionBriefs[patientId] = brief
  db.briefCreated[patientId] = true
  return { brief }
}

export async function getLatestBrief(patientId: string): Promise<Brief> {
  await delay(160)
  requireScope(requireAccess(patientId), 'view_records')
  if (sessionBriefs[patientId]) return sessionBriefs[patientId]
  if (patientId === 'pat_ravi') {
    const b = buildRaviBrief()
    sessionBriefs[patientId] = b
    return b
  }
  throw apiError(404, 'NOT_FOUND', 'No brief yet.')
}

export async function generateNarrative(patientId: string, _briefId: string): Promise<{ narrative: Brief['overview']['narrative'] }> {
  await delay(1800)
  requireScope(requireAccess(patientId), 'view_records')
  if (!health.ai.available) {
    return {
      narrative: {
        output_id: newId('aio'),
        status: 'unavailable',
        statements: [],
        evidence: [],
        notices: [{ code: 'ai_unavailable', text: 'The AI summary isn’t available right now. Everything below comes directly from your documents.' }],
        templated_text: sessionBriefs[patientId]?.overview.templated_text ?? '',
        generated_at: new Date().toISOString(),
      },
    }
  }
  const narrative = patientId === 'pat_meera' ? MEERA_NARRATIVE : {
    output_id: newId('aio'),
    status: 'ready' as const,
    statements: [],
    evidence: [],
    notices: [],
    templated_text: sessionBriefs[patientId]?.overview.templated_text ?? '',
    generated_at: new Date().toISOString(),
  }
  if (sessionBriefs[patientId]) {
    sessionBriefs[patientId].overview.narrative = narrative
    sessionBriefs[patientId].overview.narrative_status = narrative.status
  }
  return { narrative }
}

function emptyBrief(patientId: string): Brief {
  const now = new Date().toISOString()
  return {
    id: newId('brf'),
    patient_id: patientId,
    created_at: now,
    created_by: { user_id: getCurrentUserId() ?? '', display_name: currentUser()?.display_name ?? '' },
    include_unverified: true,
    visit_reason: null,
    stale: false,
    header: { patient_display_name: PATIENTS[patientId]?.display_name ?? '', age_years: null, documents_count: 0, providers_count: 0, date_range: null, unverified_items_count: 0 },
    overview: { templated_text: 'No documents yet.', narrative_status: 'not_requested', narrative: null },
    sections: { medications_from: null, medications: [], other_medications_mentioned: [], conditions: [], results_over_time: [], allergies: { status: 'not_documented', items: [] }, points_to_clarify: [], missing_information: [], questions_for_doctor: [] },
    evidence: [],
    sources: [],
    disclaimer: 'MediVara organises what your documents say. It is not medical advice. Check important information with your doctor.',
  }
}

// --- Ask (API-21) -----------------------------------------------------------

export async function ask(patientId: string, question: string, _inputMode: 'text' | 'voice' = 'text'): Promise<AskResponse> {
  requireScope(requireAccess(patientId), 'view_records')
  if (!health.ai.available) {
    await delay(900)
    return degradedAnswer(patientId)
  }
  const resp = answerQuestion(patientId, question)
  // Gate responses are instant; grounded answers simulate model latency.
  await delay(resp.latency_ms < 100 ? 150 : 900)
  return resp
}

// --- Reminders (API-27..30) -------------------------------------------------

export async function listReminders(patientId: string, status: string = 'all'): Promise<ListResponse<Reminder>> {
  await delay(150)
  requireScope(requireAccess(patientId), 'view_records')
  let items = [...(db.reminders[patientId] ?? [])]
  if (status !== 'all') items = items.filter((r) => r.status === status)
  return { items, total: items.length, limit: 50, offset: 0 }
}

export async function createReminder(patientId: string, input: Partial<Reminder> & { title: string; type: Reminder['type']; schedule_kind: 'once' | 'daily'; schedule: Reminder['schedule'] }): Promise<{ reminder: Reminder }> {
  await delay(220)
  const ctx = requireAccess(patientId)
  requireScope(ctx, 'manage_reminders')
  if (input.type === 'medication' && !input.medication_schedule_attested) {
    throw apiError(422, 'VALIDATION_ERROR', 'Some fields need attention.', { fields: [{ field: 'medication_schedule_attested', issue: 'attestation required for medication reminders' }] })
  }
  const date = input.schedule.date ?? '2026-10-27'
  const time = input.schedule.time ?? '10:00'
  const reminder: Reminder = {
    id: newId('rem'),
    type: input.type,
    title: input.title,
    notes: input.notes ?? null,
    schedule_kind: input.schedule_kind,
    schedule: input.schedule,
    timezone: 'Asia/Kolkata',
    next_due_at: `${date}T04:30:00Z`,
    next_due_local: `${formatLocal(date)}, ${time} IST`,
    last_completed_at: null,
    status: 'active',
    source_fact_id: input.source_fact_id ?? null,
    medication_schedule_attested: input.medication_schedule_attested ?? false,
    created_by: { user_id: ctx.userId, display_name: currentUser()?.display_name ?? '' },
    created_at: new Date().toISOString(),
  }
  db.reminders[patientId] = [reminder, ...(db.reminders[patientId] ?? [])]
  return { reminder }
}

export async function completeReminder(patientId: string, reminderId: string): Promise<{ reminder: Reminder }> {
  await delay(160)
  requireScope(requireAccess(patientId), 'manage_reminders')
  const r = (db.reminders[patientId] ?? []).find((x) => x.id === reminderId)
  if (!r) throw apiError(404, 'NOT_FOUND', 'Reminder not found.')
  if (r.schedule_kind === 'once') r.status = 'completed'
  r.last_completed_at = new Date().toISOString()
  return { reminder: r }
}

export async function updateReminder(patientId: string, reminderId: string, patch: Partial<Reminder>): Promise<{ reminder: Reminder }> {
  await delay(160)
  requireScope(requireAccess(patientId), 'manage_reminders')
  const r = (db.reminders[patientId] ?? []).find((x) => x.id === reminderId)
  if (!r) throw apiError(404, 'NOT_FOUND', 'Reminder not found.')
  Object.assign(r, patch)
  return { reminder: r }
}

export async function getReminderSuggestions(patientId: string) {
  await delay(80)
  return REMINDER_SUGGESTIONS[patientId] ?? []
}

function formatLocal(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1]}`
}

// --- Access / family (API-23..26) ------------------------------------------

export async function listGrants(patientId: string): Promise<{ grants: Grant[] }> {
  await delay(160)
  requireOwner(requireAccess(patientId))
  return { grants: (db.grants[patientId] ?? []).filter((g) => g.status === 'active') }
}

export async function createGrant(patientId: string, email: string, scopes: string[]): Promise<{ grant: Grant }> {
  await delay(240)
  requireOwner(requireAccess(patientId))
  const target = KNOWN_EMAILS[email.trim().toLowerCase()]
  if (!target) throw apiError(404, 'USER_NOT_FOUND', 'No MediVara account uses this email.')
  const existing = (db.grants[patientId] ?? []).find((g) => g.grantee.user_id === target.user_id && g.status === 'active')
  if (existing) throw apiError(409, 'GRANT_EXISTS', 'This person already has access.')
  const grant: Grant = {
    id: newId('grt'),
    grantee: { user_id: target.user_id, display_name: target.display_name, email: email.trim().toLowerCase() },
    role: 'caregiver',
    scopes: scopes as Grant['scopes'],
    status: 'active',
    granted_at: new Date().toISOString(),
    revoked_at: null,
  }
  db.grants[patientId] = [...(db.grants[patientId] ?? []), grant]
  pushAudit(patientId, {
    actor: { user_id: getCurrentUserId()!, display_name: currentUser()?.display_name ?? '' },
    action: 'access.granted',
    action_label: `Shared records with ${target.display_name}`,
    resource_type: 'grant',
    resource_id: grant.id,
    outcome: 'success',
  })
  return { grant }
}

export async function revokeGrant(patientId: string, grantId: string): Promise<void> {
  await delay(200)
  requireOwner(requireAccess(patientId))
  const grant = (db.grants[patientId] ?? []).find((g) => g.id === grantId)
  if (!grant) throw apiError(404, 'NOT_FOUND', 'Grant not found.')
  if (grant.role === 'owner') throw apiError(409, 'INVALID_STATE', 'The owner grant cannot be removed.')
  grant.status = 'revoked'
  grant.revoked_at = new Date().toISOString()
  pushAudit(patientId, {
    actor: { user_id: getCurrentUserId()!, display_name: currentUser()?.display_name ?? '' },
    action: 'access.revoked',
    action_label: `Revoked ${grant.grantee.display_name}’s access`,
    resource_type: 'grant',
    resource_id: grant.id,
    outcome: 'success',
  })
}

export async function listAuditEvents(patientId: string): Promise<ListResponse<AuditEvent>> {
  await delay(160)
  requireOwner(requireAccess(patientId))
  const items = db.audit[patientId] ?? []
  return { items, total: items.length, limit: 50, offset: 0 }
}
