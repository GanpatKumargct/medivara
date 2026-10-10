// ISL health-term glossary (FR-061, data pack §7). Static content shipped with the
// frontend. video_id is null for every term in this dummy set: no ISLRTC video has
// been verified for embedding here, so every entry shows the text + dictionary-link
// fallback (COPY-18b). This keeps the honesty guarantee — we never show an
// unverified/placeholder sign video. Person C would set video_provider/video_id
// after verifying embedding terms against the official ISLRTC dictionary.
import type { GlossaryTerm } from '../api/types'

const ISL_DICTIONARY = 'https://indiansignlanguage.org/'

function term(
  term_id: string,
  display: string,
  aliases: string[],
  category: GlossaryTerm['category'],
  notes: string | null = null,
): GlossaryTerm {
  return {
    term_id,
    term: display,
    aliases,
    category,
    video_provider: null,
    video_id: null,
    source_name: 'ISLRTC — Indian Sign Language Dictionary',
    source_url: ISL_DICTIONARY,
    usage_terms_checked: null,
    notes,
  }
}

export const GLOSSARY: GlossaryTerm[] = [
  term('doctor', 'Doctor', ['physician'], 'people_places'),
  term('hospital', 'Hospital', ['clinic'], 'people_places'),
  term('medicine', 'Medicine', ['medication', 'tablet', 'drug'], 'medicines'),
  term('prescription', 'Prescription', ['rx'], 'medicines'),
  term('blood-test', 'Blood test', ['lab test', 'blood report'], 'tests'),
  term('blood-pressure', 'Blood pressure', ['bp', 'hypertension'], 'tests'),
  term('diabetes', 'Diabetes', ['sugar', 'blood sugar'], 'conditions'),
  term('thyroid', 'Thyroid', ['hypothyroidism', 'tsh'], 'conditions', 'Regional sign variants exist.'),
  term('allergy', 'Allergy', ['allergic'], 'conditions'),
  term('pain', 'Pain', ['ache', 'hurt'], 'conditions'),
  term('fever', 'Fever', ['temperature'], 'conditions'),
  term('appointment', 'Appointment', ['visit', 'booking'], 'communication'),
  term('interpreter', 'Interpreter', ['isl interpreter', 'sign interpreter'], 'communication'),
  term('help', 'Help / Emergency', ['emergency', 'urgent'], 'communication'),
  term('write', 'Write / Write down', ['writing', 'type'], 'communication'),
]
