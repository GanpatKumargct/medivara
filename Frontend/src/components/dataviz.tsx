// Tiny inline-SVG data-viz (no dependency). Used for at-a-glance trends on the
// dashboard and brief. Purely presentational — values are passed in, never derived.
import { useId } from 'react'

/** Sparkline with gradient stroke + soft area fill. */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  className,
  strokeWidth = 2,
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
  strokeWidth?: number
}) {
  const id = useId().replace(/:/g, '')
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pad = strokeWidth + 1
  const stepX = (width - pad * 2) / (data.length - 1)
  const pts = data.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (height - pad * 2) * (1 - (v - min) / span)
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height - pad} L${pts[0][0].toFixed(1)},${height - pad} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0284F7" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id={`spkf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0284F7" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0284F7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spkf-${id})`} />
      <path d={line} fill="none" stroke={`url(#spk-${id})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth + 1} fill="#10B981" />
    </svg>
  )
}

/** Circular progress ring with gradient. `value` is 0–100. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  label,
  sublabel,
}: {
  value: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
}) {
  const id = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const offset = c * (1 - pct / 100)
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0284F7" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms var(--mv-ease)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        {label && <span className="text-sm font-bold text-brand-900">{label}</span>}
        {sublabel && <span className="mt-0.5 text-[9px] font-medium text-ink-subtle">{sublabel}</span>}
      </div>
    </div>
  )
}
