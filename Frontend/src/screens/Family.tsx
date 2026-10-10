// SCR-14 — Family & sharing (FR-080..084, redesign). Manage family members' profiles,
// invite people by email (they accept after signing in or creating an account), see
// pending invitations, revoke access instantly, and review the access log.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import type { Grant, OwnerInvitation, Relationship, Scope } from '../api/types'
import * as api from '../api/endpoints'
import { useToast } from '../context/ToastContext'
import { Badge, Button, Card, CardBody, Checkbox, Dialog, Field, Input, Tabs } from '../components/ui'
import { AccessDeniedPage, ErrorBanner, LoadingRows } from '../components/states'
import { PageHeader } from '../components/page-header'
import { AddFamilyMemberDialog } from '../components/family/AddFamilyMemberDialog'
import { Avatar } from '../components/shell/Sidebar'
import { IconCheck, IconCopy, IconMail, IconUserPlus, IconUsers } from '../components/icons'
import { COPY, fill } from '../lib/copy'
import { formatTimestampDate, RELATIONSHIP_LABELS, SCOPE_LABELS } from '../lib/format'

const SCOPE_OPTIONS: { id: Scope; label: string; hint: string; required?: boolean }[] = [
  { id: 'view_records', label: 'View records', hint: 'Documents, timeline, brief, vitals and chat', required: true },
  { id: 'upload_documents', label: 'Add records', hint: 'Upload documents and log vitals' },
  { id: 'manage_reminders', label: 'Manage reminders', hint: 'Create and complete reminders' },
]
const RELATIONSHIPS: Relationship[] = ['spouse', 'child', 'parent', 'sibling', 'grandparent', 'other']

function absoluteUrl(path: string) {
  return `${window.location.origin}${path}`
}

export default function Family() {
  const { patientId = '' } = useParams()
  const [tab, setTab] = useState<'people' | 'log'>('people')

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  if (patientQ.isLoading) return <LoadingRows rows={2} />
  if (patientQ.data && patientQ.data.my_role !== 'owner') {
    return <AccessDeniedPage />
  }
  const patientName = patientQ.data?.display_name ?? ''

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        icon={<IconUsers className="h-5 w-5" />}
        title="Family & sharing"
        subtitle="Keep your family’s records together, invite people by email, and decide what they can do. Remove access any time."
      />
      <Tabs
        tabs={[{ id: 'people', label: 'Family & access' }, { id: 'log', label: 'Access log' }]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === 'people' ? (
        <div className="space-y-5">
          <ManagedProfiles />
          <InviteForm patientId={patientId} patientName={patientName} />
          <PendingInvitations patientId={patientId} />
          <People patientId={patientId} patientName={patientName} />
        </div>
      ) : (
        <AccessLog patientId={patientId} />
      )}
    </div>
  )
}

