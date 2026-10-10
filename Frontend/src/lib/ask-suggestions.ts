// Example questions for SCR-08, built from what this profile's documents actually contain
// (timeline events), so every suggestion can be answered. Deterministic: no model call.
import type { TimelineEvent, TimelineResponse } from '../api/types'

const MAX_SUGGESTIONS = 5

/** "HbA1c (Glycated haemoglobin) 7.6 %" → "HbA1c"; "Metformin 1000 mg" → "Metformin". */
export function shortName(title: string): string {
  const name = title.split(/\s+(?=[<>≤≥]?\s*\d)/)[0].trim()
  const withoutBrackets = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  return withoutBrackets || name
}

function newestFirst(timeline: TimelineResponse): TimelineEvent[] {
  // Groups arrive oldest or newest first depending on the order asked for; sort to be sure.
  const dated = timeline.groups
    .flatMap((g) => g.events)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  return [...dated, ...timeline.undated].filter((e) => e.status !== 'rejected')
}

export function buildAskSuggestions(timeline: TimelineResponse | undefined): string[] {
  if (!timeline) return []
  const events = newestFirst(timeline)
  const of = (type: TimelineEvent['event_type']) => events.filter((e) => e.event_type === type)
  const out: string[] = []

  const labs = of('lab_result')
  if (labs.length) {
    const counts = new Map<string, number>()
    for (const l of labs) counts.set(shortName(l.title), (counts.get(shortName(l.title)) ?? 0) + 1)
    const repeated = [...counts.entries()].find(([, n]) => n > 1)?.[0]
    const latest = shortName(labs[0].title)
    out.push(`What was my most recent ${latest}?`)
    if (repeated) out.push(`How has my ${repeated} changed over time?`)
  }

  const meds = of('medication')
  if (meds.length) out.push('Which medicines are listed in my most recent document?')
  if (of('allergy').length) out.push('Do I have any allergies in my records?')
  if (of('condition').length) out.push('Which conditions are documented in my records?')
  if (of('follow_up').length) out.push('When was my follow-up advised?')
  if (of('instruction').length) out.push('What advice did my doctor write down for me?')
  if (of('procedure').length) out.push('Which procedures are mentioned in my records?')

  const picked = out.slice(0, MAX_SUGGESTIONS - (meds.length ? 1 : 0))
  // One medicine-change question shows that MediVara redirects advice to the doctor.
  if (meds.length) picked.push(`Should I stop taking ${shortName(meds[0].title).toLowerCase()}?`)
  return picked
}
