// Create an account (redesign). New accounts get their own profile and go through the
// same onboarding (disclaimer + AI consent) as everyone else. Invitees land here from an
// invite link and accept the invitation afterwards.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/types'
import type { Sex } from '../api/types'
import { Button, Card, CardBody, Field, Input } from '../components/ui'
import { SyntheticWarning } from '../components/common'
import { LogoFull } from '../components/brand'
import { t } from '../lib/i18n'

export default function Signup() {
  const { signUp, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const from = location.state?.from?.startsWith('/') ? location.state.from : null
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [sex, setSex] = useState<Sex | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user && !busy) navigate(from ?? '/', { replace: true })
  }, [loading, user, busy, navigate, from])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordShort = password.length > 0 && password.length < 10
  const mismatch = confirm.length > 0 && confirm !== password
  const ready = name.trim() && emailValid && password.length >= 10 && password === confirm

  async function submit() {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const me = await signUp(email.trim(), password, name.trim(), sex || null)
      navigate(me.onboarding_required ? '/onboarding' : from ?? '/profiles', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_TAKEN') setError(t("An account already uses this email. Sign in instead."))
      else if (e instanceof ApiError && e.code === 'RATE_LIMITED') setError(t("Too many sign-ups from this network. Please wait a few minutes."))
      else if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setError(t("Some details need attention. Check your email and password."))
      else setError(t("Something went wrong. Try again."))
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoFull className="max-w-[200px] mix-blend-multiply" />
          <h1 className="mt-3 font-serif text-2xl text-ink">{t("Create your account")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("One place for your family’s health records.")}</p>
        </div>

        <Card>
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
              className="space-y-4"
            >
              <Field label={t("Your name")} htmlFor="su-name">
                <Input id="su-name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t("Sex (optional)")} htmlFor="su-sex" hint={t("Used for health tools such as Women’s health, and the app’s colour theme.")}>
                <select id="su-sex" value={sex} onChange={(e) => setSex(e.target.value as Sex | '')} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
                  <option value="">{t("Prefer not to say")}</option>
                  <option value="female">{t("Female")}</option>
                  <option value="male">{t("Male")}</option>
                  <option value="other">{t("Other")}</option>
                </select>
              </Field>
              <Field label={t("Email")} htmlFor="su-email" error={email && !emailValid ? t("Enter a valid email address") : undefined}>
                <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label={t("Password")} htmlFor="su-pw" hint={t("At least 10 characters")} error={passwordShort ? t("Use at least 10 characters") : undefined}>
                <Input id="su-pw" type="password" autoComplete="new-password" maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label={t("Confirm password")} htmlFor="su-pw2" error={mismatch ? t("Passwords don’t match") : undefined}>
                <Input id="su-pw2" type="password" autoComplete="new-password" maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              {error && <p className="text-sm font-medium text-danger-fg" role="alert">{error}</p>}
              <Button type="submit" className="w-full" loading={busy} disabled={!ready}>{t("Create account")}</Button>
            </form>
            <p className="mt-4 text-center text-sm text-ink-muted">
              {t("Already have an account?")}{' '}
              <Link to="/login" state={from ? { from } : undefined} className="font-semibold text-brand-700 hover:underline">{t("Sign in")}</Link>
            </p>
          </CardBody>
        </Card>

        <div className="mt-6">
          <SyntheticWarning />
        </div>
      </div>
    </div>
  )
}
