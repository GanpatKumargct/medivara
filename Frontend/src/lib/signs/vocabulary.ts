// The signs MediVara can learn for sign-assisted questions (DEC-28), and how chosen signs
// become a question the profile's documents can answer. Signs pick a question; they are not
// translated into sentences. The vocabulary is to be confirmed with a qualified ISL signer.
import type { TimelineEvent, TimelineResponse } from '../../api/types'
import { shortName } from '../ask-suggestions'
import { t } from '../i18n'

export type SignKind = 'topic' | 'question' | 'safety' | 'control'

export interface SignWord {
  id: string
  label: string
  kind: SignKind
}

export const SIGN_VOCABULARY: SignWord[] = [
  { id: 'medicine', label: t("Medicine"), kind: 'topic' },
  { id: 'test', label: t("Test / report"), kind: 'topic' },
  { id: 'diabetes', label: t("Sugar / diabetes"), kind: 'topic' },
  { id: 'blood_pressure', label: t("Blood pressure"), kind: 'topic' },
  { id: 'allergy', label: t("Allergy"), kind: 'topic' },
  { id: 'doctor', label: t("Doctor"), kind: 'topic' },
  { id: 'hospital', label: t("Hospital"), kind: 'topic' },
  { id: 'what', label: t("What"), kind: 'question' },
  { id: 'when', label: t("When"), kind: 'question' },
  { id: 'change', label: t("Change"), kind: 'question' },
  { id: 'emergency', label: t("Emergency"), kind: 'safety' },
  { id: 'chest_pain', label: t("Chest pain"), kind: 'safety' },
  { id: 'cant_breathe', label: t("Can’t breathe"), kind: 'safety' },
  { id: 'yes', label: t("Yes"), kind: 'control' },
  { id: 'no', label: t("No"), kind: 'control' },
  { id: 'again', label: t("Again"), kind: 'control' },
]

export const SIGN_BY_ID: Record<string, SignWord> = Object.fromEntries(SIGN_VOCABULARY.map((w) => [w.id, w]))

/** What an emergency sign sends at once: phrases the safety check always treats as emergencies.
 * Kept in English on purpose (never translated): they must match the backend's emergency
 * patterns in every interface language (DEC-29). */
export const EMERGENCY_PHRASES: Record<string, string> = {
  emergency: 'This is an emergency. I need emergency help now.',
  chest_pain: 'I have chest pain.',
  cant_breathe: 'I can’t breathe.',
}

function eventsOf(timeline: TimelineResponse | undefined, type: TimelineEvent['event_type']): TimelineEvent[] {
  if (!timeline) return []
  return [...timeline.groups.flatMap((g) => g.events), ...timeline.undated]
    .filter((e) => e.event_type === type && e.status !== 'rejected')
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/**
 * Builds one question from the topic and question words the user chose, using what this
 * profile's documents contain. Returns null until a topic sign has been chosen.
 */
export function buildSignQuestion(words: string[], timeline: TimelineResponse | undefined): string | null {
  const topic = words.find((w) => SIGN_BY_ID[w]?.kind === 'topic')
  if (!topic) return null
  const change = words.includes('change')
  const when = words.includes('when')
  const labs = eventsOf(timeline, 'lab_result')
  const labNames = labs.map((l) => shortName(l.title))
  const repeated = labNames.find((name, i) => labNames.indexOf(name) !== i)

  switch (topic) {
    case 'medicine':
      return change ? t("Have my medicines changed between my documents?") : t("Which medicines are listed in my most recent document?")
    case 'test':
      if (labs.length === 0) return t("Which test results are in my records?")
      if (change) return t("How has my {{repeated}} changed over time?", { repeated: repeated ?? labNames[0] })
      return when ? t("When was my most recent {{value}} test?", { value: labNames[0] }) : t("What was my most recent {{value}}?", { value: labNames[0] })
    case 'diabetes': {
      const sugar = labNames.find((n) => /hba1c|glucose|sugar/i.test(n))
      if (sugar) return change ? t("How has my {{sugar}} changed over time?", { sugar: sugar }) : t("What was my most recent {{sugar}}?", { sugar: sugar })
      return t("What do my records say about diabetes?")
    }
    case 'blood_pressure':
      return change ? t("How has my blood pressure changed in my records?") : t("What do my records say about my blood pressure?")
    case 'allergy':
      return t("Do I have any allergies in my records?")
    case 'doctor':
      return when ? t("When was my follow-up advised?") : t("Which doctors are named in my records?")
    case 'hospital':
      return when ? t("When was I in hospital, according to my records?") : t("Which hospital stays are in my records?")
    default:
      return null
  }
}
