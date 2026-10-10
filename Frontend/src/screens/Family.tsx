// SCR-14 — Family sharing and permissions (FR-080..084). Owner grants scoped
// access with consent and can revoke instantly; access log shows who did what.
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import type { Grant, Scope } from '../api/types'
import * as api from '../api/endpoints'
import { useToast } from '../context/ToastContext'
import { Alert, Badge, Button, Card, CardBody, Checkbox, Dialog, Field, Input, Tabs } from '../components/ui'
import { AccessDeniedPage, ErrorBanner, LoadingRows } from '../components/states'
import { COPY, fill } from '../lib/copy'
import { formatTimestampDate } from '../lib/format'

const SCOPE_OPTIONS: { id: Scope; label: string; required?: boolean }[] = [
  { id: 'view_records', label: 'View records', required: true },
  { id: 'upload_documents', label: 'Upload documents' },
  { id: 'manage_reminders', label: 'Manage reminders' },
]

export default function Family() {
  const { patientId = '' } = useParams()
  const [tab, setTab] = useState<'people' | 'log'>('people')

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  if (patientQ.isLoading) return <LoadingRows rows={2} />
  if (patientQ.data && patientQ.data.my_role !== 'owner') {
    return <AccessDeniedPage />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Family sharing</h1>
      <Tabs
        tabs={[{ id: 'people', label: 'People with access' }, { id: 'log', label: 'Access log' }]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />
      {tab === 'people' ? <People patientId={patientId} patientName={patientQ.data?.display_name ?? ''} /> : <AccessLog patientId={patientId} />}
    </div>
  )
}

function People({ patientId, patientName }: { patientId: string; patientName: string }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [removing, setRemoving] = useState<Grant | null>(null)

  const q = useQuery({ queryKey: ['grants', patientId], queryFn: () => api.listGrants(patientId) })

  const revoke = useMutation({
    mutationFn: (grantId: string) => api.revokeGrant(patientId, grantId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['grants', patientId] }); setRemoving(null); toast('Access removed') },
  })

  return (
    <div className="space-y-4">
      {q.isLoading && <LoadingRows rows={2} />}
      {q.error && <ErrorBanner error={q.error} onRetry={q.refetch} />}
      {q.data && (
        <Card>
          <CardBody>
            <ul className="divide-y divide-line">
              {q.data.grants.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {g.grantee.display_name} {g.role === 'owner' && <Badge tone="brand">Owner</Badge>}
                    </p>
                    <p className="truncate text-xs text-ink-subtle">{g.grantee.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {g.scopes.map((s) => <Badge key={s} tone="neutral">{SCOPE_OPTIONS.find((o) => o.id === s)?.label ?? s}</Badge>)}
                    </div>
                  </div>
                  {g.role !== 'owner' && (
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(g)}>Remove</Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <ShareForm patientId={patientId} patientName={patientName} onShared={() => { void qc.invalidateQueries({ queryKey: ['grants', patientId] }); toast('Access shared') }} />

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
    </div>
  )
}

function ShareForm({ patientId, patientName, onShared }: { patientId: string; patientName: string; onShared: () => void }) {
  const [email, setEmail] = useState('')
  const [scopes, setScopes] = useState<Scope[]>(['view_records'])
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const share = useMutation({
    mutationFn: () => api.createGrant(patientId, email, scopes),
    onSuccess: () => { setEmail(''); setScopes(['view_records']); setConsent(false); setError(null); onShared() },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'USER_NOT_FOUND') setError('No MediVara account uses this email.')
      else if (e instanceof ApiError && e.code === 'GRANT_EXISTS') setError('This person already has access.')
      else setError('Could not share access. Try again.')
    },
  })

  function toggleScope(s: Scope) {
    if (s === 'view_records') return
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Share with someone</h2>
        <Field label="Email of an existing MediVara account" htmlFor="share-email">
          <Input id="share-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@medivara.test" />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">Permissions</legend>
          <div className="space-y-1">
            {SCOPE_OPTIONS.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={scopes.includes(o.id)} disabled={o.required} onChange={() => toggleScope(o.id)} className="h-4 w-4" />
                {o.label} {o.required && <span className="text-xs text-ink-subtle">(required)</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="rounded-lg border border-line p-3">
          <Checkbox
            id="share-consent"
            checked={consent}
            onChange={setConsent}
            label={fill(COPY['COPY-25'], { patient: patientName, name: email || 'this person', email: email || '—' })}
          />
        </div>
        {error && <p className="text-sm text-danger-fg" role="alert">{error}</p>}
        <div className="flex justify-end">
          <Button loading={share.isPending} disabled={!email || !consent} onClick={() => share.mutate()}>Share</Button>
        </div>
        <p className="text-xs text-ink-subtle">Demo tip: share with <code>karthik.demo@medivara.test</code> or <code>ravi.demo@medivara.test</code>.</p>
      </CardBody>
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
