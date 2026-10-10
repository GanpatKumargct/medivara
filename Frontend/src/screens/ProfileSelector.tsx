// SCR-03 — Profile selector and family dashboard (FR-083). Single-profile users
// skip straight to their dashboard.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { Badge, Button, Card, CardBody } from '../components/ui'
import { LoadingRows, ErrorBanner } from '../components/states'
import { SyntheticProfileBadge } from '../components/common'

const SCOPE_LABELS: Record<string, string> = {
  view_records: 'View records',
  upload_documents: 'Upload',
  manage_reminders: 'Reminders',
}

export default function ProfileSelector() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patients'],
    queryFn: api.getPatients,
  })

  useEffect(() => {
    if (data && data.items.length === 1) {
      navigate(`/p/${data.items[0].id}`, { replace: true })
    }
  }, [data, navigate])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-ink">Choose a profile</h1>
      <p className="mt-1 text-sm text-ink-muted">Open the records you want to work with.</p>

      <div className="mt-6">
        {isLoading && <LoadingRows rows={2} />}
        {error && <ErrorBanner error={error} onRetry={refetch} />}
        {data && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold text-ink">{p.display_name}</h2>
                      <SyntheticProfileBadge />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone={p.my_role === 'owner' ? 'brand' : 'info'}>
                        {p.my_role === 'owner' ? 'You' : 'Shared with you'}
                      </Badge>
                      {p.scopes.map((s) => (
                        <Badge key={s} tone="neutral">
                          {SCOPE_LABELS[s] ?? s}
                        </Badge>
                      ))}
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <dt className="text-xs text-ink-subtle">Documents</dt>
                        <dd className="font-semibold text-ink">{p.stats.documents_total}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-subtle">To review</dt>
                        <dd className="font-semibold text-ink">{p.stats.documents_needs_review}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink-subtle">Reminders</dt>
                        <dd className="font-semibold text-ink">{p.stats.upcoming_reminders}</dd>
                      </div>
                    </dl>
                    <Button className="mt-4 w-full" onClick={() => navigate(`/p/${p.id}`)}>
                      Open
                    </Button>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
