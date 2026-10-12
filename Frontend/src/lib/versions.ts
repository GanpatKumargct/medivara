// Labels for document history (DEC-27): what each version did and what changed in it.
// Values are shown exactly as stored; the client never interprets them.
import type { VersionAction, VersionChange, VersionItem } from '../api/types'
import { DOCUMENT_TYPE_LABELS, formatDate, dateLocale } from './format'
import { t } from './i18n'

export const VERSION_ACTION_LABELS: Record<VersionAction, string> = {
  existing: t("Saved before history began"),
  uploaded: t("Uploaded"),
  read: t("Read by MediVara"),
  read_again: t("Read again"),
  read_failed: t("Could not be read"),
  details_edited: t("Edited the details"),
  fact_confirmed: t("Confirmed an item"),
  fact_corrected: t("Corrected an item"),
  fact_rejected: t("Rejected an item"),
  fact_unrejected: t("Brought back a rejected item"),
  bulk_confirmed: t("Confirmed high-confidence items"),
  deleted: t("Moved to Recently deleted"),
  undeleted: t("Restored from Recently deleted"),
  restored: t("Restored an earlier version"),
  new_file_version: t("Uploaded a new file"),
  new_file_failed: t("New file could not be read"),
}

const FACT_STATUS: Record<string, string> = {
  unverified: t("to review"),
  confirmed: t("confirmed"),
  corrected: t("corrected"),
  rejected: t("rejected"),
}

const DOC_STATUS: Record<string, string> = {
  queued: t("waiting"),
  processing: t("being read"),
  needs_review: t("needs review"),
  ready: t("reviewed"),
  failed: t("could not be read"),
}

const HEADER_FIELDS: Record<string, string> = {
  document_type: t("Type"),
  document_date: t("Date"),
  document_date_text: t("Date as written"),
  facility_name: t("Facility"),
  clinician_name: t("Clinician"),
}

function show(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'document_type') return DOCUMENT_TYPE_LABELS[String(value)] ?? String(value)
  if (field === 'document_date') return formatDate(String(value))
  return String(value)
}

/** One line describing a change, e.g. "Metformin 500 mg: to review → confirmed". */
export function describeChange(c: VersionChange): string {
  switch (c.kind) {
    case 'created':
      return t('Started with {{count}} items', { count: Number(c.facts) })
    case 'file':
      return t("File version {{from}} → {{to}}", { from: c.from, to: c.to })
    case 'deleted':
      return t("Moved to Recently deleted")
    case 'undeleted':
      return t("Back from Recently deleted")
    case 'header':
      return `${HEADER_FIELDS[String(c.field)] ?? c.field}: ${show(c.from, String(c.field))} → ${show(c.to, String(c.field))}`
    case 'status':
      return t("Document {{value}} → {{value2}}", { value: DOC_STATUS[String(c.from)] ?? c.from, value2: DOC_STATUS[String(c.to)] ?? c.to })
    case 'fact_added':
      return t("Added: {{fact}}", { fact: c.fact })
    case 'fact_removed':
      return t("Removed: {{fact}}", { fact: c.fact })
    case 'fact_status':
      return `${c.fact}: ${FACT_STATUS[String(c.from)] ?? c.from} → ${FACT_STATUS[String(c.to)] ?? c.to}`
    case 'fact_corrected':
      return `${c.fact}: ${c.field} “${show(c.from)}” → “${show(c.to)}”`
    case 'facts_count':
      return t("{{from}} → {{to}} items", { from: c.from, to: c.to })
    case 'restored_from':
      return t("Restored from version {{version}}", { version: c.version })
    case 'carried_over':
      return `${c.count} review decision${c.count === 1 ? '' : 's'} carried over from the previous file`
    case 'file_failed':
      return t("File version {{file_version}} could not be read; the previous file is still used", { file_version: c.file_version })
    default:
      return c.kind
  }
}

/** "Meera Raman" / "You" / "MediVara" for automatic steps. */
export function actorName(v: VersionItem): string {
  if (!v.actor) return 'MediVara'
  return v.by_me ? 'You' : v.actor.display_name || 'Someone'
}

/** `2026-10-10T17:05:55Z` -> `10 Oct 2026, 22:35 IST`. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const parts = new Intl.DateTimeFormat(dateLocale(), {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} IST`
}
