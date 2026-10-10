// Medivara brand marks. The full gradient logo (with wordmark + tagline) is the
// supplied PNG, used for large brand moments (login, onboarding). The compact
// LogoMark is an SVG lockup in the brand gradient for the header, sidebar and
// mobile nav, where the full stacked logo would be illegible.
import { useId } from 'react'
import { cn } from '../lib/cn'

/** Compact square app mark: gradient tile with a white "M" and a care cross. */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  // Unique per instance: a shared id breaks every copy when the first one is display:none.
  const id = `mv-grad-${useId().replace(/:/g, '')}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Medivara"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--mv-logo-1)' }} />
          <stop offset="55%" style={{ stopColor: 'var(--mv-logo-2)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--mv-logo-3)' }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="12" fill={`url(#${id})`} />
      {/* Stylised M */}
      <path
        d="M11 35 V15 q0-1 1.4-0.4 L24 24 l11.6-9.4 q1.4-0.6 1.4 0.4 V35 h-4.6 V22.5 L25 30.2 q-1 0.8-2 0 L15.6 22.5 V35 Z"
        fill="#FFFFFF"
        fillOpacity="0.96"
      />
      {/* Care cross */}
      <path
        d="M22.2 31.5 h3.6 v3 h3 v3.6 h-3 v3 h-3.6 v-3 h-3 v-3.6 h3 Z"
        fill="#FFFFFF"
        transform="translate(0 -3)"
        fillOpacity="0.92"
      />
    </svg>
  )
}

/** Horizontal lockup: mark + "Medivara" wordmark. `tone` picks wordmark colour. */
export function LogoLockup({
  className,
  markSize = 30,
  tone = 'dark',
}: {
  className?: string
  markSize?: number
  tone?: 'dark' | 'light'
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={markSize} />
      <span
        className={cn(
          'text-lg font-extrabold tracking-tight',
          tone === 'light' ? 'text-white' : 'text-brand-900',
        )}
      >
        Medivara
      </span>
    </span>
  )
}

/** The supplied full gradient logo (mark + wordmark + tagline) as an image. */
export function LogoFull({ className }: { className?: string }) {
  return (
    <img
      src="/medivara-logo.png"
      alt="Medivara — Your Health History. Clearer Decisions."
      className={cn('h-auto w-full select-none', className)}
      draggable={false}
    />
  )
}
