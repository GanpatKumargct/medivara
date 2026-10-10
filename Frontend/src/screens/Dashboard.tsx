// SCR-04 — Patient dashboard (FR-004). Quick actions + tiles; controls the viewer's
// scopes don't allow are hidden (e.g. Upload for a view-only caregiver).
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import * as api from '../api/endpoints'
import { Badge, Button, Card, CardBody } from '../components/ui'
import { LoadingRows, ErrorBanner } from '../components/states'
import { SyntheticProfileBadge } from '../components/common'
import { formatTimestampDate } from '../lib/format'
import {
  IconAsk,
  IconBrief,
  IconDoc,
  IconHand,
  IconTimeline,
  IconUpload,
} from '../components/icons'

export default function Dashboard() {
  const { patientId = '' } = useParams()
  const base = `/p/${patientId}`

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const docsQ = useQuery({ queryKey: ['documents', patientId], queryFn: () => api.listDocuments(patientId) })
  const briefQ = useQuery({
    queryKey: ['latest-brief', patientId],
    queryFn: () => api.getLatestBrief(patientId),
    retry: false,
  })

  if (patientQ.isLoading) return <LoadingRows rows={3} />
  if (patientQ.error) return <ErrorBanner error={patientQ.error} onRetry={patientQ.refetch} />
  const p = patientQ.data!
  const canUpload = p.my_role === 'owner' || p.scopes.includes('upload_documents')

  const noBrief = briefQ.error instanceof ApiError && briefQ.error.code === 'NOT_FOUND'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-ink">{p.display_name}</h1>
        <Badge tone={p.my_role === 'owner' ? 'brand' : 'info'}>
          {p.my_role === 'owner' ? 'You' : 'Shared with you'}
        </Badge>
        <SyntheticProfileBadge />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {canUpload && (
          <Link to={`${base}/records`}>
            <Button size="sm"><IconUpload className="h-4 w-4" /> Upload</Button>
          </Link>
        )}
        <Link to={`${base}/timeline`}>
          <Button size="sm" variant="secondary"><IconTimeline className="h-4 w-4" /> Timeline</Button>
        </Link>
        <Link to={`${base}/ask`}>
          <Button size="sm" variant="secondary"><IconAsk className="h-4 w-4" /> Ask</Button>
        </Link>
        <Link to={`${base}/brief`}>
          <Button size="sm" variant="secondary"><IconBrief className="h-4 w-4" /> Create brief</Button>
        </Link>
        <Link to={`${base}/visit-assist`}>
          <Button size="sm" variant="secondary"><IconHand className="h-4 w-4" /> Visit Card</Button>
        </Link>
      </div>

      {/* Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 text-ink-muted"><IconDoc /> <span className="text-sm">Documents</span></div>
            <p className="mt-2 text-3xl font-bold text-ink">{p.stats.documents_total}</p>
            <p className="text-sm text-ink-subtle">
              {p.stats.documents_processing} processing · {p.stats.documents_failed} failed
            </p>
            <Link to={`${base}/records`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
              View records →
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2 text-ink-muted"><IconDoc /> <span className="text-sm">Needs review</span></div>
            <p className="mt-2 text-3xl font-bold text-ink">{p.stats.documents_needs_review}</p>
            <p className="text-sm text-ink-subtle">
              {p.stats.documents_needs_review === 1 ? '1 document needs review' : `${p.stats.documents_needs_review} documents need review`}
            </p>
            <Link to={`${base}/records`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
              Review now →
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-2 text-ink-muted"><IconBrief /> <span className="text-sm">Latest brief</span></div>
            {briefQ.isLoading ? (
              <p className="mt-2 text-sm text-ink-subtle">Loading…</p>
            ) : noBrief ? (
              <>
                <p className="mt-2 text-sm text-ink-muted">No brief yet.</p>
                <Link to={`${base}/brief`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
                  Create your first brief →
                </Link>
              </>
            ) : briefQ.data ? (
              <>
                <p className="mt-2 text-lg font-semibold text-ink">{formatTimestampDate(briefQ.data.created_at)}</p>
                {briefQ.data.stale && <Badge tone="warn">Needs refreshing</Badge>}
                <Link to={`${base}/brief`} className="mt-3 block text-sm font-medium text-brand-700 hover:underline">
                  Open brief →
                </Link>
              </>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {docsQ.data && docsQ.data.items.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-ink">Recent documents</h2>
            <ul className="mt-2 divide-y divide-line">
              {docsQ.data.items.slice(0, 5).map((d) => (
                <li key={d.id} className="py-2">
                  <Link to={`${base}/records/${d.id}`} className="flex items-center justify-between gap-3 text-sm hover:underline">
                    <span className="truncate text-ink">{d.title}</span>
                    <Badge tone={d.status === 'needs_review' ? 'warn' : d.status === 'failed' ? 'danger' : 'ok'}>
                      {d.status === 'needs_review' ? 'Review' : d.status === 'failed' ? 'Failed' : 'Reviewed'}
                    </Badge>
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
