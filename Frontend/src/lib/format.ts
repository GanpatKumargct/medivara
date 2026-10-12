import { currentLanguage, t } from './i18n'
// Display formatting. Dates show as `DD Mon YYYY` (month names in the interface language,
// DEC-29); times are labelled IST.
// The client never interprets clinical dates — it only formats values the API
// already parsed (FE scope boundary).

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** `2026-05-04` -> `04 May 2026`. Returns the input unchanged if not ISO date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return t("Date unknown")
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  const lang = currentLanguage().code
  const monthName =
    lang === 'en'
      ? MONTHS[Number(mo) - 1] ?? mo
      : new Intl.DateTimeFormat(`${lang}-IN`, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(Number(y), Number(mo) - 1, 15))
  return `${d} ${monthName} ${y}`
}

/** Locale tag for Intl date/time formatting in the interface language, with Western digits
 * (values must look the same as in the documents). */
export function dateLocale(): string {
  return t("{{code}}-IN-u-nu-latn", { code: currentLanguage().code })
}

/** ISO timestamp -> `DD Mon YYYY` (date part only). */
export function formatTimestampDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return formatDate(iso.slice(0, 10))
}

/** Relative file size for display. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  prescription: t("Prescription"),
  lab_report: t("Lab report"),
  discharge_summary: t("Discharge summary"),
  consultation_note: t("Consultation note"),
  other: t("Other"),
  unknown: t("Unknown type"),
}

export const FACT_TYPE_LABELS: Record<string, string> = {
  medication: t("Medicines"),
  lab_result: t("Test results"),
  condition: t("Conditions"),
  allergy: t("Allergies"),
  procedure: t("Procedures"),
  vital_sign: t("Vital signs"),
  follow_up: t("Follow-up"),
  instruction: t("Instructions"),
}

export const UNCERTAINTY_LABELS: Record<string, string> = {
  value_not_in_source: t("The value could not be matched to the source line"),
  name_not_in_source: t("The name could not be matched to the source line"),
  missing_required_field: t("A required detail is missing"),
  missing_unit: t("No unit printed"),
  missing_reference_range: t("No reference range printed"),
  unrecognised_unit: t("Unusual unit"),
  date_ambiguous: t("The date could be read two ways"),
  date_in_future: t("The date is in the future"),
  model_note: t("The reader flagged this as unclear"),
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  self: t("You"),
  spouse: t("Spouse / partner"),
  parent: t("Parent"),
  child: t("Child"),
  sibling: t("Sibling"),
  grandparent: t("Grandparent"),
  other: t("Other family"),
}

export const SCOPE_LABELS: Record<string, string> = {
  view_records: t("View records"),
  upload_documents: t("Add records"),
  manage_reminders: t("Manage reminders"),
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}

const AVATAR_TINTS = [
  'bg-brand-100 text-brand-800',
  'bg-cyan-bg text-cyan-fg',
  'bg-teal-bg text-teal-fg',
  'bg-violet-bg text-violet-fg',
  'bg-green-bg text-green-fg',
  'bg-warn-bg text-warn-fg',
]

/** Stable avatar tint per id, so each family member keeps their colour. */
export function avatarTint(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TINTS[h % AVATAR_TINTS.length]
}
