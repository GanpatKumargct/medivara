// SCR-12 — Reminders (FR-070..074). In-app only; times labelled IST. Medication
// reminders require an attestation. MediVara never creates a reminder by itself.
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Reminder, ReminderType } from '../api/types'
import * as api from '../api/endpoints'
import { useToast } from '../context/ToastContext'
import { Alert, Badge, Button, Card, CardBody, Checkbox, Field, Input } from '../components/ui'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { COPY } from '../lib/copy'

export default function Reminders() {
  const { patientId = '' } = useParams()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [prefill, setPrefill] = useState<{ title: string; type: ReminderType; source_fact_id?: string } | null>(null)

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const canManage = patientQ.data ? patientQ.data.my_role === 'owner' || patientQ.data.scopes.includes('manage_reminders') : false

  const q = useQuery({ queryKey: ['reminders', patientId], queryFn: () => api.listReminders(patientId) })
  const suggestionsQ = useQuery({ queryKey: ['reminders', patientId, 'suggestions'], queryFn: () => api.getReminderSuggestions(patientId) })
  const suggestions = suggestionsQ.data ?? []

  const complete = useMutation({
    mutationFn: (id: string) => api.completeReminder(patientId, id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['reminders', patientId] }); toast('Marked done') },
  })
  const dismiss = useMutation({
    mutationFn: (id: string) => api.updateReminder(patientId, id, { status: 'dismissed' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['reminders', patientId] }); toast('Dismissed') },
  })

  const items = q.data?.items ?? []
  const active = items.filter((r) => r.status === 'active')
  const done = items.filter((r) => r.status !== 'active')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Reminders</h1>
        {canManage && !showForm && (
          <Button onClick={() => { setPrefill(null); setShowForm(true) }}>New reminder</Button>
        )}
      </div>

      <Alert tone="info">{COPY['COPY-23']}</Alert>

      {canManage && suggestions.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-ink">Suggested from your documents</h2>
            <ul className="mt-2 space-y-2">
              {suggestions.map((s) => (
                <li key={s.source_fact_id} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2">
                  <div>
                    <p className="text-sm text-ink">{s.title}</p>
                    <p className="text-xs text-ink-subtle">{s.document_title} · “{s.due_text}”</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => { setPrefill({ title: s.title, type: s.type, source_fact_id: s.source_fact_id }); setShowForm(true) }}>
                    Create reminder
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {showForm && canManage && (
        <ReminderForm
          patientId={patientId}
          prefill={prefill}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); void qc.invalidateQueries({ queryKey: ['reminders', patientId] }); toast('Reminder created') }}
        />
      )}

      {q.isLoading && <LoadingRows rows={2} />}
      {q.error && <ErrorBanner error={q.error} onRetry={q.refetch} />}
      {q.data && items.length === 0 && !showForm && (
        <EmptyState title="No reminders yet" message="Create one, or add a suggestion from your documents." />
      )}

      {active.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Active</h2>
          <ul className="space-y-2">
            {active.map((r) => (
              <li key={r.id}>
                <ReminderRow r={r} canManage={canManage} onDone={() => complete.mutate(r.id)} onDismiss={() => dismiss.mutate(r.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-muted">Completed / dismissed</h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.id}><ReminderRow r={r} canManage={false} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ReminderRow({ r, canManage, onDone, onDismiss }: { r: Reminder; canManage: boolean; onDone?: () => void; onDismiss?: () => void }) {
  return (
    <Card>
      <CardBody className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{r.title}</p>
          <p className="text-xs text-ink-subtle">
            {r.next_due_local ?? '—'} · <Badge tone="neutral">{r.type.replace('_', ' ')}</Badge>
            {r.source_fact_id && ' · from a document'}
          </p>
          {r.status !== 'active' && <Badge tone="ok">{r.status}</Badge>}
        </div>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={onDone}>Done</Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function ReminderForm({
  patientId,
  prefill,
  onClose,
  onCreated,
}: {
  patientId: string
  prefill: { title: string; type: ReminderType; source_fact_id?: string } | null
  onClose: () => void
  onCreated: () => void
}) {
  const [type, setType] = useState<ReminderType>(prefill?.type ?? 'follow_up')
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [date, setDate] = useState('2026-10-27')
  const [time, setTime] = useState('10:00')
  const [notes, setNotes] = useState('')
  const [attested, setAttested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () =>
      api.createReminder(patientId, {
        type,
        title,
        notes: notes || null,
        schedule_kind: 'once',
        schedule: { date, time, times: null, start_date: null, end_date: null },
        source_fact_id: prefill?.source_fact_id ?? null,
        medication_schedule_attested: attested,
      }),
    onSuccess: onCreated,
    onError: () => setError('Please check the fields and try again.'),
  })

  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">New reminder</h2>
        <Field label="Type" htmlFor="r-type">
          <select id="r-type" value={type} onChange={(e) => setType(e.target.value as ReminderType)} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
            <option value="follow_up">Follow-up</option>
            <option value="appointment">Appointment</option>
            <option value="medication">Medication</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Title" htmlFor="r-title">
          <Input id="r-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="r-date">
            <Input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time (IST · Asia/Kolkata)" htmlFor="r-time">
            <Input id="r-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)" htmlFor="r-notes">
          <Input id="r-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {type === 'medication' && (
          <div className="rounded-lg border border-line p-3">
            <Checkbox id="r-attest" checked={attested} onChange={setAttested} label={COPY['COPY-24']} />
          </div>
        )}
        {error && <p className="text-sm text-danger-fg" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} disabled={!title || (type === 'medication' && !attested)} onClick={() => create.mutate()}>
            Create
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
