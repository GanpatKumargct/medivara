// Vitals tracker: blood pressure, blood sugar, weight, heart rate, SpO₂ and temperature
// that the user records themselves. Shows each vital's latest reading, a trend chart and
// the full list. Values are never labelled normal or abnormal (COPY-41).
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { ApiError } from '../api/types'
import type { Vital, VitalKind } from '../api/types'
import { useToast } from '../context/ToastContext'
import { PageHeader } from '../components/page-header'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { Sparkline } from '../components/dataviz'
import { SERIES_COLORS, VitalsChart, type ChartPoint } from '../components/vitals/VitalsChart'
import { Button, Card, CardBody, Dialog, Field, Input } from '../components/ui'
import { IconHeartPulse, IconPlus, IconTrash } from '../components/icons'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'

interface KindMeta {
  label: string
  units: string[]
  ranges: Record<string, [number, number]>
  second?: { label: string; range: [number, number] }
  firstLabel?: string
}

const KINDS: Record<VitalKind, KindMeta> = {
  blood_pressure: {
    label: 'Blood pressure',
    units: ['mmHg'],
    ranges: { mmHg: [50, 260] },
    firstLabel: 'Systolic (upper)',
    second: { label: 'Diastolic (lower)', range: [30, 160] },
  },
  blood_sugar: { label: 'Blood sugar', units: ['mg/dL'], ranges: { 'mg/dL': [20, 600] } },
  weight: { label: 'Weight', units: ['kg'], ranges: { kg: [1, 300] } },
  heart_rate: { label: 'Heart rate', units: ['bpm'], ranges: { bpm: [20, 250] } },
  spo2: { label: 'Oxygen (SpO₂)', units: ['%'], ranges: { '%': [50, 100] } },
  temperature: { label: 'Temperature', units: ['°F', '°C'], ranges: { '°F': [86, 113], '°C': [30, 45] } },
}
const ORDER: VitalKind[] = ['blood_pressure', 'blood_sugar', 'weight', 'heart_rate', 'spo2', 'temperature']
const SUGAR_CONTEXT: Record<string, string> = { fasting: 'Fasting', post_meal: 'After a meal', random: 'Random' }
const RANGES = [
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
  { id: '365', label: '1 year', days: 365 },
  { id: 'all', label: 'All', days: 0 },
]

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
function display(v: Vital) {
  return v.kind === 'blood_pressure' && v.value2 !== null ? `${fmt(v.value)}/${fmt(v.value2)}` : fmt(v.value)
}
function when(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}
/** Temperatures can be entered in °C or °F; chart them in one unit. */
function inUnit(v: Vital, unit: string): number {
  if (v.kind !== 'temperature' || v.unit === unit) return v.value
  return unit === '°F' ? v.value * 1.8 + 32 : (v.value - 32) / 1.8
}

