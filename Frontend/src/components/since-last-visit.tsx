// "Since your last visit" (DEC-27, API-39): what changed in this profile's documents after the
// viewer's previous sign-in, including changes made by other people with access.
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import type { ChangesResponse } from '../api/types'
import { Badge, Card, CardBody } from './ui'
import { VERSION_ACTION_LABELS, actorName, formatWhen } from '../lib/versions'
import { t } from '../lib/i18n'

const SHOWN = 5

export function SinceLastVisit({ patientId }: { patientId: string }) {
  const q = useQuery({ queryKey: ['changes', patientId], queryFn: () => api.getChanges(patientId) })
  if (!q.data) return null
  return <SinceLastVisitCard patientId={patientId} data={q.data} />
}

export function SinceLastVisitCard({ patientId, data, title = t("Since your last visit") }: {
  patientId: string
  data: ChangesResponse
  title?: string
}) {
  const base = `/p/${patientId}`
  return (
    <Card accent>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <Link to={`${base}/history`} className="text-sm font-medium text-brand-700 hover:underline">{t("Visit history →")}</Link>
        </div>
        {data.since === null ? (
          <p className="mt-2 text-sm text-ink-muted">{t("This is your first visit. Changes to the documents will show here next time.")}</p>
        ) : data.items.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{t("Nothing has changed since")}{' '}{formatWhen(data.since)}.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-subtle">
              {data.counts.changes} change{data.counts.changes === 1 ? '' : 's'} {t("to")}{' '}{data.counts.documents} {t("document")}{data.counts.documents === 1 ? '' : 's'} {t("since")}{' '}{formatWhen(data.since)}
            </p>
            <ul className="mt-3 space-y-2">
              {data.items.slice(0, SHOWN).map((item) => {
                const latest = item.changes[0]
                const people = [...new Set(item.changes.map(actorName).filter((n) => n !== 'MediVara'))]
                return (
                  <li key={item.document.series_id} className="flex items-start justify-between gap-2 rounded-lg border border-line p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {item.document.deleted ? (
                          item.document.title
                        ) : (
                          <Link to={`${base}/records/${item.document.id}?history=1`} className="hover:underline">{item.document.title}</Link>
                        )}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {VERSION_ACTION_LABELS[latest.action] ?? latest.action} · {formatWhen(latest.at)}
                        {people.length > 0 && ` · by ${people.join(', ')}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {item.document.is_new && <Badge tone="brand">{t("New")}</Badge>}
                      {item.document.deleted && <Badge tone="neutral">{t("Deleted")}</Badge>}
                      <Badge tone="neutral">{item.changes.length}</Badge>
                    </div>
                  </li>
                )
              })}
            </ul>
            {data.items.length > SHOWN && (
              <p className="mt-2 text-xs text-ink-subtle">{t("…and")}{' '}{data.items.length - SHOWN} {t("more documents")}</p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}
