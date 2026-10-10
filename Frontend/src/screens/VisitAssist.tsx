// SCR-11 — ISL Visit Assist (FR-060, FR-061). A Visit Card and a glossary of
// official ISL dictionary terms. It does NOT translate sign language (COPY-17).
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import * as api from '../api/endpoints'
import { GLOSSARY } from '../dummy-data/glossary'
import { Alert, Badge, Button, Card, CardBody, Input, Tabs } from '../components/ui'
import { LoadingRows } from '../components/states'
import { COPY } from '../lib/copy'
import { formatDate } from '../lib/format'
import { IconExternal, IconPrint, IconSearch, IconX } from '../components/icons'

const STORAGE_KEY = 'mv_visit_card_choices'

export default function VisitAssist() {
  const { patientId = '' } = useParams()
  const [tab, setTab] = useState<'card' | 'glossary' | 'about'>('card')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">ISL Visit Assist</h1>
        <p className="mt-1 text-sm text-ink-muted">Help staff understand your communication needs. This does not translate sign language.</p>
      </div>
      <div className="no-print">
        <Tabs
          tabs={[{ id: 'card', label: 'Visit Card' }, { id: 'glossary', label: 'ISL Glossary' }, { id: 'about', label: 'About' }]}
          active={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
      </div>
      <div className="mt-4">
        {tab === 'card' && <VisitCard patientId={patientId} />}
        {tab === 'glossary' && <Glossary />}
        {tab === 'about' && <About />}
      </div>
    </div>
  )
}

const QUICK_PHRASES = ['Please write it down', 'Please repeat', 'Please slow down', 'I need an interpreter', 'Thank you']

function loadChoices(): boolean[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  // Default: first three statements ticked.
  return COPY['COPY-19'].map((_, i) => i < 3)
}

