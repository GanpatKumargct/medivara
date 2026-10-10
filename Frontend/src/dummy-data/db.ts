// Tiny in-memory mutable store, seeded from the fixtures. Holds session state that
// changes while the app runs: uploaded documents, fact review status, reminders,
// grants and audit entries. Resets on page reload — there is no persistence.
import type {
  AuditEvent,
  DocumentDetail,
  DocumentSummary,
  Fact,
  Grant,
  Reminder,
} from '../api/types'
import { DOCUMENT_FACTS, DOCUMENT_PAGES, DOCUMENT_SUMMARIES } from './documents'
import { SEED_AUDIT, SEED_GRANTS } from './access'
import { SEED_REMINDERS } from './reminders'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

interface Store {
  documents: Record<string, DocumentSummary[]>
  facts: Record<string, Fact[]> // keyed by document id
  pages: typeof DOCUMENT_PAGES
  reminders: Record<string, Reminder[]>
  grants: Record<string, Grant[]>
  audit: Record<string, AuditEvent[]>
  briefCreated: Record<string, boolean> // patient id -> has a brief been created this session
}

export const db: Store = {
  documents: clone(DOCUMENT_SUMMARIES),
  facts: clone(DOCUMENT_FACTS),
  pages: DOCUMENT_PAGES, // read-only; page text never changes
  reminders: clone(SEED_REMINDERS),
  grants: clone(SEED_GRANTS),
  audit: clone(SEED_AUDIT),
  briefCreated: { pat_ravi: true },
}

let idSeq = 0
export function newId(prefix: string): string {
  idSeq += 1
  return `${prefix}_${Date.now().toString(36)}${idSeq}`
}

/** Assemble a DocumentDetail (summary + pages + facts) for API-11. */
export function getDocumentDetail(
  patientId: string,
  documentId: string,
): DocumentDetail | null {
  const sum = (db.documents[patientId] ?? []).find((d) => d.id === documentId)
  if (!sum) return null
  const pages = db.pages[documentId] ?? []
  const facts = db.facts[documentId] ?? []

  const headerLine = pages[0]?.text ?? ''
  const detail: DocumentDetail = {
    ...sum,
    original_filename: documentId.replace('doc_', '') + '.pdf',
    mime_type: 'application/pdf',
    size_bytes: 40000 + pages.length * 800,
    header_sources: {
      document_type: pages.length ? { line_ids: ['p1-l1'], text: headerLine } : null,
      document_date: null,
      facility_name: sum.facility_name ? { line_ids: ['p1-l1'], text: headerLine } : null,
      clinician_name: null,
    },
    flags_detail: buildFlagDetails(sum.flags),
    pages: [{ page: 1, lines: pages }],
  }
  return detail
}

function buildFlagDetails(flags: string[]) {
  const map: Record<string, string> = {
    suspicious_instructions:
      'This document contains text that looks like instructions to an AI system. MediVara ignored those instructions and treated the document as information only. Please check that the document is genuine.',
    date_ambiguous: 'The date 04/05/2026 was read as 04 May 2026 (day first). Please check it.',
    cached_extraction:
      'The AI service didn’t respond, so MediVara used a saved reading of this same file from earlier testing.',
  }
  return flags.filter((f) => map[f]).map((f) => ({ flag: f, text: map[f] }))
}

/** Recompute a document's fact_counts + status after a review action. */
export function refreshDocumentStatus(patientId: string, documentId: string) {
  const facts = db.facts[documentId] ?? []
  const sum = (db.documents[patientId] ?? []).find((d) => d.id === documentId)
  if (!sum) return
  const active = facts.filter((f) => f.status !== 'rejected')
  const unverified = active.filter((f) => f.status === 'unverified').length
  sum.fact_counts = {
    total: active.length,
    unverified,
    low_confidence: active.filter((f) => f.confidence === 'low').length,
  }
  if (sum.status === 'needs_review' || sum.status === 'ready') {
    sum.status = unverified > 0 ? 'needs_review' : 'ready'
  }
}

export function pushAudit(patientId: string, event: Omit<AuditEvent, 'id' | 'at'>) {
  const list = db.audit[patientId] ?? (db.audit[patientId] = [])
  list.unshift({ ...event, id: newId('aud'), at: new Date().toISOString() })
}
