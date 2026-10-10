// Medicines: every medicine your documents mention, grouped by name with the latest
// mention first and its source, plus your medicine reminders. MediVara lists what the
// documents say — it never advises starting, stopping or changing a medicine (COPY-06).
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import type { TimelineEvent } from '../api/types'
import { PageHeader } from '../components/page-header'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { UnverifiedBadge } from '../components/common'
import { Badge, Button, Card, CardBody } from '../components/ui'
import { IconBell, IconChevronDown, IconPill } from '../components/icons'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'
import { formatDate } from '../lib/format'

interface MedicineGroup {
  key: string
  name: string
  mentions: TimelineEvent[]
}

/** "Metformin 1000 mg" → "Metformin" (grouping only; the full text is always shown). */
function medicineName(title: string): string {
  return title.replace(/\s+\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|units?|%)\b.*$/i, '').trim() || title
}

export default function Medicines() {
  const { patientId = '' } = useParams()
  const base = `/p/${patientId}`
  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const timelineQ = useQuery({
    queryKey: ['timeline', patientId, ['medication'], true, 'desc'],
    queryFn: () => api.getTimeline(patientId, { types: ['medication'], order: 'desc' }),
  })
  const remindersQ = useQuery({ queryKey: ['reminders', patientId, 'active'], queryFn: () => api.listReminders(patientId, 'active') })
  const canRemind = !!patientQ.data && (patientQ.data.my_role === 'owner' || patientQ.data.scopes.includes('manage_reminders'))

  const { groups, docTitles } = useMemo(() => {
    const events = [...(timelineQ.data?.groups.flatMap((g) => g.events) ?? []), ...(timelineQ.data?.undated ?? [])]
    const titles: Record<string, string> = {}
    events.filter((e) => e.event_type === 'document').forEach((e) => (titles[e.document_id] = e.title))
    const map = new Map<string, MedicineGroup>()
    for (const e of events) {
      if (e.event_type !== 'medication' || e.status === 'rejected') continue
      const name = medicineName(e.title)
      const key = name.toLowerCase()
      const g = map.get(key) ?? { key, name, mentions: [] }
      g.mentions.push(e)
      map.set(key, g)
    }
    for (const g of map.values()) g.mentions.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    const list = [...map.values()].sort((a, b) => (b.mentions[0].date ?? '').localeCompare(a.mentions[0].date ?? ''))
    return { groups: list, docTitles: titles }
  }, [timelineQ.data])

  const medReminders = (remindersQ.data?.items ?? []).filter((r) => r.type === 'medication')

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconPill className="h-5 w-5" />}
        title="Medicines"
        subtitle="Every medicine your documents mention, newest first, with where it came from."
      />

      <div className="rounded-xl border border-info-border bg-info-bg px-3 py-2 text-sm text-info-fg">{COPY['COPY-06']}</div>

      {timelineQ.isLoading && <LoadingRows rows={3} />}
      {timelineQ.error && <ErrorBanner error={timelineQ.error} onRetry={timelineQ.refetch} />}
      {timelineQ.data && groups.length === 0 && (
        <EmptyState
          title="No medicines found yet"
          message="Upload a prescription or discharge summary and the medicines it lists will appear here, linked to the document."
          action={<Link to={`${base}/records`}><Button variant="secondary">Go to records</Button></Link>}
        />
      )}

      {groups.length > 0 && (
        <ul className="mv-stagger space-y-3">
          {groups.map((g) => (
            <li key={g.key}>
              <MedicineCard group={g} base={base} docTitles={docTitles} />
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><IconBell className="h-4 w-4 text-ink-muted" /> Medicine reminders</h2>
            <Link to={`${base}/reminders`} className="text-sm font-medium text-brand-700 hover:underline">
              {canRemind ? 'Manage reminders →' : 'View reminders →'}
            </Link>
          </div>
          {medReminders.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              No medicine reminders yet.{canRemind && ' Add one exactly as your doctor or pharmacist told you.'}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {medReminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                    <p className="text-xs text-ink-subtle">
                      {r.schedule_kind === 'daily' ? `Daily at ${(r.schedule.times ?? []).join(', ')}` : r.next_due_local ?? 'Once'}
                    </p>
                  </div>
                  {r.next_due_local && <Badge tone="info">Next: {r.next_due_local}</Badge>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-subtle">{COPY['COPY-23']}</p>
        </CardBody>
      </Card>
    </div>
  )
}

function MedicineCard({ group, base, docTitles }: { group: MedicineGroup; base: string; docTitles: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  const latest = group.mentions[0]
  const docs = new Set(group.mentions.map((m) => m.document_id)).size
  return (
    <Card>
      <CardBody>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IconPill className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink">{latest.title}</h3>
              {latest.status === 'unverified' && <UnverifiedBadge />}
              {latest.status === 'corrected' && <Badge tone="info">Corrected by you</Badge>}
              {latest.change?.kind === 'dose_change' && <Badge tone="warn">Strength changed</Badge>}
            </div>
            {latest.summary && <p className="mt-0.5 text-sm text-ink-muted">{latest.summary}</p>}
            <p className="mt-1 text-xs text-ink-subtle">
              Latest mention {formatDate(latest.date)} in{' '}
              <Link to={`${base}/records/${latest.document_id}`} className="font-medium text-brand-700 hover:underline">
                {docTitles[latest.document_id] ?? 'a document'}
              </Link>
              {docs > 1 && ` · mentioned in ${docs} documents`}
            </p>
            {latest.change?.kind === 'dose_change' && (
              <p className="mt-1 text-xs text-warn-fg">
                {latest.change.previous.strength} ({formatDate(latest.change.previous.date)}) → {latest.change.current.strength} ({formatDate(latest.change.current.date)}). Confirm your current dose with your doctor.
              </p>
            )}
          </div>
        </div>
        {group.mentions.length > 1 && (
          <div className="mt-3 border-t border-line pt-2">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
            >
              <IconChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
              {open ? 'Hide' : 'Show'} earlier mentions ({group.mentions.length - 1})
            </button>
            {open && (
              <ul className="mt-2 space-y-1.5">
                {group.mentions.slice(1).map((m) => (
                  <li key={m.id} className="text-xs text-ink-muted">
                    <span className="font-medium text-ink">{m.title}</span>
                    {m.summary && ` · ${m.summary}`} · {formatDate(m.date)} ·{' '}
                    <Link to={`${base}/records/${m.document_id}`} className="text-brand-700 hover:underline">
                      {docTitles[m.document_id] ?? 'source'}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
