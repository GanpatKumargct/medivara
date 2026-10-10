// SCR-08 — Ask (FR-035..040, FR-100, FR-101, FR-055, FR-056). A multimodal,
// accessible assistant: ask by TYPING, by SPEAKING (browser speech-to-text, en-IN),
// or via SIGNS & PHRASES (tap example questions / ISL glossary terms). Every method
// funnels into an editable text box the user confirms — nothing is auto-sent, and
// MediVara never claims to translate sign language (COPY-17). Answers come only from
// this profile's documents, with sources, and can be read aloud.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api/endpoints'
import type { AskResponse } from '../api/types'
import { ASK_EXAMPLE_QUESTIONS } from '../dummy-data/ask'
import { GLOSSARY } from '../dummy-data/glossary'
import { useSpeechInput } from '../lib/useSpeechInput'
import { useReadAloud } from '../lib/useReadAloud'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { PageHeader } from '../components/page-header'
import { Alert, Badge, Button, Card, CardBody, Textarea } from '../components/ui'
import { Disclaimer } from '../components/common'
import { CitationChips } from '../components/evidence'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'
import { formatDate } from '../lib/format'
import { IconAsk, IconHand, IconKeyboard, IconMic, IconSend, IconSpeaker, IconWarn, IconX } from '../components/icons'

type Mode = 'type' | 'speak' | 'signs'

interface ThreadItem {
  id: number
  question: string
  mode: Mode
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
  const [mode, setMode] = useState<Mode>('type')
  const [busy, setBusy] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const voiceUsed = useRef(false)
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