export default function Vitals() {
  const { patientId = '' } = useParams()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [kind, setKind] = useState<VitalKind>('blood_pressure')
  const [range, setRange] = useState('all')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Vital | null>(null)

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const vitalsQ = useQuery({ queryKey: ['vitals', patientId], queryFn: () => api.listVitals(patientId) })
  const canWrite = !!patientQ.data && (patientQ.data.my_role === 'owner' || patientQ.data.scopes.includes('upload_documents'))

  const byKind = useMemo(() => {
    const map = Object.fromEntries(ORDER.map((k) => [k, [] as Vital[]])) as Record<VitalKind, Vital[]>
    for (const v of vitalsQ.data?.items ?? []) map[v.kind]?.push(v)
    return map
  }, [vitalsQ.data])

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteVital(patientId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vitals', patientId] })
      setRemoving(null)
      toast('Reading deleted')
    },
    onError: () => toast('Couldn’t delete this reading.', 'error'),
  })

  const readings = byKind[kind] ?? []
  const meta = KINDS[kind]
  const chartUnit = kind === 'temperature' ? readings[0]?.unit ?? '°F' : meta.units[0]
  const cutoff = RANGES.find((r) => r.id === range)!.days
  const inRange = readings.filter((v) => !cutoff || Date.now() - new Date(v.measured_at).getTime() <= cutoff * 86_400_000)
  const points: ChartPoint[] = [...inRange]
    .reverse()
    .map((v) => ({ t: new Date(v.measured_at).getTime(), values: kind === 'blood_pressure' ? [v.value, v.value2 ?? v.value] : [inUnit(v, chartUnit)] }))
  const series =
    kind === 'blood_pressure'
      ? [{ name: 'Systolic', color: SERIES_COLORS[0] }, { name: 'Diastolic', color: SERIES_COLORS[1] }]
      : [{ name: meta.label, color: SERIES_COLORS[0] }]

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconHeartPulse className="h-5 w-5" />}
        title="Vitals"
        subtitle={COPY['COPY-41']}
        actions={canWrite && <Button onClick={() => setAdding(true)}><IconPlus className="h-4 w-4" /> Log a reading</Button>}
      />

      {vitalsQ.isLoading && <LoadingRows rows={2} />}
      {vitalsQ.error && <ErrorBanner error={vitalsQ.error} onRetry={vitalsQ.refetch} />}

      {vitalsQ.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ORDER.map((k) => {
              const list = byKind[k]
              const latest = list[0]
              const spark = [...list].slice(0, 12).reverse().map((v) => v.value)
              return (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    'mv-press rounded-2xl border bg-white p-4 text-left transition-colors',
                    kind === k ? 'border-brand-400 ring-2 ring-brand-100' : 'border-canvas-border hover:border-brand-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-muted">{KINDS[k].label}</p>
                      {latest ? (
                        <p className="mt-1 text-2xl font-semibold text-ink">
                          {display(latest)} <span className="text-sm font-normal text-ink-subtle">{latest.unit}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-ink-subtle">No readings yet</p>
                      )}
                      {latest && <p className="mt-0.5 text-xs text-ink-subtle">{when(latest.measured_at)}</p>}
                    </div>
                    {spark.length > 1 && <Sparkline data={spark} width={84} height={34} />}
                  </div>
                </button>
              )
            })}
          </div>

          <Card>
            <CardBody>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">{meta.label}</h2>
                  <p className="text-xs text-ink-subtle">
                    {readings.length} reading{readings.length === 1 ? '' : 's'} · {chartUnit}
                    {kind === 'temperature' && readings.some((v) => v.unit !== chartUnit) && ' (converted for the chart)'}
                  </p>
                </div>
                <div role="group" aria-label="Time range" className="inline-flex rounded-xl bg-surface-sunken p-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRange(r.id)}
                      aria-pressed={range === r.id}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                        range === r.id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                {points.length > 0 ? (
                  <VitalsChart points={points} series={series} unit={chartUnit} title={meta.label} />
                ) : (
                  <p className="py-10 text-center text-sm text-ink-muted">
                    {readings.length ? 'No readings in this time range.' : `No ${meta.label.toLowerCase()} readings yet.`}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {readings.length > 0 ? (
            <Card>
              <CardBody>
                <h2 className="text-sm font-semibold text-ink">All {meta.label.toLowerCase()} readings</h2>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs text-ink-subtle">
                        <th scope="col" className="py-2 pr-3 font-medium">When</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Reading</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Notes</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Added by</th>
                        {canWrite && <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {readings.map((v) => (
                        <tr key={v.id} className="border-b border-line last:border-0">
                          <td className="whitespace-nowrap py-2 pr-3 text-ink-muted">{when(v.measured_at)}</td>
                          <td className="whitespace-nowrap py-2 pr-3 font-medium text-ink">
                            {display(v)} {v.unit}
                            {v.context && <span className="ml-1 font-normal text-ink-subtle">· {SUGAR_CONTEXT[v.context] ?? v.context}</span>}
                          </td>
                          <td className="py-2 pr-3 text-ink-muted">{v.notes ?? '—'}</td>
                          <td className="whitespace-nowrap py-2 pr-3 text-ink-subtle">{v.created_by.display_name}</td>
                          {canWrite && (
                            <td className="py-2 text-right">
                              <button
                                onClick={() => setRemoving(v)}
                                aria-label={`Delete reading from ${when(v.measured_at)}`}
                                className="rounded p-1 text-ink-subtle hover:bg-danger-bg hover:text-danger-fg"
                              >
                                <IconTrash className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          ) : (
            (vitalsQ.data.items.length === 0) && (
              <EmptyState
                title="Start tracking your vitals"
                message="Log readings from your BP monitor, glucometer, scale or thermometer to see them over time and share them with your doctor."
                action={canWrite ? <Button onClick={() => setAdding(true)}>Log your first reading</Button> : undefined}
              />
            )
          )}
        </>
      )}

      {adding && (
        <AddReadingDialog
          patientId={patientId}
          initialKind={kind}
          onClose={() => setAdding(false)}
          onSaved={(k) => {
            setKind(k)
            setAdding(false)
            void qc.invalidateQueries({ queryKey: ['vitals', patientId] })
            toast('Reading saved')
          }}
        />
      )}

      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          title="Delete this reading?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(removing.id)}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-ink">
            {KINDS[removing.kind].label} {display(removing)} {removing.unit} from {when(removing.measured_at)}.
          </p>
        </Dialog>
      )}
    </div>
  )
}

function localNow(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function AddReadingDialog({
  patientId,
  initialKind,
  onClose,
  onSaved,
}: {
  patientId: string
  initialKind: VitalKind
  onClose: () => void
  onSaved: (k: VitalKind) => void
}) {
  const [kind, setKind] = useState<VitalKind>(initialKind)
  const [value, setValue] = useState('')
  const [value2, setValue2] = useState('')
  const [unit, setUnit] = useState(KINDS[initialKind].units[0])
  const [context, setContext] = useState('fasting')
  const [at, setAt] = useState(localNow)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const meta = KINDS[kind]

  const n1 = Number(value)
  const n2 = Number(value2)
  const [lo, hi] = meta.ranges[unit] ?? [0, 0]
  const v1Bad = value !== '' && (Number.isNaN(n1) || n1 < lo || n1 > hi)
  const v2Bad = !!meta.second && value2 !== '' && (Number.isNaN(n2) || n2 < meta.second.range[0] || n2 > meta.second.range[1])
  const future = new Date(at).getTime() > Date.now() + 5 * 60_000
  const ready = value !== '' && !v1Bad && (!meta.second || (value2 !== '' && !v2Bad)) && !!at && !future

  const save = useMutation({
    mutationFn: () =>
      api.createVital(patientId, {
        kind,
        value: n1,
        value2: meta.second ? n2 : null,
        unit,
        measured_at: new Date(at).toISOString(),
        context: kind === 'blood_sugar' ? context : null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => onSaved(kind),
    onError: (e) => setError(e instanceof ApiError && e.code === 'VALIDATION_ERROR' ? 'Some values are outside what a home device can measure. Please check them.' : 'Couldn’t save this reading. Try again.'),
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title="Log a reading"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} disabled={!ready} onClick={() => save.mutate()}>Save reading</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div role="radiogroup" aria-label="What are you recording?" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {ORDER.map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k)
                setUnit(KINDS[k].units[0])
                setValue('')
                setValue2('')
              }}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-sm transition-colors',
                kind === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-ink-muted hover:bg-surface-muted',
              )}
            >
              {KINDS[k].label}
            </button>
          ))}
        </div>

        <div className={cn('grid gap-3', meta.second || meta.units.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          <Field label={`${meta.firstLabel ?? meta.label} (${unit})`} htmlFor="vt-v1" error={v1Bad ? `Enter a value from ${lo} to ${hi}` : undefined}>
            <Input id="vt-v1" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </Field>
          {meta.second && (
            <Field label={`${meta.second.label} (${unit})`} htmlFor="vt-v2" error={v2Bad ? `Enter a value from ${meta.second.range[0]} to ${meta.second.range[1]}` : undefined}>
              <Input id="vt-v2" inputMode="decimal" value={value2} onChange={(e) => setValue2(e.target.value)} />
            </Field>
          )}
          {meta.units.length > 1 && (
            <Field label="Unit" htmlFor="vt-unit">
              <select id="vt-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
                {meta.units.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
          )}
        </div>

        {kind === 'blood_sugar' && (
          <Field label="When was it taken?" htmlFor="vt-ctx">
            <select id="vt-ctx" value={context} onChange={(e) => setContext(e.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
              {Object.entries(SUGAR_CONTEXT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        )}

        <Field label="Date and time" htmlFor="vt-at" error={future ? 'This time is in the future' : undefined}>
          <Input id="vt-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <Field label="Notes (optional)" htmlFor="vt-notes">
          <Input id="vt-notes" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. after a walk, left arm" />
        </Field>
        {error && <p className="text-sm font-medium text-danger-fg" role="alert">{error}</p>}
      </div>
    </Dialog>
  )
}
