// Document history (DEC-27, API-34..36): every saved version of a document, what changed in
// each, and restore. Restoring saves a new version; nothing in the history is rewritten.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { ApiError } from '../api/types'
import type { VersionItem } from '../api/types'
import { useToast } from '../context/ToastContext'
import { Badge, Button, Card, CardBody, Dialog } from './ui'
import { ErrorBanner, LoadingRows } from './states'
import { DOCUMENT_TYPE_LABELS, FACT_TYPE_LABELS, formatDate } from '../lib/format'
import { VERSION_ACTION_LABELS, actorName, describeChange, formatWhen } from '../lib/versions'
import { t } from '../lib/i18n'

const FACT_STATUS_TONE: Record<string, 'ok' | 'warn' | 'neutral' | 'danger' | 'brand'> = {
  confirmed: 'ok',
  corrected: 'brand',
  unverified: 'warn',
  rejected: 'neutral',
}
const FACT_STATUS_TEXT: Record<string, string> = {
  confirmed: t("Confirmed"),
  corrected: t("Corrected"),
  unverified: t("To review"),
  rejected: t("Rejected"),
}

export function HistoryPanel({
  patientId,
  documentId,
  canRestore,
}: {
  patientId: string
  documentId: string
  canRestore: boolean
}) {
  const [viewing, setViewing] = useState<VersionItem | null>(null)
  const q = useQuery({
    queryKey: ['history', patientId, documentId],
    queryFn: () => api.getDocumentHistory(patientId, documentId),
  })

  return (
    <Card>
      <CardBody>
        <h2 className="text-sm font-semibold text-ink">{t("History")}</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {t("Every change is saved as a version. Restoring an earlier version saves it as a new one, so nothing is lost.")}</p>
        {q.isLoading && <LoadingRows rows={2} />}
        {q.error && <ErrorBanner error={q.error} onRetry={q.refetch} />}
        {q.data && (
          <>
            {q.data.files.length > 1 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("Files")}</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {q.data.files.map((f) => (
                    <li key={f.document_id} className="flex flex-wrap items-center gap-2">
                      <span className="text-ink">{t("File")}{' '}{f.file_version}</span>
                      <span className="text-ink-subtle">· {f.original_filename} · {formatWhen(f.uploaded_at)}</span>
                      {f.is_current ? (
                        <Badge tone="ok">{t("In use")}</Badge>
                      ) : f.status === 'queued' || f.status === 'processing' ? (
                        <Badge tone="warn">{t("Being read…")}</Badge>
                      ) : f.document_id !== documentId ? (
                        <Link className="text-brand-700 underline" to={`/p/${patientId}/records/${f.document_id}`}>{t("View")}</Link>
                      ) : (
                        <Badge tone="neutral">{t("Viewing")}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ol className="mt-3 space-y-2">
              {q.data.versions.map((v) => (
                <li key={v.version_no} className="rounded-lg border border-line p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        <span className="mr-1.5 text-ink-subtle">v{v.version_no}</span>
                        {VERSION_ACTION_LABELS[v.action] ?? v.action}
                        {v.version_no === q.data.latest_version && <span className="ml-2"><Badge tone="brand">{t("Latest")}</Badge></span>}
                      </p>
                      <p className="text-xs text-ink-subtle">{actorName(v)} · {formatWhen(v.at)}</p>
                      {v.summary.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
                          {v.summary.slice(0, 4).map((c, i) => <li key={i}>{describeChange(c)}</li>)}
                          {v.summary.length > 4 && <li>{t("…and")}{' '}{v.summary.length - 4} more</li>}
                        </ul>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setViewing(v)} aria-label={t("View version {{version_no}}", { version_no: v.version_no })}>
                      {t("View")}</Button>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </CardBody>
      {viewing && q.data && (
        <VersionDialog
          patientId={patientId}
          documentId={documentId}
          version={viewing}
          isLatest={viewing.version_no === q.data.latest_version}
          canRestore={canRestore && !q.data.document.deleted_at}
          onClose={() => setViewing(null)}
        />
      )}
    </Card>
  )
}

function VersionDialog({
  patientId,
  documentId,
  version,
  isLatest,
  canRestore,
  onClose,
}: {
  patientId: string
  documentId: string
  version: VersionItem
  isLatest: boolean
  canRestore: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const q = useQuery({
    queryKey: ['version', patientId, documentId, version.version_no],
    queryFn: () => api.getDocumentVersion(patientId, documentId, version.version_no),
  })
  const restore = useMutation({
    mutationFn: () => api.restoreVersion(patientId, documentId, version.version_no),
    onSuccess: () => {
      for (const key of ['history', 'document', 'documents', 'timeline', 'latest-brief', 'patient', 'changes', 'reminders']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      toast(t("Restored version {{version_no}}", { version_no: version.version_no }))
      onClose()
    },
  })
  const state = q.data?.state

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("Version {{version_no}} · {{value}}", { version_no: version.version_no, value: VERSION_ACTION_LABELS[version.action] ?? version.action })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("Close")}</Button>
          {canRestore && !isLatest && (
            <Button loading={restore.isPending} onClick={() => restore.mutate()}>{t("Restore this version")}</Button>
          )}
        </>
      }
    >
      <p className="text-xs text-ink-subtle">{actorName(version)} · {formatWhen(version.at)} {t("· file")}{' '}{version.file_version}</p>
      {q.isLoading && <LoadingRows rows={2} />}
      {q.error && <ErrorBanner error={q.error} onRetry={q.refetch} />}
      {state && (
        <div className="mt-3 max-h-[55vh] space-y-3 overflow-y-auto">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-subtle">{t("Type")}</dt><dd className="text-ink">{DOCUMENT_TYPE_LABELS[state.header.document_type] ?? state.header.document_type}</dd>
            <dt className="text-ink-subtle">{t("Date")}</dt><dd className="text-ink">{state.header.document_date ? formatDate(state.header.document_date) : t("Unknown")}</dd>
            <dt className="text-ink-subtle">{t("Facility")}</dt><dd className="text-ink">{state.header.facility_name ?? '—'}</dd>
            <dt className="text-ink-subtle">{t("Clinician")}</dt><dd className="text-ink">{state.header.clinician_name ?? '—'}</dd>
          </dl>
          {version.summary.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("What changed")}</p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                {version.summary.map((c, i) => <li key={i}>{describeChange(c)}</li>)}
              </ul>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("Items in this version (")}{state.facts.length})</p>
            <ul className="mt-1 space-y-1">
              {state.facts.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-ink-subtle">{FACT_TYPE_LABELS[f.fact_type]}:</span>
                  <span className={f.status === 'rejected' ? "text-ink-subtle line-through" : 'text-ink'}>{f.text}</span>
                  <Badge tone={FACT_STATUS_TONE[f.status] ?? 'neutral'}>{FACT_STATUS_TEXT[f.status] ?? f.status}</Badge>
                </li>
              ))}
              {state.facts.length === 0 && <li className="text-sm text-ink-subtle">{t("No items.")}</li>}
            </ul>
          </div>
          {restore.error && (
            <p className="text-sm font-medium text-danger-fg" role="alert">
              {restore.error instanceof ApiError ? t(restore.error.message) : t("Restore failed. Try again.")}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
