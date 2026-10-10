// Time-series chart for one vital sign (no dependency). One y-axis; 2px lines;
// 8px end markers with a 2px surface ring; hairline grid; a crosshair that snaps to the
// nearest reading on hover or arrow keys. Two series (blood pressure) get a legend and
// end labels. Values are shown exactly as entered — nothing is coloured as good or bad.
import { useEffect, useMemo, useRef, useState } from 'react'

export interface SeriesSpec {
  name: string
  color: string
}

export interface ChartPoint {
  t: number
  values: number[]
}

// Validated categorical pair (dataviz validator, light surface: all checks pass).
export const SERIES_COLORS = ['#0A6FD6', '#D9730D']
const GRID = '#E5E5E0'
const SURFACE = '#FFFFFF'

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(6)))
  return ticks
}

function fmtValue(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function fmtDate(t: number, withTime = false) {
  const d = new Date(t)
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return withTime ? `${date}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : date
}

export function VitalsChart({
  points,
  series,
  unit,
  title,
  height = 240,
}: {
  points: ChartPoint[]
  series: SeriesSpec[]
  unit: string
  title: string
  height?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pad = { top: 16, right: series.length > 1 ? 72 : 48, bottom: 28, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const geom = useMemo(() => {
    const all = points.flatMap((p) => p.values)
    const lo = Math.min(...all)
    const hi = Math.max(...all)
    const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1)
    const ticks = niceTicks(lo - span * 0.15, hi + span * 0.15)
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const t0 = points[0]?.t ?? 0
    const t1 = points[points.length - 1]?.t ?? 1
    const x = (t: number) => (t1 === t0 ? pad.left + innerW / 2 : pad.left + ((t - t0) / (t1 - t0)) * innerW)
    const y = (v: number) => pad.top + innerH * (1 - (v - yMin) / (yMax - yMin || 1))
    return { ticks, x, y }
  }, [points, innerW, innerH, pad.left, pad.top])

  if (points.length === 0) return null
  const { ticks, x, y } = geom
  const last = points[points.length - 1]

  function nearest(clientX: number) {
    const rect = wrap.current?.getBoundingClientRect()
    if (!rect) return
    const px = clientX - rect.left
    let best = 0
    let bestD = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(x(p.t) - px)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setActive(best)
  }

  const hover = active !== null ? points[active] : null
  const tipLeft = hover ? Math.min(Math.max(x(hover.t) + 12, 8), width - 180) : 0
  const summary = `${title}: ${points.length} reading${points.length === 1 ? '' : 's'} from ${fmtDate(points[0].t)} to ${fmtDate(last.t)}. Latest ${series
    .map((s, i) => `${s.name.toLowerCase()} ${fmtValue(last.values[i])}`)
    .join(', ')} ${unit}. Use the left and right arrow keys to move between readings.`

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-4 text-xs text-ink-muted" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={wrap}
        className="relative w-full select-none rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        tabIndex={0}
        role="img"
        aria-label={summary}
        onPointerMove={(e) => nearest(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length - 1) - 1))
          if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? 0) + 1))
          if (e.key === 'Home') setActive(0)
          if (e.key === 'End') setActive(points.length - 1)
        }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-subtle" fontSize={11}>
                {fmtValue(t)}
              </text>
            </g>
          ))}
          <text x={pad.left} y={height - 8} className="fill-ink-subtle" fontSize={11}>{fmtDate(points[0].t)}</text>
          {points.length > 1 && (
            <text x={width - pad.right} y={height - 8} textAnchor="end" className="fill-ink-subtle" fontSize={11}>
              {fmtDate(last.t)}
            </text>
          )}

          {series.map((s, si) => {
            const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.values[si]).toFixed(1)}`).join(' ')
            const area =
              series.length === 1 && points.length > 1
                ? `${d} L${x(last.t).toFixed(1)},${pad.top + innerH} L${x(points[0].t).toFixed(1)},${pad.top + innerH} Z`
                : null
            return (
              <g key={s.name}>
                {area && <path d={area} fill={s.color} opacity={0.1} />}
                {points.length > 1 && (
                  <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                )}
                {points.length <= 24 &&
                  points.map((p) => (
                    <circle key={p.t} cx={x(p.t)} cy={y(p.values[si])} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                  ))}
                {points.length > 24 && (
                  <circle cx={x(last.t)} cy={y(last.values[si])} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                )}
                <text x={x(last.t) + 10} y={y(last.values[si])} dy="0.32em" fontSize={12} fontWeight={600} className="fill-ink">
                  {fmtValue(last.values[si])}
                  {series.length > 1 && <tspan className="fill-ink-subtle" fontWeight={400}> {s.name.slice(0, 3).toLowerCase()}</tspan>}
                </text>
              </g>
            )
          })}

          {hover && (
            <g>
              <line x1={x(hover.t)} x2={x(hover.t)} y1={pad.top} y2={pad.top + innerH} stroke="#94A3B8" strokeWidth={1} />
              {series.map((s, si) => (
                <circle key={s.name} cx={x(hover.t)} cy={y(hover.values[si])} r={5} fill={s.color} stroke={SURFACE} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[150px] rounded-lg border border-canvas-border bg-white px-3 py-2 text-xs shadow-pop"
            style={{ left: tipLeft }}
            aria-hidden="true"
          >
            <p className="text-ink-subtle">{fmtDate(hover.t, true)}</p>
            {series.map((s, si) => (
              <p key={s.name} className="mt-1 flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                <span className="font-semibold text-ink">{fmtValue(hover.values[si])} {unit}</span>
                {series.length > 1 && <span className="text-ink-subtle">{s.name}</span>}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
