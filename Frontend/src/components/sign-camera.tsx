// Sign mode (DEC-28, FR-064), experimental: a full-screen view, like voice mode, opened from
// the chat composer. The camera and recognition run on this device; signs choose words, the
// words build a question about the user's own records, and the question goes back to the
// composer for the user to check and send. Emergency signs go straight to the fixed emergency
// card (the backend safety check makes no model call for them).
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { Badge, Button } from './ui'
import { COPY } from '../lib/copy'
import { cn } from '../lib/cn'
import { recognise, type Recognition, type SignExample } from '../lib/signs/recognizer'
import { clearLocalExamples, loadSignPack, readLocalExamples, toPack, writeLocalExamples } from '../lib/signs/examples'
import { EMERGENCY_PHRASES, SIGN_BY_ID, SIGN_VOCABULARY, buildSignQuestion, type SignKind } from '../lib/signs/vocabulary'
import { useSignCamera } from '../lib/signs/useSignCamera'
import { IconCamera, IconCheck, IconHand, IconWarn, IconX } from './icons'
import { t } from '../lib/i18n'

const ISL_DICTIONARY = 'https://indiansignlanguage.org/'
const EXAMPLES_PER_SIGN = 3

const GROUPS: { kind: SignKind; title: string; hint: string }[] = [
  { kind: 'topic', title: t("What about"), hint: t("Pick one topic") },
  { kind: 'question', title: t("Question words"), hint: t("Optional") },
  { kind: 'control', title: t("Controls"), hint: t("Yes uses the question · No clears · Again removes the last sign") },
]

