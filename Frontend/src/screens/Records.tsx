// SCR-05 — Records: upload and processing (FR-010, FR-012, FR-013).
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import type { DocumentSummary } from '../api/types'
import * as api from '../api/endpoints'
import { Badge, Button, Card, CardBody, Dialog } from '../components/ui'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { FlagBadge, SyntheticWarning } from '../components/common'
import { PageHeader } from '../components/page-header'
import { PROCESSING_STAGE_LABELS, COPY, fill } from '../lib/copy'
import { useToast } from '../context/ToastContext'
import { DOCUMENT_TYPE_LABELS, formatDate } from '../lib/format'
import { IconDoc, IconUpload } from '../components/icons'

const STATUS_FILTERS = [
  { id: 'needs_review', label: 'Needs review' },
  { id: 'ready', label: 'Reviewed' },
  { id: 'processing', label: 'Processing' },
  { id: 'failed', label: 'Failed' },
]
const TYPE_FILTERS = [
  { id: 'prescription', label: 'Prescriptions' },
  { id: 'lab_report', label: 'Lab reports' },
  { id: 'discharge_summary', label: 'Discharge' },
  { id: 'consultation_note', label: 'Notes' },
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
    // Poll while anything is still processing.
    refetchInterval: (q) =>
      (q.state.data?.items ?? []).some((d: DocumentSummary) => d.status === 'queued' || d.status === 'processing')
        ? 2000
        : false,
  })

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
        else setUploadError(e.message)
      } else setUploadError('Upload failed. Try again.')
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
        title="Records"
        subtitle={docCount ? `${docCount} document${docCount === 1 ? '' : 's'} on file. Upload a PDF to add more.` : 'Upload prescriptions, lab reports and discharge summaries as PDFs.'}
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
              <p className="mt-2 text-sm font-medium text-ink">Drop a PDF here or choose a file</p>
              <p className="text-xs text-ink-subtle">PDF, up to 10 MB, up to 10 pages</p>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {upload.isPending && <p className="mt-2 text-sm text-ink-muted" role="status">Uploading…</p>}
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
          title={statusF.length || typeF.length ? 'No documents match these filters' : 'No documents yet'}
          message={statusF.length || typeF.length ? 'Try clearing the filters.' : 'Upload a prescription, lab report or discharge summary to get started.'}
          action={
            statusF.length || typeF.length ? (
              <Button variant="secondary" onClick={() => { setStatusF([]); setTypeF([]) }}>Clear filters</Button>
            ) : canUpload ? (
              <Button onClick={() => fileInput.current?.click()}>Upload a document</Button>
            ) : undefined
          }
        />
      )}

      {docsQ.data && docsQ.data.items.length > 0 && (
        <ul className="mv-stagger space-y-3">
          {docsQ.data.items.map((d) => (
            <li key={d.id}>
              <DocumentRow patientId={patientId} doc={d} canRetry={canUpload} canDelete={isOwner} patientName={patientQ.data?.display_name ?? ''} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-3 py-1 text-sm ' +
        (active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-muted')
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
}: {
  patientId: string
  doc: DocumentSummary
  canRetry: boolean
  canDelete: boolean
  patientName: string
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
      for (const key of ['documents', 'timeline', 'latest-brief', 'patient', 'patients', 'reminders']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      toast('Document deleted')
    },
  })

  const body = (
    <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{doc.title}</p>
        <p className="text-xs text-ink-subtle">
          {DOCUMENT_TYPE_LABELS[doc.document_type]} · {doc.document_date ? formatDate(doc.document_date) : 'Date unknown'}
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
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {doc.status === 'needs_review' && <Badge tone="warn">{doc.fact_counts.unverified} to review</Badge>}
          {doc.status === 'ready' && <Badge tone="ok">Reviewed</Badge>}
          {doc.flags.map((f) => (
            <FlagBadge key={f} flag={f} />
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {doc.status === 'failed' && doc.failure_code !== 'NO_TEXT_LAYER' && canRetry && (
          <Button size="sm" variant="secondary" loading={retry.isPending} onClick={() => retry.mutate()}>
            Try again
          </Button>
        )}
        {!processing && doc.status !== 'failed' && (
          <Link to={`/p/${patientId}/records/${doc.id}`}>
            <Button size="sm" variant="secondary">Open</Button>
          </Link>
        )}
        {canDelete && !processing && (
          <Button size="sm" variant="ghost" aria-label={`Delete ${doc.title}`} onClick={() => { remove.reset(); setConfirming(true) }}>
            Delete
          </Button>
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
          title="Delete document"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-ink">{fill(COPY['COPY-26b'], { title: doc.title, patient: patientName })}</p>
          {remove.error && (
            <p className="mt-2 text-sm font-medium text-danger-fg" role="alert">
              {remove.error instanceof ApiError ? remove.error.message : 'Delete failed. Try again.'}
            </p>
          )}
        </Dialog>
      )}
    </>
  )
}
