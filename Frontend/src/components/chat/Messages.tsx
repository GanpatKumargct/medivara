// Chat thread rows (SCR-08 redesign). User questions are right-aligned bubbles,
// uploaded documents are live-status cards, and answers are reading-serif prose with
// citation chips. Every answer keeps the safety behaviour of the original Ask screen:
// emergency and advice-redirect states, evidence-only fallbacks, and the disclaimer.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../../api/endpoints'
import type { AskResponse, ChatMessage, DocumentSummary } from '../../api/types'
import { useDisplayPrefs } from '../../context/DisplayPrefsContext'
import { useToast } from '../../context/ToastContext'
import { answerAsText } from '../../lib/chat'
import { cn } from '../../lib/cn'
import { COPY, PROCESSING_STAGE_LABELS } from '../../lib/copy'
import { DOCUMENT_TYPE_LABELS, formatDate } from '../../lib/format'
import { useReadAloud } from '../../lib/useReadAloud'
import { LogoMark } from '../brand'
import { AiGeneratedBadge } from '../common'
import { CitationChips, useEvidence } from '../evidence'
import { IconHand, IconCopy, IconDoc, IconMic, IconSpeaker, IconWarn } from '../icons'
import { Badge } from '../ui'
import { t } from '../../lib/i18n'

export function UserBubble({ message, onRetry }: { message: ChatMessage; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-canvas-bubble px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        {message.text}
      </div>
      {message.input_mode === 'voice' && (
        <span className="flex items-center gap-1 pr-2 text-[11px] text-ink-subtle">
          <IconMic className="h-3 w-3" /> {t("Spoken")}</span>
      )}
      {message.input_mode === 'sign' && (
        <span className="flex items-center gap-1 pr-2 text-[11px] text-ink-subtle">
          <IconHand className="h-3 w-3" /> {t("Signed")}</span>
      )}
      {message.failed && (
        <div className="flex items-center gap-2 pr-1 text-xs text-danger-fg" role="alert">
          <IconWarn className="h-3.5 w-3.5" /> {t("That took too long or didn’t reach MediVara.")}{onRetry && (
            <button onClick={onRetry} className="font-semibold underline underline-offset-2">
              {t("Try again")}</button>
          )}
        </div>
      )}
    </div>
  )
}

