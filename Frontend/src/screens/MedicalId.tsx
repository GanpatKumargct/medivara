// Medical ID: an emergency card the user fills in themselves (blood group, allergies,
// conditions, emergency contacts), printable, alongside the allergies and conditions
// found in their documents. Only the profile owner can edit it.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import type { EmergencyContact, ProfileDetails, ProfileDetailsInput, TimelineEvent } from '../api/types'
import { useToast } from '../context/ToastContext'
import { PageHeader } from '../components/page-header'
import { ErrorBanner, LoadingRows } from '../components/states'
import { UnverifiedBadge } from '../components/common'
import { Button, Card, CardBody, Field, Input, Textarea } from '../components/ui'
import { IconEdit, IconIdCard, IconPlus, IconPrint, IconTrash } from '../components/icons'
import { formatDate, RELATIONSHIP_LABELS } from '../lib/format'
import { t } from '../lib/i18n'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const SEX_LABELS: Record<string, string> = { female: t("Female"), male: t("Male"), other: t("Other") }

function ageFrom(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age -= 1
  return age
}

export default function MedicalId() {
  const { patientId = '' } = useParams()
  const [editing, setEditing] = useState(false)
  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const detailsQ = useQuery({ queryKey: ['details', patientId], queryFn: () => api.getProfileDetails(patientId) })
  const factsQ = useQuery({
    queryKey: ['timeline', patientId, ['allergy', 'condition'], true, 'desc'],
    queryFn: () => api.getTimeline(patientId, { types: ['allergy', 'condition'], order: 'desc' }),
  })
  const isOwner = patientQ.data?.my_role === 'owner'

  if (detailsQ.isLoading || patientQ.isLoading) return <LoadingRows rows={2} />
  if (detailsQ.error) return <ErrorBanner error={detailsQ.error} onRetry={detailsQ.refetch} />
  const d = detailsQ.data!
  const p = patientQ.data
  const facts = [...(factsQ.data?.groups.flatMap((g) => g.events) ?? []), ...(factsQ.data?.undated ?? [])].filter(
    (e) => (e.event_type === 'allergy' || e.event_type === 'condition') && e.status !== 'rejected',
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        icon={<IconIdCard className="h-5 w-5" />}
        title={t("Medical ID")}
        subtitle={t("Key details for an emergency or a new doctor. You enter these yourself; keep them up to date.")}
        actions={
          !editing && (
            <>
              <Button variant="secondary" onClick={() => window.print()}><IconPrint className="h-4 w-4" /> {t("Print")}</Button>
              {isOwner && <Button onClick={() => setEditing(true)}><IconEdit className="h-4 w-4" /> {t("Edit")}</Button>}
            </>
          )
        }
      />

      {editing ? (
        <DetailsForm patientId={patientId} details={d} onDone={() => setEditing(false)} />
      ) : (
        <Card className="print-page">
          <div className="border-b border-danger-border bg-danger-bg px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-danger-fg">{t("Medical ID · In an emergency call 112")}</p>
          </div>
          <CardBody className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl text-ink">{p?.display_name}</h2>
                <p className="text-sm text-ink-muted">
                  {[
                    d.date_of_birth ? t("{{ageFrom}} years (born {{formatDate}})", { ageFrom: ageFrom(d.date_of_birth), formatDate: formatDate(d.date_of_birth) }) : p?.age_years != null ? `${p.age_years} years` : null,
                    d.sex ? SEX_LABELS[d.sex] : null,
                    d.relationship && d.relationship !== 'self' ? RELATIONSHIP_LABELS[d.relationship] : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || t("Age and sex not added")}
                </p>
              </div>
              <dl className="flex gap-6 text-center">
                <div>
                  <dt className="text-xs text-ink-subtle">{t("Blood group")}</dt>
                  <dd className="text-2xl font-semibold text-ink">{d.blood_group ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">{t("Height")}</dt>
                  <dd className="text-2xl font-semibold text-ink">{d.height_cm ? `${d.height_cm} cm` : '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <NoteBlock label={t("Allergies")} text={d.allergies_note} />
              <NoteBlock label={t("Conditions")} text={d.conditions_note} />
              <NoteBlock label={t("Current medicines")} text={d.medications_note} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("Emergency contacts")}</p>
              {d.emergency_contacts.length === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">{t("None added.")}</p>
              ) : (
                <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {d.emergency_contacts.map((c, i) => (
                    <li key={i} className="rounded-xl border border-line p-3">
                      <p className="text-sm font-medium text-ink">{c.name}{c.relation && <span className="font-normal text-ink-subtle"> · {c.relation}</span>}</p>
                      <a href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`} className="text-sm font-medium text-brand-700 hover:underline">{c.phone}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {d.organ_donor !== null && (
              <p className="text-sm text-ink">{t("Organ donor:")}{' '}<span className="font-medium">{d.organ_donor ? t("Yes") : t("No")}</span></p>
            )}
            <p className="text-xs text-ink-subtle">
              {t("Entered by the profile owner")}{d.updated_at ? t(", last updated {{formatDate}}", { formatDate: formatDate(d.updated_at) }) : ''}{t(". Not verified by a clinician.")}</p>
          </CardBody>
        </Card>
      )}

      <Card className="no-print">
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">{t("Allergies and conditions in your documents")}</h2>
          <p className="text-xs text-ink-subtle">{t("As written in your records. Confirm anything important with your doctor.")}</p>
          {facts.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">{t("None of your documents mention allergies or conditions yet.")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {facts.map((e) => <FactRow key={e.id} event={e} base={`/p/${patientId}`} />)}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function NoteBlock({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="rounded-xl bg-surface-muted p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{text || t("Not added")}</p>
    </div>
  )
}

function FactRow({ event, base }: { event: TimelineEvent; base: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-ink">
          <span className="text-ink-subtle">{event.event_type === 'allergy' ? t("Allergy") : t("Condition")}:</span> {event.title}
        </p>
        <p className="text-xs text-ink-subtle">{formatDate(event.date)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {event.status === 'unverified' && <UnverifiedBadge />}
        <Link to={`${base}/records/${event.document_id}`} className="text-xs font-medium text-brand-700 hover:underline">{t("Source")}</Link>
      </div>
    </li>
  )
}

function DetailsForm({ patientId, details, onDone }: { patientId: string; details: ProfileDetails; onDone: () => void }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState<ProfileDetailsInput>(() => {
    const { patient_id: _p, updated_at: _u, ...rest } = details
    return rest
  })
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setError(null), [form])

  const set = <K extends keyof ProfileDetailsInput>(k: K, v: ProfileDetailsInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setContact = (i: number, patch: Partial<EmergencyContact>) =>
    set('emergency_contacts', form.emergency_contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  const contactsBad = form.emergency_contacts.some((c) => !c.name.trim() || !/^[0-9+()\- ]{3,20}$/.test(c.phone.trim()))
  const heightBad = form.height_cm !== null && (form.height_cm < 30 || form.height_cm > 250)
  const dobBad = !!form.date_of_birth && form.date_of_birth > new Date().toISOString().slice(0, 10)

  const save = useMutation({
    mutationFn: () =>
      api.updateProfileDetails(patientId, {
        ...form,
        allergies_note: form.allergies_note?.trim() || null,
        conditions_note: form.conditions_note?.trim() || null,
        medications_note: form.medications_note?.trim() || null,
        emergency_contacts: form.emergency_contacts.map((c) => ({ name: c.name.trim(), phone: c.phone.trim(), relation: c.relation.trim() })),
      }),
    onSuccess: (d) => {
      qc.setQueryData(['details', patientId], d)
      toast(t("Medical ID saved"))
      onDone()
    },
    onError: () => setError(t("Couldn’t save. Check the highlighted fields and try again.")),
  })

  const select = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink'
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Date of birth")} htmlFor="mid-dob" error={dobBad ? t("Can’t be in the future") : undefined}>
            <Input id="mid-dob" type="date" value={form.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value || null)} />
          </Field>
          <Field label={t("Sex")} htmlFor="mid-sex">
            <select id="mid-sex" className={select} value={form.sex ?? ''} onChange={(e) => set('sex', (e.target.value || null) as ProfileDetailsInput['sex'])}>
              <option value="">{t("Not specified")}</option>
              {Object.entries(SEX_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label={t("Blood group")} htmlFor="mid-bg">
            <select id="mid-bg" className={select} value={form.blood_group ?? ''} onChange={(e) => set('blood_group', e.target.value || null)}>
              <option value="">{t("Not known")}</option>
              {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label={t("Height (cm)")} htmlFor="mid-h" error={heightBad ? t("Enter 30–250 cm") : undefined}>
            <Input
              id="mid-h"
              inputMode="decimal"
              value={form.height_cm ?? ''}
              onChange={(e) => set('height_cm', e.target.value === '' ? null : Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label={t("Allergies")} htmlFor="mid-al" hint={t("e.g. Sulfa drugs — rash")}>
          <Textarea id="mid-al" rows={2} maxLength={500} value={form.allergies_note ?? ''} onChange={(e) => set('allergies_note', e.target.value)} />
        </Field>
        <Field label={t("Conditions")} htmlFor="mid-co">
          <Textarea id="mid-co" rows={2} maxLength={500} value={form.conditions_note ?? ''} onChange={(e) => set('conditions_note', e.target.value)} />
        </Field>
        <Field label={t("Current medicines")} htmlFor="mid-me">
          <Textarea id="mid-me" rows={2} maxLength={500} value={form.medications_note ?? ''} onChange={(e) => set('medications_note', e.target.value)} />
        </Field>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink">{t("Emergency contacts")}</legend>
          <div className="space-y-2">
            {form.emergency_contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_0.8fr_auto] items-center gap-2">
                <Input aria-label={t("Contact {{value}} name", { value: i + 1 })} placeholder={t("Name")} maxLength={80} value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                <Input aria-label={t("Contact {{value}} phone", { value: i + 1 })} placeholder={t("Phone")} inputMode="tel" maxLength={20} value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />
                <Input aria-label={t("Contact {{value}} relation", { value: i + 1 })} placeholder={t("Relation")} maxLength={40} value={c.relation} onChange={(e) => setContact(i, { relation: e.target.value })} />
                <button
                  onClick={() => set('emergency_contacts', form.emergency_contacts.filter((_, j) => j !== i))}
                  aria-label={t("Remove contact {{value}}", { value: i + 1 })}
                  className="rounded p-1.5 text-ink-subtle hover:bg-danger-bg hover:text-danger-fg"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            ))}
            {form.emergency_contacts.length < 5 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => set('emergency_contacts', [...form.emergency_contacts, { name: '', phone: '', relation: '' }])}
              >
                <IconPlus className="h-4 w-4" /> {t("Add contact")}</Button>
            )}
            {contactsBad && <p className="text-xs text-danger-fg">{t("Each contact needs a name and a phone number (digits, +, -, spaces).")}</p>}
          </div>
        </fieldset>

        <Field label={t("Organ donor")} htmlFor="mid-od">
          <select
            id="mid-od"
            className={select}
            value={form.organ_donor === null ? '' : form.organ_donor ? 'yes' : 'no'}
            onChange={(e) => set('organ_donor', e.target.value === '' ? null : e.target.value === 'yes')}
          >
            <option value="">{t("Not specified")}</option>
            <option value="yes">{t("Yes")}</option>
            <option value="no">{t("No")}</option>
          </select>
        </Field>

        {error && <p className="text-sm font-medium text-danger-fg" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>{t("Cancel")}</Button>
          <Button loading={save.isPending} disabled={contactsBad || heightBad || dobBad} onClick={() => save.mutate()}>{t("Save")}</Button>
        </div>
      </CardBody>
    </Card>
  )
}
