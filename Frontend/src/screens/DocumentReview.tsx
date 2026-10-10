// SCR-06 — Document viewer and extraction review (FR-016..021, FR-031, FR-040).
// Left: the original document (rendered from synthetic page text in dummy mode).
// Right: banners, document details, bulk confirm, and per-fact review actions.
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Fact } from '../api/types'
import * as api from '../api/endpoints'
import { useToast } from '../context/ToastContext'
import { Alert, Badge, Button, Card, CardBody, Dialog, Field, Input, Tabs } from '../components/ui'
import { ErrorBanner, LoadingRows } from '../components/states'
import { FlagBadge } from '../components/common'
import { cn } from '../lib/cn'
import { categoryOf } from '../lib/category'
import { COPY, PROCESSING_STAGE_LABELS } from '../lib/copy'
import { DOCUMENT_TYPE_LABELS, FACT_TYPE_LABELS, UNCERTAINTY_LABELS, formatDate } from '../lib/format'
import { IconCheck, IconEdit, IconUndo, IconWarn, IconX } from '../components/icons'

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
  }

  const factMut = useMutation({
    mutationFn: ({ factId, action, fields }: { factId: string; action: 'confirm' | 'reject' | 'undo_reject' | 'correct'; fields?: Record<string, string> }) =>
      api.patchFact(patientId, factId, action, fields),
    onSuccess: (_d, v) => {
      invalidate()
      toast(v.action === 'correct' ? 'Saved correction' : v.action === 'reject' ? 'Rejected' : v.action === 'undo_reject' ? 'Restored' : 'Confirmed')
    },
  })
  const bulkMut = useMutation({
    mutationFn: () => api.bulkReview(patientId, documentId),
    onSuccess: (r) => {
      invalidate()
      toast(`Confirmed ${r.confirmed_fact_ids.length} items`)
    },
  })
  const detailsMut = useMutation({
    mutationFn: (fields: Record<string, string>) => api.patchDocument(patientId, documentId, fields),
    onSuccess: () => {
      invalidate()
      setEditingDetails(false)
      toast('Saved')
    },
  })

  if (q.isLoading) return <LoadingRows rows={3} />
  if (q.error) return <ErrorBanner error={q.error} onRetry={q.refetch} />

  const { document: doc, facts } = q.data!
  const pageLines = doc.pages?.[0]?.lines ?? []
  const unverifiedHigh = facts.filter((f) => f.status === 'unverified' && f.confidence === 'high').length

  if (doc.status === 'processing' || doc.status === 'queued') {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-sm font-medium text-ink" role="status">
            {PROCESSING_STAGE_LABELS[doc.stage] ?? 'Processing…'}
          </p>
          <p className="mt-1 text-xs text-ink-subtle">This updates automatically.</p>
        </CardBody>
      </Card>
    )
  }

  const docPane = (
    <Card className="print-page">
      <CardBody>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">Original document</h2>
        <div className="rounded-lg border border-line bg-surface-muted p-3 font-mono text-[12px] leading-relaxed">
          {pageLines.length === 0 && <p className="text-ink-subtle">No readable text layer.</p>}
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
      {/* Banners */}
      {doc.flags.includes('suspicious_instructions') && (
        <Alert tone="danger" icon={<IconWarn />} title="Suspicious content">{COPY['COPY-13']}</Alert>
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
            <h2 className="text-sm font-semibold text-ink">Document details</h2>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => setEditingDetails(true)}>
                <IconEdit className="h-4 w-4" /> Edit
              </Button>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Detail label="Type" value={DOCUMENT_TYPE_LABELS[doc.document_type]} />
            <Detail label="Date" value={doc.document_date ? formatDate(doc.document_date) : 'Unknown'} />
            <Detail label="Facility" value={doc.facility_name ?? '—'} />
            <Detail label="Clinician" value={doc.clinician_name ?? '—'} />
          </dl>
        </CardBody>
      </Card>

      {/* Bulk confirm */}
      {canEdit && unverifiedHigh > 0 && (
        <Button loading={bulkMut.isPending} onClick={() => bulkMut.mutate()}>
          <IconCheck className="h-4 w-4" /> Confirm all high-confidence items ({unverifiedHigh})
        </Button>
      )}
      {!canEdit && (
        <Alert tone="info">You have view-only access, so you can read these facts but not change them.</Alert>
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
                    canEdit={canEdit}
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
        <Alert tone="info">Nothing could be read reliably from this document.</Alert>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/p/${patientId}/records`} className="text-sm text-brand-700 hover:underline">
            ← Records
          </Link>
          <h1 className="truncate text-lg font-semibold text-ink">{doc.title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {doc.status === 'needs_review' && <Badge tone="warn">Needs review</Badge>}
          {doc.status === 'ready' && <Badge tone="ok">Reviewed</Badge>}
          {doc.flags.map((f) => <FlagBadge key={f} flag={f} />)}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden">
        <Tabs
          tabs={[{ id: 'found', label: 'What we found' }, { id: 'document', label: 'Document' }]}
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
    <article className={cn('rounded-lg border p-3', rejected ? 'border-line bg-surface-muted opacity-70' : 'border-line bg-white')}>
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
        Show in document (page {fact.source.page})
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FactStatusBadge fact={fact} />
        {canEdit && !rejected && (
          <>
            {fact.status !== 'confirmed' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onConfirm}>
                <IconCheck className="h-4 w-4" /> Confirm
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCorrect}>
              <IconEdit className="h-4 w-4" /> Correct
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onReject}>
              <IconX className="h-4 w-4" /> Reject
            </Button>
          </>
        )}
        {canEdit && rejected && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onUndo}>
            <IconUndo className="h-4 w-4" /> Undo
          </Button>
        )}
      </div>
    </article>
  )
}

function ConfidenceBadge({ confidence }: { confidence: Fact['confidence'] }) {
  const map = { high: { tone: 'ok' as const, label: 'High' }, medium: { tone: 'warn' as const, label: 'Medium' }, low: { tone: 'danger' as const, label: 'Low' } }
  const c = map[confidence]
  return <Badge tone={c.tone}>{c.label} confidence</Badge>
}

function FactStatusBadge({ fact }: { fact: Fact }) {
  switch (fact.status) {
    case 'unverified':
      return <Badge tone="warn" title={COPY['COPY-12']}>{COPY['COPY-12-label']}</Badge>
    case 'confirmed':
      return <Badge tone="ok">Confirmed</Badge>
    case 'corrected':
      return <Badge tone="info">Corrected by you</Badge>
    case 'rejected':
      return <Badge tone="neutral">Rejected</Badge>
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
      title="Correct this item"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={() => onSave(values)}>Save</Button>
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
      title="Edit document details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={() => onSave(v)}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Date (YYYY-MM-DD)" htmlFor="d-date" hint="Setting the date clears the ambiguity flag.">
          <Input id="d-date" type="date" value={v.document_date} onChange={(e) => setV({ ...v, document_date: e.target.value })} />
        </Field>
        <Field label="Facility" htmlFor="d-fac">
          <Input id="d-fac" value={v.facility_name} onChange={(e) => setV({ ...v, facility_name: e.target.value })} />
        </Field>
        <Field label="Clinician" htmlFor="d-clin">
          <Input id="d-clin" value={v.clinician_name} onChange={(e) => setV({ ...v, clinician_name: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  )
}
