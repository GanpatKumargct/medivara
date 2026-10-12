// SCR-09 — Consultation Brief (FR-033, FR-034, FR-041). Deterministic sections
// render instantly; the AI narrative is fetched separately and clearly labelled.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/types'
import type { Brief as BriefType } from '../api/types'
import * as api from '../api/endpoints'
import { useReadAloud } from '../lib/useReadAloud'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { Alert, Button, Card, CardBody, Checkbox, Field, Input } from '../components/ui'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/states'
import { AiGeneratedBadge, DocumentsDifferBadge, Disclaimer, UnverifiedBadge } from '../components/common'
import { CitationChips } from '../components/evidence'
import { PageHeader } from '../components/page-header'
import { COPY } from '../lib/copy'
import { formatDate, formatTimestampDate } from '../lib/format'
import { IconBrief, IconHand, IconPrint, IconSpeaker } from '../components/icons'
import { t } from '../lib/i18n'

export default function Brief() {
  const { patientId = '' } = useParams()
  const qc = useQueryClient()
  const prefs = useDisplayPrefs()
  const { speak, stop, speaking, supported } = useReadAloud(prefs.readAloudSpeed)
  const [includeUnverified, setIncludeUnverified] = useState(true)
  const [visitReason, setVisitReason] = useState('')
  const narrativeRequested = useRef(false)

  const latestQ = useQuery({
    queryKey: ['latest-brief', patientId],
    queryFn: () => api.getLatestBrief(patientId),
    retry: false,
  })

  const createMut = useMutation({
    mutationFn: () => api.createBrief(patientId, { include_unverified: includeUnverified, visit_reason: visitReason || null }),
    onSuccess: (r) => {
      narrativeRequested.current = false
      qc.setQueryData(['latest-brief', patientId], r.brief)
      void qc.invalidateQueries({ queryKey: ['patient', patientId] })
    },
  })

  const narrativeMut = useMutation({
    mutationFn: (briefId: string) => api.generateNarrative(patientId, briefId),
    onSuccess: (r) => {
      qc.setQueryData<BriefType>(['latest-brief', patientId], (prev) =>
        prev ? { ...prev, overview: { ...prev.overview, narrative: r.narrative ?? null, narrative_status: r.narrative?.status ?? 'unavailable' } } : prev,
      )
    },
  })

  const brief = latestQ.data

  // Auto-request the narrative once per brief when it opens.
  useEffect(() => {
    if (brief && brief.overview.narrative_status === 'not_requested' && !narrativeRequested.current) {
      narrativeRequested.current = true
      narrativeMut.mutate(brief.id)
    }
  }, [brief, narrativeMut])

  const noBrief = latestQ.error instanceof ApiError && latestQ.error.code === 'NOT_FOUND'

  function readBriefAloud() {
    if (!brief) return
    const parts: string[] = []
    const n = brief.overview.narrative
    if (n && n.status === 'ready') n.statements.forEach((s) => parts.push(s.text))
    else parts.push(brief.overview.templated_text)
    brief.sections.medications.forEach((m) => parts.push(t("Medicine: {{text}}", { text: m.text })))
    brief.sections.points_to_clarify.forEach((f) => parts.push(t("Point to clarify: {{text}}", { text: f.text })))
    speak(parts.join('. '))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<IconBrief className="h-5 w-5" />}
        title={t("Consultation Brief")}
        subtitle={t("A one-page, source-linked summary to take to your appointment.")}
        className="no-print"
        actions={
          brief ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => window.print()}><IconPrint className="h-4 w-4" /> {t("Print")}</Button>
              {supported && (
                <Button size="sm" variant="secondary" onClick={() => (speaking ? stop() : readBriefAloud())}>
                  <IconSpeaker className="h-4 w-4" /> {speaking ? t("Stop") : t("Read aloud")}
                </Button>
              )}
              <Link to={`/p/${patientId}/visit-assist`}>
                <Button size="sm" variant="secondary"><IconHand className="h-4 w-4" /> {t("Visit Card")}</Button>
              </Link>
            </>
          ) : undefined
        }
      />

      {/* Create bar */}
      <Card accent className="no-print">
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Field label={t("Reason for visit (optional, your words)")} htmlFor="visit-reason">
                <Input id="visit-reason" value={visitReason} onChange={(e) => setVisitReason(e.target.value)} maxLength={300} placeholder={t("e.g. Routine diabetes review")} />
              </Field>
            </div>
            <Checkbox id="inc-unv" checked={includeUnverified} onChange={setIncludeUnverified} label={t("Include unverified items")} />
            <Button loading={createMut.isPending} onClick={() => createMut.mutate()}>
              {brief ? t("Create new brief") : t("Create brief")}
            </Button>
          </div>
        </CardBody>
      </Card>

      {latestQ.isLoading && <LoadingRows rows={3} />}
      {latestQ.error && !noBrief && <ErrorBanner error={latestQ.error} onRetry={latestQ.refetch} />}
      {noBrief && !brief && (
        <EmptyState
          title={t("Create your first brief")}
          message={t("A one-page summary of what your documents say, with sources and questions for your doctor.")}
          action={<Button loading={createMut.isPending} onClick={() => createMut.mutate()}>{t("Create brief")}</Button>}
        />
      )}

      {brief && <BriefBody brief={brief} narrativeLoading={narrativeMut.isPending} />}
    </div>
  )
}

