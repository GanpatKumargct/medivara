// SCR-07 — Medical timeline (FR-022). Deterministic, chronological. Change markers
// show values and dates only — never "better"/"worse" and no red/green colouring.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { TimelineChange, TimelineEvent } from '../api/types'
import * as api from '../api/endpoints'
import { Badge, Button, Card, CardBody } from '../components/ui'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { cn } from '../lib/cn'
import { formatDate, FACT_TYPE_LABELS } from '../lib/format'

const TYPE_CHIPS = [
  { id: 'medication', label: 'Medicines' },
  { id: 'lab_result', label: 'Test results' },
  { id: 'condition', label: 'Conditions' },
  { id: 'allergy', label: 'Allergies' },
  { id: 'follow_up', label: 'Follow-up' },
]

export default function Timeline() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const [types, setTypes] = useState<string[]>([])
  const [includeUnverified, setIncludeUnverified] = useState(true)
  const [order, setOrder] = useState<'desc' | 'asc'>('desc')

  const q = useQuery({
    queryKey: ['timeline', patientId, types, includeUnverified, order],
    queryFn: () => api.getTimeline(patientId, { types, include_unverified: includeUnverified, order }),
  })

  const openEvent = (e: TimelineEvent) =>
    navigate(`/p/${patientId}/records/${e.document_id}?line=${e.source.line_ids[0] ?? ''}`)

  const toggleType = (id: string) =>
    setTypes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))

  const hasEvents = q.data && (q.data.groups.length > 0 || q.data.undated.length > 0)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink">Timeline</h1>

      {/* Filters */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-2">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c.id}
              aria-pressed={types.includes(c.id)}
              onClick={() => toggleType(c.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                types.includes(c.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-muted',
              )}
            >
              {c.label}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-line" />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={includeUnverified} onChange={(e) => setIncludeUnverified(e.target.checked)} className="h-4 w-4" />
            Include unverified
          </label>
          <span className="mx-1 w-px self-stretch bg-line" />
          <Button size="sm" variant="secondary" onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}>
            {order === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
        </CardBody>
      </Card>

      {q.isLoading && <LoadingRows rows={4} />}
      {q.error && <ErrorBanner error={q.error} onRetry={q.refetch} />}

      {q.data && !hasEvents && (
        <EmptyState
          title={types.length ? 'No events match these filters' : 'Your timeline will appear after your first document is read'}
          message={types.length ? 'Try clearing the filters.' : 'Upload a document to build your history.'}
          action={types.length ? <Button variant="secondary" onClick={() => setTypes([])}>Clear filters</Button> : undefined}
        />
      )}

      {q.data && hasEvents && (
        <ol className="relative space-y-6 border-l-2 border-line pl-5">
          {q.data.groups.map((group) => (
            <li key={group.date}>
              <div className="sticky top-16 -ml-[26px] mb-2 inline-block rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
                {formatDate(group.date)}
              </div>
              <ul className="space-y-2">
                {group.events.map((e) => (
                  <li key={e.id}>
                    <EventCard event={e} onOpen={() => openEvent(e)} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {q.data.undated.length > 0 && (
            <li>
              <div className="-ml-[26px] mb-2 inline-block rounded-full bg-ink-subtle px-3 py-0.5 text-xs font-semibold text-white">
                Date unknown
              </div>
              <ul className="space-y-2">
                {q.data.undated.map((e) => (
                  <li key={e.id}><EventCard event={e} onOpen={() => openEvent(e)} /></li>
                ))}
              </ul>
            </li>
          )}
        </ol>
      )}
    </div>
  )
}

function EventCard({ event, onOpen }: { event: TimelineEvent; onOpen: () => void }) {
  const isDoc = event.event_type === 'document'
  return (
    <Card>
      <CardBody className="p-3">
        <button onClick={onOpen} className="block w-full text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{event.title}</p>
              <p className="text-xs text-ink-muted">{event.summary}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {!isDoc && <Badge tone="neutral">{FACT_TYPE_LABELS[event.event_type] ?? event.event_type}</Badge>}
              {event.status === 'unverified' && <Badge tone="warn">Unverified</Badge>}
            </div>
          </div>
          {event.change && <ChangeMarker change={event.change} />}
        </button>
      </CardBody>
    </Card>
  )
}

/** Neutral change marker: values and dates only. No evaluative words or colour. */
function ChangeMarker({ change }: { change: TimelineChange }) {
  const prev = change.kind === 'dose_change' ? change.previous.strength : `${change.previous.value} ${change.previous.unit ?? ''}`.trim()
  const cur = change.kind === 'dose_change' ? change.current.strength : `${change.current.value} ${change.current.unit ?? ''}`.trim()
  const label = change.kind === 'dose_change' ? 'Strength changed' : 'Value changed'
  return (
    <div className="mt-2 rounded-md border border-line bg-surface-muted px-2 py-1 text-xs text-ink-muted">
      {label}: <span className="font-medium text-ink">{prev}</span> ({formatDate(change.previous.date)}) →{' '}
      <span className="font-medium text-ink">{cur}</span> ({formatDate(change.current.date)})
    </div>
  )
}
