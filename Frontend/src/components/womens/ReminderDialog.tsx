// Quick reminder for women's health (period due, check-ups, scans, vaccinations,
// medicines). Uses the normal reminders API, so it appears in Reminders too. Medicine
// reminders need the COPY-24 attestation, exactly like the Reminders screen.
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/endpoints'
import type { ReminderType } from '../../api/types'
import { useToast } from '../../context/ToastContext'
import { COPY } from '../../lib/copy'
import { cn } from '../../lib/cn'
import { Button, Checkbox, Dialog, Field, Input } from '../ui'
import { todayIso } from './CycleVisuals'

export interface ReminderPreset {
  title: string
  type: ReminderType
  kind: 'once' | 'daily'
  date?: string
  time?: string
  notes?: string
}

export function ReminderDialog({ patientId, preset, onClose }: { patientId: string; preset: ReminderPreset; onClose: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const today = todayIso()
  const [title, setTitle] = useState(preset.title)
  const [kind, setKind] = useState(preset.kind)
  const [date, setDate] = useState(preset.date && preset.date >= today ? preset.date : today)
  const [time, setTime] = useState(preset.time ?? '09:00')
  const [notes, setNotes] = useState(preset.notes ?? '')
  const [attested, setAttested] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const medicine = preset.type === 'medication'

  const create = useMutation({
    mutationFn: () =>
      api.createReminder(patientId, {
        type: preset.type,
        title: title.trim(),
        notes: notes.trim() || null,
        schedule_kind: kind,
        schedule:
          kind === 'once'
            ? { date, time, times: null, start_date: null, end_date: null }
            : { date: null, time: null, times: [time], start_date: date, end_date: null },
        medication_schedule_attested: attested,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reminders', patientId] })
      toast('Reminder added')
      onClose()
    },
    onError: () => setError('Couldn’t add this reminder. Check the date and time.'),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a reminder"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} disabled={!title.trim() || !date || !time || (medicine && !attested)} onClick={() => create.mutate()}>
            Add reminder
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="What to remind you about" htmlFor="wr-title">
          <Input id="wr-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div role="radiogroup" aria-label="How often" className="inline-flex rounded-xl bg-surface-sunken p-1">
          {(['once', 'daily'] as const).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn('rounded-lg px-3 py-1 text-sm font-medium', kind === k ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}
            >
              {k === 'once' ? 'Once' : 'Every day'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={kind === 'once' ? 'Date' : 'Starting'} htmlFor="wr-date">
            <Input id="wr-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time (IST)" htmlFor="wr-time">
            <Input id="wr-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes (optional)" htmlFor="wr-notes">
          <Input id="wr-notes" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder={medicine ? 'Name and dose exactly as prescribed' : 'e.g. clinic name, what to bring'} />
        </Field>
        {medicine && <Checkbox id="wr-attest" checked={attested} onChange={setAttested} label={COPY['COPY-24']} />}
        <p className="text-xs text-ink-subtle">{COPY['COPY-23']}</p>
        {error && <p className="text-sm font-medium text-danger-fg" role="alert">{error}</p>}
      </div>
    </Dialog>
  )
}
