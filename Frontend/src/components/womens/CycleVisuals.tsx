// Cycle ring and month calendar for the period tracker. Both only draw what the
// backend calculated from the user's own logs (WomensHealth.summary.cycle); nothing
// here judges whether a cycle is normal. Every coloured day also carries a text label.
import { useMemo, useState } from 'react'
import type { CycleSummary, Period } from '../../api/types'
import { cn } from '../../lib/cn'
import { IconChevronRight } from '../icons'
import { t } from '../../lib/i18n'

const DAY = 86_400_000
const parse = (s: string) => new Date(`${s}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * DAY))

export function todayIso(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10) // IST
}

export function shortDate(s: string | null): string {
  if (!s) return '—'
  return parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Ring showing where today falls in the cycle: period days, the fertile-window estimate and today. */
export function CycleRing({ cycle }: { cycle: CycleSummary }) {
  const length = cycle.average_cycle_days ?? 28
  const day = cycle.cycle_day ?? 0
  const size = 188
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const arc = (from: number, to: number) => {
    const a = Math.max(0, Math.min(length, from - 1))
    const b = Math.max(a, Math.min(length, to))
    return { dasharray: `${((b - a) / length) * c} ${c}`, dashoffset: -(a / length) * c }
  }
  const period = arc(1, cycle.average_period_days ?? 5)
  const fertileFrom =
    cycle.fertile_window_start && cycle.last_period_start
      ? Math.round((parse(cycle.fertile_window_start).getTime() - parse(cycle.last_period_start).getTime()) / DAY) + 1
      : null
  const fertile = fertileFrom ? arc(fertileFrom, fertileFrom + 6) : null
  const late = cycle.days_until_next_period !== null && cycle.days_until_next_period < 0
  const angle = ((Math.min(day, length) - 0.5) / length) * 2 * Math.PI - Math.PI / 2
  const mx = size / 2 + r * Math.cos(angle)
  const my = size / 2 + r * Math.sin(angle)

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--mv-canvas-active))" strokeWidth={stroke} />
        <g transform={t("rotate(-90 {{value}} {{value2}})", { value: size / 2, value2: size / 2 })}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--mv-brand-500))" strokeWidth={stroke}
            strokeDasharray={period.dasharray} strokeDashoffset={period.dashoffset} />
          {fertile && (
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#9DE6D6" strokeWidth={stroke}
              strokeDasharray={fertile.dasharray} strokeDashoffset={fertile.dashoffset} />
          )}
        </g>
        {cycle.cycle_day !== null && (
          <circle cx={mx} cy={my} r={9} fill="#FFFFFF" stroke="rgb(var(--mv-brand-700))" strokeWidth={3} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {cycle.cycle_day !== null ? (
          <>
            <span className="text-xs uppercase tracking-wide text-ink-subtle">{t("Cycle day")}</span>
            <span className="text-4xl font-semibold text-ink">{cycle.cycle_day}</span>
            <span className="text-xs text-ink-subtle">
              {late ? `${-cycle.days_until_next_period!} day${cycle.days_until_next_period === -1 ? '' : 's'} late` : cycle.average_cycle_days ? `of about ${cycle.average_cycle_days}` : t("log more periods")}
            </span>
          </>
        ) : (
          <span className="px-6 text-sm text-ink-subtle">{t("Log your period to start")}</span>
        )}
      </div>
    </div>
  )
}

type DayKind = 'period' | 'predicted' | 'fertile' | null

/** Month calendar. Logged period days are solid, the predicted period is dashed, the fertile-window estimate is tinted. */
export function CycleCalendar({
  cycle,
  periods,
  onPickDay,
}: {
  cycle: CycleSummary
  periods: Period[]
  onPickDay?: (date: string) => void
}) {
  const today = todayIso()
  const [month, setMonth] = useState(() => today.slice(0, 7))

  const kinds = useMemo(() => {
    const map = new Map<string, DayKind>()
    const mark = (from: string, to: string, kind: DayKind) => {
      for (let d = from; d <= to; d = addDays(d, 1)) if (!map.has(d) || kind === 'period') map.set(d, kind)
    }
    if (cycle.fertile_window_start && cycle.fertile_window_end) mark(cycle.fertile_window_start, cycle.fertile_window_end, 'fertile')
    if (cycle.next_period_estimate) {
      mark(cycle.next_period_estimate, cycle.next_period_end_estimate ?? addDays(cycle.next_period_estimate, 4), 'predicted')
    }
    for (const p of periods) {
      const assumedEnd = addDays(p.start_date, (cycle.average_period_days ?? 5) - 1)
      const end = p.end_date ?? (assumedEnd < today ? assumedEnd : today)
      mark(p.start_date, end, 'period')
    }
    return map
  }, [cycle, periods, today])

  const first = parse(`${month}-01`)
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const lead = first.getUTCDay()
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]
  const shift = (n: number) => {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1))
    setMonth(iso(d).slice(0, 7))
  }
  const label = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const kindLabel: Record<string, string> = { period: 'period day', predicted: 'predicted period', fertile: 'fertile window estimate' }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => shift(-1)} aria-label={t("Previous month")} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-hover">
          <IconChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <p className="text-sm font-semibold text-ink" aria-live="polite">{label}</p>
        <button onClick={() => shift(1)} aria-label={t("Next month")} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-hover">
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-ink-subtle" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const kind = kinds.get(d) ?? null
          const isToday = d === today
          const future = d > today
          const name = `${shortDate(d)}${kind ? `, ${kindLabel[kind]}` : ''}${isToday ? ', today' : ''}`
          const cls = cn(
            'mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors',
            kind === 'period' && 'bg-brand-500 font-semibold text-white',
            kind === 'predicted' && 'border-2 border-dashed border-brand-400 text-brand-800',
            kind === 'fertile' && 'bg-teal-bg text-teal-fg',
            !kind && 'text-ink',
            isToday && 'ring-2 ring-ink ring-offset-1',
          )
          return onPickDay && !future ? (
            <button key={d} onClick={() => onPickDay(d)} aria-label={t("{{name}}. Log a period starting this day", { name: name })} className={cn(cls, !kind && 'hover:bg-canvas-hover')}>
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={d} aria-label={name} className={cls}>{Number(d.slice(8))}</span>
          )
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-brand-500" aria-hidden="true" /> {t("Period")}</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-dashed border-brand-400" aria-hidden="true" /> {t("Predicted period")}</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-teal-bg ring-1 ring-teal-border" aria-hidden="true" /> {t("Fertile window (estimate)")}</li>
      </ul>
    </div>
  )
}
