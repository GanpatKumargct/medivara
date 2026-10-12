// SCR-05 — Records: upload and processing (FR-010, FR-012, FR-013).
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import type { ChangesResponse, DeletedDocument, DocumentSummary } from '../api/types'
import * as api from '../api/endpoints'
import { Badge, Button, Card, CardBody, Dialog } from '../components/ui'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { FlagBadge, SyntheticWarning } from '../components/common'
import { PageHeader } from '../components/page-header'
import { PROCESSING_STAGE_LABELS, COPY, fill } from '../lib/copy'
import { useToast } from '../context/ToastContext'
import { DOCUMENT_TYPE_LABELS, formatDate, formatTimestampDate } from '../lib/format'
import { IconDoc, IconUpload } from '../components/icons'
import { t } from '../lib/i18n'

const STATUS_FILTERS = [
  { id: 'needs_review', label: t("Needs review") },
  { id: 'ready', label: t("Reviewed") },
  { id: 'processing', label: t("Processing") },
  { id: 'failed', label: t("Failed") },
]
const TYPE_FILTERS = [
  { id: 'prescription', label: t("Prescriptions") },
  { id: 'lab_report', label: t("Lab reports") },
  { id: 'discharge_summary', label: t("Discharge") },
  { id: 'consultation_note', label: t("Notes") },
]

