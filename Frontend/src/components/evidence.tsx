// Citation chips + Evidence drawer (FR-021). Every AI/derived statement cites its
// exact source line; a chip opens the drawer with the document, page and line text,
// and a link to open the document at that page.
import { createContext, useContext, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Evidence } from '../api/types'
import { cn } from '../lib/cn'
import { formatDate, DOCUMENT_TYPE_LABELS } from '../lib/format'
import { IconExternal, IconX } from './icons'
import { Badge } from './ui'
import { t } from '../lib/i18n'

interface EvidenceCtx {
  open: (evidence: Evidence[], focusId?: string) => void
}
const Ctx = createContext<EvidenceCtx | null>(null)

export function EvidenceProvider({
  patientId,
  children,
}: {
  patientId: string
  children: ReactNode
}) {
  const [list, setList] = useState<Evidence[] | null>(null)
  const [focus, setFocus] = useState<string | undefined>()

  return (
    <Ctx.Provider value={{ open: (e, f) => { setList(e); setFocus(f) } }}>
      {children}
      {list && (
        <EvidenceDrawer
          patientId={patientId}
          evidence={list}
          focusId={focus}
          onClose={() => setList(null)}
        />
      )}
    </Ctx.Provider>
  )
}

export function useEvidence() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEvidence must be used within EvidenceProvider')
  return ctx
}

/** Row of citation chips (E1, E2 …) that open the drawer. */
export function CitationChips({
  evidenceIds,
  evidence,
}: {
  evidenceIds: string[]
  evidence: Evidence[]
}) {
  const { open } = useEvidence()
  if (!evidenceIds.length) return null
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {evidenceIds.map((id) => {
        const ev = evidence.find((e) => e.evidence_id === id)
        const label = ev ? t("Source {{value}}: {{value2}}, {{formatDate}}", { value: id.replace('E', ''), value2: DOCUMENT_TYPE_LABELS[ev.document_type] ?? 'Document', formatDate: formatDate(ev.document_date) }) : id
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            onClick={() => open(evidence, id)}
            className="inline-flex items-center rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
          >
            {id}
          </button>
        )
      })}
    </span>
  )
}

function EvidenceDrawer({
  patientId,
  evidence,
  focusId,
  onClose,
}: {
  patientId: string
  evidence: Evidence[]
  focusId?: string
  onClose: () => void
}) {
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div className="animate-fade-in absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={t("Evidence")}
        className="animate-slide-in-right relative z-10 flex h-full w-full max-w-md flex-col bg-surface shadow-pop"
      >
        <header className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-base font-semibold text-ink">{t("Evidence")}</h2>
          <button onClick={onClose} aria-label={t("Close evidence")} className="rounded p-1 text-ink-muted hover:bg-surface-muted">
            <IconX />
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {evidence.map((ev) => (
            <div
              key={ev.evidence_id}
              className={cn(
                'rounded-lg border p-3',
                ev.evidence_id === focusId ? "border-brand-400 bg-brand-50" : "border-line bg-white",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">
                  {ev.evidence_id}
                </span>
                {ev.is_user_correction && <Badge tone="info">{t("Corrected by you")}</Badge>}
                {ev.fact_status === 'unverified' && <Badge tone="warn">{t("Unverified")}</Badge>}
              </div>
              <p className="mt-2 text-sm font-medium text-ink">{ev.document_title}</p>
              <p className="text-xs text-ink-subtle">
                {formatDate(ev.document_date)} {t("· Page")}{' '}{ev.page}
              </p>
              <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm text-ink-muted">
                {ev.text}
              </blockquote>
              <Link
                to={`/p/${patientId}/records/${ev.document_id}?page=${ev.page}&line=${ev.line_ids[0] ?? ''}`}
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                <IconExternal className="h-4 w-4" />
                {t("Open document at page")}{' '}{ev.page}
              </Link>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
