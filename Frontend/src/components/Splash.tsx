// Branded full-screen loading splash (hackathon-ready). A spinning multi-hue ring
// around the Medivara mark, with the wordmark, tagline and an indeterminate bar.
import { LogoMark } from './brand'

export function Splash({ label = 'Loading your records…' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-hero-fade">
      {/* floating brand orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="mv-orb" style={{ width: 320, height: 320, top: -70, left: -50, background: 'var(--mv-logo-1)' }} />
        <div className="mv-orb" style={{ width: 300, height: 300, bottom: -80, right: -40, background: 'var(--mv-logo-3)', animationDelay: '-5s' }} />
        <div className="mv-orb" style={{ width: 200, height: 200, top: '55%', left: '15%', background: 'var(--mv-logo-2)', animationDelay: '-9s' }} />
      </div>

      <div className="relative flex flex-col items-center" role="status" aria-live="polite">
        {/* spinning multi-hue ring + logo */}
        <div className="relative h-28 w-28">
          <div className="mv-splash-glow absolute inset-0 rounded-[28px] bg-brand-gradient blur-2xl" aria-hidden="true" />
          <div
            className="mv-splash-ring absolute inset-0 rounded-[26px]"
            style={{ background: 'conic-gradient(from 0deg, var(--mv-logo-1), var(--mv-logo-2), var(--mv-logo-3), var(--mv-grad-soft-to), var(--mv-logo-1))' }}
            aria-hidden="true"
          />
          <div className="absolute inset-[5px] rounded-[22px] bg-white" aria-hidden="true" />
          <div className="mv-splash-logo absolute inset-0 flex items-center justify-center">
            <LogoMark size={64} />
          </div>
        </div>

        <p className="mt-6 text-2xl font-extrabold tracking-tight text-brand-900">Medivara</p>
        <p className="mt-1 text-sm text-ink-muted">Your Health History. Clearer Decisions.</p>

        {/* indeterminate bar */}
        <div className="mv-progress mt-5 w-48" aria-hidden="true" />
        <p className="mt-3 text-xs text-ink-subtle">{label}</p>
      </div>
    </div>
  )
}
