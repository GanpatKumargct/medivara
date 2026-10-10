// Display formatting. Dates show as `DD Mon YYYY`; times are labelled IST.
// The client never interprets clinical dates — it only formats values the API
// already parsed (FE scope boundary).

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** `2026-05-04` -> `04 May 2026`. Returns the input unchanged if not ISO date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Date unknown'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  const monthName = MONTHS[Number(mo) - 1] ?? mo
  return `${d} ${monthName} ${y}`
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
  prescription: 'Prescription',
  lab_report: 'Lab report',
  discharge_summary: 'Discharge summary',
  consultation_note: 'Consultation note',
  other: 'Other',
  unknown: 'Unknown type',
}

export const FACT_TYPE_LABELS: Record<string, string> = {
  medication: 'Medicines',
  lab_result: 'Test results',
  condition: 'Conditions',
  allergy: 'Allergies',
  procedure: 'Procedures',
  vital_sign: 'Vital signs',
  follow_up: 'Follow-up',
  instruction: 'Instructions',
}

export const UNCERTAINTY_LABELS: Record<string, string> = {
  value_not_in_source: 'The value could not be matched to the source line',
  name_not_in_source: 'The name could not be matched to the source line',
  missing_required_field: 'A required detail is missing',
  missing_unit: 'No unit printed',
  missing_reference_range: 'No reference range printed',
  unrecognised_unit: 'Unusual unit',
  date_ambiguous: 'The date could be read two ways',
  date_in_future: 'The date is in the future',
  model_note: 'The reader flagged this as unclear',
}
