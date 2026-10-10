// Two-way voice mode on an ElevenLabs Agent (loaded lazily: the SDK is large).
// The agent speaks and listens; for anything about the user's records it must call the
// `ask_medical_records` client tool, which runs MediVara's own gated and validated Ask
// pipeline and saves the turn to this chat. The tool result is what the agent reads back.
// Live captions are always shown so the conversation stays accessible.
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ConversationProvider, useConversation, useConversationClientTool } from '@elevenlabs/react'
import * as api from '../../api/endpoints'
import { ApiError } from '../../api/types'
import type { AskResponse } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { answerAsText } from '../../lib/chat'
import { cn } from '../../lib/cn'
import { COPY } from '../../lib/copy'
import { formatDate } from '../../lib/format'
import { IconMic, IconMicOff, IconPhoneOff, IconWaveform, IconX } from '../icons'
import { Button, Spinner } from '../ui'

export interface VoiceModeProps {
  patientId: string
  patientName: string
  onClose: () => void
  /** Ask MediVara (saved to the current chat). Resolves null when the answer couldn't be fetched. */
  askRecords: (question: string) => Promise<AskResponse | null>
}

export default function VoiceMode(props: VoiceModeProps) {
  return (
    <ConversationProvider>
      <VoiceModeInner {...props} />
    </ConversationProvider>
  )
}

interface Caption {
  id: number
  role: 'user' | 'agent'
  text: string
}

/** What the voice agent receives from the tool: the checked answer plus reading instructions. */
function toolResult(answer: AskResponse): string {
  const sources = [
    ...new Map(answer.evidence.map((e) => [e.document_id, `${e.document_title} (${formatDate(e.document_date)})`])).values(),
  ]
  const parts = [`Status: ${answer.status}.`, answerAsText(answer)]
  if (answer.status === 'answered' && sources.length) parts.push(`Sources: ${sources.join('; ')}.`)
  parts.push('Read this to the user faithfully and briefly. Do not add advice or facts that are not here.')
  return parts.join('\n')
}

function startErrorText(e: unknown): string {
  if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) return COPY['COPY-22']
  if (e instanceof DOMException && e.name === 'NotFoundError') return 'No microphone was found on this device.'
  if (e instanceof ApiError) {
    if (e.code === 'VOICE_UNAVAILABLE' && e.status === 503) return COPY['COPY-40']
    if (e.code === 'CONSENT_REQUIRED') return 'Voice needs your permission first. Try starting again.'
    return e.message
  }
  return 'Voice conversation couldn’t start. Try again, or type your question.'
}

let captionSeq = 0

