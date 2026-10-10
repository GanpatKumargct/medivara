// SCR-04 — Overview (FR-004; the chat is now the home screen). Product showcase:
// gradient hero, data-viz stat cards, a neutral health snapshot and a rich
// recent-documents list. Controls the viewer's scopes don't allow stay hidden.
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import type { DocumentSummary, TimelineEvent } from '../api/types'
import * as api from '../api/endpoints'
import { Badge, Button, Card, CardBody } from '../components/ui'
import { ErrorBanner, LoadingRows } from '../components/states'
import { AnimatedNumber } from '../components/motion'
import { ProgressRing, Sparkline } from '../components/dataviz'
import { formatDate, formatTimestampDate, DOCUMENT_TYPE_LABELS } from '../lib/format'
import {
  IconAsk,
  IconBrief,
  IconDoc,
  IconHand,
  IconSparkle,
  IconTimeline,
  IconUpload,
  IconUsers,
} from '../components/icons'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { patientId = '' } = useParams()
  const base = `/p/${patientId}`

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const docsQ = useQuery({ queryKey: ['documents', patientId], queryFn: () => api.listDocuments(patientId) })
  const briefQ = useQuery({ queryKey: ['latest-brief', patientId], queryFn: () => api.getLatestBrief(patientId), retry: false })
  const timelineQ = useQuery({ queryKey: ['timeline', patientId, [], true, 'desc'], queryFn: () => api.getTimeline(patientId) })

  if (patientQ.isLoading) return <LoadingRows rows={3} />
  if (patientQ.error) return <ErrorBanner error={patientQ.error} onRetry={patientQ.refetch} />
  const p = patientQ.data!
  const canUpload = p.my_role === 'owner' || p.scopes.includes('upload_documents')
  const noBrief = briefQ.error instanceof ApiError && briefQ.error.code === 'NOT_FOUND'

  const docs = docsQ.data?.items ?? []
  const ready = docs.filter((d) => d.status === 'ready').length
  const reviewPct = docs.length ? Math.round((ready / docs.length) * 100) : 0
  const providers = new Set(docs.map((d) => d.facility_name).filter(Boolean)).size

  const snapshot = pickHealthSnapshot(timelineQ.data?.groups.flatMap((g) => g.events) ?? [])

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-700 to-[color:var(--mv-grad-to)] p-6 text-white shadow-pop sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-[color:var(--mv-grad-soft-to)] opacity-20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="text-sm font-medium text-brand-100/90">{greeting()}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{p.display_name}</h1>
          <p className="mt-2 max-w-xl text-sm text-brand-100/90">
            {p.stats.documents_needs_review > 0
              ? `You have ${p.stats.documents_needs_review} document${p.stats.documents_needs_review > 1 ? 's' : ''} to review and ${docs.length} on file from ${providers} provider${providers === 1 ? '' : 's'}.`
              : `${docs.length} documents on file from ${providers} provider${providers === 1 ? '' : 's'}, all reviewed.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {canUpload && (
              <Link to={`${base}/records`}>
                <button className="mv-press inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50">
                  <IconUpload className="h-4 w-4" /> Upload document
                </button>
              </Link>
            )}
            <Link to={`${base}/brief`}>
              <button className="mv-press inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25">
                <IconBrief className="h-4 w-4" /> Consultation brief
              </button>
            </Link>
            <Link to={base}>
              <button className="mv-press inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25">
                <IconAsk className="h-4 w-4" /> Ask a question
              </button>
            </Link>
            <Link to={`${base}/visit-assist`}>
              <button className="mv-press inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25">
                <IconHand className="h-4 w-4" /> Visit Card
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="mv-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<IconDoc className="h-5 w-5" />}
          label="Documents"
          value={p.stats.documents_total}
          hint={`${p.stats.documents_failed} failed · ${p.stats.documents_processing} processing`}
          to={`${base}/records`}
          grad="bg-grad-blue"
        />
        <Card accent className="mv-lift">
          <CardBody className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-muted">Review progress</p>
              <p className="mt-1 text-3xl font-bold text-brand-900"><AnimatedNumber value={reviewPct} />%</p>
              <p className="text-xs text-ink-subtle">{ready} of {docs.length} reviewed</p>
            </div>
            <ProgressRing value={reviewPct} label={`${reviewPct}%`} />
          </CardBody>
        </Card>
        <StatCard
          icon={<IconUsers className="h-5 w-5" />}
          label="Providers"
          value={providers}
          hint="across your records"
          to={`${base}/timeline`}
          grad="bg-grad-teal"
        />
        <StatCard
          icon={<IconTimeline className="h-5 w-5" />}
          label="Needs review"
          value={p.stats.documents_needs_review}
          hint={p.stats.documents_needs_review === 1 ? '1 document waiting' : 'documents waiting'}
          to={`${base}/records`}
          emphasise={p.stats.documents_needs_review > 0}
          grad="bg-grad-violet"
        />
      </div>

      {/* Lower grid: health snapshot + latest brief */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card accent className="lg:col-span-2">
          <CardBody>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <IconSparkle className="h-4 w-4 text-brand-500" /> Health snapshot
              </h2>
              <Link to={`${base}/timeline`} className="text-sm font-medium text-brand-700 hover:underline">Timeline →</Link>
            </div>
            {snapshot ? (
              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-ink-muted">{snapshot.name}</p>
                  <p className="mt-1 text-2xl font-bold text-brand-900">
                    {snapshot.current} <span className="text-base font-medium text-ink-muted">{snapshot.unit}</span>
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {snapshot.previous} {snapshot.unit} ({formatDate(snapshot.prevDate)}) → {snapshot.current} {snapshot.unit} ({formatDate(snapshot.curDate)})
                  </p>
                  <p className="mt-1 text-[11px] text-ink-subtle">Values as written on your reports. Not a medical assessment.</p>
                </div>
                <Sparkline data={snapshot.series} width={150} height={56} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">Your trends appear here once you have results on file.</p>
            )}
          </CardBody>
        </Card>

        <Card className="mv-lift">
          <CardBody>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><IconBrief className="h-4 w-4 text-brand-500" /> Latest brief</h2>
            {briefQ.isLoading ? (
              <p className="mt-3 text-sm text-ink-subtle">Loading…</p>
            ) : noBrief ? (
              <div className="mt-3">
                <p className="text-sm text-ink-muted">No brief yet.</p>
                <Link to={`${base}/brief`} className="mt-3 inline-block">
                  <Button size="sm">Create first brief</Button>
                </Link>
              </div>
            ) : briefQ.data ? (
              <div className="mt-3">
                <p className="text-lg font-semibold text-brand-900">{formatTimestampDate(briefQ.data.created_at)}</p>
                {briefQ.data.stale && <Badge tone="warn">Needs refreshing</Badge>}
                <Link to={`${base}/brief`} className="mt-3 inline-block">
                  <Button size="sm" variant="secondary">Open brief</Button>
                </Link>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {/* Recent documents */}
      {docs.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Recent documents</h2>
              <Link to={`${base}/records`} className="text-sm font-medium text-brand-700 hover:underline">View all →</Link>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link to={`${base}/records/${d.id}`} className="group flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                      <IconDoc className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink group-hover:text-brand-800">{d.title}</p>
                      <p className="truncate text-xs text-ink-subtle">
                        {DOCUMENT_TYPE_LABELS[d.document_type]} · {d.document_date ? formatDate(d.document_date) : 'Date unknown'}
                      </p>
                    </div>
                    <DocStatusPill doc={d} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
  to,
  emphasise,
  grad = 'bg-brand-gradient',
}: {
  icon: ReactNode
  label: string
  value: number
  hint: string
  to: string
  emphasise?: boolean
  grad?: string
}) {
  return (
    <Link to={to}>
      <Card accent className="mv-lift h-full">
        <CardBody>
          <div className="flex items-center gap-2 text-ink-muted">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${grad} text-white shadow-brand`}>{icon}</span>
            <span className="text-sm">{label}</span>
          </div>
          <p className={`mt-2 text-3xl font-bold ${emphasise && value > 0 ? 'text-warn-fg' : 'text-brand-900'}`}>
            <AnimatedNumber value={value} />
          </p>
          <p className="text-xs text-ink-subtle">{hint}</p>
        </CardBody>
      </Card>
    </Link>
  )
}

