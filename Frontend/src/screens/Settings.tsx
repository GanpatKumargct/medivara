// SCR-15 — Settings, consent and privacy (FR-106, FR-051).
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { Badge, Card, CardBody } from '../components/ui'
import { PageHeader } from '../components/page-header'
import { IconSettings } from '../components/icons'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'

const CONSENT_LABELS = {
  terms_and_disclaimer: 'Terms and disclaimer',
  ai_processing: 'AI processing',
  voice_input: 'Voice input and voice conversation',
} as const

export default function Settings() {
  const { patientId } = useParams()
  const { me } = useAuth()
  const prefs = useDisplayPrefs()
  const healthQ = useQuery({ queryKey: ['health'], queryFn: api.getHealth })
  const voiceQ = useQuery({ queryKey: ['voice-config'], queryFn: api.getVoiceConfig, staleTime: 60_000 })

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        icon={<IconSettings className="h-5 w-5" />}
        title="Settings"
        subtitle="Display, layout, consent and privacy for this prototype."
      />

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
            <div>
              <p className="mb-1 text-sm text-ink">Colour theme</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Colour theme">
                {([['auto', 'Automatic'], ['rose', 'Rose'], ['blue', 'Blue']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={prefs.themePreference === id}
                    onClick={() => prefs.setThemePreference(id)}
                    className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm', prefs.themePreference === id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-muted')}
                  >
                    {id !== 'auto' && <span className={cn('h-3 w-3 rounded-full', id === 'rose' ? 'bg-[#E14B82]' : 'bg-[#0284F7]')} aria-hidden="true" />}
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-subtle">Automatic uses rose for profiles whose Medical ID says female, and blue for others.</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-ink">Sidebar position</p>
              <div className="flex gap-2">
                {(['left', 'right'] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => prefs.setSidebarSide(side)}
                    aria-pressed={prefs.sidebarSide === side}
                    className={cn('flex-1 rounded-lg border px-3 py-2 text-sm capitalize', prefs.sidebarSide === side ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-muted')}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between text-sm text-ink">
              Compact sidebar (icons only)
              <input type="checkbox" checked={prefs.sidebarCollapsed} onChange={(e) => prefs.setSidebarCollapsed(e.target.checked)} className="h-5 w-5" />
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">Consents</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {me &&
              (['terms_and_disclaimer', 'ai_processing', 'voice_input'] as const).map((key) => (
                <li key={key} className="flex items-center justify-between py-2">
                  <span className="text-ink">{CONSENT_LABELS[key]}</span>
                  <Badge tone={me.consents[key]?.granted ? 'ok' : 'neutral'}>
                    {me.consents[key]?.granted ? 'Granted' : 'Not granted'}
                  </Badge>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-ink-subtle">
            Withdrawing AI processing stops new documents being read; existing information stays.{api.API_MODE === 'dummy' ? ' (Withdrawal is not wired in dummy-data mode.)' : ' Asking questions and the brief summary then show matching lines from your documents instead of an AI answer.'}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">Privacy</h2>
          <div className="mt-2 space-y-1 text-sm text-ink-muted">
            <p>{COPY['COPY-04']}</p>
            <p>Requests go through OpenRouter to AI providers that don’t store or train on them (<code>data_collection: deny</code>). Synthetic data only.</p>
            <p>Browser speech features are cloud services in some browsers.</p>
            <p>{COPY['COPY-39']}</p>
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
            <div><dt className="text-xs text-ink-subtle">Voice conversation</dt><dd className="text-ink">{voiceQ.data ? (voiceQ.data.available ? 'Available (ElevenLabs)' : 'Not set up') : '—'}</dd></div>
            <div><dt className="text-xs text-ink-subtle">Data</dt><dd className="text-ink">{api.API_MODE === 'dummy' ? 'Synthetic (in-browser dummy data)' : 'Synthetic (MediVara backend)'}</dd></div>
          </dl>
        </CardBody>
      </Card>
    </div>
  )
}
