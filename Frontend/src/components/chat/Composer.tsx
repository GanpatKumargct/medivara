// Chat composer. Type, dictate (browser speech-to-text, en-IN), or build a question
// from signs & phrases — every method fills an editable box the user confirms; nothing
// is auto-sent (FR-056, COPY-17). The paperclip uploads a PDF into this profile's
// records, and the waveform button opens two-way voice mode.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../api/endpoints'
import { GLOSSARY } from '../../dummy-data/glossary'
import { cn } from '../../lib/cn'
import { COPY } from '../../lib/copy'
import { useSpeechInput } from '../../lib/useSpeechInput'
import { IconArrowUp, IconHand, IconMic, IconPaperclip, IconWaveform, IconX } from '../icons'
import { Spinner } from '../ui'

const MAX_LEN = 500
const DICTATION_ACK_KEY = 'mv_dictation_ack'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* private mode: the disclosure simply shows again next time */
  }
}

export interface ComposerProps {
  patientId: string
  value: string
  onChange: (v: string) => void
  onSubmit: (text: string, usedVoice: boolean) => void
  busy: boolean
  canAttach: boolean
  onAttach: (file: File) => void
  onVoiceMode: () => void
  examples: string[]
  placeholder?: string
  autoFocus?: boolean
  size?: 'hero' | 'docked'
}

