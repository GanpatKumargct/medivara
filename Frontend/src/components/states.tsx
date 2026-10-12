// Shared system-state components (SCR-16, FR-120). No screen shows a raw error
// or stack trace; everything routes through these.
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ApiError } from '../api/types'
import { Alert, Button, Card, CardBody, Skeleton } from './ui'
import { IconInfo, IconLock, IconWarn } from './icons'
import { COPY } from '../lib/copy'
import { t } from '../lib/i18n'

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={t("Loading")}>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardBody>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-3 h-3 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </CardBody>
        </Card>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <Card>
      <CardBody className="text-center py-10">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{message}</p>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </CardBody>
    </Card>
  )
}

export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const requestId = error instanceof ApiError ? error.request_id : undefined
  return (
    <Alert
      tone="danger"
      role="alert"
      icon={<IconWarn />}
      title={t("Something went wrong. Try again.")}
    >
      {requestId && <p className="text-xs opacity-80">{t("Reference:")}{' '}{requestId}</p>}
      {onRetry && (
        <div className="mt-2">
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t("Try again")}</Button>
        </div>
      )}
    </Alert>
  )
}

/** Full-page access-denied (403 ACCESS_DENIED), COPY-27. */
export function AccessDeniedPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg text-danger-fg">
        <IconLock />
      </div>
      <h1 className="text-xl font-semibold text-ink">{COPY['COPY-27-title']}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{COPY['COPY-27']}</p>
      <div className="mt-6">
        <Link to="/profiles">
          <Button>{t("Go to my profiles")}</Button>
        </Link>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        <IconInfo />
      </div>
      <h1 className="text-xl font-semibold text-ink">{t("We couldn’t find that.")}</h1>
      <div className="mt-6">
        <Link to="/profiles">
          <Button variant="secondary">{t("Go to my profiles")}</Button>
        </Link>
      </div>
    </div>
  )
}

/** Resolve an API error to the right state element, or null to use a generic banner. */
export function renderApiError(error: unknown, onRetry?: () => void): ReactNode {
  if (error instanceof ApiError && error.code === 'ACCESS_DENIED') return <AccessDeniedPage />
  if (error instanceof ApiError && error.code === 'NOT_FOUND') return <NotFoundPage />
  return <ErrorBanner error={error} onRetry={onRetry} />
}