export default function Records() {
  const { patientId = '' } = useParams()
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [statusF, setStatusF] = useState<string[]>([])
  const [typeF, setTypeF] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const canUpload = patientQ.data ? patientQ.data.my_role === 'owner' || patientQ.data.scopes.includes('upload_documents') : false
  const isOwner = patientQ.data?.my_role === 'owner' // API-22 delete is owner only

  const docsQ = useQuery({
    queryKey: ['documents', patientId, statusF, typeF],
    queryFn: () => api.listDocuments(patientId, { status: statusF, document_type: typeF }),
    // Poll while anything is still processing (including a new file of an existing document).
    refetchInterval: (q) =>
      (q.state.data?.items ?? []).some(
        (d: DocumentSummary) => d.status === 'queued' || d.status === 'processing' || d.new_file_pending,
      )
        ? 2000
        : false,
  })
  // "Since your last visit" (API-39): highlight documents changed in an earlier session or by
  // someone else, not the changes made in this sign-in.
  const changesQ = useQuery({ queryKey: ['changes', patientId], queryFn: () => api.getChanges(patientId) })
  const sinceBadges = sinceLastVisit(changesQ.data)

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDocument(patientId, file),
    onSuccess: () => {
      setUploadError(null)
      void qc.invalidateQueries({ queryKey: ['documents', patientId] })
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.code === 'FILE_TOO_LARGE') setUploadError(COPY['COPY-34b'])
        else if (e.code === 'UNSUPPORTED_FILE_TYPE') setUploadError(COPY['COPY-34c'])
        else if (e.code === 'TOO_MANY_PAGES') setUploadError(COPY['COPY-34e'])
        else setUploadError(t(e.message))
      } else setUploadError(t("Upload failed. Try again."))
    },
  })

  function handleFiles(files: FileList | null) {
    if (!files || !files[0]) return
    const file = files[0]
    // Client-side checks mirroring the server (FE-3.2).
    if (file.size > 10 * 1024 * 1024) return setUploadError(COPY['COPY-34b'])
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return setUploadError(COPY['COPY-34c'])
    }
    setUploadError(null)
    upload.mutate(file)
  }

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

  const docCount = docsQ.data?.items.length ?? 0
  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconDoc className="h-5 w-5" />}
        title={t("Records")}
        subtitle={docCount ? t('{{count}} documents on file. Upload a PDF to add more.', { count: docCount }) : t("Upload prescriptions, lab reports and discharge summaries as PDFs.")}
      />

      {canUpload && (
        <Card>
          <CardBody>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFiles(e.dataTransfer.files)
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-surface-muted p-8 text-center hover:border-brand-400"
            >
              <IconUpload className="h-8 w-8 text-brand-600" />
              <p className="mt-2 text-sm font-medium text-ink">{t("Drop a PDF here or choose a file")}</p>
              <p className="text-xs text-ink-subtle">{t("PDF, up to 10 MB, up to 10 pages")}</p>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {upload.isPending && <p className="mt-2 text-sm text-ink-muted" role="status">{t("Uploading…")}</p>}
            {uploadError && (
              <p className="mt-2 text-sm font-medium text-danger-fg" role="alert">
                {uploadError}
              </p>
            )}
            <div className="mt-3">
              <SyntheticWarning />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <FilterChip key={f.id} active={statusF.includes(f.id)} onClick={() => toggle(statusF, setStatusF, f.id)}>
            {f.label}
          </FilterChip>
        ))}
        <span className="mx-1 w-px self-stretch bg-line" />
        {TYPE_FILTERS.map((f) => (
          <FilterChip key={f.id} active={typeF.includes(f.id)} onClick={() => toggle(typeF, setTypeF, f.id)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {docsQ.isLoading && <LoadingRows rows={3} />}
      {docsQ.error && <ErrorBanner error={docsQ.error} onRetry={docsQ.refetch} />}
      {docsQ.data && docsQ.data.items.length === 0 && (
        <EmptyState
          title={statusF.length || typeF.length ? t("No documents match these filters") : t("No documents yet")}
          message={statusF.length || typeF.length ? t("Try clearing the filters.") : t("Upload a prescription, lab report or discharge summary to get started.")}
          action={
            statusF.length || typeF.length ? (
              <Button variant="secondary" onClick={() => { setStatusF([]); setTypeF([]) }}>{t("Clear filters")}</Button>
            ) : canUpload ? (
              <Button onClick={() => fileInput.current?.click()}>{t("Upload a document")}</Button>
            ) : undefined
          }
        />
      )}

      {docsQ.data && docsQ.data.items.length > 0 && (
        <ul className="mv-stagger space-y-3">
          {docsQ.data.items.map((d) => (
            <li key={d.id}>
              <DocumentRow
                patientId={patientId}
                doc={d}
                canRetry={canUpload}
                canDelete={isOwner}
                patientName={patientQ.data?.display_name ?? ''}
                since={sinceBadges[d.series_id ?? d.id]}
              />
            </li>
          ))}
        </ul>
      )}

      {isOwner && <RecentlyDeleted patientId={patientId} patientName={patientQ.data?.display_name ?? ''} />}
    </div>
  )
}

function sinceLastVisit(data: ChangesResponse | undefined): Record<string, 'new' | 'updated'> {
  const out: Record<string, 'new' | 'updated'> = {}
  for (const item of data?.items ?? []) {
    const earlier = item.changes.filter((c) => !c.this_session && c.actor !== null)
    if (earlier.length === 0) continue
    out[item.document.series_id] = item.document.is_new ? 'new' : 'updated'
  }
  return out
}

function RecentlyDeleted({ patientId, patientName }: { patientId: string; patientName: string }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [purging, setPurging] = useState<DeletedDocument | null>(null)
  const q = useQuery({ queryKey: ['documents', patientId, 'deleted'], queryFn: () => api.listDeletedDocuments(patientId) })
  const refresh = () => {
    for (const key of ['documents', 'timeline', 'latest-brief', 'patient', 'patients', 'reminders', 'changes', 'history']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }
  const undelete = useMutation({
    mutationFn: (id: string) => api.undeleteDocument(patientId, id),
    onSuccess: () => { refresh(); toast(t("Document restored")) },
  })
  const purge = useMutation({
    mutationFn: (id: string) => api.deleteDocument(patientId, id, true),
    onSuccess: () => { setPurging(null); refresh(); toast(t("Deleted permanently")) },
  })
  const items = q.data?.items ?? []
  if (items.length === 0) return null

  return (
    <Card>
      <CardBody>
        <button className="flex w-full items-center justify-between text-left" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="text-sm font-semibold text-ink">{t("Recently deleted (")}{items.length})</span>
          <span className="text-xs text-ink-subtle">{open ? t("Hide") : t("Show")} {t("· kept for")}{' '}{q.data?.retention_days ?? 30} days</span>
        </button>
        {open && (
          <ul className="mt-3 divide-y divide-line">
            {items.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                  <p className="text-xs text-ink-subtle">
                    {t("Deleted")}{' '}{formatTimestampDate(d.deleted_at)}{d.deleted_by.display_name ? ` by ${d.deleted_by.display_name}` : ''} {t("· removed for good after")}{' '}{formatTimestampDate(d.purge_after)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" loading={undelete.isPending && undelete.variables === d.id} onClick={() => undelete.mutate(d.id)}>
                    {t("Restore")}</Button>
                  <Button size="sm" variant="ghost" aria-label={t("Delete {{title}} permanently", { title: d.title })} onClick={() => { purge.reset(); setPurging(d) }}>
                    {t("Delete permanently")}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {purging && (
        <Dialog
          open
          onClose={() => setPurging(null)}
          title={t("Delete permanently")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPurging(null)}>{t("Cancel")}</Button>
              <Button variant="danger" loading={purge.isPending} onClick={() => purge.mutate(purging.id)}>{t("Delete permanently")}</Button>
            </>
          }
        >
          <p className="text-sm text-ink">{fill(COPY['COPY-26c'], { title: purging.title, patient: patientName })}</p>
          {purge.error && (
            <p className="mt-2 text-sm font-medium text-danger-fg" role="alert">
              {purge.error instanceof ApiError ? t(purge.error.message) : t("Delete failed. Try again.")}
            </p>
          )}
        </Dialog>
      )}
    </Card>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-3 py-1 text-sm ' +
        (active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-muted hover:bg-surface-muted")
      }
    >
      {children}
    </button>
  )
}

function DocumentRow({
  patientId,
  doc,
  canRetry,
  canDelete,
  patientName,
  since,
}: {
  patientId: string
  doc: DocumentSummary
  canRetry: boolean
  canDelete: boolean
  patientName: string
  since?: 'new' | 'updated'
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const processing = doc.status === 'queued' || doc.status === 'processing'
  const retry = useMutation({
    mutationFn: () => api.reprocessDocument(patientId, doc.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', patientId] }),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteDocument(patientId, doc.id),
    onSuccess: () => {
      setConfirming(false)
      qc.removeQueries({ queryKey: ['document', patientId, doc.id] })
      // Everything built from documents: list, timeline, brief (now stale), stats, reminder links.
      for (const key of ['documents', 'timeline', 'latest-brief', 'patient', 'patients', 'reminders', 'changes']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      toast(t("Moved to Recently deleted"))
    },
  })

  const body = (
    <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{doc.title}</p>
        <p className="text-xs text-ink-subtle">
          {DOCUMENT_TYPE_LABELS[doc.document_type]} · {doc.document_date ? formatDate(doc.document_date) : t("Date unknown")}
          {doc.date_ambiguous && ' · date to check'}
        </p>
        {processing && (
          <div className="mt-1.5 max-w-xs">
            <p className="text-xs text-ink-muted" role="status" aria-live="polite">
              {PROCESSING_STAGE_LABELS[doc.stage] ?? 'Processing…'}
            </p>
            <div className="mv-progress mt-1" aria-hidden="true" />
          </div>
        )}
        {doc.status === 'failed' && (
          <p className="mt-1 text-xs text-danger-fg">{doc.failure_message}</p>
        )}
        {doc.new_file_pending && (
          <p className="mt-1 text-xs text-ink-muted" role="status" aria-live="polite">{t("A new file for this document is being read…")}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {doc.status === 'needs_review' && <Badge tone="warn">{doc.fact_counts.unverified} {t("to review")}</Badge>}
          {doc.status === 'ready' && <Badge tone="ok">{t("Reviewed")}</Badge>}
          {since === 'new' && <Badge tone="brand">{t("New since your last visit")}</Badge>}
          {since === 'updated' && <Badge tone="info">{t("Updated since your last visit")}</Badge>}
          {(doc.file_version ?? 1) > 1 && <Badge tone="neutral">{t("File")}{' '}{doc.file_version}</Badge>}
          {doc.flags.map((f) => (
            <FlagBadge key={f} flag={f} />
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {doc.status === 'failed' && doc.failure_code !== 'NO_TEXT_LAYER' && canRetry && (
          <Button size="sm" variant="secondary" loading={retry.isPending} onClick={() => retry.mutate()}>
            {t("Try again")}</Button>
        )}
        {!processing && doc.status !== 'failed' && (
          <Link to={`/p/${patientId}/records/${doc.id}`}>
            <Button size="sm" variant="secondary">{t("Open")}</Button>
          </Link>
        )}
        {canDelete && !processing && (
          <Button size="sm" variant="ghost" aria-label={t("Delete {{title}}", { title: doc.title })} onClick={() => { remove.reset(); setConfirming(true) }}>
            {t("Delete")}</Button>
        )}
      </div>
    </CardBody>
  )

  return (
    <>
      <Card className="mv-lift">{body}</Card>
      {confirming && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title={t("Delete document")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>{t("Cancel")}</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>{t("Delete")}</Button>
            </>
          }
        >
          <p className="text-sm text-ink">{fill(COPY['COPY-26b'], { title: doc.title, patient: patientName })}</p>
          {remove.error && (
            <p className="mt-2 text-sm font-medium text-danger-fg" role="alert">
              {remove.error instanceof ApiError ? t(remove.error.message) : t("Delete failed. Try again.")}
            </p>
          )}
        </Dialog>
      )}
    </>
  )
}