export function AttachmentCard({ patientId, message }: { patientId: string; message: ChatMessage }) {
  const docId = message.document?.id
  const docsQ = useQuery({
    queryKey: ['documents', patientId],
    queryFn: () => api.listDocuments(patientId),
    enabled: !!docId,
    refetchInterval: (q) =>
      (q.state.data?.items ?? []).some((d: DocumentSummary) => d.id === docId && (d.status === 'queued' || d.status === 'processing'))
        ? 2000
        : false,
  })
  const live = docsQ.data?.items.find((d) => d.id === docId)
  const title = live?.title ?? message.document?.title ?? message.file_name ?? 'Document'
  const status = live?.status ?? message.document?.status
  const processing = message.pending || status === 'queued' || status === 'processing'

  return (
    <div className="flex justify-end">
      <div className="w-full max-w-sm rounded-2xl border border-canvas-border bg-white p-3 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IconDoc className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink" title={title}>{title}</p>
            {message.pending ? (
              <p className="text-xs text-ink-subtle">{t("Uploading…")}</p>
            ) : message.failed ? (
              <p className="text-xs font-medium text-danger-fg" role="alert">{message.text}</p>
            ) : !message.document ? (
              <p className="text-xs text-ink-subtle">{t("This document was removed.")}</p>
            ) : (
              <p className="text-xs text-ink-subtle">
                {DOCUMENT_TYPE_LABELS[live?.document_type ?? message.document.document_type]}
                {(live?.document_date ?? message.document.document_date) && ` · ${formatDate(live?.document_date ?? message.document.document_date)}`}
              </p>
            )}
          </div>
        </div>
        {processing && !message.failed && (
          <div className="mt-2.5">
            <p className="text-xs text-ink-muted" role="status" aria-live="polite">
              {message.pending ? t("Sending to your records…") : PROCESSING_STAGE_LABELS[live?.stage ?? 'queued'] ?? 'Processing…'}
            </p>
            <div className="mv-progress mt-1.5" aria-hidden="true" />
          </div>
        )}
        {!processing && live && (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {live.status === 'needs_review' && <Badge tone="warn">{live.fact_counts.unverified} {t("to review")}</Badge>}
            {live.status === 'ready' && <Badge tone="ok">{t("Reviewed")}</Badge>}
            {live.status === 'failed' && <span className="text-xs text-danger-fg">{live.failure_message}</span>}
            {live.status !== 'failed' && (
              <Link to={`/p/${patientId}/records/${live.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                {live.status === 'needs_review' ? t("Review details →") : t("Open →")}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const THINKING_STEPS = [
  t("Checking your documents…"),
  t("Writing an answer…"),
  t("Checking every statement against your documents…"),
]

export function ThinkingRow() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 3000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex items-center gap-3">
      <span className="animate-pulse"><LogoMark size={26} /></span>
      <p className="text-sm text-ink-muted" role="status">{THINKING_STEPS[step]}</p>
    </div>
  )
}

export function AssistantAnswer({ answer }: { answer: AskResponse }) {
  return (
    <div className="flex gap-3">
      <LogoMark size={26} className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        <AnswerBody answer={answer} />
        <AnswerActions answer={answer} />
      </div>
    </div>
  )
}

function AnswerBody({ answer }: { answer: AskResponse }) {
  if (answer.status === 'emergency') {
    return (
      <div role="alert" className="rounded-2xl border-2 border-danger-border bg-danger-bg p-4">
        <p className="flex items-center gap-2 font-semibold text-danger-fg"><IconWarn /> {t("Urgent")}</p>
        <p className="mt-2 text-sm leading-relaxed text-danger-fg">{answer.statements[0]?.text ?? COPY['COPY-05']}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="tel:112" className="rounded-lg bg-danger-fg px-3 py-1.5 text-sm font-semibold text-white">{t("Call 112")}</a>
          <a href="tel:108" className="rounded-lg border border-danger-border bg-white px-3 py-1.5 text-sm font-semibold text-danger-fg">{t("Ambulance 108")}</a>
        </div>
      </div>
    )
  }

  if (answer.status === 'advice_redirect') {
    return (
      <div className="space-y-3">
        <p className="mv-prose">{COPY['COPY-06']}</p>
        {answer.evidence.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("What your documents say")}</p>
            <EvidenceList answer={answer} />
          </div>
        )}
        <DoctorQuestions answer={answer} />
      </div>
    )
  }

  if (answer.status === 'not_found' || answer.status === 'out_of_scope') {
    return <p className="mv-prose">{answer.statements[0]?.text ?? COPY['COPY-07']}</p>
  }

  if (answer.status === 'degraded' || answer.status === 'withheld') {
    return (
      <div className="space-y-2">
        <p className="mv-prose font-medium">{COPY['COPY-10']}</p>
        <p className="text-xs text-ink-subtle">{answer.status === 'degraded' ? COPY['COPY-09b'] : COPY['COPY-08b']}</p>
        <EvidenceList answer={answer} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {answer.statements.map((st) => (
        <p key={st.id} className="mv-prose">
          {st.kind === 'explanation' && (
            <span className="mr-1.5 inline-block rounded bg-surface-sunken px-1.5 py-0.5 align-middle font-sans text-[11px] font-medium text-ink-muted">
              {COPY['COPY-37']}
            </span>
          )}
          {st.text}
          <CitationChips evidenceIds={st.evidence_ids} evidence={answer.evidence} />
        </p>
      ))}
      {answer.notices.map((n) => (
        <p key={n.code} className="text-xs text-ink-subtle">{n.text}</p>
      ))}
      <DoctorQuestions answer={answer} />
    </div>
  )
}

function AnswerActions({ answer }: { answer: AskResponse }) {
  const prefs = useDisplayPrefs()
  const { toast } = useToast()
  const evidence = useEvidence()
  const { speak, stop, speaking, supported } = useReadAloud(prefs.readAloudSpeed)
  const text = answerAsText(answer)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast(t("Copied"))
    } catch {
      toast(t("Couldn’t copy. Select the text instead."), 'error')
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <ActionButton onClick={copy} label={t("Copy answer")}><IconCopy className="h-4 w-4" /></ActionButton>
        {supported && text && (
          <ActionButton onClick={() => (speaking ? stop() : speak(text))} label={speaking ? t("Stop reading aloud") : t("Read aloud")} active={speaking}>
            <IconSpeaker className="h-4 w-4" />
          </ActionButton>
        )}
        {answer.evidence.length > 0 && (
          <button
            onClick={() => evidence.open(answer.evidence)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-canvas-hover hover:text-ink"
          >
            {answer.evidence.length} source{answer.evidence.length === 1 ? '' : 's'}
          </button>
        )}
        {answer.status === 'answered' && <span className="ml-1"><AiGeneratedBadge /></span>}
      </div>
      <p className="text-[11px] text-ink-subtle">{COPY['COPY-02']}</p>
    </div>
  )
}

function ActionButton({ onClick, label, active, children }: { onClick: () => void; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-canvas-hover hover:text-ink',
        active && 'bg-brand-50 text-brand-700',
      )}
    >
      {children}
    </button>
  )
}

function EvidenceList({ answer }: { answer: AskResponse }) {
  return (
    <ul className="mt-1.5 space-y-2">
      {answer.evidence.map((ev) => (
        <li key={ev.evidence_id} className="rounded-xl border border-canvas-border bg-white p-2.5">
          <p className="text-xs font-medium text-ink">{ev.document_title} · {formatDate(ev.document_date)}</p>
          <blockquote className="mt-1 border-l-2 border-brand-200 pl-2 font-mono text-[11px] text-ink-muted">{ev.text}</blockquote>
        </li>
      ))}
    </ul>
  )
}

function DoctorQuestions({ answer }: { answer: AskResponse }) {
  if (!answer.questions_for_doctor.length) return null
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t("Questions for your doctor")}</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink">
        {answer.questions_for_doctor.map((q, i) => <li key={i}>{q}</li>)}
      </ul>
    </div>
  )
}

