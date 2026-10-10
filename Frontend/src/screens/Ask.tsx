// SCR-08 — Ask (FR-035..040, FR-100, FR-101). Answers come only from this profile's
// documents, with sources. Emergencies and advice requests get safe templates.
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as api from '../api/endpoints'
import type { AskResponse } from '../api/types'
import { ASK_EXAMPLE_QUESTIONS } from '../dummy-data/ask'
import { Alert, Button, Card, CardBody, Textarea } from '../components/ui'
import { Disclaimer } from '../components/common'
import { CitationChips } from '../components/evidence'
import { COPY } from '../lib/copy'
import { formatDate } from '../lib/format'
import { IconAsk, IconWarn } from '../components/icons'

interface ThreadItem {
  id: number
  question: string
  response?: AskResponse
  error?: boolean
}

const LOADING_STEPS = [
  'Checking your documents…',
  'Writing an answer…',
  'Checking every statement against your documents…',
]

export default function Ask() {
  const { patientId = '' } = useParams()
  const [thread, setThread] = useState<ThreadItem[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const examples = ASK_EXAMPLE_QUESTIONS[patientId] ?? []
  const endRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread, busy])

  useEffect(() => {
    if (!busy) return
    setLoadingStep(0)
    const t = setInterval(() => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 3000)
    return () => clearInterval(t)
  }, [busy])

  async function send(q: string) {
    const text = q.trim()
    if (!text || busy) return
    seq.current += 1
    const id = seq.current
    setThread((t) => [...t, { id, question: text }])
    setQuestion('')
    setBusy(true)

    // Client timeout at 25 s (server limit is 20 s).
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000))
    try {
      const response = (await Promise.race([api.ask(patientId, text), timeout])) as AskResponse
      setThread((t) => t.map((it) => (it.id === id ? { ...it, response } : it)))
    } catch {
      setThread((t) => t.map((it) => (it.id === id ? { ...it, error: true } : it)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>
      <h1 className="text-xl font-semibold text-ink">Ask about your records</h1>
      <p className="mt-1 text-sm text-ink-muted">Answers come only from this profile’s documents, with sources.</p>

      <div className="mt-4 flex-1 space-y-4" aria-live="polite">
        {thread.length === 0 && (
          <Card>
            <CardBody>
              <p className="text-sm text-ink-muted">Try one of these:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="rounded-full border border-line px-3 py-1 text-sm text-ink-muted hover:border-brand-400 hover:text-ink"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {thread.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-sm text-white">{item.question}</p>
            </div>
            {item.error ? (
              <Alert tone="danger" icon={<IconWarn />} title="That took too long.">
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => send(item.question)}>Try again</Button>
              </Alert>
            ) : item.response ? (
              <AnswerCard response={item.response} />
            ) : null}
          </div>
        ))}

        {busy && (
          <Card>
            <CardBody>
              <p className="text-sm text-ink-muted" role="status">{LOADING_STEPS[loadingStep]}</p>
            </CardBody>
          </Card>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 mt-4 bg-surface-muted pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(question)
          }}
        >
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Textarea
                rows={2}
                value={question}
                maxLength={500}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(question)
                  }
                }}
                placeholder="Type your question…"
                aria-label="Your question"
              />
              <p className="mt-0.5 text-right text-xs text-ink-subtle">{question.length}/500</p>
            </div>
            <Button type="submit" loading={busy} disabled={!question.trim()}>
              <IconAsk className="h-4 w-4" /> Send
            </Button>
          </div>
        </form>
        <Disclaimer className="mt-1" />
      </div>
    </div>
  )
}

function AnswerCard({ response }: { response: AskResponse }) {
  if (response.status === 'emergency') {
    return (
      <div role="alert" className="rounded-xl border-2 border-danger-border bg-danger-bg p-4">
        <p className="flex items-center gap-2 font-semibold text-danger-fg"><IconWarn /> Urgent</p>
        <p className="mt-2 text-sm text-danger-fg">{response.statements[0]?.text}</p>
      </div>
    )
  }

  if (response.status === 'advice_redirect') {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Alert tone="info" icon={<IconWarn />}>{COPY['COPY-06']}</Alert>
          {response.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">What your documents say</p>
              <EvidenceList response={response} />
            </div>
          )}
          <DoctorQuestions response={response} />
          <Disclaimer />
        </CardBody>
      </Card>
    )
  }

  if (response.status === 'not_found' || response.status === 'out_of_scope') {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-ink">{response.statements[0]?.text ?? COPY['COPY-07']}</p>
          <Disclaimer className="mt-2" />
        </CardBody>
      </Card>
    )
  }

  if (response.status === 'degraded' || response.status === 'withheld') {
    return (
      <Card>
        <CardBody className="space-y-2">
          <p className="text-sm font-medium text-ink">{COPY['COPY-10']}</p>
          <p className="text-xs text-ink-subtle">
            {response.status === 'degraded' ? COPY['COPY-09b'] : COPY['COPY-08b']}
          </p>
          <EvidenceList response={response} />
          <Disclaimer />
        </CardBody>
      </Card>
    )
  }

  // answered
  return (
    <Card>
      <CardBody className="space-y-2">
        {response.statements.map((st) => (
          <p key={st.id} className="text-sm text-ink">
            {st.kind === 'explanation' && (
              <span className="mr-1 inline-block rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                {COPY['COPY-37']}
              </span>
            )}
            {st.text}
            <CitationChips evidenceIds={st.evidence_ids} evidence={response.evidence} />
          </p>
        ))}
        {response.notices.map((n) => (
          <p key={n.code} className="text-xs text-ink-subtle">{n.text}</p>
        ))}
        <DoctorQuestions response={response} />
        <Disclaimer />
      </CardBody>
    </Card>
  )
}

function EvidenceList({ response }: { response: AskResponse }) {
  return (
    <ul className="mt-1 space-y-2">
      {response.evidence.map((ev) => (
        <li key={ev.evidence_id} className="rounded-lg border border-line bg-surface-muted p-2">
          <p className="text-xs font-medium text-ink">{ev.document_title} · {formatDate(ev.document_date)}</p>
          <blockquote className="mt-1 border-l-2 border-line pl-2 font-mono text-[11px] text-ink-muted">{ev.text}</blockquote>
        </li>
      ))}
    </ul>
  )
}

function DoctorQuestions({ response }: { response: AskResponse }) {
  if (!response.questions_for_doctor.length) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Questions you could ask your doctor</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
        {response.questions_for_doctor.map((q, i) => <li key={i}>{q}</li>)}
      </ul>
    </div>
  )
}
