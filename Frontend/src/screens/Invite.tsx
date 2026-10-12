// Invitation landing page (/invite/:id). Signed out: explains the invite and offers
// sign-in or sign-up (returning here afterwards). Signed in: shows who invited you to
// which profile and with what permissions, and lets you accept or decline. The server
// only shows the invitation to the account whose email it was sent to.
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { Badge, Button, Card, CardBody } from '../components/ui'
import { Splash } from '../components/Splash'
import { LogoLockup } from '../components/brand'
import { IconMail } from '../components/icons'
import { formatTimestampDate, RELATIONSHIP_LABELS, SCOPE_LABELS } from '../lib/format'
import { t } from '../lib/i18n'

export default function Invite() {
  const { invitationId = '' } = useParams()
  const { user, me, loading, signOut } = useAuth()
  const here = `/invite/${invitationId}`

  if (loading) return <Splash label={t("Opening your invitation…")} />
  if (user && me?.onboarding_required) return <Navigate to="/onboarding" replace />

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 flex justify-center"><LogoLockup markSize={34} /></div>
        {user ? (
          <SignedIn invitationId={invitationId} email={user.email} onSwitch={() => void signOut()} />
        ) : (
          <Card>
            <CardBody className="space-y-4 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <IconMail className="h-6 w-6" />
              </span>
              <h1 className="font-serif text-2xl text-ink">{t("You’ve been invited to MediVara")}</h1>
              <p className="text-sm text-ink-muted">
                {t("A family member wants to share their health records with you. Sign in — or create a free account — with the email address the invitation was sent to.")}</p>
              <div className="flex flex-col gap-2">
                <Link to="/signup" state={{ from: here }}><Button className="w-full">{t("Create an account")}</Button></Link>
                <Link to="/login" state={{ from: here }}><Button variant="secondary" className="w-full">{t("I already have an account")}</Button></Link>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}

function SignedIn({ invitationId, email, onSwitch }: { invitationId: string; email: string; onSwitch: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [declined, setDeclined] = useState(false)
  const q = useQuery({ queryKey: ['my-invitations'], queryFn: api.listMyInvitations })
  const inv = q.data?.find((i) => i.id === invitationId)

  const accept = useMutation({
    mutationFn: () => api.acceptInvitation(invitationId),
    onSuccess: ({ patient_id }) => {
      void qc.invalidateQueries({ queryKey: ['patients'] })
      void qc.invalidateQueries({ queryKey: ['my-invitations'] })
      navigate(`/p/${patient_id}`, { replace: true })
    },
  })
  const decline = useMutation({
    mutationFn: () => api.declineInvitation(invitationId),
    onSuccess: () => {
      setDeclined(true)
      void qc.invalidateQueries({ queryKey: ['my-invitations'] })
    },
  })

  if (q.isLoading) return <Card><CardBody><p className="text-center text-sm text-ink-muted">{t("Checking your invitation…")}</p></CardBody></Card>

  if (declined) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <h1 className="font-serif text-2xl text-ink">{t("Invitation declined")}</h1>
          <p className="text-sm text-ink-muted">{t("You won’t get access to these records. The person who invited you can send a new invitation later.")}</p>
          <Link to="/profiles"><Button variant="secondary">{t("Go to my profiles")}</Button></Link>
        </CardBody>
      </Card>
    )
  }

  if (!inv) {
    return (
      <Card>
        <CardBody className="space-y-3 text-center">
          <h1 className="font-serif text-2xl text-ink">{t("This invitation isn’t available")}</h1>
          <p className="text-sm text-ink-muted">
            {t("It may have expired, been cancelled or already been used — or it was sent to a different email than")}{' '}<strong>{email}</strong>.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/profiles"><Button className="w-full">{t("Go to my profiles")}</Button></Link>
            <Button variant="ghost" className="w-full" onClick={onSwitch}>{t("Sign in with a different account")}</Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-ink">{t("Join")}{' '}{inv.patient.display_name}{t("’s health records")}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {inv.invited_by.display_name} {t("invited you as their")}{' '}{RELATIONSHIP_LABELS[inv.relationship]?.toLowerCase() ?? 'family member'}.
          </p>
        </div>
        <div className="rounded-xl bg-surface-muted p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("You’ll be able to")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {inv.scopes.map((s) => <Badge key={s} tone="brand">{SCOPE_LABELS[s] ?? s}</Badge>)}
          </div>
          <p className="mt-2 text-xs text-ink-subtle">{t("Expires")}{' '}{formatTimestampDate(inv.expires_at)}. {inv.invited_by.display_name} {t("can remove your access at any time.")}</p>
        </div>
        {(accept.error || decline.error) && (
          <p className="text-sm font-medium text-danger-fg" role="alert">{t("That didn’t work. Try again.")}</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button className="flex-1" loading={accept.isPending} onClick={() => accept.mutate()}>{t("Accept invitation")}</Button>
          <Button className="flex-1" variant="secondary" loading={decline.isPending} onClick={() => decline.mutate()}>{t("Decline")}</Button>
        </div>
      </CardBody>
    </Card>
  )
}