  async function send(q: string, usedVoice: boolean) {
    const text = q.trim()
    if (!text || busy) return
    seq.current += 1
    const id = seq.current
    setThread((t) => [...t, { id, question: text, mode }])
    setQuestion('')
    voiceUsed.current = false
    setBusy(true)
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000))
    try {
      const response = (await Promise.race([
        api.ask(patientId, text, usedVoice ? 'voice' : 'text'),
        timeout,
      ])) as AskResponse
      setThread((t) => t.map((it) => (it.id === id ? { ...it, response } : it)))
    } catch {
      setThread((t) => t.map((it) => (it.id === id ? { ...it, error: true } : it)))
    } finally {
      setBusy(false)
    }
  }

  const insert = (text: string) => {
    setQuestion((q) => (q ? `${q} ${text}` : text))
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <PageHeader
        icon={<IconAsk className="h-5 w-5" />}
        title="Ask"
        subtitle="Ask about this profile’s documents and get answers with sources. Type, speak, or use signs & phrases — nothing is sent until you choose."
      />

      <div className="mt-1 flex-1 space-y-4" aria-live="polite">
        {thread.length === 0 && (
          <Card accent>
            <CardBody>
              <p className="text-sm font-medium text-ink">Try one of these</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex, false)}
                    className="mv-press rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-subtle">
                Answers are drawn only from your records. MediVara never gives medical advice.
              </p>
            </CardBody>
          </Card>
        )}

        {thread.map((item) => (
          <div key={item.id} className="animate-fade-up space-y-2">
            <div className="flex justify-end">
              <p className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tr-sm bg-brand-gradient px-3.5 py-2 text-sm text-white shadow-brand">
                {item.mode === 'speak' && <IconMic className="h-3.5 w-3.5 opacity-80" />}
                {item.question}
              </p>
            </div>
            {item.error ? (
              <Alert tone="danger" icon={<IconWarn />} title="That took too long.">
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => send(item.question, false)}>
                  Try again
                </Button>
              </Alert>
            ) : item.response ? (
              <AnswerCard response={item.response} />
            ) : null}
          </div>
        ))}

        {busy && (
          <Card>
            <CardBody className="flex items-center gap-3">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-600" />
              </span>
              <p className="text-sm text-ink-muted" role="status">{LOADING_STEPS[loadingStep]}</p>
            </CardBody>
          </Card>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 z-10 mt-4 pb-1">
        <Card className="shadow-pop">
          <CardBody className="space-y-3">
            <ModeSwitch mode={mode} onChange={setMode} />

            {mode === 'speak' && (
              <VoicePanel
                patientId={patientId}
                onTranscript={(t) => {
                  voiceUsed.current = true
                  insert(t)
                }}
              />
            )}

            {mode === 'signs' && (
              <SignsPanel patientId={patientId} examples={examples} onInsert={insert} />
            )}

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
                      void send(question, voiceUsed.current)
                    }
                  }}
                  placeholder={
                    mode === 'speak'
                      ? 'Your spoken words appear here — edit, then send'
                      : mode === 'signs'
                        ? 'Tap a question or term above — edit, then send'
                        : 'Type your question…'
                  }
                  aria-label="Your question"
                />
                <p className="mt-0.5 text-right text-xs text-ink-subtle">{question.length}/500</p>
              </div>
              <Button onClick={() => void send(question, voiceUsed.current)} loading={busy} disabled={!question.trim()}>
                <IconSend className="h-4 w-4" /> Send
              </Button>
            </div>
            <Disclaimer />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: { id: Mode; label: string; icon: ReactNode }[] = [
    { id: 'type', label: 'Type', icon: <IconKeyboard className="h-4 w-4" /> },
    { id: 'speak', label: 'Speak', icon: <IconMic className="h-4 w-4" /> },
    { id: 'signs', label: 'Signs & phrases', icon: <IconHand className="h-4 w-4" /> },
  ]
  return (
    <div role="tablist" aria-label="How to ask" className="inline-flex rounded-xl bg-surface-sunken p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={mode === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'mv-press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
            mode === t.id ? 'bg-white text-brand-800 shadow-sm' : 'text-ink-muted hover:text-ink',
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

function VoicePanel({ patientId, onTranscript }: { patientId: string; onTranscript: (t: string) => void }) {
  const [showDisclosure, setShowDisclosure] = useState(true)
  const consentRecorded = useRef(false)
  const { supported, listening, interim, error, start, stop } = useSpeechInput(onTranscript)

  async function toggle() {
    if (listening) {
      stop()
      return
    }
    if (!consentRecorded.current) {
      consentRecorded.current = true
      try {
        await api.recordConsent('voice_input', true)
      } catch {
        /* ignore */
      }
    }
    start()
  }

  if (!supported) {
    return (
      <Alert tone="info">Voice input works in Chrome or Edge. You can type your question instead.</Alert>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface-muted p-3">
      {showDisclosure && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-white p-2 text-xs text-ink-muted ring-1 ring-line">
          <span>{COPY['COPY-20']}</span>
          <button onClick={() => setShowDisclosure(false)} aria-label="Dismiss" className="shrink-0 text-ink-subtle hover:text-ink">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Start voice input'}
          className={cn(
            'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-transform mv-press',
            listening ? 'bg-danger-fg' : 'bg-brand-gradient shadow-brand',
          )}
        >
          {listening && <span className="absolute inset-0 rounded-full bg-danger-fg" style={{ animation: 'mvPing 1.4s var(--mv-ease) infinite' }} aria-hidden="true" />}
          <IconMic className="relative h-6 w-6" />
        </button>
        <div className="min-w-0" aria-live="polite">
          <p className="text-sm font-medium text-ink">
            {listening ? 'Listening… tap to stop' : 'Tap the mic and speak'}
          </p>
          <p className="truncate text-xs text-ink-subtle">
            {error === 'denied' ? COPY['COPY-22'] : interim || 'English (India). Your words appear in the box to review before sending.'}
          </p>
        </div>
      </div>
      {error === 'denied' && (
        <p className="mt-2 text-xs text-danger-fg" role="alert">{COPY['COPY-22']}</p>
      )}
      <Link to={`/p/${patientId}/settings`} className="sr-only">Microphone settings</Link>
    </div>
  )
}

function SignsPanel({
  patientId,
  examples,
  onInsert,
}: {
  patientId: string
  examples: string[]
  onInsert: (t: string) => void
}) {
  const terms = GLOSSARY.slice(0, 10)
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-muted p-3">
      <div className="flex items-start gap-2 rounded-lg bg-white p-2 text-xs text-ink-muted ring-1 ring-line">
        <IconHand className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <span>
          MediVara doesn’t translate sign language. Build your question by tapping a card or a health term, then send it.
          For a conversation with staff, <Link to={`/p/${patientId}/visit-assist`} className="font-medium text-brand-700 underline">open your Visit Card</Link>.
        </span>
      </div>
      {examples.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Common questions</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => onInsert(ex)}
                className="mv-press rounded-lg border border-line bg-white px-3 py-2 text-left text-sm text-ink transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Health terms</p>
        <div className="flex flex-wrap gap-1.5">
          {terms.map((t) => (
            <button
              key={t.term_id}
              onClick={() => onInsert(t.term)}
              className="mv-press rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-brand-800 hover:bg-brand-100"
            >
              {t.term}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function AnswerCard({ response }: { response: AskResponse }) {
  const prefs = useDisplayPrefs()
  const { speak, stop, speaking, supported } = useReadAloud(prefs.readAloudSpeed)

  const readable = response.statements.map((s) => s.text).join('. ')

  const ReadAloud = () =>
    supported && readable ? (
      <button
        onClick={() => (speaking ? stop() : speak(readable))}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted"
      >
        <IconSpeaker className="h-3.5 w-3.5" /> {speaking ? 'Stop' : 'Read aloud'}
      </button>
    ) : null

  if (response.status === 'emergency') {
    return (
      <div role="alert" className="animate-scale-in rounded-2xl border-2 border-danger-border bg-danger-bg p-4">
        <p className="flex items-center gap-2 font-semibold text-danger-fg"><IconWarn /> Urgent</p>
        <p className="mt-2 text-sm text-danger-fg">{response.statements[0]?.text}</p>
      </div>
    )
  }

  if (response.status === 'advice_redirect') {
    return (
      <Card accent>
        <CardBody className="space-y-3">
          <Alert tone="info" icon={<IconWarn />}>{COPY['COPY-06']}</Alert>
          {response.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">What your documents say</p>
              <EvidenceList response={response} />
            </div>
          )}
          <DoctorQuestions response={response} />
          <div className="flex items-center justify-between">
            <Disclaimer />
            <ReadAloud />
          </div>
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
    <Card accent>
      <CardBody className="space-y-2">
        {response.statements.map((st) => (
          <p key={st.id} className="text-sm leading-relaxed text-ink">
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
        <div className="flex items-center justify-between pt-1">
          <Disclaimer />
          <ReadAloud />
        </div>
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
          <blockquote className="mt-1 border-l-2 border-brand-200 pl-2 font-mono text-[11px] text-ink-muted">{ev.text}</blockquote>
        </li>
      ))}
    </ul>
  )
}

function DoctorQuestions({ response }: { response: AskResponse }) {
  if (!response.questions_for_doctor.length) return null
  return (
    <div className="rounded-lg bg-brand-50/60 p-2.5">
      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
        <Badge tone="brand">For your doctor</Badge>
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink">
        {response.questions_for_doctor.map((q, i) => <li key={i}>{q}</li>)}
      </ul>
    </div>
  )
}
