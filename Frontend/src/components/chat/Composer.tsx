// Chat composer. Type, dictate (browser speech-to-text, en-IN), or build a question in
// sign mode (camera button, DEC-28) — every method fills an editable box the user confirms;
// nothing is auto-sent except emergency signs (FR-056, COPY-17). The paperclip uploads a PDF
// into this profile's records, and the waveform button opens two-way voice mode.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as api from '../../api/endpoints'
import { cn } from '../../lib/cn'
import { COPY } from '../../lib/copy'
import { SignMode } from '../sign-camera'
import { useSpeechInput } from '../../lib/useSpeechInput'
import { IconArrowUp, IconCamera, IconMic, IconPaperclip, IconWaveform, IconX } from '../icons'
import { Spinner } from '../ui'
import { t } from '../../lib/i18n'

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
  onSubmit: (text: string, inputMode: 'text' | 'voice' | 'sign') => void
  busy: boolean
  canAttach: boolean
  onAttach: (file: File) => void
  onVoiceMode: () => void
  /** Shown in sign mode's header ("Meera Raman's records"). */
  patientName?: string
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
  patientName = '',
  placeholder = t("Ask about your health records…"),
  autoFocus,
  size = 'docked',
}: ComposerProps) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const voiceUsed = useRef(false)
  const signUsed = useRef(false)
  const consentRecorded = useRef(false)
  const [signOpen, setSignOpen] = useState(false)
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
    onSubmit(text, signUsed.current ? 'sign' : voiceUsed.current ? 'voice' : 'text')
    voiceUsed.current = false
    signUsed.current = false
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
      {signOpen && (
        <SignMode
          patientId={patientId}
          patientName={patientName}
          onClose={() => {
            setSignOpen(false)
            textRef.current?.focus()
          }}
          onQuestion={(q) => {
            // Shown in the box: the user checks it and presses Send (DEC-28).
            signUsed.current = true
            onChange(q.slice(0, MAX_LEN))
          }}
          // Emergency signs don't wait: the safety check answers with the fixed emergency card.
          onEmergency={(phrase) => onSubmit(phrase, 'sign')}
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
            aria-label={t("Dismiss")}
            className="shrink-0 rounded p-0.5 text-ink-subtle hover:bg-canvas-hover hover:text-ink"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        className={cn(
          'rounded-[26px] border border-canvas-border bg-white shadow-composer transition-colors focus-within:border-brand-300',
          size === 'hero' ? "px-4 pb-3 pt-4" : "px-3 pb-2.5 pt-3",
        )}
      >
        <textarea
          ref={textRef}
          rows={size === 'hero' ? 2 : 1}
          value={value}
          maxLength={MAX_LEN}
          onChange={(e) => {
            onChange(e.target.value)
            if (!e.target.value) signUsed.current = false
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={speech.listening ? t("Listening… speak now") : placeholder}
          aria-label={t("Your question")}
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
                <ToolButton label={t("Add a PDF to your records")} onClick={() => fileRef.current?.click()}>
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
            <ToolButton label={t("Sign with the camera (experimental)")} onClick={() => setSignOpen(true)} active={signOpen}>
              <IconCamera className="h-[18px] w-[18px]" />
            </ToolButton>
            {value.length > MAX_LEN - 100 && (
              <span className="ml-1 text-xs text-ink-subtle">{value.length}/{MAX_LEN}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {speech.supported && (
              <ToolButton
                label={speech.listening ? t("Stop dictation") : t("Dictate (speech to text)")}
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
                aria-label={t("Send")}
                title={t("Send (Enter)")}
                className="mv-press flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-subtle/40"
              >
                {busy ? <Spinner className="h-4 w-4" /> : <IconArrowUp className="h-[18px] w-[18px]" />}
              </button>
            ) : (
              <button
                onClick={onVoiceMode}
                aria-label={t("Start voice conversation")}
                title={t("Voice conversation")}
                className="mv-press flex h-9 items-center gap-1.5 rounded-full bg-ink px-3 text-sm font-medium text-white transition-colors hover:bg-ink/85"
              >
                <IconWaveform className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">{t("Voice")}</span>
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
