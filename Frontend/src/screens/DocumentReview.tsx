// SCR-06 — Document viewer and extraction review (FR-016..021, FR-031, FR-040).
// Left: the original document (rendered from synthetic page text in dummy mode).
// Right: banners, document details, bulk confirm, and per-fact review actions.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Fact } from '../api/types'
import * as api from '../api/endpoints'
import { useToast } from '../context/ToastContext'
import { Alert, Badge, Button, Card, CardBody, Dialog, Field, Input, Tabs } from '../components/ui'
import { ErrorBanner, LoadingRows } from '../components/states'
import { FlagBadge } from '../components/common'
import { HistoryPanel } from '../components/document-history'
import { ApiError } from '../api/types'
import { cn } from '../lib/cn'
import { categoryOf } from '../lib/category'
import { COPY, PROCESSING_STAGE_LABELS } from '../lib/copy'
import { DOCUMENT_TYPE_LABELS, FACT_TYPE_LABELS, UNCERTAINTY_LABELS, formatDate } from '../lib/format'
import { IconCheck, IconEdit, IconUndo, IconWarn, IconX } from '../components/icons'
import { t } from '../lib/i18n'

const FACT_ORDER: Fact['fact_type'][] = [
  'medication', 'lab_result', 'condition', 'allergy', 'procedure', 'vital_sign', 'follow_up', 'instruction',
]

