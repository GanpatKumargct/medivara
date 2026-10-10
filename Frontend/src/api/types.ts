// Types mirror the MediVara API contract (docs/srd/11-api-contract.md §3 and
// the data model §3). The dummy-data layer returns objects of these exact
// shapes, so switching to the real backend needs no app-code changes.
// Every documented key is always present; unknown/not-applicable values are null.

export type Role = 'owner' | 'caregiver'
export type Scope = 'view_records' | 'upload_documents' | 'manage_reminders'

export interface UserSummary {
  id: string
  email: string
  display_name: string
  is_demo: boolean
}

export interface PatientStats {
  documents_total: number
  documents_needs_review: number
  documents_processing: number
  documents_failed: number
  upcoming_reminders: number
  latest_brief_at: string | null
}

export interface PatientSummary {
  id: string
  display_name: string
  age_years: number | null
  is_synthetic: boolean
  my_role: Role
  scopes: Scope[]
  owner_display_name: string
  stats: PatientStats
  created_at?: string
}

export type ConsentType =
  | 'terms_and_disclaimer'
  | 'ai_processing'
  | 'voice_input'
  | 'notifications'
  | 'sharing'

export interface ConsentState {
  granted: boolean
  policy_version: string
  at: string
}

export interface MeResponse {
  user: UserSummary
  owned_patient_id: string
  current_policy_version: string
  onboarding_required: boolean
  consents: Record<string, ConsentState | null>
}

export interface LoginResponse {
  token: string
  token_type: string
  expires_at: string
  user: UserSummary
}

export interface HealthResponse {
  status: string
  service: string
  contract_version: string
  demo_mode: boolean
  ai: {
    mode: 'live' | 'cache_only' | 'off'
    available: boolean
    model: string | null
  }
  time: string
}

export type DocumentType =
  | 'prescription'
  | 'lab_report'
  | 'discharge_summary'
  | 'consultation_note'
  | 'other'
  | 'unknown'

export type DocumentStatus =
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'ready'
  | 'failed'

export type DocumentStage =
  | 'queued'
  | 'reading_text'
  | 'screening'
  | 'extracting'
  | 'validating'
  | 'done'
  | 'no_text_layer'

export type DocumentFlag =
  | 'suspicious_instructions'
  | 'date_ambiguous'
  | 'date_missing'
  | 'low_text_density'
  | 'cached_extraction'
  | 'sample'
  | 'ai_transcribed'

export interface FactCounts {
  total: number
  unverified: number
  low_confidence: number
}

export interface DocumentSummary {
  id: string
  patient_id: string
  title: string
  document_type: DocumentType
  document_date: string | null
  date_ambiguous: boolean
  facility_name: string | null
  clinician_name: string | null
  status: DocumentStatus
  stage: DocumentStage
  failure_code: string | null
  failure_message: string | null
  flags: DocumentFlag[]
  is_sample: boolean
  extraction_source: 'live' | 'cache' | 'none'
  page_count: number
  fact_counts: FactCounts
  created_at: string
  processed_at: string | null
}

export type FactType =
  | 'medication'
  | 'lab_result'
  | 'condition'
  | 'allergy'
  | 'procedure'
  | 'vital_sign'
  | 'follow_up'
  | 'instruction'

export type FactStatus = 'unverified' | 'confirmed' | 'corrected' | 'rejected'
export type Confidence = 'high' | 'medium' | 'low'

export interface FactLine {
  line_id: string
  text: string
}

export interface FactSource {
  page: number
  line_ids: string[]
  lines: FactLine[]
}

export interface Fact {
  id: string
  document_id: string
  fact_type: FactType
  display_text: string
  fields: Record<string, string | null>
  event_date: string | null
  source: FactSource
  confidence: Confidence
  uncertainty_reasons: string[]
  status: FactStatus
  corrected_fields: Record<string, string> | null
  extraction_note: string | null
  reviewed_at: string | null
}

export interface HeaderSource {
  line_ids: string[]
  text: string
}

export interface FlagDetail {
  flag: string
  text: string
}

export interface DocumentPageView {
  page: number
  lines: FactLine[]
}

export interface DocumentDetail extends DocumentSummary {
  original_filename: string
  mime_type: string
  size_bytes: number
  header_sources: Record<string, HeaderSource | null>
  flags_detail: FlagDetail[]
  // Additive (not in the backend contract): full synthetic page text so the
  // dummy viewer can render the document without a real PDF. Clients ignore it.
  pages?: DocumentPageView[]
}

export interface DocumentDetailResponse {
  document: DocumentDetail
  facts: Fact[]
}

export interface ListResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// Timeline -----------------------------------------------------------------

export interface TimelineChangeSide {
  value?: string
  strength?: string
  unit?: string
  document_id: string
  date: string
}

export interface TimelineChange {
  kind: 'value_change' | 'dose_change'
  previous: TimelineChangeSide
  current: TimelineChangeSide
}

export interface TimelineEvent {
  id: string
  date: string | null
  event_type: 'document' | FactType
  title: string
  summary: string
  document_id: string
  fact_id: string | null
  status: FactStatus | null
  confidence: Confidence | null
  change: TimelineChange | null
  source: { page: number; line_ids: string[] }
}

export interface TimelineGroup {
  date: string
  events: TimelineEvent[]
}

