// Visit history (DEC-27, API-39, API-68): the viewer's sign-ins, and for any of them the documents
// as they were at that time plus everything that changed since.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { PageHeader } from '../components/page-header'
import { Badge, Card, CardBody } from '../components/ui'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { SinceLastVisitCard } from '../components/since-last-visit'
import { DOCUMENT_TYPE_LABELS, FACT_TYPE_LABELS, formatDate } from '../lib/format'
import { formatWhen } from '../lib/versions'
import { IconTimeline } from '../components/icons'
import { t } from '../lib/i18n'

export default function VisitHistory() {
  const { patientId = '' } = useParams()
  const loginsQ = useQuery({ queryKey: ['logins'], queryFn: () => api.getMyLogins() })
  const earlier = (loginsQ.data?.items ?? []).filter((l) => !l.current)
  const [picked, setPicked] = useState<string | null>(null)
  const at = picked ?? earlier[0]?.at ?? null

  const asOfQ = useQuery({
    queryKey: ['records-as-of', patientId, at],
    queryFn: () => api.getRecordsAsOf(patientId, at!),
    enabled: Boolean(at),
  })
  const changesQ = useQuery({
    queryKey: ['changes', patientId, at],
    queryFn: () => api.getChanges(patientId, at!),
    enabled: Boolean(at),
  })

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconTimeline className="h-5 w-5" />}
        title={t("Visit history")}
        subtitle={t("See the documents as they were at an earlier sign-in, and what has changed since.")}
      />
      {loginsQ.isLoading && <LoadingRows rows={2} />}
      {loginsQ.error && <ErrorBanner error={loginsQ.error} onRetry={loginsQ.refetch} />}
      {loginsQ.data && earlier.length === 0 && (
        <EmptyState title={t("No earlier sign-ins yet")} message={t("Next time you sign in, you can look back at this visit here.")} />
      )}
      {earlier.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-ink">{t("Your earlier sign-ins")}</h2>
              <ul className="mt-2 space-y-1">
                {earlier.map((l) => (
                  <li key={l.session_id}>
                    <button
                      onClick={() => setPicked(l.at)}
                      aria-pressed={l.at === at}
                      className={
                        'w-full rounded-lg px-3 py-2 text-left text-sm ' +
                        (l.at === at ? "bg-brand-50 font-medium text-brand-800 ring-1 ring-brand-200" : "text-ink hover:bg-surface-muted")
                      }
                    >
                      {formatWhen(l.at)}
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {changesQ.data && <SinceLastVisitCard patientId={patientId} data={changesQ.data} title={t("Changed since then")} />}
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-ink">{t("Documents at")}{' '}{at ? formatWhen(at) : '—'}</h2>
                {asOfQ.isLoading && <LoadingRows rows={2} />}
                {asOfQ.error && <ErrorBanner error={asOfQ.error} onRetry={asOfQ.refetch} />}
                {asOfQ.data && asOfQ.data.documents.length === 0 && (
                  <p className="mt-2 text-sm text-ink-muted">{t("There were no documents yet.")}</p>
                )}
                <ul className="mt-3 space-y-3">
                  {asOfQ.data?.documents.map((d) => (
                    <li key={d.series_id} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{d.header.title}</p>
                        <span className="text-xs text-ink-subtle">{t("version")}{' '}{d.version_no} {t("· file")}{' '}{d.file_version}</span>
                      </div>
                      <p className="text-xs text-ink-subtle">
                        {DOCUMENT_TYPE_LABELS[d.header.document_type] ?? d.header.document_type} ·{' '}
                        {d.header.document_date ? formatDate(d.header.document_date) : t("Date unknown")}
                      </p>
                      {d.facts.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-sm">
                          {d.facts.filter((f) => f.status !== 'rejected').map((f) => (
                            <li key={f.id} className="flex flex-wrap items-center gap-2">
                              <span className="text-ink-subtle">{FACT_TYPE_LABELS[f.fact_type]}:</span>
                              <span className="text-ink">{f.text}</span>
                              {f.status === 'unverified' && <Badge tone="warn">{t("To review")}</Badge>}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link to={`/p/${patientId}/records/${d.document_id}?history=1`} className="mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">
                        {t("Open its history")}</Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
