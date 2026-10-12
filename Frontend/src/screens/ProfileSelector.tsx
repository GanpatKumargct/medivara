// SCR-03 — Profiles and family (FR-083, redesign). Shows invitations waiting for you,
// the profiles you manage and the ones shared with you, and lets you add a family
// member. Someone with one profile and no invitations goes straight to it.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import type { MyInvitation, PatientSummary } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Badge, Button, Card, CardBody } from '../components/ui'
import { LoadingRows, ErrorBanner } from '../components/states'
import { LogoLockup } from '../components/brand'
import { Avatar } from '../components/shell/Sidebar'
import { AddFamilyMemberDialog } from '../components/family/AddFamilyMemberDialog'
import { IconLogout, IconMail, IconUserPlus } from '../components/icons'
import { RELATIONSHIP_LABELS, SCOPE_LABELS } from '../lib/format'
import { t } from '../lib/i18n'

export default function ProfileSelector() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [adding, setAdding] = useState(false)
  const patientsQ = useQuery({ queryKey: ['patients'], queryFn: api.getPatients })
  const invitesQ = useQuery({ queryKey: ['my-invitations'], queryFn: api.listMyInvitations })

  useEffect(() => {
    if (patientsQ.data && invitesQ.data && patientsQ.data.items.length === 1 && invitesQ.data.length === 0) {
      navigate(`/p/${patientsQ.data.items[0].id}`, { replace: true })
    }
  }, [patientsQ.data, invitesQ.data, navigate])

  const owned = (patientsQ.data?.items ?? []).filter((p) => p.my_role === 'owner')
  const shared = (patientsQ.data?.items ?? []).filter((p) => p.my_role !== 'owner')

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <LogoLockup markSize={28} />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted sm:inline">{user?.email}</span>
          <Button size="sm" variant="ghost" onClick={() => void signOut().then(() => navigate('/login'))}>
            <IconLogout className="h-4 w-4" /> {t("Sign out")}</Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-12 pt-4">
        <h1 className="font-serif text-3xl text-ink">{t("Whose records?")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("Choose a profile, or add a family member whose health you look after.")}</p>

        {(invitesQ.data?.length ?? 0) > 0 && (
          <section className="mt-6 space-y-3" aria-label={t("Invitations")}>
            {invitesQ.data!.map((inv) => <InvitationCard key={inv.id} inv={inv} />)}
          </section>
        )}

        <div className="mt-6">
          {patientsQ.isLoading && <LoadingRows rows={2} />}
          {patientsQ.error && <ErrorBanner error={patientsQ.error} onRetry={patientsQ.refetch} />}
          {patientsQ.data && (
            <>
              <ProfileGrid title={t("Profiles you manage")} items={owned} onOpen={(id) => navigate(`/p/${id}`)} extra={
                <button
                  onClick={() => setAdding(true)}
                  className="mv-press flex h-full min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-canvas-border text-sm font-medium text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  <IconUserPlus className="h-6 w-6" /> {t("Add family member")}</button>
              } />
              {shared.length > 0 && (
                <ProfileGrid title={t("Shared with you")} items={shared} onOpen={(id) => navigate(`/p/${id}`)} />
              )}
            </>
          )}
        </div>
      </div>
      <AddFamilyMemberDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function ProfileGrid({
  title,
  items,
  onOpen,
  extra,
}: {
  title: string
  items: PatientSummary[]
  onOpen: (id: string) => void
  extra?: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h2>
      <ul className="mv-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <li key={p.id}>
            <button onClick={() => onOpen(p.id)} className="mv-lift w-full rounded-2xl border border-canvas-border bg-white p-4 text-left">
              <div className="flex items-center gap-3">
                <Avatar id={p.id} name={p.display_name} />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{p.display_name}</p>
                  <p className="truncate text-xs text-ink-subtle">
                    {p.my_role === 'owner' ? (p.age_years != null ? `${p.age_years} years` : t("You manage this")) : t("Shared by {{owner_display_name}}", { owner_display_name: p.owner_display_name })}
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div><dt className="text-[11px] text-ink-subtle">{t("Documents")}</dt><dd className="font-semibold text-ink">{p.stats.documents_total}</dd></div>
                <div><dt className="text-[11px] text-ink-subtle">{t("To review")}</dt><dd className="font-semibold text-ink">{p.stats.documents_needs_review}</dd></div>
                <div><dt className="text-[11px] text-ink-subtle">{t("Reminders")}</dt><dd className="font-semibold text-ink">{p.stats.upcoming_reminders}</dd></div>
              </dl>
              {p.my_role !== 'owner' && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.scopes.map((s) => <Badge key={s} tone="neutral">{SCOPE_LABELS[s] ?? s}</Badge>)}
                </div>
              )}
            </button>
          </li>
        ))}
        {extra && <li>{extra}</li>}
      </ul>
    </section>
  )
}

function InvitationCard({ inv }: { inv: MyInvitation }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const accept = useMutation({
    mutationFn: () => api.acceptInvitation(inv.id),
    onSuccess: ({ patient_id }) => {
      void qc.invalidateQueries({ queryKey: ['patients'] })
      void qc.invalidateQueries({ queryKey: ['my-invitations'] })
      navigate(`/p/${patient_id}`)
    },
    onError: () => toast(t("Couldn’t accept this invitation. It may have expired."), 'error'),
  })
  const decline = useMutation({
    mutationFn: () => api.declineInvitation(inv.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-invitations'] })
      toast(t("Invitation declined"), 'info')
    },
  })
  return (
    <Card className="border-brand-200">
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"><IconMail className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold text-ink">
              {inv.invited_by.display_name} {t("invited you to")}{' '}{inv.patient.display_name}{t("’s records")}</p>
            <p className="text-xs text-ink-subtle">
              {t("As their")}{' '}{RELATIONSHIP_LABELS[inv.relationship]?.toLowerCase() ?? 'family member'} · {inv.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(', ')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" loading={decline.isPending} onClick={() => decline.mutate()}>{t("Decline")}</Button>
          <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate()}>{t("Accept")}</Button>
        </div>
      </CardBody>
    </Card>
  )
}