export default function DocumentReview() {
  const { patientId = '', documentId = '' } = useParams()
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [highlight, setHighlight] = useState<string | null>(params.get('line'))
  const [mobileTab, setMobileTab] = useState<'document' | 'found'>('found')
  const [correcting, setCorrecting] = useState<Fact | null>(null)
  const [editingDetails, setEditingDetails] = useState(false)
  const [showHistory, setShowHistory] = useState(params.get('history') === '1')
  const [versionError, setVersionError] = useState<string | null>(null)
  const newFileInput = useRef<HTMLInputElement>(null)

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const canEdit = patientQ.data ? patientQ.data.my_role === 'owner' || patientQ.data.scopes.includes('upload_documents') : false

  const q = useQuery({
    queryKey: ['document', patientId, documentId],
    queryFn: () => api.getDocument(patientId, documentId),
  })

  useEffect(() => {
    const line = params.get('line')
    if (line) {
      setHighlight(line)
      setMobileTab('document')
    }
  }, [params])

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['document', patientId, documentId] })
    void qc.invalidateQueries({ queryKey: ['documents', patientId] })
    void qc.invalidateQueries({ queryKey: ['patient', patientId] })
    void qc.invalidateQueries({ queryKey: ['history', patientId, documentId] })
  }

  // Files of this document, to link an older file to the one in use and to notice a new
  // file that is still being read (polls until it finishes).
  const filesQ = useQuery({
    queryKey: ['history', patientId, documentId],
    queryFn: () => api.getDocumentHistory(patientId, documentId),
    refetchInterval: (query) =>
      (query.state.data?.files ?? []).some((f) => !f.is_current && (f.status === 'queued' || f.status === 'processing'))
        ? 2000
        : false,
  })
  const files = filesQ.data?.files ?? []
  const currentFile = files.find((f) => f.is_current)
  const pendingFile = files.find((f) => !f.is_current && (f.status === 'queued' || f.status === 'processing'))
  const wasPending = useRef(false)
  useEffect(() => {
    // When a new file finishes being read, refresh what this page shows.
    if (wasPending.current && !pendingFile) {
      void qc.invalidateQueries({ queryKey: ['document', patientId, documentId] })
      void qc.invalidateQueries({ queryKey: ['documents', patientId] })
    }
    wasPending.current = Boolean(pendingFile)
  }, [pendingFile, qc, patientId, documentId])

  const newVersionMut = useMutation({
    mutationFn: (file: File) => api.uploadNewVersion(patientId, documentId, file),
    onSuccess: () => {
      setVersionError(null)
      invalidate()
      toast(t("New file uploaded. It replaces this one once it has been read."))
    },
    onError: (e) => setVersionError(e instanceof ApiError ? t(e.message) : t("Upload failed. Try again.")),
  })
  function chooseNewFile(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return setVersionError(COPY['COPY-34b'])
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return setVersionError(COPY['COPY-34c'])
    newVersionMut.mutate(file)
  }

  const factMut = useMutation({
    mutationFn: ({ factId, action, fields }: { factId: string; action: 'confirm' | 'reject' | 'undo_reject' | 'correct'; fields?: Record<string, string> }) =>
      api.patchFact(patientId, factId, action, fields),
    onSuccess: (_d, v) => {
      invalidate()
      toast(v.action === 'correct' ? t("Saved correction") : v.action === 'reject' ? 'Rejected' : v.action === 'undo_reject' ? 'Restored' : 'Confirmed')
    },
  })
  const bulkMut = useMutation({
    mutationFn: () => api.bulkReview(patientId, documentId),
    onSuccess: (r) => {
      invalidate()
      toast(t("Confirmed {{length}} items", { length: r.confirmed_fact_ids.length }))
    },
  })
  const detailsMut = useMutation({
    mutationFn: (fields: Record<string, string>) => api.patchDocument(patientId, documentId, fields),
    onSuccess: () => {
      invalidate()
      setEditingDetails(false)
      toast(t("Saved"))
    },
  })

  if (q.isLoading) return <LoadingRows rows={3} />
  if (q.error) return <ErrorBanner error={q.error} onRetry={q.refetch} />

  const { document: doc, facts } = q.data!
  const pageLines = doc.pages?.[0]?.lines ?? []
  const unverifiedHigh = facts.filter((f) => f.status === 'unverified' && f.confidence === 'high').length
  const isOlderFile = doc.is_current === false
  const isDeleted = Boolean(doc.deleted_at)
  // Changes go only to the file in use, and not while the document is in Recently deleted.
  const editable = canEdit && !isOlderFile && !isDeleted

  if (doc.status === 'processing' || doc.status === 'queued') {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm font-medium text-ink" role="status">
            {PROCESSING_STAGE_LABELS[doc.stage] ?? 'Processing…'}
          </p>
          <p className="mt-1 text-xs text-ink-subtle">{t("This updates automatically.")}</p>
        </CardBody>
      </Card>
    )
  }

  const docPane = (
    <Card className="print-page">
      <CardBody>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">{t("Original document")}</h2>
        <div className="rounded-lg border border-line bg-surface-muted p-3 font-mono text-[12px] leading-relaxed">
          {pageLines.length === 0 && <p className="text-ink-subtle">{t("No readable text layer.")}</p>}
          {pageLines.map((l) => (
            <p
              key={l.line_id}
              id={`line-${l.line_id}`}
              className={cn('whitespace-pre-wrap rounded px-1', highlight === l.line_id && 'bg-brand-100 ring-1 ring-brand-300')}
            >
              {l.text}
            </p>
          ))}
        </div>
      </CardBody>
    </Card>
  )

  const reviewPane = (
    <div className="space-y-4">
      {/* Version banners (DEC-27) */}
      {isOlderFile && (
        <Alert tone="info" icon={<IconWarn />} title={t("An older file (file {{file_version}}) of this document", { file_version: doc.file_version ?? 1 })}>
          {t("It's kept in the history and can't be changed.")}{' '}
          {currentFile && (
            <Link className="font-medium underline" to={`/p/${patientId}/records/${currentFile.document_id}`}>{t("Open the file in use")}</Link>
          )}
        </Alert>
      )}
      {isDeleted && (
        <Alert tone="warn" icon={<IconWarn />} title={t("In Recently deleted")}>
          {t("This document is hidden from Records, the timeline, briefs and Ask. The owner can restore it from Records.")}</Alert>
      )}
      {pendingFile && (
        <Alert tone="info">{t("A new file (file")}{' '}{pendingFile.file_version}{t(") is being read. It replaces this one if it's read successfully.")}</Alert>
      )}
      {versionError && <Alert tone="danger">{versionError}</Alert>}
      {showHistory && <HistoryPanel patientId={patientId} documentId={documentId} canRestore={canEdit} />}

      {/* Banners */}
      {doc.flags.includes('suspicious_instructions') && (
        <Alert tone="danger" icon={<IconWarn />} title={t("Suspicious content")}>{COPY['COPY-13']}</Alert>
      )}
      {doc.flags.includes('date_ambiguous') && (
        <Alert tone="warn" icon={<IconWarn />}>
          {doc.flags_detail.find((f) => f.flag === 'date_ambiguous')?.text ?? COPY['COPY-28']}
        </Alert>
      )}
      {doc.flags.includes('cached_extraction') && (
        <Alert tone="info">{COPY['COPY-11']}</Alert>
      )}

      {/* Document details */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t("Document details")}</h2>
            {editable && (
              <Button size="sm" variant="ghost" onClick={() => setEditingDetails(true)}>
                <IconEdit className="h-4 w-4" /> {t("Edit")}</Button>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Detail label={t("Type")} value={DOCUMENT_TYPE_LABELS[doc.document_type]} />
            <Detail label={t("Date")} value={doc.document_date ? formatDate(doc.document_date) : t("Unknown")} />
            <Detail label={t("Facility")} value={doc.facility_name ?? '—'} />
            <Detail label={t("Clinician")} value={doc.clinician_name ?? '—'} />
          </dl>
        </CardBody>
      </Card>

      {/* Bulk confirm */}
      {editable && unverifiedHigh > 0 && (
        <Button loading={bulkMut.isPending} onClick={() => bulkMut.mutate()}>
          <IconCheck className="h-4 w-4" /> {t("Confirm all high-confidence items (")}{unverifiedHigh})
        </Button>
      )}
      {!canEdit && (
        <Alert tone="info">{t("You have view-only access, so you can read these facts but not change them.")}</Alert>
      )}

      {/* Facts grouped by type */}
      {FACT_ORDER.map((type) => {
        const group = facts
          .filter((f) => f.fact_type === type)
          .sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence))
        if (group.length === 0) return null
        return (
          <section key={type}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryOf(type).dot }} aria-hidden="true" />
              {FACT_TYPE_LABELS[type]}
            </h3>
            <ul className="space-y-2">
              {group.map((f) => (
                <li key={f.id}>
                  <FactCard
                    fact={f}
                    canEdit={editable}
                    busy={factMut.isPending}
                    onShow={() => { setHighlight(f.source.line_ids[0]); setMobileTab('document'); document.getElementById(`line-${f.source.line_ids[0]}`)?.scrollIntoView({ block: 'center' }) }}
                    onConfirm={() => factMut.mutate({ factId: f.id, action: 'confirm' })}
                    onReject={() => factMut.mutate({ factId: f.id, action: 'reject' })}
                    onUndo={() => factMut.mutate({ factId: f.id, action: 'undo_reject' })}
                    onCorrect={() => setCorrecting(f)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {facts.length === 0 && (
        <Alert tone="info">{t("Nothing could be read reliably from this document.")}</Alert>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/p/${patientId}/records`} className="text-sm text-brand-700 hover:underline">
            {t("← Records")}</Link>
          <h1 className="truncate text-lg font-semibold text-ink">{doc.title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button size="sm" variant={showHistory ? 'secondary' : 'ghost'} aria-pressed={showHistory} onClick={() => setShowHistory((v) => !v)}>
            {t("History")}</Button>
          {editable && !pendingFile && (
            <>
              <Button size="sm" variant="ghost" loading={newVersionMut.isPending} onClick={() => newFileInput.current?.click()}>
                {t("Upload new version")}</Button>
              <input
                ref={newFileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                aria-label={t("Choose the new file")}
                onChange={(e) => { chooseNewFile(e.target.files); e.target.value = '' }}
              />
            </>
          )}
          {doc.status === 'needs_review' && <Badge tone="warn">{t("Needs review")}</Badge>}
          {doc.status === 'ready' && <Badge tone="ok">{t("Reviewed")}</Badge>}
          {doc.flags.map((f) => <FlagBadge key={f} flag={f} />)}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden">
        <Tabs
          tabs={[{ id: 'found', label: t("What we found") }, { id: 'document', label: t("Document") }]}
          active={mobileTab}
          onChange={(id) => setMobileTab(id as 'document' | 'found')}
        />
        <div className="mt-4">{mobileTab === 'document' ? docPane : reviewPane}</div>
      </div>

      {/* Desktop two-pane */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-2">
        <div>{docPane}</div>
        <div>{reviewPane}</div>
      </div>

      {correcting && (
        <CorrectDialog
          fact={correcting}
          busy={factMut.isPending}
          onClose={() => setCorrecting(null)}
          onSave={(fields) => {
            factMut.mutate({ factId: correcting.id, action: 'correct', fields })
            setCorrecting(null)
          }}
        />
      )}

      {editingDetails && (
        <EditDetailsDialog
          current={{ document_type: doc.document_type, document_date: doc.document_date ?? '', facility_name: doc.facility_name ?? '', clinician_name: doc.clinician_name ?? '' }}
          busy={detailsMut.isPending}
          onClose={() => setEditingDetails(false)}
          onSave={(fields) => detailsMut.mutate(fields)}
        />
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

function confidenceRank(c: Fact['confidence']) {
  return c === 'low' ? 0 : c === 'medium' ? 1 : 2
}

function FactCard({
  fact,
  canEdit,
  busy,
  onShow,
  onConfirm,
  onReject,
  onUndo,
  onCorrect,
}: {
  fact: Fact
  canEdit: boolean
  busy: boolean
  onShow: () => void
  onConfirm: () => void
  onReject: () => void
  onUndo: () => void
  onCorrect: () => void
}) {
  const rejected = fact.status === 'rejected'
  return (
    <article className={cn('rounded-lg border p-3', rejected ? "border-line bg-surface-muted opacity-70" : "border-line bg-white")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{fact.display_text}</p>
        <ConfidenceBadge confidence={fact.confidence} />
      </div>

      {fact.uncertainty_reasons.length > 0 && (
        <ul className="mt-1 text-xs text-warn-fg">
          {fact.uncertainty_reasons.map((r) => (
            <li key={r}>• {UNCERTAINTY_LABELS[r] ?? r}</li>
          ))}
        </ul>
      )}

      <blockquote className="mt-2 border-l-2 border-line pl-2 font-mono text-[11px] text-ink-muted">
        {fact.source.lines[0]?.text}
      </blockquote>
      <button onClick={onShow} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
        {t("Show in document (page")}{' '}{fact.source.page})
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FactStatusBadge fact={fact} />
        {canEdit && !rejected && (
          <>
            {fact.status !== 'confirmed' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onConfirm}>
                <IconCheck className="h-4 w-4" /> {t("Confirm")}</Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCorrect}>
              <IconEdit className="h-4 w-4" /> {t("Correct")}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onReject}>
              <IconX className="h-4 w-4" /> {t("Reject")}</Button>
          </>
        )}
        {canEdit && rejected && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onUndo}>
            <IconUndo className="h-4 w-4" /> {t("Undo")}</Button>
        )}
      </div>
    </article>
  )
}

function ConfidenceBadge({ confidence }: { confidence: Fact['confidence'] }) {
  const map = { high: { tone: 'ok' as const, label: t("High") }, medium: { tone: 'warn' as const, label: t("Medium") }, low: { tone: 'danger' as const, label: t("Low") } }
  const c = map[confidence]
  return <Badge tone={c.tone}>{c.label} confidence</Badge>
}

function FactStatusBadge({ fact }: { fact: Fact }) {
  switch (fact.status) {
    case 'unverified':
      return <Badge tone="warn" title={COPY['COPY-12']}>{COPY['COPY-12-label']}</Badge>
    case 'confirmed':
      return <Badge tone="ok">{t("Confirmed")}</Badge>
    case 'corrected':
      return <Badge tone="info">{t("Corrected by you")}</Badge>
    case 'rejected':
      return <Badge tone="neutral">{t("Rejected")}</Badge>
  }
}

function CorrectDialog({ fact, busy, onClose, onSave }: { fact: Fact; busy: boolean; onClose: () => void; onSave: (fields: Record<string, string>) => void }) {
  const editableKeys = Object.keys(fact.fields).filter((k) => fact.fields[k] !== undefined)
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(editableKeys.map((k) => [k, fact.fields[k] ?? ''])),
  )
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("Correct this item")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
          <Button loading={busy} onClick={() => onSave(values)}>{t("Save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {editableKeys.map((k) => (
          <Field key={k} label={k.replace(/_/g, ' ')} htmlFor={`fld-${k}`}>
            <Input id={`fld-${k}`} value={values[k]} maxLength={200} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
          </Field>
        ))}
      </div>
    </Dialog>
  )
}

function EditDetailsDialog({ current, busy, onClose, onSave }: { current: { document_type: string; document_date: string; facility_name: string; clinician_name: string }; busy: boolean; onClose: () => void; onSave: (fields: Record<string, string>) => void }) {
  const [v, setV] = useState(current)
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("Edit document details")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
          <Button loading={busy} onClick={() => onSave(v)}>{t("Save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t("Date (YYYY-MM-DD)")} htmlFor="d-date" hint={t("Setting the date clears the ambiguity flag.")}>
          <Input id="d-date" type="date" value={v.document_date} onChange={(e) => setV({ ...v, document_date: e.target.value })} />
        </Field>
        <Field label={t("Facility")} htmlFor="d-fac">
          <Input id="d-fac" value={v.facility_name} onChange={(e) => setV({ ...v, facility_name: e.target.value })} />
        </Field>
        <Field label={t("Clinician")} htmlFor="d-clin">
          <Input id="d-clin" value={v.clinician_name} onChange={(e) => setV({ ...v, clinician_name: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  )
}
