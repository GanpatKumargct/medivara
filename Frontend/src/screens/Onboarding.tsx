// SCR-01 — Welcome and onboarding (FR-003). Three steps: what MediVara does,
// consent (both required), display quick-setup. No patient data loads before consent.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { Button, Card, CardBody, Checkbox } from '../components/ui'
import { LogoLockup } from '../components/brand'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'
import { t } from '../lib/i18n'

export default function Onboarding() {
  const navigate = useNavigate()
  const { refreshMe } = useAuth()
  const prefs = useDisplayPrefs()
  const [step, setStep] = useState(1)
  const [terms, setTerms] = useState(false)
  const [ai, setAi] = useState(false)
  const [busy, setBusy] = useState(false)

  async function finish() {
    setBusy(true)
    try {
      await api.recordConsent('terms_and_disclaimer', true)
      await api.recordConsent('ai_processing', true)
      await refreshMe()
      navigate('/profiles', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <div className="mb-5 flex justify-center">
        <LogoLockup markSize={34} />
      </div>
      <ol className="mb-4 flex items-center justify-center gap-2 text-xs text-ink-subtle" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <li key={n} className={cn('flex items-center gap-2')}>
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                step >= n ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-subtle",
              )}
            >
              {n}
            </span>
            {n < 3 && <span className="h-px w-6 bg-line" />}
          </li>
        ))}
      </ol>
      <p className="mb-2 text-center text-sm font-medium text-ink-muted">{t("Step")}{' '}{step} {t("of 3")}</p>

      <Card>
        <CardBody>
          {step === 1 && (
            <section aria-labelledby="ob-h1">
              <h1 id="ob-h1" className="text-xl font-semibold text-brand-900">
                {t("What MediVara does")}</h1>
              <p className="mt-3 text-sm text-ink-muted">{COPY['COPY-01']}</p>
              <ul className="mt-4 space-y-2 text-sm text-ink">
                <li>📄 <strong>{t("Organise")}</strong> {t("your prescriptions, lab reports and discharge summaries.")}</li>
                <li>🕑 <strong>{t("Understand")}</strong> {t("your history on a timeline, with sources.")}</li>
                <li>💬 <strong>{t("Prepare")}</strong> {t("questions for your doctor.")}</li>
              </ul>
              <div className="mt-4 rounded-lg border border-line bg-surface-muted p-3 text-sm text-ink-muted">
                <p className="font-medium text-ink">{t("What it doesn’t do")}</p>
                <p>{t("It does not diagnose, treat or give medical advice, and it can make mistakes.")}</p>
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="ob-h2">
              <h1 id="ob-h2" className="text-xl font-semibold text-brand-900">
                {t("Your consent")}</h1>
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-line p-3">
                  <Checkbox id="c-terms" checked={terms} onChange={setTerms} label={COPY['COPY-03']} />
                </div>
                <div className="rounded-lg border border-line p-3">
                  <Checkbox id="c-ai" checked={ai} onChange={setAi} label={COPY['COPY-04']} />
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="ob-h3">
              <h1 id="ob-h3" className="text-xl font-semibold text-brand-900">
                {t("Make it comfortable")}</h1>
              <p className="mt-2 text-sm text-ink-muted">{t("You can change these any time from the “Aa” menu.")}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-1 text-sm font-medium text-ink">{t("Text size")}</p>
                  <div className="flex gap-2">
                    {([100, 125, 150] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => prefs.setTextScale(s)}
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-2 text-sm',
                          prefs.textScale === s ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-muted",
                        )}
                      >
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-lg border border-line p-3 text-sm text-ink">
                  {t("High contrast")}<input type="checkbox" checked={prefs.highContrast} onChange={(e) => prefs.setHighContrast(e.target.checked)} className="h-5 w-5" />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-line p-3 text-sm text-ink">
                  {t("Reduce motion")}<input type="checkbox" checked={prefs.reducedMotion} onChange={(e) => prefs.setReducedMotion(e.target.checked)} className="h-5 w-5" />
                </label>
                <p className="rounded-lg bg-surface-muted p-3 text-sm text-ink-muted">
                  {t("Preview: this text follows your chosen size and contrast.")}</p>
              </div>
            </section>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
              {t("Back")}</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 2 && !(terms && ai)}>
                {step === 2 ? t("Accept and continue") : t("Next")}
              </Button>
            ) : (
              <Button onClick={() => void finish()} loading={busy}>
                {t("Finish")}</Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