function ManagedProfiles() {
  const [adding, setAdding] = useState(false)
  const q = useQuery({ queryKey: ['patients'], queryFn: api.getPatients })
  const owned = (q.data?.items ?? []).filter((p) => p.my_role === 'owner')
  const shared = (q.data?.items ?? []).filter((p) => p.my_role !== 'owner')
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">Family profiles</h2>
            <p className="text-xs text-ink-subtle">Profiles you manage, and profiles others have shared with you.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <IconUserPlus className="h-4 w-4" /> Add family member
          </Button>
        </div>
        {q.isLoading && <p className="mt-3 text-sm text-ink-subtle">Loading…</p>}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[...owned, ...shared].map((p) => (
            <li key={p.id}>
              <Link to={`/p/${p.id}`} className="flex items-center gap-3 rounded-xl border border-canvas-border p-3 transition-colors hover:bg-canvas">
                <Avatar id={p.id} name={p.display_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{p.display_name}</span>
                  <span className="block truncate text-xs text-ink-subtle">
                    {p.my_role === 'owner' ? 'You manage this' : `Shared by ${p.owner_display_name}`} · {p.stats.documents_total} documents
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <AddFamilyMemberDialog open={adding} onClose={() => setAdding(false)} />
      </CardBody>
    </Card>
  )
}

function InviteForm({ patientId, patientName }: { patientId: string; patientName: string }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState<Relationship>('spouse')
  const [scopes, setScopes] = useState<Scope[]>(['view_records'])
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ email: string; url: string; emailSent: boolean } | null>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const invite = useMutation({
    mutationFn: () => api.createInvitation(patientId, { email: email.trim(), scopes, relationship }),
    onSuccess: (res) => {
      setSent({ email: res.invitation.email, url: absoluteUrl(res.invite_url), emailSent: res.email_sent })
      setEmail('')
      setScopes(['view_records'])
      setConsent(false)
      setError(null)
      void qc.invalidateQueries({ queryKey: ['invitations', patientId] })
      void qc.invalidateQueries({ queryKey: ['audit', patientId] })
      toast('Invitation created')
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'INVITATION_EXISTS') setError('An invitation to this email is already pending.')
      else if (e instanceof ApiError && e.code === 'GRANT_EXISTS') setError('This person already has access.')
      else if (e instanceof ApiError && e.code === 'VALIDATION_ERROR') setError('Check the email address. You can’t invite yourself.')
      else setError('Couldn’t create the invitation. Try again.')
    },
  })

  function toggleScope(s: Scope) {
    if (s === 'view_records') return
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><IconMail className="h-4 w-4 text-ink-muted" /> Invite someone to {patientName}’s records</h2>
          <p className="text-xs text-ink-subtle">They accept after signing in — or creating a free account — with this email address.</p>
        </div>

        {sent && (
          <div className="rounded-xl border border-ok-border bg-ok-bg p-3 text-sm text-ok-fg" role="status">
            <p className="font-medium">
              {sent.emailSent ? `Invitation emailed to ${sent.email}.` : `Invitation ready for ${sent.email}.`}
            </p>
            <p className="mt-0.5 text-xs">
              {sent.emailSent
                ? 'You can also send them this link:'
                : 'Email delivery isn’t set up on this server, so send them this link yourself (for example on WhatsApp):'}
            </p>
            <CopyLink url={sent.url} />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
          <Field label="Email address" htmlFor="inv-email" error={email && !emailValid ? 'Enter a valid email address' : undefined}>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="They are your…" htmlFor="inv-rel">
            <select
              id="inv-rel"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as Relationship)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
            </select>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">What can they do?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SCOPE_OPTIONS.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-line p-2.5 text-sm has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/50"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(o.id)}
                  disabled={o.required}
                  onChange={() => toggleScope(o.id)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="block font-medium text-ink">{o.label}{o.required && <span className="font-normal text-ink-subtle"> (always)</span>}</span>
                  <span className="block text-xs text-ink-subtle">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-xl border border-line p-3">
          <Checkbox
            id="inv-consent"
            checked={consent}
            onChange={setConsent}
            label={fill(COPY['COPY-25'], { patient: patientName, name: email.trim() || 'this person', email: email.trim() || '—' })}
          />
        </div>
        {error && <p className="text-sm font-medium text-danger-fg" role="alert">{error}</p>}
        <div className="flex justify-end">
          <Button loading={invite.isPending} disabled={!emailValid || !consent} onClick={() => invite.mutate()}>
            <IconMail className="h-4 w-4" /> Send invitation
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs text-ink">{url}</code>
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          void navigator.clipboard.writeText(url).then(
            () => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            },
            () => undefined,
          )
        }
      >
        {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  )
}

const STATUS_TONE: Record<OwnerInvitation['status'], 'warn' | 'ok' | 'neutral' | 'danger'> = {
  pending: 'warn',
  accepted: 'ok',
  declined: 'neutral',
  cancelled: 'neutral',
  expired: 'danger',
}