function DocStatusPill({ doc }: { doc: DocumentSummary }) {
  if (doc.status === 'failed') return <Badge tone="danger">Failed</Badge>
  if (doc.status === 'needs_review') return <Badge tone="warn">Review</Badge>
  if (doc.status === 'processing' || doc.status === 'queued') return <Badge tone="info">Processing</Badge>
  return <Badge tone="ok">Reviewed</Badge>
}

interface Snapshot {
  name: string
  unit: string
  previous: string
  current: string
  prevDate: string
  curDate: string
  series: number[]
}

/** Pick a lab result with a value change to show as a neutral trend. */
function pickHealthSnapshot(events: TimelineEvent[]): Snapshot | null {
  const ev = events.find((e) => e.event_type === 'lab_result' && e.change?.kind === 'value_change')
  if (!ev || !ev.change) return null
  const prev = ev.change.previous
  const cur = ev.change.current
  const pv = Number(prev.value)
  const cv = Number(cur.value)
  if (Number.isNaN(pv) || Number.isNaN(cv)) return null
  return {
    name: ev.title.replace(/\s+[\d.]+\s*%?$/, ''),
    unit: cur.unit ?? '',
    previous: prev.value ?? '',
    current: cur.value ?? '',
    prevDate: prev.date,
    curDate: cur.date,
    series: [pv, cv],
  }
}