export function SignMode({
  patientId,
  patientName,
  onQuestion,
  onEmergency,
  onClose,
}: {
  patientId: string
  patientName: string
  onQuestion: (question: string) => void
  onEmergency: (phrase: string) => void
  onClose: () => void
}) {
  const { me, refreshMe } = useAuth()
  const consented = me?.consents?.camera_input?.granted === true
  const [packExamples, setPackExamples] = useState<SignExample[]>([])
  const [localExamples, setLocalExamples] = useState<SignExample[]>(() => readLocalExamples())
  const [view, setView] = useState<'ask' | 'teach'>('ask')
  const [words, setWords] = useState<string[]>([])
  const [last, setLast] = useState<Recognition | null>(null)
  const [teaching, setTeaching] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [allowing, setAllowing] = useState(false)

  useEffect(() => {
    void loadSignPack().then(setPackExamples)
  }, [])

  const examples = useMemo(() => [...packExamples, ...localExamples], [packExamples, localExamples])
  const timelineQ = useQuery({
    queryKey: ['timeline', patientId, 'ask-suggestions'],
    queryFn: () => api.getTimeline(patientId, { include_unverified: true }),
  })
  const question = buildSignQuestion(words, timelineQ.data)

  const camera = useSignCamera((frames) => {
    if (teaching) {
      const next = [...localExamples, { label: teaching, frames }]
      setLocalExamples(next)
      setSaveFailed(!writeLocalExamples(next))
      // Keep recording the same word until it has enough examples.
      if (next.filter((e) => e.label === teaching).length >= EXAMPLES_PER_SIGN) setTeaching(null)
      return
    }
    const result = recognise(frames, examples)
    // An emergency sign recognised with confidence acts at once; anything else waits for a tap.
    const top = result.guesses[0]
    if (!result.unsure && top && SIGN_BY_ID[top.label]?.kind === 'safety' && top.confidence > 0.8) {
      sendEmergency(EMERGENCY_PHRASES[top.label])
      return
    }
    setLast(result)
  })

  function close() {
    camera.stop()
    onClose()
  }

  function applyQuestion(q: string) {
    onQuestion(q)
    close()
  }

  function sendEmergency(phrase: string) {
    onEmergency(phrase)
    close()
  }

  function choose(id: string) {
    setLast(null)
    const word = SIGN_BY_ID[id]
    if (!word) return
    if (word.kind === 'safety') return sendEmergency(EMERGENCY_PHRASES[id])
    if (id === 'no') return setWords([])
    if (id === 'again') return setWords((w) => w.slice(0, -1))
    if (id === 'yes') {
      if (question) applyQuestion(question)
      return
    }
    setWords((w) => (w.includes(id) ? w : [...w, id]))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function allowCamera() {
    setAllowing(true)
    try {
      await api.recordConsent('camera_input', true)
      await refreshMe()
    } finally {
      setAllowing(false)
    }
  }

  function exportPack() {
    const blob = new Blob([JSON.stringify(toPack(localExamples))], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'medivara-sign-examples.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const countFor = (id: string) => examples.filter((e) => e.label === id).length

  // Rendered into <body>: an animated (transformed) parent would otherwise turn `fixed` into
  // "fixed to that parent" and clip the view to the chat column.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("Sign mode")} className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-canvas-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
          <IconHand className="h-4 w-4" />
          <span className="font-medium text-ink">{t("Sign")}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{patientName}{t("’s records")}</span>
          <Badge tone="violet">{t("Experimental")}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {consented && (
            <div className="inline-flex rounded-full bg-surface-sunken p-0.5 text-sm" role="tablist" aria-label={t("Sign mode")}>
              {(['ask', 'teach'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => { setView(v); setTeaching(null); setLast(null) }}
                  className={cn('rounded-full px-3 py-1', view === v ? "bg-white font-medium text-ink shadow-sm" : 'text-ink-muted')}
                >
                  {v === 'ask' ? t("Ask") : t("Teach signs")}
                </button>
              ))}
            </div>
          )}
          <button onClick={close} aria-label={t("Close sign mode")} className="rounded-full p-2 text-ink-muted hover:bg-canvas-hover hover:text-ink">
            <IconX />
          </button>
        </div>
      </header>

      {!consented ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-canvas-border bg-white p-6 text-center shadow-card">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <IconCamera className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-ink">{t("Ask by signing")}</h2>
            <p className="mt-2 text-sm text-ink-muted">{COPY['COPY-47']}</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="ghost" onClick={close}>{t("Not now")}</Button>
              <Button loading={allowing} onClick={() => void allowCamera()}>{t("Allow the camera")}</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto mv-scroll">
          <div className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {/* Camera stage */}
            <section aria-label={t("Camera")} className="space-y-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink/90 shadow-card">
                <video ref={camera.videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label={t("Your camera")} />
                <canvas ref={camera.canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100" aria-hidden="true" />
                {camera.status !== 'running' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white/80">
                    <IconCamera className="h-10 w-10" />
                    <p className="text-sm">{camera.status === 'starting' ? t("Starting the camera…") : t("The camera is off")}</p>
                    {camera.status !== 'starting' && <Button onClick={() => void camera.start()}>{t("Start camera")}</Button>}
                  </div>
                )}
                {camera.status === 'running' && (
                  <>
                    <span
                      className={cn(
                        'absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium backdrop-blur',
                        camera.collecting ? "bg-brand-600/90 text-white" : camera.handsVisible ? "bg-white/85 text-ink" : "bg-black/50 text-white",
                      )}
                      role="status"
                      aria-live="polite"
                    >
                      {teaching
                        ? t("Recording “{{label}}” · {{countFor}}/{{EXAMPLES_PER_SIGN}}", { label: SIGN_BY_ID[teaching].label, countFor: countFor(teaching), EXAMPLES_PER_SIGN: EXAMPLES_PER_SIGN })
                        : camera.collecting
                          ? t("Watching your sign… lower your hands when done")
                          : camera.handsVisible
                            ? t("Hands seen")
                            : t("Raise your hands to sign")}
                    </span>
                    <button
                      onClick={camera.stop}
                      className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/70"
                    >
                      {t("Stop camera")}</button>
                  </>
                )}
              </div>
              {camera.error && (
                <div className="flex items-start gap-2 rounded-2xl border border-warn-border bg-warn-bg p-3 text-sm text-warn-fg" role="alert">
                  <IconWarn className="mt-0.5 h-4 w-4 shrink-0" /> {camera.error}
                </div>
              )}
              {view === 'ask' && (
                <GuessCard last={last} hasExamples={examples.length > 0} onPick={choose} onDismiss={() => setLast(null)} />
              )}
              <p className="text-xs text-ink-subtle">{COPY['COPY-48']}</p>
            </section>

            {/* Right side: build a question, or teach signs */}
            {view === 'ask' ? (
              <section aria-label={t("Your question")} className="space-y-4">
                <div className="rounded-3xl border border-canvas-border bg-white p-5 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("Your signs")}</p>
                  <div className="mt-2 flex min-h-[2rem] flex-wrap items-center gap-1.5">
                    {words.length === 0 && <span className="text-sm text-ink-subtle">{t("Sign or tap a word to start.")}</span>}
                    {words.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-800">
                        {SIGN_BY_ID[id]?.label ?? id}
                        <button
                          onClick={() => setWords((w) => w.filter((x) => x !== id))}
                          aria-label={t("Remove {{label}}", { label: SIGN_BY_ID[id]?.label ?? id })}
                          className="rounded-full p-0.5 hover:bg-brand-100"
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl bg-canvas p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("Question")}</p>
                    {question ? (
                      <p className="mt-1 font-serif text-xl leading-snug text-ink">“{question}”</p>
                    ) : (
                      <p className="mt-1 text-sm text-ink-subtle">
                        {words.length ? t("Add a topic, for example Medicine or Test.") : t("Your question appears here.")}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button disabled={!question} onClick={() => question && applyQuestion(question)}>
                      <IconCheck className="h-4 w-4" /> {t("Use this question")}</Button>
                    {words.length > 0 && <Button variant="ghost" onClick={() => setWords([])}>{t("Clear")}</Button>}
                  </div>
                  <p className="mt-2 text-xs text-ink-subtle">{t("It goes into the message box so you can check it before sending.")}</p>
                </div>

                {GROUPS.map((g) => (
                  <WordGroup key={g.kind} title={g.title} hint={g.hint}>
                    {SIGN_VOCABULARY.filter((w) => w.kind === g.kind).map((w) => (
                      <button
                        key={w.id}
                        onClick={() => choose(w.id)}
                        aria-label={t("Sign word: {{label}}", { label: w.label })}
                        aria-pressed={words.includes(w.id)}
                        className={cn(
                          'mv-press rounded-xl border px-3 py-2 text-sm transition-colors',
                          words.includes(w.id)
                            ? "border-brand-400 bg-brand-50 font-medium text-brand-800"
                            : "border-canvas-border bg-white text-ink hover:border-brand-200 hover:bg-brand-50",
                        )}
                      >
                        {w.label}
                      </button>
                    ))}
                  </WordGroup>
                ))}

                <div className="rounded-3xl border border-danger-border bg-danger-bg p-4">
                  <p className="text-sm font-semibold text-danger-fg">{t("Emergency")}</p>
                  <p className="text-xs text-danger-fg/80">{t("These send straight away and show who to call.")}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {SIGN_VOCABULARY.filter((w) => w.kind === 'safety').map((w) => (
                      <button
                        key={w.id}
                        onClick={() => choose(w.id)}
                        aria-label={t("Sign word: {{label}}", { label: w.label })}
                        className="mv-press rounded-xl bg-danger-fg px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section aria-label={t("Teach signs")} className="space-y-4">
                <div className="rounded-3xl border border-canvas-border bg-white p-5 shadow-card">
                  <p className="text-sm font-semibold text-ink">{t("Teach MediVara your signs")}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t("Pick a word, start the camera and make the sign")}{' '}{EXAMPLES_PER_SIGN} {t("times, lowering your hands after each. Examples are hand positions, not video, and stay in this browser. Check signs against an")}{' '}
                    <a className="underline" href={ISL_DICTIONARY} target="_blank" rel="noreferrer">{t("Indian Sign Language dictionary")}</a>.
                  </p>
                  {saveFailed && <p className="mt-2 text-xs text-danger-fg">{t("This browser couldn’t save the example; it will be lost on reload.")}</p>}
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {SIGN_VOCABULARY.map((w) => {
                    const n = countFor(w.id)
                    const active = teaching === w.id
                    return (
                      <li key={w.id}>
                        <button
                          onClick={() => setTeaching(active ? null : w.id)}
                          aria-pressed={active}
                          aria-label={t("Teach the sign for {{label}} ({{n}} examples)", { label: w.label, n: n })}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors',
                            active ? "border-brand-400 bg-brand-50" : "border-canvas-border bg-white hover:bg-canvas-hover",
                          )}
                        >
                          <span className={cn('text-ink', w.kind === 'safety' && 'text-danger-fg')}>{w.label}</span>
                          <span className="flex items-center gap-1" aria-hidden="true">
                            {Array.from({ length: EXAMPLES_PER_SIGN }, (_, i) => (
                              <span key={i} className={cn('h-2 w-2 rounded-full', i < n ? 'bg-ok-fg' : 'bg-line')} />
                            ))}
                            {active && <span className="ml-1 text-xs font-medium text-brand-700">{t("Recording")}</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {localExamples.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={exportPack}>{t("Export examples for the team pack")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { clearLocalExamples(); setLocalExamples([]) }}>
                      {t("Delete my sign examples")}</Button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

function GuessCard({
  last,
  hasExamples,
  onPick,
  onDismiss,
}: {
  last: Recognition | null
  hasExamples: boolean
  onPick: (id: string) => void
  onDismiss: () => void
}) {
  if (!hasExamples) {
    return (
      <div className="rounded-2xl border border-info-border bg-info-bg p-3 text-sm text-info-fg">
        {t("MediVara hasn’t been shown any signs yet. Use")}{' '}<strong>{t("Teach signs")}</strong> {t("to record a few, or tap the words.")}</div>
    )
  }
  if (!last) return null
  if (last.unsure || last.guesses.length === 0) {
    return (
      <div className="rounded-2xl border border-canvas-border bg-white p-3 text-sm text-ink-muted" aria-live="polite">
        {t("Not sure which sign that was. Sign again, or tap a word.")}</div>
    )
  }
  return (
    <div className="rounded-2xl border border-canvas-border bg-white p-3" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t("Did you sign…")}</p>
        <button onClick={onDismiss} className="text-xs text-ink-muted underline">{t("None of these")}</button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {last.guesses.map((g, i) => (
          <button
            key={g.label}
            onClick={() => onPick(g.label)}
            className={cn(
              'mv-press rounded-xl border px-3 py-2 text-left transition-colors hover:bg-brand-50',
              i === 0 ? 'border-brand-300' : 'border-canvas-border',
            )}
          >
            <span className="block text-sm font-medium text-ink">{SIGN_BY_ID[g.label]?.label ?? g.label}</span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.round(g.confidence * 100)}%` }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function WordGroup({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</p>
        <p className="text-[11px] text-ink-subtle">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