function PendingInvitations({ patientId }: { patientId: string }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const q = useQuery({ queryKey: ['invitations', patientId], queryFn: () => api.listInvitations(patientId) })
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelInvitation(patientId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invitations', patientId] })
      toast('Invitation cancelled')
    },
    onError: () => toast('Couldn’t cancel this invitation.', 'error'),
  })
  const recent = (q.data ?? []).filter((i) => i.status !== 'cancelled').slice(0, 10)
  if (q.isLoading || recent.length === 0) return null

  return (
    <Card>
      <CardBody>
        <h2 className="text-sm font-semibold text-ink">Invitations</h2>
        <ul className="mt-2 divide-y divide-line">
          {recent.map((inv) => (
            <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  <span className="truncate">{inv.email}</span>
                  <Badge tone={STATUS_TONE[inv.status]}>{inv.status[0].toUpperCase() + inv.status.slice(1)}</Badge>
                </p>
                <p className="text-xs text-ink-subtle">
                  {RELATIONSHIP_LABELS[inv.relationship]} · {inv.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(', ')} · sent {formatTimestampDate(inv.created_at)}
                  {inv.status === 'pending' && ` · expires ${formatTimestampDate(inv.expires_at)}`}
                </p>
              </div>
              {inv.status === 'pending' && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void navigator.clipboard.writeText(absoluteUrl(inv.invite_url)).then(
                        () => toast('Invite link copied'),
                        () => toast('Couldn’t copy the link.', 'error'),
                      )
                    }
                  >
                    <IconCopy className="h-4 w-4" /> Copy link
                  </Button>
                  <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === inv.id} onClick={() => cancel.mutate(inv.id)}>
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

function People({ patientId, patientName }: { patientId: string; patientName: string }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [removing, setRemoving] = useState<Grant | null>(null)
  const q = useQuery({ queryKey: ['grants', patientId], queryFn: () => api.listGrants(patientId) })

  const revoke = useMutation({
    mutationFn: (grantId: string) => api.revokeGrant(patientId, grantId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['grants', patientId] })
      setRemoving(null)
      toast('Access removed')
    },
  })

  return (
    <Card>
      <CardBody>
        <h2 className="text-sm font-semibold text-ink">People with access to {patientName}’s records</h2>
        {q.isLoading && <LoadingRows rows={1} />}
        {q.error && <ErrorBanner error={q.error} onRetry={q.refetch} />}
        {q.data && (
          <ul className="mt-2 divide-y divide-line">
            {q.data.grants.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar id={g.grantee.user_id} name={g.grantee.display_name} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {g.grantee.display_name} {g.role === 'owner' && <Badge tone="brand">Owner</Badge>}
                    </p>
                    <p className="truncate text-xs text-ink-subtle">{g.grantee.email}</p>
                    {g.role !== 'owner' && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {g.scopes.map((s) => <Badge key={s} tone="neutral">{SCOPE_LABELS[s] ?? s}</Badge>)}
                      </div>
                    )}
                  </div>
                </div>
                {g.role !== 'owner' && (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(g)}>Remove</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          title="Remove access"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" loading={revoke.isPending} onClick={() => revoke.mutate(removing.id)}>Remove</Button>
            </>
          }
        >
          <p className="text-sm text-ink">{fill(COPY['COPY-26'], { name: removing.grantee.display_name, patient: patientName })}</p>
        </Dialog>
      )}
    </Card>
  )
}

function AccessLog({ patientId }: { patientId: string }) {
  const q = useQuery({ queryKey: ['audit', patientId], queryFn: () => api.listAuditEvents(patientId) })
  return (
    <div>
      {q.isLoading && <LoadingRows rows={2} />}
      {q.error && <ErrorBanner error={q.error} onRetry={q.refetch} />}
      {q.data && (
        <Card>
          <CardBody>
            <ul className="divide-y divide-line">
              {q.data.items.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm text-ink">{e.action_label}</p>
                    <p className="text-xs text-ink-subtle">{e.actor.display_name} · {formatTimestampDate(e.at)}</p>
                  </div>
                  {e.outcome === 'denied' && <Badge tone="danger">Denied</Badge>}
                </li>
              ))}
              {q.data.items.length === 0 && <li className="py-3 text-sm text-ink-muted">No activity yet.</li>}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
