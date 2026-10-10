// SCR-15 — Settings, consent and privacy (FR-106, FR-051).
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { Badge, Card, CardBody } from '../components/ui'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'

export default function Settings() {
  const { patientId } = useParams()
  const { me } = useAuth()
  const prefs = useDisplayPrefs()
  const healthQ = useQuery({ queryKey: ['health'], queryFn: api.getHealth })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-ink">Settings</h1>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">Display</h2>
          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-1 text-sm text-ink">Text size</p>
              <div className="flex gap-2">
                {([100, 125, 150] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => prefs.setTextScale(s)}
                    className={cn('flex-1 rounded-lg border px-3 py-2 text-sm', prefs.textScale === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-muted')}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between text-sm text-ink">
              High contrast
              <input type="checkbox" checked={prefs.highContrast} onChange={(e) => prefs.setHighContrast(e.target.checked)} className="h-5 w-5" />
            </label>
            <label className="flex items-center justify-between text-sm text-ink">
              Reduce motion
              <input type="checkbox" checked={prefs.reducedMotion} onChange={(e) => prefs.setReducedMotion(e.target.checked)} className="h-5 w-5" />
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">Consents</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {me &&
              (['terms_and_disclaimer', 'ai_processing'] as const).map((key) => (
                <li key={key} className="flex items-center justify-between py-2">
                  <span className="text-ink">{key === 'ai_processing' ? 'AI processing' : 'Terms and disclaimer'}</span>
                  <Badge tone={me.consents[key]?.granted ? 'ok' : 'neutral'}>
                    {me.consents[key]?.granted ? 'Granted' : 'Not granted'}
                  </Badge>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-ink-subtle">
            Withdrawing AI processing stops new documents being read; existing information stays. (Withdrawal is specified for the prototype but not wired in dummy-data mode.)
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">Privacy</h2>
          <div className="mt-2 space-y-1 text-sm text-ink-muted">
            <p>{COPY['COPY-04']}</p>
            <p>MediVara asks Google not to store these requests (<code>store=false</code>). Synthetic data only.</p>
            <p>Browser speech features are cloud services in some browsers.</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">About</h2>
          <p className="mt-2 text-sm text-ink-muted">{COPY['COPY-01']}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-xs text-ink-subtle">Profile</dt><dd className="text-ink">{patientId}</dd></div>
            <div><dt className="text-xs text-ink-subtle">Contract version</dt><dd className="text-ink">{healthQ.data?.contract_version ?? '—'}</dd></div>
            <div><dt className="text-xs text-ink-subtle">AI mode</dt><dd className="text-ink">{healthQ.data?.ai.mode ?? '—'}</dd></div>
            <div><dt className="text-xs text-ink-subtle">Data</dt><dd className="text-ink">Synthetic (dummy-data)</dd></div>
          </dl>
        </CardBody>
      </Card>
    </div>
  )
}