function VoiceModeInner({ patientId, patientName, onClose, askRecords }: VoiceModeProps) {
  const { me, refreshMe } = useAuth()
  const configQ = useQuery({ queryKey: ['voice-config'], queryFn: api.getVoiceConfig, staleTime: 60_000 })
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [checking, setChecking] = useState(false)
  const orbRef = useRef<HTMLDivElement>(null)
  const captionsEnd = useRef<HTMLDivElement>(null)

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      if (!message) return
      captionSeq += 1
      setCaptions((c) => [...c.slice(-30), { id: captionSeq, role, text: message }])
    },
    onError: (message) => setError(message || 'The voice connection had a problem.'),
    onDisconnect: (details) => {
      if (details.reason === 'error') setError('The voice connection dropped. You can start again.')
    },
  })
  const convRef = useRef(conversation)
  convRef.current = conversation
  const live = conversation.status === 'connected'
  const connecting = starting || conversation.status === 'connecting'

  useConversationClientTool('ask_medical_records', async (params) => {
    const question = String(params.question ?? '').trim().slice(0, 500)
    if (!question) return 'No question was received. Ask the user to repeat their question.'
    setChecking(true)
    try {
      const answer = await askRecords(question)
      if (!answer) return 'MediVara could not check the records just now. Tell the user to try again in a moment or type the question.'
      return toolResult(answer)
    } finally {
      setChecking(false)
    }
  })

  // Drive the orb from live input/output volume without re-rendering every frame.
  useEffect(() => {
    if (!live) return
    let raf = 0
    const tick = () => {
      const c = convRef.current
      const level = Math.max(c.getInputVolume?.() ?? 0, c.getOutputVolume?.() ?? 0)
      orbRef.current?.style.setProperty('--mv-level', String(Math.min(1, level * 1.6)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live])

  useEffect(() => {
    captionsEnd.current?.scrollIntoView({ block: 'end' })
  }, [captions])

  // Always hang up when the overlay goes away.
  useEffect(() => () => convRef.current.endSession(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  async function start() {
    setError(null)
    setStarting(true)
    try {
      if (!me?.consents.voice_input?.granted) {
        await api.recordConsent('voice_input', true)
        void refreshMe()
      }
      // Ask for the microphone up front so a denial gets a clear message.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      const session = await api.startVoiceSession(patientId)
      const dynamicVariables = session.dynamic_variables
      // Only sent when the server configured one (the agent must allow that override).
      const overrides = session.overrides?.tts?.voiceId ? { tts: { voiceId: session.overrides.tts.voiceId } } : undefined
      if (session.signed_url) {
        conversation.startSession({ signedUrl: session.signed_url, connectionType: 'websocket', dynamicVariables, overrides })
      } else if (session.agent_id) {
        conversation.startSession({ agentId: session.agent_id, connectionType: 'websocket', dynamicVariables, overrides })
      } else {
        throw new ApiError(503, { code: 'VOICE_UNAVAILABLE', message: COPY['COPY-40'], details: {}, request_id: '' })
      }
    } catch (e) {
      setError(startErrorText(e))
    } finally {
      setStarting(false)
    }
  }

  function close() {
    convRef.current.endSession()
    onClose()
  }

  const unavailable = configQ.data && !configQ.data.available
  const status = !live
    ? connecting
      ? 'Connecting…'
      : 'Talk with MediVara'
    : conversation.isSpeaking
      ? 'MediVara is speaking'
      : checking
        ? 'Checking your documents…'
        : 'Listening'

  return (
    <div role="dialog" aria-modal="true" aria-label="Voice conversation" className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <IconWaveform className="h-4 w-4" />
          <span className="font-medium text-ink">Voice</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{patientName}’s records</span>
        </div>
        <button onClick={close} aria-label="Close voice mode" className="rounded-full p-2 text-ink-muted hover:bg-canvas-hover hover:text-ink">
          <IconX />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center px-4">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="relative flex h-52 w-52 items-center justify-center">
            <div
              className={cn('absolute inset-0 rounded-full bg-brand-gradient-soft blur-2xl', live ? 'mv-orb-glow' : 'opacity-40')}
              aria-hidden="true"
            />
            <div
              ref={orbRef}
              className="relative h-40 w-40 rounded-full bg-brand-gradient shadow-pop transition-transform duration-100"
              style={{ transform: 'scale(calc(0.92 + var(--mv-level, 0) * 0.22))' }}
              aria-hidden="true"
            />
            {connecting && <Spinner className="absolute h-8 w-8 text-white" />}
          </div>
          <p className="mt-6 font-serif text-2xl text-ink" role="status" aria-live="polite">{status}</p>
          {live && <p className="mt-1 text-sm text-ink-subtle">Ask about your documents, medicines or results.</p>}
        </div>

        {captions.length > 0 && (
          <div className="mb-4 max-h-56 w-full max-w-xl overflow-y-auto rounded-2xl border border-canvas-border bg-white/80 p-3 mv-scroll" aria-live="polite" aria-label="Live captions">
            <ul className="space-y-2">
              {captions.map((c) => (
                <li key={c.id} className={cn('flex', c.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <span
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-1.5 text-sm',
                      c.role === 'user' ? 'bg-canvas-bubble text-ink' : 'bg-brand-50 text-brand-900',
                    )}
                  >
                    <span className="sr-only">{c.role === 'user' ? 'You said: ' : 'MediVara said: '}</span>
                    {c.text}
                  </span>
                </li>
              ))}
            </ul>
            <div ref={captionsEnd} />
          </div>
        )}

        {error && (
          <p className="mb-3 max-w-xl text-center text-sm font-medium text-danger-fg" role="alert">{error}</p>
        )}

        <div className="mb-8 flex w-full max-w-xl flex-col items-center gap-3">
          {unavailable ? (
            <>
              <p className="text-center text-sm text-ink-muted">{COPY['COPY-40']}</p>
              <Button variant="secondary" onClick={close}>Back to chat</Button>
            </>
          ) : live ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => conversation.setMuted(!conversation.isMuted)}
                aria-pressed={conversation.isMuted}
                aria-label={conversation.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full border transition-colors',
                  conversation.isMuted ? 'border-danger-border bg-danger-bg text-danger-fg' : 'border-canvas-border bg-white text-ink hover:bg-canvas-hover',
                )}
              >
                {conversation.isMuted ? <IconMicOff className="h-6 w-6" /> : <IconMic className="h-6 w-6" />}
              </button>
              <button
                onClick={close}
                aria-label="End voice conversation"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-fg text-white transition-opacity hover:opacity-90"
              >
                <IconPhoneOff className="h-6 w-6" />
              </button>
            </div>
          ) : (
            <>
              <p className="text-center text-xs leading-relaxed text-ink-subtle">{COPY['COPY-39']}</p>
              <div className="flex items-center gap-2">
                <Button onClick={() => void start()} loading={connecting} disabled={configQ.isLoading}>
                  <IconMic className="h-4 w-4" /> Start conversation
                </Button>
                <Button variant="ghost" onClick={close}>Type instead</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
