// Hand-rolled accessible base components (DEC-19 leaves the component library to
// Person A). Tailwind only, no external UI dependency. All status styling pairs
// colour with text/icon — colour is never the only signal (NFR-A11Y-06).
import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/cn'

// --- Button -----------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const BTN_VARIANT: Record<ButtonVariant, string> = {
  // Primary CTA uses the brand gradient (used sparingly, per the design system).
  primary:
    'bg-brand-gradient text-white shadow-brand hover:brightness-105 active:brightness-95 disabled:opacity-50 disabled:shadow-none',
  secondary: 'bg-white text-brand-800 border border-line hover:bg-brand-50 hover:border-brand-200 disabled:opacity-60',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50 disabled:opacity-60',
  danger: 'bg-danger-fg text-white hover:opacity-90 disabled:opacity-60',
}
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 min-h-[36px]',
  md: 'text-sm px-4 py-2 min-h-[44px]',
  lg: 'text-base px-5 py-2.5 min-h-[48px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'mv-press inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
})

// --- Spinner ----------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// --- Card -------------------------------------------------------------------

export function Card({
  className,
  children,
  interactive,
  accent,
  ...rest
}: {
  className?: string
  children: ReactNode
  interactive?: boolean
  accent?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mv-card relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card',
        interactive && 'mv-lift cursor-pointer',
        className,
      )}
      {...rest}
    >
      {accent && (
        <span className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" aria-hidden="true" />
      )}
      {children}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-4 sm:p-5', className)}>{children}</div>
}

// --- Badge ------------------------------------------------------------------

type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'brand' | 'cyan' | 'teal' | 'violet'

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted border-line',
  ok: 'bg-ok-bg text-ok-fg border-ok-border',
  warn: 'bg-warn-bg text-warn-fg border-warn-border',
  danger: 'bg-danger-bg text-danger-fg border-danger-border',
  info: 'bg-info-bg text-info-fg border-info-border',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  cyan: 'bg-cyan-bg text-cyan-fg border-cyan-border',
  teal: 'bg-teal-bg text-teal-fg border-teal-border',
  violet: 'bg-violet-bg text-violet-fg border-violet-border',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        BADGE_TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

// --- Alert ------------------------------------------------------------------

type AlertTone = 'info' | 'warn' | 'danger' | 'ok'
const ALERT_TONE: Record<AlertTone, string> = {
  info: 'bg-info-bg text-info-fg border-info-border',
  warn: 'bg-warn-bg text-warn-fg border-warn-border',
  danger: 'bg-danger-bg text-danger-fg border-danger-border',
  ok: 'bg-ok-bg text-ok-fg border-ok-border',
}

export function Alert({
  tone = 'info',
  title,
  children,
  icon,
  className,
  role = 'status',
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  className?: string
  role?: 'status' | 'alert'
}) {
  return (
    <div role={role} className={cn('rounded-lg border p-3 text-sm', ALERT_TONE[tone], className)}>
      <div className="flex gap-2">
        {icon && <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
        </div>
      </div>
    </div>
  )
}

// --- Inputs -----------------------------------------------------------------

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle',
          'focus:border-brand-500',
          className,
        )}
        {...rest}
      />
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-subtle',
          'focus:border-brand-500',
          className,
        )}
        {...rest}
      />
    )
  },
)

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs font-medium text-danger-fg" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  id?: string
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-line text-brand-600 focus:ring-brand-500"
      />
      <span>{label}</span>
    </label>
  )
}

// --- Skeleton ---------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('mv-skeleton rounded-md', className)} aria-hidden="true" />
}

// --- Dialog (modal) ---------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-scale-in relative z-10 w-full max-w-lg rounded-2xl bg-surface p-5 shadow-pop focus:outline-none"
      >
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <div className="mt-3">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

// --- Tabs -------------------------------------------------------------------

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            active === t.id
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