export interface TimelineResponse {
  groups: TimelineGroup[]
  undated: TimelineEvent[]
  counts: { events: number; documents: number; unverified: number }
  generated_at: string
}

// Evidence + statements (brief, narrative, ask) ----------------------------

export interface Evidence {
  evidence_id: string
  document_id: string
  document_title: string
  document_type: DocumentType
  document_date: string | null
  page: number
  line_ids: string[]
  text: string
  fact_status: FactStatus | null
  is_user_correction: boolean
}

export type StatementKind =
  | 'record_fact'
  | 'uncertainty'
  | 'explanation'
  | 'not_found'
  | 'safety_notice'

export interface Statement {
  id: string
  kind: StatementKind
  text: string
  evidence_ids: string[]
}

export interface Notice {
  code: string
  text: string
}

// Brief --------------------------------------------------------------------

export interface BriefSectionItem {
  id: string
  text: string
  status?: FactStatus
  badges?: string[]
  evidence_ids: string[]
}

export interface BriefLabValue {
  date: string
  value: string
  unit: string
  flag_as_written: string | null
  status: FactStatus
  evidence_ids: string[]
}

export interface BriefLabRow {
  id: string
  test_name: string
  reference_range_as_written: string | null
  values: BriefLabValue[]
}

export interface BriefFinding {
  id: string
  rule_id: string
  text: string
  evidence_ids: string[]
  suggested_question: string | null
}

export type NarrativeStatus =
  | 'not_requested'
  | 'ready'
  | 'unavailable'
  | 'withheld'

export interface Narrative {
  output_id: string
  status: 'ready' | 'unavailable' | 'withheld'
  statements: Statement[]
  evidence: Evidence[]
  notices: Notice[]
  templated_text: string
  generated_at: string
}

export interface Brief {
  id: string
  patient_id: string
  created_at: string
  created_by: { user_id: string; display_name: string }
  include_unverified: boolean
  visit_reason: string | null
  stale: boolean
  header: {
    patient_display_name: string
    age_years: number | null
    documents_count: number
    providers_count: number
    date_range: { from: string; to: string }
    unverified_items_count: number
  }
  overview: {
    templated_text: string
    narrative_status: NarrativeStatus
    narrative: Narrative | null
  }
  sections: {
    medications_from: { document_id: string; title: string } | null
    medications: BriefSectionItem[]
    other_medications_mentioned: {
      id: string
      name: string
      last_seen_date: string
      evidence_ids: string[]
    }[]
    conditions: BriefSectionItem[]
    results_over_time: BriefLabRow[]
    allergies: { status: string; items: BriefSectionItem[] }
    points_to_clarify: BriefFinding[]
    missing_information: BriefFinding[]
    questions_for_doctor: string[]
  }
  evidence: Evidence[]
  sources: { document_id: string; title: string }[]
  disclaimer: string
}

// Ask ----------------------------------------------------------------------

export type AskStatus =
  | 'answered'
  | 'not_found'
  | 'advice_redirect'
  | 'emergency'
  | 'out_of_scope'
  | 'degraded'
  | 'withheld'

export interface AskResponse {
  answer_id: string
  status: AskStatus
  statements: Statement[]
  evidence: Evidence[]
  questions_for_doctor: string[]
  notices: Notice[]
  disclaimer: string
  generated_at: string
  latency_ms: number
}

// Reminders ----------------------------------------------------------------

export type ReminderType = 'appointment' | 'medication' | 'follow_up' | 'other'
export type ReminderStatus = 'active' | 'completed' | 'dismissed'

export interface Reminder {
  id: string
  type: ReminderType
  title: string
  notes: string | null
  schedule_kind: 'once' | 'daily'
  schedule: {
    date: string | null
    time: string | null
    times: string[] | null
    start_date: string | null
    end_date: string | null
  }
  timezone: string
  next_due_at: string | null
  next_due_local: string | null
  last_completed_at: string | null
  status: ReminderStatus
  source_fact_id: string | null
  medication_schedule_attested: boolean
  created_by: { user_id: string; display_name: string }
  created_at: string
}

// Access / family ----------------------------------------------------------

export interface Grant {
  id: string
  grantee: { user_id: string; display_name: string; email: string }
  role: Role
  scopes: Scope[]
  status: 'active' | 'revoked'
  granted_at: string
  revoked_at: string | null
}

export interface AuditEvent {
  id: string
  at: string
  actor: { user_id: string; display_name: string }
  action: string
  action_label: string
  resource_type: string
  resource_id: string
  outcome: 'success' | 'denied' | 'error'
}

// ISL glossary (static frontend content) -----------------------------------

export interface GlossaryTerm {
  term_id: string
  term: string
  aliases: string[]
  category:
    | 'people_places'
    | 'medicines'
    | 'tests'
    | 'conditions'
    | 'communication'
  video_provider: 'youtube' | null
  video_id: string | null
  source_name: string
  source_url: string
  usage_terms_checked: string | null
  notes: string | null
}

// Error envelope -----------------------------------------------------------

export interface ApiErrorBody {
  code: string
  message: string
  details: Record<string, unknown>
  request_id: string
}

export class ApiError extends Error {
  code: string
  status: number
  details: Record<string, unknown>
  request_id: string
  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
    this.request_id = body.request_id
  }
}
