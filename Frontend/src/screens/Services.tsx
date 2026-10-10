// Health services hub: everything MediVara does in one place, a BMI calculator, and the
// partner services a full health platform needs (health ID, consultations, lab tests,
// pharmacy, insurance). Partner services are clearly marked unavailable (COPY-42) — the
// prototype never pretends to book, order or link anything (SRD 13 §4).
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { PageHeader } from '../components/page-header'
import { Badge, Card, CardBody, Field, Input } from '../components/ui'
import {
  IconAsk,
  IconBell,
  IconBrief,
  IconCalculator,
  IconCart,
  IconDoc,
  IconFlask,
  IconGrid,
  IconHand,
  IconHeartPulse,
  IconIdCard,
  IconPill,
  IconShield,
  IconStethoscope,
  IconTimeline,
  IconUsers,
} from '../components/icons'
import { COPY } from '../lib/copy'

export default function Services() {
  const { patientId = '' } = useParams()
  const base = `/p/${patientId}`
  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const isOwner = patientQ.data?.my_role === 'owner'

  const tools: { to: string; title: string; text: string; icon: ReactNode; hide?: boolean }[] = [
    { to: base, title: 'Ask MediVara', text: 'Chat or talk by voice about your records, with sources.', icon: <IconAsk /> },
    { to: `${base}/records`, title: 'Health records', text: 'Upload prescriptions, lab reports and discharge summaries.', icon: <IconDoc /> },
    { to: `${base}/timeline`, title: 'Health timeline', text: 'Your history in date order, with changes marked.', icon: <IconTimeline /> },
    { to: `${base}/vitals`, title: 'Vitals tracker', text: 'BP, sugar, weight, heart rate, SpO₂ and temperature.', icon: <IconHeartPulse /> },
    { to: `${base}/medicines`, title: 'Medicines', text: 'Every medicine in your documents and its source.', icon: <IconPill /> },
    { to: `${base}/reminders`, title: 'Reminders', text: 'Appointments, follow-ups and medicine times.', icon: <IconBell /> },
    { to: `${base}/brief`, title: 'Doctor visit brief', text: 'A one-page summary and questions for your doctor.', icon: <IconBrief /> },
    { to: `${base}/visit-assist`, title: 'Visit Assist (ISL)', text: 'Visit Card and ISL glossary for Deaf patients.', icon: <IconHand /> },
    { to: `${base}/medical-id`, title: 'Medical ID', text: 'Blood group, allergies and emergency contacts.', icon: <IconIdCard /> },
    { to: `${base}/family`, title: 'Family & sharing', text: 'Invite family by email and manage access.', icon: <IconUsers />, hide: !isOwner },
  ]

  const partners: { title: string; text: string; icon: ReactNode }[] = [
    { title: 'ABHA health ID', text: 'Create or link an Ayushman Bharat Health Account and pull records from ABDM.', icon: <IconShield /> },
    { title: 'Doctor consultations', text: 'Book in-clinic visits or video consultations with verified doctors.', icon: <IconStethoscope /> },
    { title: 'Lab tests at home', text: 'Book sample collection and receive reports straight into your records.', icon: <IconFlask /> },
    { title: 'Order medicines', text: 'Refill prescriptions from a licensed pharmacy.', icon: <IconCart /> },
    { title: 'Health insurance', text: 'Keep policy cards and claims alongside your records.', icon: <IconShield /> },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<IconGrid className="h-5 w-5" />}
        title="Health services"
        subtitle="Everything for your family’s health in one place."
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">In MediVara</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.filter((t) => !t.hide).map((t) => (
            <li key={t.to}>
              <Link to={t.to} className="mv-lift flex h-full items-start gap-3 rounded-2xl border border-canvas-border bg-white p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 [&_svg]:h-5 [&_svg]:w-5">{t.icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{t.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{t.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><IconCalculator className="h-4 w-4" /> Health calculators</h2>
        <BmiCalculator patientId={patientId} />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-ink">Partner services</h2>
        <p className="mb-3 text-xs text-ink-subtle">{COPY['COPY-42']}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((s) => (
            <li key={s.title} aria-disabled="true" className="flex h-full items-start gap-3 rounded-2xl border border-dashed border-canvas-border bg-canvas p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-subtle [&_svg]:h-5 [&_svg]:w-5">{s.icon}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink-muted">{s.title}</span>
                  <Badge tone="neutral">Not available yet</Badge>
                </span>
                <span className="mt-0.5 block text-xs text-ink-subtle">{s.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** BMI from height (Medical ID) and the latest weight reading, editable. General information only. */
function BmiCalculator({ patientId }: { patientId: string }) {
  const detailsQ = useQuery({ queryKey: ['details', patientId], queryFn: () => api.getProfileDetails(patientId) })
  const weightQ = useQuery({ queryKey: ['vitals', patientId, 'weight'], queryFn: () => api.listVitals(patientId, 'weight') })
  const [height, setHeight] = useState<string | null>(null)
  const [weight, setWeight] = useState<string | null>(null)

  const h = height ?? (detailsQ.data?.height_cm ? String(detailsQ.data.height_cm) : '')
  const w = weight ?? (weightQ.data?.items[0] ? String(weightQ.data.items[0].value) : '')
  const bmi = useMemo(() => {
    const hm = Number(h) / 100
    const kg = Number(w)
    if (!hm || !kg || hm < 0.3 || hm > 2.5 || kg < 1 || kg > 300) return null
    return kg / (hm * hm)
  }, [h, w])

  return (
    <Card>
      <CardBody>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1.2fr] sm:items-end">
          <Field label="Height (cm)" htmlFor="bmi-h">
            <Input id="bmi-h" inputMode="decimal" value={h} onChange={(e) => setHeight(e.target.value)} />
          </Field>
          <Field label="Weight (kg)" htmlFor="bmi-w">
            <Input id="bmi-w" inputMode="decimal" value={w} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <div className="rounded-xl bg-surface-muted px-4 py-2.5" aria-live="polite">
            <p className="text-xs text-ink-subtle">Body mass index</p>
            <p className="text-2xl font-semibold text-ink">{bmi ? bmi.toFixed(1) : '—'}</p>
          </div>
        </div>
        <details className="mt-3 text-xs text-ink-muted">
          <summary className="cursor-pointer font-medium text-ink">{COPY['COPY-37']}: what BMI ranges mean</summary>
          <p className="mt-2">
            BMI is weight (kg) divided by height (m) squared. The World Health Organization uses these adult ranges:
            under 18.5 underweight · 18.5–24.9 healthy · 25–29.9 overweight · 30 and above obesity. For many Asian
            adults, guidance uses lower cut-offs (23 and 27.5). BMI doesn’t measure body fat directly and isn’t a
            diagnosis — talk to your doctor about what’s right for you.
          </p>
        </details>
      </CardBody>
    </Card>
  )
}