function VisitCard({ patientId }: { patientId: string }) {
  const [choices, setChoices] = useState<boolean[]>(loadChoices)
  const [note, setNote] = useState('')
  const [fullScreen, setFullScreen] = useState(false)

  const briefQ = useQuery({
    queryKey: ['latest-brief', patientId],
    queryFn: () => api.getLatestBrief(patientId),
    retry: false,
  })

  function toggle(i: number) {
    setChoices((c) => {
      const next = c.map((v, idx) => (idx === i ? !v : v))
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const noBrief = briefQ.error instanceof ApiError && briefQ.error.code === 'NOT_FOUND'
  const brief = briefQ.data
  const selectedStatements = COPY['COPY-19'].filter((_, i) => choices[i])

  const keyFacts = useMemo(() => {
    if (!brief) return null
    return {
      medicines: brief.sections.medications.map((m) => m.text),
      allergies: brief.sections.allergies.items.map((a) => a.text),
      allergyStatus: brief.sections.allergies.status,
      conditions: brief.sections.conditions.map((c) => c.text),
    }
  }, [brief])

  return (
    <div className="space-y-4">
      {/* Builder */}
      <Card className="no-print">
        <CardBody>
          <h2 className="text-sm font-semibold text-ink">Communication needs</h2>
          <ul className="mt-2 space-y-2">
            {COPY['COPY-19'].map((statement, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                  <input type="checkbox" checked={choices[i]} onChange={() => toggle(i)} className="mt-0.5 h-5 w-5" />
                  <span>{statement}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <label htmlFor="vc-note" className="mb-1 block text-sm font-medium text-ink">Optional note (max 140)</label>
            <Input id="vc-note" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="Anything else you'd like staff to know" />
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setFullScreen(true)}>Show to staff</Button>
            <Button variant="secondary" onClick={() => window.print()}><IconPrint className="h-4 w-4" /> Print</Button>
          </div>
        </CardBody>
      </Card>

      {/* Preview / printable card */}
      <Card className="print-page">
        <CardBody>
          <CardContent statements={selectedStatements} note={note} keyFacts={keyFacts} noBrief={noBrief} patientId={patientId} briefDate={brief?.created_at} />
        </CardBody>
      </Card>

      {fullScreen && (
        <FullScreenCard statements={selectedStatements} note={note} keyFacts={keyFacts} onClose={() => setFullScreen(false)} />
      )}
    </div>
  )
}

function CardContent({
  statements,
  note,
  keyFacts,
  noBrief,
  patientId,
  briefDate,
}: {
  statements: string[]
  note: string
  keyFacts: { medicines: string[]; allergies: string[]; allergyStatus: string; conditions: string[] } | null
  noBrief: boolean
  patientId?: string
  briefDate?: string
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {statements.map((s, i) => (
          <li key={i} className="rounded-lg bg-brand-50 px-3 py-2 text-base font-medium text-ink">{s}</li>
        ))}
      </ul>
      {note && <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink">{note}</p>}

      {keyFacts ? (
        <div className="border-t border-line pt-3 text-sm">
          <p className="font-semibold text-ink">Key facts from my records</p>
          {keyFacts.medicines.length > 0 && (
            <p className="mt-1 text-ink-muted"><span className="font-medium text-ink">Current medicines:</span> {keyFacts.medicines.join('; ')}</p>
          )}
          <p className="mt-1 text-ink-muted">
            <span className="font-medium text-ink">Allergies:</span>{' '}
            {keyFacts.allergyStatus === 'conflicting' && <Badge tone="warn">Documents differ</Badge>}{' '}
            {keyFacts.allergies.length ? keyFacts.allergies.join('; ') : 'None documented'}
          </p>
          {keyFacts.conditions.length > 0 && (
            <p className="mt-1 text-ink-muted"><span className="font-medium text-ink">Conditions:</span> {keyFacts.conditions.join('; ')}</p>
          )}
          {briefDate && <p className="mt-1 text-xs text-ink-subtle">From my brief, {formatDate(briefDate.slice(0, 10))}</p>}
        </div>
      ) : noBrief && patientId ? (
        <Alert tone="info">
          Create a brief to add your key medical facts to this card.{' '}
          <Link to={`/p/${patientId}/brief`} className="font-medium text-brand-700 underline">Create brief</Link>
        </Alert>
      ) : null}
    </div>
  )
}

function FullScreenCard({
  statements,
  note,
  keyFacts,
  onClose,
}: {
  statements: string[]
  note: string
  keyFacts: { medicines: string[]; allergies: string[]; allergyStatus: string; conditions: string[] } | null
  onClose: () => void
}) {
  // AAA contrast (black on white), text ≥ 28px, works without sound.
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-6 text-black">
      <button
        onClick={onClose}
        aria-label="Exit full screen"
        className="fixed right-4 top-4 rounded-lg border-2 border-black px-3 py-2 text-base font-bold"
      >
        <IconX /> Exit
      </button>
      <div className="mx-auto max-w-3xl space-y-6 pt-12">
        {statements.map((s, i) => (
          <p key={i} className="rounded-xl border-4 border-black p-4 text-[28px] font-bold leading-snug">{s}</p>
        ))}
        {note && <p className="text-[24px] font-semibold">{note}</p>}
        {keyFacts && (keyFacts.medicines.length > 0 || keyFacts.allergies.length > 0) && (
          <div className="border-t-4 border-black pt-4 text-[22px]">
            {keyFacts.medicines.length > 0 && <p className="font-bold">Medicines: <span className="font-normal">{keyFacts.medicines.join('; ')}</span></p>}
            <p className="mt-2 font-bold">
              Allergies: <span className="font-normal">{keyFacts.allergyStatus === 'conflicting' ? '(documents differ) ' : ''}{keyFacts.allergies.join('; ') || 'None documented'}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Glossary() {
  const [query, setQuery] = useState('')
  const results = GLOSSARY.filter((t) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return t.term.toLowerCase().includes(q) || t.aliases.some((a) => a.toLowerCase().includes(q))
  })

  return (
    <div className="space-y-4">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <Input className="pl-9" placeholder="Search health terms…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search glossary" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((t) => (
          <Card key={t.term_id}>
            <CardBody>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-ink">{t.term}</h3>
                <Badge tone="neutral">{t.category.replace(/_/g, ' ')}</Badge>
              </div>
              {t.notes && <p className="mt-1 text-xs text-ink-subtle">{t.notes}</p>}
              {/* Every entry in this dummy set has no verified embeddable video → fallback. */}
              <Alert tone="info" className="mt-2">
                {COPY['COPY-18b']}
                <a href={t.source_url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 font-medium text-brand-700 underline">
                  Open dictionary <IconExternal className="h-3.5 w-3.5" />
                </a>
              </Alert>
              <p className="mt-2 text-[11px] text-ink-subtle">{COPY['COPY-18']}</p>
            </CardBody>
          </Card>
        ))}
      </div>
      {results.length === 0 && <p className="text-sm text-ink-muted">No terms match “{query}”.</p>}
    </div>
  )
}

function About() {
  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="text-base font-semibold text-ink">About ISL Visit Assist</h2>
        <Alert tone="info">{COPY['COPY-17']}</Alert>
        <div className="text-sm text-ink-muted">
          <p className="font-medium text-ink">What this does</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Shows staff a clear card with your communication needs and key facts.</li>
            <li>Links to official ISL dictionary signs for selected health terms.</li>
          </ul>
          <p className="mt-3 font-medium text-ink">What it doesn’t do</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>It does not translate between ISL and text or speech.</li>
            <li>Glossary content has not yet been reviewed with ISL users (a roadmap commitment).</li>
          </ul>
          <p className="mt-3">Glossary videos, where available, load from YouTube and come from the ISLRTC Indian Sign Language dictionary.</p>
        </div>
      </CardBody>
    </Card>
  )
}
