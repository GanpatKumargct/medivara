// Women's health: period tracking, pregnancy and after-birth (postpartum) modes, each
// with reminders. All numbers (cycle day, next period, pregnancy week) are calculated by
// the backend from dates the user enters — estimates, never medical advice (COPY-43).
// Safety notes point to 108 / Tele-MANAS for urgent problems (COPY-44, COPY-45).
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { ApiError } from '../api/types'
import type { Period, PeriodFlow, PeriodSymptom, WomensHealth as WH, WomensHealthMode, WomensHealthSettingsInput } from '../api/types'
import { useToast } from '../context/ToastContext'
import { PageHeader } from '../components/page-header'
import { ErrorBanner, LoadingRows } from '../components/states'
import { Alert, Badge, Button, Card, CardBody, Dialog, Field, Input } from '../components/ui'
import { AddFamilyMemberDialog } from '../components/family/AddFamilyMemberDialog'
import { CycleCalendar, CycleRing, shortDate, todayIso } from '../components/womens/CycleVisuals'
import { ReminderDialog, type ReminderPreset } from '../components/womens/ReminderDialog'
import { IconBaby, IconBell, IconCalendar, IconFlower, IconHeartPulse, IconPlus, IconTrash, IconWarn } from '../components/icons'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'
import { formatDate } from '../lib/format'

const SYMPTOMS: { id: PeriodSymptom; label: string }[] = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'bloating', label: 'Bloating' },
  { id: 'mood_changes', label: 'Mood changes' },
  { id: 'fatigue', label: 'Tiredness' },
  { id: 'acne', label: 'Acne' },
  { id: 'back_pain', label: 'Back pain' },
  { id: 'tender_breasts', label: 'Tender breasts' },
  { id: 'nausea', label: 'Nausea' },
]
const FLOW_LABEL: Record<PeriodFlow, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy' }
const MODES: { id: Exclude<WomensHealthMode, 'off'>; label: string; icon: ReactNode }[] = [
  { id: 'cycle', label: 'Periods', icon: <IconFlower className="h-4 w-4" /> },
  { id: 'pregnancy', label: 'Pregnancy', icon: <IconHeartPulse className="h-4 w-4" /> },
  { id: 'postpartum', label: 'After birth', icon: <IconBaby className="h-4 w-4" /> },
]

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const addDays = (s: string, n: number) => new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10)

function settings(wh: WH, patch: Partial<WomensHealthSettingsInput>): WomensHealthSettingsInput {
  return {
    mode: wh.mode,
    cycle_length_days: wh.cycle_length_days,
    period_length_days: wh.period_length_days,
    lmp_date: wh.lmp_date,
    due_date: wh.due_date,
    delivery_date: wh.delivery_date,
    ...patch,
  }
}