export function Composer({
  patientId,
  value,
  onChange,
  onSubmit,
  busy,
  canAttach,
  onAttach,
  onVoiceMode,
  examples,
  placeholder = 'Ask about your health records…',
  autoFocus,
  size = 'docked',
}: ComposerProps) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const voiceUsed = useRef(false)
  const consentRecorded = useRef(false)
  const [phrasesOpen, setPhrasesOpen] = useState(false)
  const [showDisclosure, setShowDisclosure] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const speech = useSpeechInput((text) => {
    voiceUsed.current = true
    const cur = valueRef.current
    onChange((cur ? `${cur} ${text}` : text).slice(0, MAX_LEN))
  })

  // Auto-grow the textarea up to a cap, like a desktop chat app.
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, size === 'hero' ? 260 : 220)}px`
  }, [value, size])

  useEffect(() => {
    if (autoFocus) textRef.current?.focus()
  }, [autoFocus])

  function submit() {
    const text = value.trim()
    if (!text || busy) return
    onSubmit(text, voiceUsed.current)
    voiceUsed.current = false
  }

  async function toggleDictation() {
    if (speech.listening) {
      speech.stop()
      return
    }
    if (!readFlag(DICTATION_ACK_KEY)) setShowDisclosure(true)
    if (!consentRecorded.current) {
      consentRecorded.current = true
      try {
        await api.recordConsent('voice_input', true)
      } catch {
        /* recording the consent is best-effort; dictation stays in the browser */
      }
    }
    speech.start()
  }

  const hasText = value.trim().length > 0

  return (
    <div className="relative">
      {phrasesOpen && (
        <PhrasesPanel
          patientId={patientId}
          examples={examples}
          onClose={() => setPhrasesOpen(false)}
          onInsert={(t) => {
            onChange((value ? `${value} ${t}` : t).slice(0, MAX_LEN))
            textRef.current?.focus()
          }}
        />
      )}

      {showDisclosure && (
        <div className="mb-2 flex items-start gap-2 rounded-2xl border border-canvas-border bg-white p-3 text-xs text-ink-muted shadow-card">
          <IconMic className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <span className="flex-1">{COPY['COPY-20']}</span>
          <button
            onClick={() => {
              writeFlag(DICTATION_ACK_KEY)
              setShowDisclosure(false)
            }}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 text-ink-subtle hover:bg-canvas-hover hover:text-ink"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        className={cn(
          'rounded-[26px] border border-canvas-border bg-white shadow-composer transition-colors focus-within:border-brand-300',
          size === 'hero' ? 'px-4 pb-3 pt-4' : 'px-3 pb-2.5 pt-3',
        )}
      >
        <textarea
          ref={textRef}
          rows={size === 'hero' ? 2 : 1}
          value={value}
          maxLength={MAX_LEN}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={speech.listening ? 'Listening… speak now' : placeholder}
          aria-label="Your question"
          className="block max-h-[260px] w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:outline-none"
        />
        {speech.listening && speech.interim && (
          <p className="px-1 pt-1 text-sm italic text-ink-subtle" aria-live="polite">{speech.interim}</p>
        )}
        {speech.error === 'denied' && (
          <p className="px-1 pt-1 text-xs text-danger-fg" role="alert">{COPY['COPY-22']}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {canAttach && (
              <>
                <ToolButton label="Add a PDF to your records" onClick={() => fileRef.current?.click()}>
                  <IconPaperclip className="h-[18px] w-[18px]" />
                </ToolButton>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onAttach(f)
                    e.target.value = ''
                  }}
                />
              </>
            )}
            <ToolButton label="Signs & phrases" onClick={() => setPhrasesOpen((o) => !o)} active={phrasesOpen}>
              <IconHand className="h-[18px] w-[18px]" />
            </ToolButton>
            {value.length > MAX_LEN - 100 && (
              <span className="ml-1 text-xs text-ink-subtle">{value.length}/{MAX_LEN}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {speech.supported && (
              <ToolButton
                label={speech.listening ? 'Stop dictation' : 'Dictate (speech to text)'}
                onClick={() => void toggleDictation()}
                active={speech.listening}
                danger={speech.listening}
              >
                <span className="relative flex">
                  {speech.listening && (
                    <span className="absolute inset-0 rounded-full bg-danger-fg/40" style={{ animation: 'mvPing 1.4s var(--mv-ease) infinite' }} aria-hidden="true" />
                  )}
                  <IconMic className="relative h-[18px] w-[18px]" />
                </span>
              </ToolButton>
            )}
            {hasText || busy ? (
              <button
                onClick={submit}
                disabled={!hasText || busy}
                aria-label="Send"
                title="Send (Enter)"
                className="mv-press flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-subtle/40"
              >
                {busy ? <Spinner className="h-4 w-4" /> : <IconArrowUp className="h-[18px] w-[18px]" />}
              </button>
            ) : (
              <button
                onClick={onVoiceMode}
                aria-label="Start voice conversation"
                title="Voice conversation"
                className="mv-press flex h-9 items-center gap-1.5 rounded-full bg-ink px-3 text-sm font-medium text-white transition-colors hover:bg-ink/85"
              >
                <IconWaveform className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Voice</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas-hover hover:text-ink',
        active && !danger && 'bg-brand-50 text-brand-700',
        danger && 'bg-danger-bg text-danger-fg hover:bg-danger-bg',
      )}
    >
      {children}
    </button>
  )
}

function PhrasesPanel({
  patientId,
  examples,
  onInsert,
  onClose,
}: {
  patientId: string
  examples: string[]
  onInsert: (t: string) => void
  onClose: () => void
}) {
  const terms = GLOSSARY.slice(0, 12)
  return (
    <div className="animate-scale-in absolute bottom-full left-0 right-0 z-20 mb-2 max-h-[55vh] overflow-y-auto rounded-2xl border border-canvas-border bg-white p-3 shadow-pop mv-scroll">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-ink-muted">
          MediVara doesn’t translate sign language. Tap a question or a health term to add it, then send.
          For a conversation with staff, <Link to={`/p/${patientId}/visit-assist`} className="font-medium text-brand-700 underline">open your Visit Card</Link>.
        </p>
        <button onClick={onClose} aria-label="Close signs and phrases" className="shrink-0 rounded p-0.5 text-ink-subtle hover:bg-canvas-hover">
          <IconX className="h-4 w-4" />
        </button>
      </div>
      {examples.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Common questions</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => onInsert(ex)}
                className="rounded-xl border border-canvas-border px-3 py-2 text-left text-sm text-ink transition-colors hover:border-brand-200 hover:bg-brand-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Health terms</p>
        <div className="flex flex-wrap gap-1.5">
          {terms.map((t) => (
            <button
              key={t.term_id}
              onClick={() => onInsert(t.term)}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-brand-800 hover:bg-brand-100"
            >
              {t.term}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