function BriefBody({ brief, narrativeLoading }: { brief: BriefType; narrativeLoading: boolean }) {
  const s = brief.sections
  return (
    <div className="mv-stagger print-page space-y-5">
      {brief.stale && <Alert tone="warn">{COPY['COPY-31']}</Alert>}

      {/* Header */}
      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold text-ink">{brief.header.patient_display_name}, {brief.header.age_years ?? '—'}</h2>
          <p className="text-sm text-ink-muted">
            {t('{{documents}} from {{providers}}', {
              documents: t('{{count}} documents', { count: brief.header.documents_count }),
              providers: t('{{count}} providers', { count: brief.header.providers_count }),
            })}
            {brief.header.date_range && <> · {formatDate(brief.header.date_range.from)} – {formatDate(brief.header.date_range.to)}</>}
          </p>
          <p className="text-xs text-ink-subtle">
            {t("Created")}{' '}{formatTimestampDate(brief.created_at)}
            {brief.header.unverified_items_count > 0 && t(" · {{unverified_items_count}} unverified items", { unverified_items_count: brief.header.unverified_items_count })}
          </p>
          {brief.visit_reason && <p className="mt-2 text-sm text-ink"><span className="font-medium">{t("Reason for visit:")}</span> {brief.visit_reason}</p>}
        </CardBody>
      </Card>

      {/* Overview / narrative */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-ink">{t("Overview")}</h3>
          {(() => {
            const n = brief.overview.narrative
            if (narrativeLoading && !n) return <p className="mt-2 text-sm text-ink-muted" role="status">{t("Writing a short summary…")}</p>
            if (n && n.status === 'ready') {
              return (
                <div className="mt-2">
                  <div className="mb-2"><AiGeneratedBadge /></div>
                  <div className="space-y-2">
                    {n.statements.map((st) => (
                      <p key={st.id} className="text-sm text-ink">
                        {st.text}
                        <CitationChips evidenceIds={st.evidence_ids} evidence={n.evidence} />
                      </p>
                    ))}
                  </div>
                  {n.notices.map((notice) => (
                    <p key={notice.code} className="mt-2 text-xs text-ink-subtle">{notice.text}</p>
                  ))}
                </div>
              )
            }
            // Unavailable / withheld → templated text + notice.
            return (
              <div className="mt-2">
                <p className="text-sm text-ink">{brief.overview.templated_text}</p>
                {n && n.status !== 'ready' && <p className="mt-2 text-xs text-ink-subtle">{COPY['COPY-09a']}</p>}
              </div>
            )
          })()}
        </CardBody>
      </Card>

      {/* Medicines */}
      <Section title={s.medications_from ? t("Medicines in your most recent prescription ({{title}})", { title: s.medications_from.title }) : t("Medicines")}>
        {s.medications.length === 0 && <p className="text-sm text-ink-muted">{t("No medicines found in your reviewed documents.")}</p>}
        <ul className="space-y-1.5">
          {s.medications.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm text-ink">
              <span>{m.text}</span>
              {m.status === 'unverified' && <UnverifiedBadge />}
              {m.badges?.includes('documents_differ') && <DocumentsDifferBadge />}
              <CitationChips evidenceIds={m.evidence_ids} evidence={brief.evidence} />
            </li>
          ))}
        </ul>
        {s.other_medications_mentioned.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-muted">{t("Also mentioned in older documents")}</summary>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {s.other_medications_mentioned.map((o) => (
                <li key={o.id} className="flex items-center gap-2">
                  {o.name} <span className="text-xs text-ink-subtle">{t("(last seen")}{' '}{formatDate(o.last_seen_date)})</span>
                  <CitationChips evidenceIds={o.evidence_ids} evidence={brief.evidence} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      {/* Conditions */}
      {s.conditions.length > 0 && (
        <Section title={t("Conditions (as documented)")}>
          <ul className="space-y-1.5 text-sm text-ink">
            {s.conditions.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                {c.text}
                <CitationChips evidenceIds={c.evidence_ids} evidence={brief.evidence} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Results over time */}
      {s.results_over_time.length > 0 && (
        <Section title={t("Test results over time")}>
          <div className="space-y-4">
            {s.results_over_time.map((row) => (
              <div key={row.id}>
                <p className="text-sm font-medium text-ink">
                  {row.test_name}{' '}
                  {row.reference_range_as_written && <span className="font-normal text-ink-subtle">{t("(reference")}{' '}{row.reference_range_as_written})</span>}
                </p>
                <div className="mt-1 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-subtle">
                        <th className="py-1 pr-4 font-medium">{t("Date")}</th>
                        <th className="py-1 pr-4 font-medium">{t("Value")}</th>
                        <th className="py-1 pr-4 font-medium">{t("Flag (as written)")}</th>
                        <th className="py-1 font-medium">{t("Source")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.values.map((v, i) => (
                        <tr key={i} className="border-t border-line">
                          <td className="py-1 pr-4 text-ink">{formatDate(v.date)}</td>
                          <td className="py-1 pr-4 text-ink">{v.value} {v.unit}{v.status === 'unverified' && <span className="ml-1"><UnverifiedBadge /></span>}</td>
                          <td className="py-1 pr-4 text-ink-muted">{v.flag_as_written ?? '—'}</td>
                          <td className="py-1"><CitationChips evidenceIds={v.evidence_ids} evidence={brief.evidence} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Allergies */}
      <Section title={t("Allergies")}>
        {s.allergies.status === 'conflicting' && <div className="mb-2"><DocumentsDifferBadge /></div>}
        {s.allergies.items.length === 0 ? (
          <p className="text-sm text-ink-muted">{COPY['COPY-30a']}</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-ink">
            {s.allergies.items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                {a.text}
                <CitationChips evidenceIds={a.evidence_ids} evidence={brief.evidence} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Points to clarify */}
      {s.points_to_clarify.length > 0 && (
        <Section title={t("Points to clarify")}>
          <ul className="space-y-3">
            {s.points_to_clarify.map((f) => (
              <li key={f.id} className="rounded-lg border border-warn-border bg-warn-bg p-3">
                <p className="text-sm text-warn-fg">{f.text}<CitationChips evidenceIds={f.evidence_ids} evidence={brief.evidence} /></p>
                {f.suggested_question && <p className="mt-1 text-xs font-medium text-ink">{t("Ask your doctor: “")}{f.suggested_question}”</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Missing information */}
      {s.missing_information.length > 0 && (
        <Section title={t("Missing information")}>
          <ul className="space-y-3">
            {s.missing_information.map((f) => (
              <li key={f.id} className="rounded-lg border border-line bg-surface-muted p-3">
                <p className="text-sm text-ink-muted">{f.text}<CitationChips evidenceIds={f.evidence_ids} evidence={brief.evidence} /></p>
                {f.suggested_question && <p className="mt-1 text-xs font-medium text-ink">{t("Ask your doctor: “")}{f.suggested_question}”</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Questions for the doctor */}
      {s.questions_for_doctor.length > 0 && (
        <Section title={t("Questions for your doctor")}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            {s.questions_for_doctor.map((qd, i) => <li key={i}>{qd}</li>)}
          </ol>
        </Section>
      )}

      {/* Sources */}
      <Section title={t("Sources")}>
        {brief.sources.length === 0 && <p className="text-sm text-ink-muted">{t("No reviewed documents yet.")}</p>}
        <ul className="space-y-1 text-sm text-ink-muted">
          {brief.sources.map((src) => <li key={src.document_id}>{src.title}</li>)}
        </ul>
      </Section>

      <Disclaimer />
      <p className="hidden text-[10px] text-ink-subtle print:block">
        {t("Created with MediVara (prototype) · synthetic data · not medical advice")}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
        {children}
      </CardBody>
    </Card>
  )
}