export default function WomensHealth() {
  const { patientId = '' } = useParams()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [setup, setSetup] = useState<'pregnancy' | 'postpartum' | null>(null)
  const [logStart, setLogStart] = useState<string | null>(null)
  const [preset, setPreset] = useState<ReminderPreset | null>(null)
  const [addingBaby, setAddingBaby] = useState(false)

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const whQ = useQuery({ queryKey: ['womens-health', patientId], queryFn: () => api.getWomensHealth(patientId) })
  const periodsQ = useQuery({ queryKey: ['periods', patientId], queryFn: () => api.listPeriods(patientId) })
  const p = patientQ.data
  const canWrite = !!p && (p.my_role === 'owner' || p.scopes.includes('upload_documents'))
  const canRemind = !!p && (p.my_role === 'owner' || p.scopes.includes('manage_reminders'))

  const save = useMutation({
    mutationFn: (input: WomensHealthSettingsInput) => api.updateWomensHealth(patientId, input),
    onSuccess: (wh) => {
      qc.setQueryData(['womens-health', patientId], wh)
      setSetup(null)
    },
    onError: () => toast('Couldn’t save. Check the dates and try again.', 'error'),
  })

  if (whQ.isLoading || patientQ.isLoading) return <LoadingRows rows={3} />
  if (whQ.error) return <ErrorBanner error={whQ.error} onRetry={whQ.refetch} />
  const wh = whQ.data!
  const periods = periodsQ.data?.items ?? []

  function chooseMode(mode: WomensHealthMode) {
    if (!canWrite || mode === wh.mode) return
    if (mode === 'pregnancy' && !wh.lmp_date && !wh.due_date) return setSetup('pregnancy')
    if (mode === 'postpartum' && !wh.delivery_date) return setSetup('postpartum')
    save.mutate(settings(wh, { mode }))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        icon={<IconFlower className="h-5 w-5" />}
        title="Women’s health"
        subtitle={`Periods, pregnancy and life after birth for ${p?.display_name ?? 'this profile'} — with reminders.`}
        actions={
          wh.mode !== 'off' && canWrite && (
            <Button variant="ghost" size="sm" onClick={() => save.mutate(settings(wh, { mode: 'off' }))}>Turn off tracking</Button>
          )
        }
      />

      {wh.mode === 'off' ? (
        <ModePicker onPick={chooseMode} disabled={!canWrite} />
      ) : (
        <div role="tablist" aria-label="Tracking mode" className="inline-flex rounded-xl bg-surface-sunken p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={wh.mode === m.id}
              disabled={!canWrite && wh.mode !== m.id}
              onClick={() => chooseMode(m.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                wh.mode === m.id ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      )}

      {wh.mode === 'cycle' && (
        <CycleView
          patientId={patientId}
          wh={wh}
          periods={periods}
          canWrite={canWrite}
          onLog={(d) => setLogStart(d)}
          onSaveSettings={(patch) => save.mutate(settings(wh, patch))}
        />
      )}
      {wh.mode === 'pregnancy' && wh.summary.pregnancy && (
        <PregnancyView
          wh={wh}
          canWrite={canWrite}
          onEdit={() => setSetup('pregnancy')}
          onDelivered={() => setSetup('postpartum')}
        />
      )}
      {wh.mode === 'postpartum' && wh.summary.postpartum && (
        <PostpartumView
          wh={wh}
          canWrite={canWrite}
          onEdit={() => setSetup('postpartum')}
          onAddBaby={() => setAddingBaby(true)}
          onPeriodsBack={() => chooseMode('cycle')}
        />
      )}

      {wh.mode !== 'off' && (
        <RemindersCard patientId={patientId} wh={wh} canRemind={canRemind} onAdd={setPreset} />
      )}

      <p className="text-xs text-ink-subtle">{COPY['COPY-46']}</p>

      {setup && (
        <SetupDialog
          mode={setup}
          wh={wh}
          saving={save.isPending}
          onClose={() => setSetup(null)}
          onSave={(patch) => save.mutate(settings(wh, patch))}
        />
      )}
      {logStart && (
        <PeriodDialog
          patientId={patientId}
          start={logStart}
          onClose={() => setLogStart(null)}
          onSaved={() => {
            setLogStart(null)
            void qc.invalidateQueries({ queryKey: ['periods', patientId] })
            void qc.invalidateQueries({ queryKey: ['womens-health', patientId] })
            toast('Period logged')
          }}
        />
      )}
      {preset && <ReminderDialog patientId={patientId} preset={preset} onClose={() => setPreset(null)} />}
      <AddFamilyMemberDialog open={addingBaby} onClose={() => setAddingBaby(false)} defaultRelationship="child" />
    </div>
  )
}

function ModePicker({ onPick, disabled }: { onPick: (m: WomensHealthMode) => void; disabled: boolean }) {
  const options = [
    { id: 'cycle' as const, title: 'Track my periods', text: 'Log periods and symptoms, see your cycle and get a reminder before the next one.', icon: <IconFlower /> },
    { id: 'pregnancy' as const, title: 'I’m pregnant', text: 'See your week and trimester, your due date and reminders for check-ups and scans.', icon: <IconHeartPulse /> },
    { id: 'postpartum' as const, title: 'I’ve had a baby', text: 'Track weeks since birth, add reminders for your check-ups and your baby’s vaccines.', icon: <IconBaby /> },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onPick(o.id)}
          disabled={disabled}
          className="mv-press flex flex-col items-start gap-3 rounded-2xl border border-canvas-border bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card disabled:opacity-60"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 [&_svg]:h-6 [&_svg]:w-6">{o.icon}</span>
          <span>
            <span className="block text-base font-semibold text-ink">{o.title}</span>
            <span className="mt-1 block text-sm text-ink-muted">{o.text}</span>
          </span>
        </button>
      ))}
      {disabled && <p className="text-sm text-ink-muted sm:col-span-3">Only people who can add records to this profile can turn on tracking.</p>}
    </div>
  )
}

