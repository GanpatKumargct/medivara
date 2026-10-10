// SCR-02 — Login and demo entry (FR-001). Demo cards sign in through the same
// API-02 call; there is no client-side bypass.
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/types'
import { DEMO_CARDS, DEMO_PASSWORD, USERS } from '../dummy-data/accounts'
import { Button, Card, CardBody, Field, Input } from '../components/ui'
import { SyntheticWarning } from '../components/common'
import { LogoFull } from '../components/brand'
import { COPY } from '../lib/copy'

export default function Login() {
  const { signIn, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { sessionEnded?: boolean } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [loading, user, navigate])

  async function submit(nextEmail: string, nextPassword: string) {
    setBusy(true)
    setError(null)
    try {
      const me = await signIn(nextEmail, nextPassword)
      if (me.onboarding_required) navigate('/onboarding', { replace: true })
      else navigate('/profiles', { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? COPY['COPY-34a'] : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-fade">
      {/* Soft animated brand orbs (decorative). */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="mv-orb" style={{ width: 340, height: 340, top: -80, left: -60, background: '#0284F7', animationDelay: '0s' }} />
        <div className="mv-orb" style={{ width: 300, height: 300, bottom: -70, right: -40, background: '#10B981', animationDelay: '-4s' }} />
        <div className="mv-orb" style={{ width: 220, height: 220, top: '40%', right: '12%', background: '#06B6D4', animationDelay: '-8s' }} />
      </div>
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="animate-fade-up mb-6 flex flex-col items-center text-center">
        <LogoFull className="max-w-[220px] mix-blend-multiply" />
        <p className="mt-2 text-sm text-ink-muted">
          Your medical documents, organised and explained — with sources.
        </p>
      </div>

      {location.state?.sessionEnded && (
        <div className="mb-4 rounded-lg border border-warn-border bg-warn-bg p-3 text-sm text-warn-fg" role="status">
          {COPY['COPY-33']}
        </div>
      )}

      <Card className="animate-scale-in">
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit(email, password)
            }}
            className="space-y-4"
          >
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </Field>
            {error && (
              <p id="login-error" className="text-sm font-medium text-danger-fg" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={busy} disabled={!email || !password}>
              Sign in
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">Demo accounts (synthetic data)</h2>
        <div className="mv-stagger space-y-2">
          {DEMO_CARDS.map((card) => {
            const u = USERS.find((x) => x.id === card.user_id)!
            return (
              <Card key={card.user_id} interactive onClick={() => !busy && void submit(u.email, DEMO_PASSWORD)}>
                <CardBody className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {u.display_name} <span className="font-normal text-ink-subtle">· {card.role}</span>
                    </p>
                    <p className="truncate text-xs text-ink-subtle">{u.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    aria-label={`Sign in as ${u.display_name}, ${card.role}, synthetic demo account`}
                    onClick={() => void submit(u.email, DEMO_PASSWORD)}
                  >
                    Sign in
                  </Button>
                </CardBody>
              </Card>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-ink-subtle">All demo passwords are “{DEMO_PASSWORD}”.</p>
      </div>

      <div className="mt-6">
        <SyntheticWarning />
      </div>
    </div>
    </div>
  )
}
