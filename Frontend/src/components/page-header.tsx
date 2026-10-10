// Shared page header for inner screens — gives every screen the same confident,
// consistent masthead (icon chip + title + subtitle + actions).
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-canvas-border bg-white text-brand-700 shadow-card">
            {icon}
          </span>
        )}
        <div>
          <h1 className="font-serif text-[1.75rem] leading-tight tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