// --- Periods ----------------------------------------------------------------------------

function CycleView({
  patientId,
  wh,
  periods,
  canWrite,
  onLog,
  onSaveSettings,
}: {
  patientId: string
  wh: WH
  periods: Period[]
  canWrite: boolean
  onLog: (start: string) => void
  onSaveSettings: (patch: Partial<WomensHealthSettingsInput>) => void
}) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [removing, setRemoving] = useState<Period | null>(null)
  const c = wh.summary.cycle
  const today = todayIso()
  const latest = periods[0]
  const ongoing = latest && !latest.end_date && latest.start_date >= addDays(today, -14)

  const end = useMutation({
    mutationFn: () => api.updatePeriod(patientId, latest!.id, { end_date: today }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['periods', patientId] })
      void qc.invalidateQueries({ queryKey: ['womens-health', patientId] })
      toast('Period end saved')
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePeriod(patientId, id),
    onSuccess: () => {
      setRemoving(null)
      void qc.invalidateQueries({ queryKey: ['periods', patientId] })
      void qc.invalidateQueries({ queryKey: ['womens-health', patientId] })
    },
  })

  const d = c.days_until_next_period
  const nextLine =
    d === null ? null : d > 0 ? `Next period in about ${plural(d, 'day')}` : d === 0 ? 'Next period expected today' : `Period is ${plural(-d, 'day')} late`

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Card>
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <CycleRing cycle={c} />
            {nextLine ? (
              <div>
                <p className="text-base font-semibold text-ink">{nextLine}</p>
                <p className="text-sm text-ink-muted">around {shortDate(c.next_period_estimate)}</p>
                {c.fertile_window_start && (
                  <p className="mt-1 text-xs text-ink-subtle">
                    Fertile window estimate: {shortDate(c.fertile_window_start)} – {shortDate(c.fertile_window_end)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                {c.logged_periods === 0 ? 'Log your period to see your cycle.' : 'Log one more period, or set your usual cycle length below, to see estimates.'}
              </p>
            )}
            {canWrite && (
              <div className="flex flex-wrap justify-center gap-2">
                {ongoing ? (
                  <Button loading={end.isPending} onClick={() => end.mutate()}>Period ended today</Button>
                ) : (
                  <Button onClick={() => onLog(today)}><IconPlus className="h-4 w-4" /> Log period</Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CycleCalendar cycle={c} periods={periods} onPickDay={canWrite ? onLog : undefined} />
            {canWrite && <p className="mt-2 text-xs text-ink-subtle">Tap a day to log a period that started then.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Average cycle" value={c.average_cycle_days ? `${c.average_cycle_days} days` : '—'} />
        <Stat label="Average period" value={c.average_period_days ? `${c.average_period_days} days` : '—'} />
        <Stat label="Periods logged" value={String(c.logged_periods)} />
      </div>

      <p className="flex items-start gap-2 text-xs text-ink-muted"><IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />{COPY['COPY-43']}</p>

      {periods.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-ink">Period history</h2>
            <ul className="mt-2 divide-y divide-line">
              {periods.map((per) => (
                <li key={per.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {formatDate(per.start_date)}
                      {per.end_date ? ` – ${formatDate(per.end_date)}` : ' – ongoing'}
                      {per.length_days && <span className="font-normal text-ink-subtle"> · {plural(per.length_days, 'day')}</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {per.flow && <Badge tone="brand">{FLOW_LABEL[per.flow]} flow</Badge>}
                      {per.symptoms.map((s) => <Badge key={s} tone="neutral">{SYMPTOMS.find((x) => x.id === s)?.label ?? s}</Badge>)}
                    </div>
                    {per.notes && <p className="mt-1 text-xs text-ink-muted">{per.notes}</p>}
                  </div>
                  {canWrite && (
                    <button onClick={() => setRemoving(per)} aria-label={`Delete period from ${formatDate(per.start_date)}`} className="rounded p-1 text-ink-subtle hover:bg-danger-bg hover:text-danger-fg">
                      <IconTrash className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {canWrite && <CycleSettings wh={wh} onSave={onSaveSettings} />}

      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          title="Delete this period?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(removing.id)}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-ink">The period that started {formatDate(removing.start_date)} will be removed and estimates recalculated.</p>
        </Dialog>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-canvas-border bg-white p-3 text-center">
      <p className="text-xs text-ink-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}

function CycleSettings({ wh, onSave }: { wh: WH; onSave: (patch: Partial<WomensHealthSettingsInput>) => void }) {
  const [cycle, setCycle] = useState(wh.cycle_length_days ? String(wh.cycle_length_days) : '')
  const [period, setPeriod] = useState(wh.period_length_days ? String(wh.period_length_days) : '')
  const cycleN = cycle === '' ? null : Number(cycle)
  const periodN = period === '' ? null : Number(period)
  const cycleBad = cycleN !== null && (!Number.isInteger(cycleN) || cycleN < 21 || cycleN > 45)
  const periodBad = periodN !== null && (!Number.isInteger(periodN) || periodN < 2 || periodN > 10)
  return (
    <details className="rounded-2xl border border-canvas-border bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-ink">Your usual cycle (optional)</summary>
      <p className="mt-1 text-xs text-ink-subtle">Used for estimates until you’ve logged a few periods.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Cycle length (days)" htmlFor="wh-cycle" error={cycleBad ? '21 to 45 days' : undefined}>
          <Input id="wh-cycle" inputMode="numeric" value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="e.g. 28" />
        </Field>
        <Field label="Period length (days)" htmlFor="wh-period" error={periodBad ? '2 to 10 days' : undefined}>
          <Input id="wh-period" inputMode="numeric" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 5" />
        </Field>
        <Button variant="secondary" disabled={cycleBad || periodBad} onClick={() => onSave({ cycle_length_days: cycleN, period_length_days: periodN })}>Save</Button>
      </div>
    </details>
  )
}

function PeriodDialog({ patientId, start, onClose, onSaved }: { patientId: string; start: string; onClose: () => void; onSaved: () => void }) {
  const today = todayIso()
  const [startDate, setStartDate] = useState(start)
  const [endDate, setEndDate] = useState('')
  const [flow, setFlow] = useState<PeriodFlow | null>(null)
  const [symptoms, setSymptoms] = useState<PeriodSymptom[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const endBad = !!endDate && (endDate < startDate || endDate > today || endDate > addDays(startDate, 14))

  const create = useMutation({
    mutationFn: () =>
      api.createPeriod(patientId, { start_date: startDate, end_date: endDate || null, flow, symptoms, notes: notes.trim() || null }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError && e.code === 'PERIOD_OVERLAP' ? 'This overlaps a period you’ve already logged.' : 'Couldn’t save. Check the dates and try again.'),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Log a period"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} disabled={!startDate || startDate > today || endBad} onClick={() => create.mutate()}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Started" htmlFor="pd-start">
            <Input id="pd-start" type="date" max={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Ended (optional)" htmlFor="pd-end" error={endBad ? 'Within 14 days of the start, not in the future' : undefined}>
            <Input id="pd-end" type="date" min={startDate} max={today} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Flow</legend>
          <div className="flex gap-1.5">
            {(Object.keys(FLOW_LABEL) as PeriodFlow[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={flow === f}
                onClick={() => setFlow(flow === f ? null : f)}
                className={cn('flex-1 rounded-lg border px-3 py-1.5 text-sm', flow === f ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-muted')}
              >
                {FLOW_LABEL[f]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Symptoms</legend>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOMS.map((s) => {
              const on = symptoms.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s.id) : [...symptoms, s.id])}
                  className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-line text-ink-muted hover:bg-surface-muted')}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </fieldset>
        <Field label="Notes (optional)" htmlFor="pd-notes">
          <Input id="pd-notes" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm font-medium text-danger-fg" role="alert">{error}</p>}
      </div>
    </Dialog>
  )
}

// --- Pregnancy and after birth -------------------------------------------------------------

function PregnancyView({ wh, canWrite, onEdit, onDelivered }: { wh: WH; canWrite: boolean; onEdit: () => void; onDelivered: () => void }) {
  const preg = wh.summary.pregnancy!
  const progress = Math.min(100, ((preg.weeks * 7 + preg.days) / 280) * 100)
  const tri = ['First', 'Second', 'Third'][preg.trimester - 1]
  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-subtle">You are</p>
              <p className="font-serif text-4xl text-ink">
                {plural(preg.weeks, 'week')}{preg.days ? <span className="text-2xl text-ink-muted"> + {plural(preg.days, 'day')}</span> : null}
              </p>
              <Badge tone="brand" className="mt-1">{tri} trimester</Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-subtle">Due date</p>
              <p className="text-xl font-semibold text-ink">{formatDate(preg.due_date)}</p>
              <p className="text-sm text-ink-muted">{preg.days_to_go >= 0 ? `${plural(preg.days_to_go, 'day')} to go` : 'Due date has passed'}</p>
            </div>
          </div>
          <div>
            <div className="relative h-3 rounded-full bg-brand-50" role="progressbar" aria-valuemin={0} aria-valuemax={40} aria-valuenow={preg.weeks} aria-label="Weeks of pregnancy">
              <div className="h-3 rounded-full bg-brand-gradient" style={{ width: `${progress}%` }} />
              {[13, 27].map((w) => (
                <span key={w} className="absolute top-0 h-3 w-0.5 bg-white" style={{ left: `${(w / 40) * 100}%` }} aria-hidden="true" />
              ))}
            </div>
            <div className="mt-1 grid grid-cols-[13fr_14fr_13fr] text-[11px] text-ink-subtle">
              <span>Trimester 1</span>
              <span className="text-center">Trimester 2</span>
              <span className="text-right">Trimester 3 · 40 weeks</span>
            </div>
          </div>
          <p className="text-xs text-ink-subtle">Calculated from {wh.lmp_date ? `your last period (${formatDate(preg.lmp_date)})` : `your due date`}. Your doctor’s dating scan may differ.</p>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={onEdit}><IconCalendar className="h-4 w-4" /> Change dates</Button>
              <Button variant="secondary" size="sm" onClick={onDelivered}><IconBaby className="h-4 w-4" /> Baby has arrived</Button>
            </div>
          )}
        </CardBody>
      </Card>
      <Alert tone="warn" icon={<IconWarn />} title="When to get help now">{COPY['COPY-44']}</Alert>
    </div>
  )
}

function PostpartumView({
  wh,
  canWrite,
  onEdit,
  onAddBaby,
  onPeriodsBack,
}: {
  wh: WH
  canWrite: boolean
  onEdit: () => void
  onAddBaby: () => void
  onPeriodsBack: () => void
}) {
  const pp = wh.summary.postpartum!
  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-subtle">Since your baby was born</p>
            <p className="font-serif text-4xl text-ink">
              {pp.weeks_since_delivery >= 1 ? plural(pp.weeks_since_delivery, 'week') : plural(pp.days_since_delivery, 'day')}
            </p>
            <p className="text-sm text-ink-muted">Born {formatDate(pp.delivery_date)}</p>
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onAddBaby}><IconBaby className="h-4 w-4" /> Add your baby’s profile</Button>
              <Button variant="secondary" size="sm" onClick={onEdit}><IconCalendar className="h-4 w-4" /> Change date</Button>
              <Button variant="secondary" size="sm" onClick={onPeriodsBack}><IconFlower className="h-4 w-4" /> Periods are back</Button>
            </div>
          )}
          <p className="text-xs text-ink-subtle">Add your baby as a family member to keep their vaccination records and reminders in one place.</p>
        </CardBody>
      </Card>
      <Alert tone="info" icon={<IconHeartPulse />} title="Looking after yourself">{COPY['COPY-45']}</Alert>
    </div>
  )
}

function SetupDialog({
  mode,
  wh,
  saving,
  onClose,
  onSave,
}: {
  mode: 'pregnancy' | 'postpartum'
  wh: WH
  saving: boolean
  onClose: () => void
  onSave: (patch: Partial<WomensHealthSettingsInput>) => void
}) {
  const today = todayIso()
  const [basis, setBasis] = useState<'lmp' | 'due'>(wh.due_date && !wh.lmp_date ? 'due' : 'lmp')
  const [date, setDate] = useState(mode === 'postpartum' ? wh.delivery_date ?? today : (basis === 'lmp' ? wh.lmp_date : wh.due_date) ?? '')

  const range =
    mode === 'postpartum'
      ? { min: addDays(today, -730), max: today }
      : basis === 'lmp'
        ? { min: addDays(today, -300), max: today }
        : { min: addDays(today, -30), max: addDays(today, 300) }
  const bad = !date || date < range.min || date > range.max

  function save() {
    if (mode === 'postpartum') onSave({ mode: 'postpartum', delivery_date: date })
    else onSave({ mode: 'pregnancy', lmp_date: basis === 'lmp' ? date : null, due_date: basis === 'due' ? date : null })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'pregnancy' ? 'Pregnancy dates' : 'When was your baby born?'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={saving} disabled={bad} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        {mode === 'pregnancy' && (
          <div role="radiogroup" aria-label="What do you know?" className="grid grid-cols-2 gap-2">
            {([['lmp', 'First day of my last period'], ['due', 'My due date']] as const).map(([k, label]) => (
              <button
                key={k}
                role="radio"
                aria-checked={basis === k}
                onClick={() => {
                  setBasis(k)
                  setDate((k === 'lmp' ? wh.lmp_date : wh.due_date) ?? '')
                }}
                className={cn('rounded-xl border px-3 py-2 text-sm', basis === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-muted')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <Field label={mode === 'postpartum' ? 'Date of birth' : basis === 'lmp' ? 'First day of last period' : 'Due date'} htmlFor="wh-date">
          <Input id="wh-date" type="date" min={range.min} max={range.max} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {mode === 'pregnancy' && <p className="text-xs text-ink-subtle">If your doctor gave you a due date from a scan, use that.</p>}
      </div>
    </Dialog>
  )
}

// --- Reminders ----------------------------------------------------------------------------

function RemindersCard({ patientId, wh, canRemind, onAdd }: { patientId: string; wh: WH; canRemind: boolean; onAdd: (p: ReminderPreset) => void }) {
  const remindersQ = useQuery({ queryKey: ['reminders', patientId, 'active'], queryFn: () => api.listReminders(patientId, 'active') })
  const upcoming = (remindersQ.data?.items ?? []).filter((r) => r.next_due_at).sort((a, b) => (a.next_due_at ?? '').localeCompare(b.next_due_at ?? '')).slice(0, 5)
  const next = wh.summary.cycle.next_period_estimate

  const presets: ReminderPreset[] =
    wh.mode === 'cycle'
      ? [
          ...(next ? [{ title: 'Period expected in about 2 days', type: 'other' as const, kind: 'once' as const, date: addDays(next, -2), time: '09:00' }] : []),
          { title: 'Log period symptoms', type: 'other', kind: 'daily', time: '21:00' },
          { title: 'Medicine (as prescribed)', type: 'medication', kind: 'daily', time: '08:00' },
        ]
      : wh.mode === 'pregnancy'
        ? [
            { title: 'Antenatal check-up', type: 'appointment', kind: 'once', time: '10:00' },
            { title: 'Ultrasound scan', type: 'appointment', kind: 'once', time: '10:00' },
            { title: 'Blood test', type: 'appointment', kind: 'once', time: '08:00' },
            { title: 'Medicine (as prescribed)', type: 'medication', kind: 'daily', time: '08:00' },
          ]
        : [
            { title: 'Postnatal check-up', type: 'appointment', kind: 'once', time: '10:00' },
            { title: 'Baby’s vaccination', type: 'appointment', kind: 'once', time: '10:00' },
            { title: 'Medicine (as prescribed)', type: 'medication', kind: 'daily', time: '08:00' },
          ]

  return (
    <Card>
      <CardBody>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><IconBell className="h-4 w-4 text-ink-muted" /> Reminders</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No upcoming reminders yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-sm text-ink">{r.title}</span>
                <span className="shrink-0 text-xs text-ink-subtle">{r.next_due_local}</span>
              </li>
            ))}
          </ul>
        )}
        {canRemind ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.title}
                onClick={() => onAdd(p)}
                className="mv-press inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-white px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-brand-200 hover:text-ink"
              >
                <IconPlus className="h-3.5 w-3.5" /> {p.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-subtle">You can view reminders; the profile owner can add them.</p>
        )}
      </CardBody>
    </Card>
  )
}
