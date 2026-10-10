// Cross-cutting UI: disclaimer, data badges (FR-121), synthetic-data warning,
// and the AI-status banner (FR-040).
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { COPY } from '../lib/copy'
import { Alert, Badge } from './ui'
import { IconInfo, IconShield, IconWarn } from './icons'

/** COPY-02 — appears in the footer, under answers and in the brief. */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={'text-xs text-ink-subtle ' + (className ?? '')}>{COPY['COPY-02']}</p>
  )
}

/** COPY-03 — synthetic-data-only warning (sign-in, onboarding, upload). */
export function SyntheticWarning() {
  return (
    <Alert tone="warn" icon={<IconWarn />}>
      {COPY['COPY-03']}
    </Alert>
  )
}

// Data badges ----------------------------------------------------------------

export function UnverifiedBadge() {
  return (
    <Badge tone="warn" title={COPY['COPY-12']}>
      {COPY['COPY-12-label']}
    </Badge>
  )
}
export function CorrectedBadge() {
  return <Badge tone="info">Corrected by you</Badge>
}
export function DocumentsDifferBadge() {
  return <Badge tone="warn">Documents differ</Badge>
}
export function CachedBadge() {
  return (
    <Badge tone="info" title={COPY['COPY-11']}>
      {COPY['COPY-11-label']}
    </Badge>
  )
}
export function SampleBadge() {
  return <Badge tone="neutral">{COPY['COPY-35']}</Badge>
}
export function SuspiciousBadge() {
  return (
    <Badge tone="danger" icon={<IconWarn className="h-3.5 w-3.5" />}>
      Suspicious content
    </Badge>
  )
}
export function SimulatedBadge() {
  return (
    <Badge tone="warn" title={COPY['COPY-15']}>
      {COPY['COPY-15-label']}
    </Badge>
  )
}
export function AiGeneratedBadge() {
  return (
    <Badge tone="brand" icon={<IconShield className="h-3.5 w-3.5" />}>
      {COPY['COPY-38']}
    </Badge>
  )
}
export function SyntheticProfileBadge() {
  return <Badge tone="neutral">Synthetic profile</Badge>
}

/** Renders the right badge for a document flag. */
export function FlagBadge({ flag }: { flag: string }) {
  switch (flag) {
    case 'suspicious_instructions':
      return <SuspiciousBadge />
    case 'cached_extraction':
      return <CachedBadge />
    case 'sample':
      return <SampleBadge />
    case 'date_ambiguous':
      return <Badge tone="warn">Date to check</Badge>
    case 'ai_transcribed':
      return <Badge tone="info">AI-transcribed</Badge>
    default:
      return null
  }
}

/** Global AI-status banner. Polls health every 60 s (SCR-16, FR-040). */
export function AiStatusBanner({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 60_000,
  })
  if (!data || data.ai.available) return null
  return (
    <div className={'no-print ' + (className ?? '')}>
      <Alert tone="warn" icon={<IconInfo />}>
        {COPY['COPY-09']}
      </Alert>
    </div>
  )
}
