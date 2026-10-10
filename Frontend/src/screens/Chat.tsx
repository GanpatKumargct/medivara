// SCR-08 redesign — the chat home, like a desktop AI assistant. A new chat shows a
// greeting and a large composer; once you ask, the thread scrolls above a docked
// composer. Questions are answered only from this profile's documents (gate +
// validator on the server), PDFs dropped here go into the profile's records, and the
// waveform button opens two-way voice mode. Chats are saved and listed in the sidebar.
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { ApiError } from '../api/types'
import type { ChatMessage } from '../api/types'
import { ASK_EXAMPLE_QUESTIONS } from '../dummy-data/ask'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { chatKey, uploadProblem, useChatActions } from '../lib/chat'
import { COPY } from '../lib/copy'
import { LogoMark } from '../components/brand'
import { Composer } from '../components/chat/Composer'
import { AssistantAnswer, AttachmentCard, ThinkingRow, UserBubble } from '../components/chat/Messages'
import { Button, Skeleton, Spinner } from '../components/ui'
import { IconBrief, IconHeartPulse, IconPaperclip, IconPill, IconUpload, IconWaveform } from '../components/icons'

const VoiceMode = lazy(() => import('../components/chat/VoiceMode'))

const GENERIC_EXAMPLES = [
  'Which medicines are listed in my latest prescription?',
  'Summarise my most recent lab report',
  'Do my documents mention any allergies?',
  'When is my next follow-up?',
]

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Chat() {
  const { patientId = '', chatId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const actions = useChatActions(patientId)
  const [draft, setDraft] = useState('')
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const activeChat = useRef<string | undefined>(chatId)
  const creating = useRef<Promise<string> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.getPatient(patientId) })
  const chatQ = useQuery({
    queryKey: chatKey(patientId, chatId ?? ''),
    queryFn: () => api.getChat(patientId, chatId!),
    enabled: !!chatId,
  })

  useEffect(() => {
    activeChat.current = chatId
    setNotice(null)
  }, [chatId])

  const messages = chatId ? chatQ.data?.messages ?? [] : []
  const busy = messages.some((m) => m.kind === 'question' && m.pending)
  const patient = patientQ.data
  const canUpload = !!patient && (patient.my_role === 'owner' || patient.scopes.includes('upload_documents'))
  const examples = ASK_EXAMPLE_QUESTIONS[patientId]?.length ? ASK_EXAMPLE_QUESTIONS[patientId] : GENERIC_EXAMPLES

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, busy])

  /** The chat to post into: the open one, or a new one (created once even if called twice). */
  const ensureChat = useCallback(async (): Promise<string> => {
    if (activeChat.current) return activeChat.current
    if (!creating.current) {
      creating.current = actions.createChat().finally(() => {
        creating.current = null
      })
    }
    const id = await creating.current
    activeChat.current = id
    return id
  }, [actions])

  async function ask(text: string, usedVoice: boolean) {
    setDraft('')
    try {
      const id = await ensureChat()
      await actions.sendQuestion(id, text, usedVoice ? 'voice' : 'text')
    } catch {
      setDraft(text)
      toast('MediVara couldn’t start a chat. Check your connection and try again.', 'error')
    }
  }

  async function attach(file: File) {
    const problem = uploadProblem(file)
    if (problem) {
      setNotice(problem)
      return
    }
    setNotice(null)
    try {
      const id = await ensureChat()
      await actions.attachFile(id, file)
    } catch {
      toast('MediVara couldn’t start a chat. Check your connection and try again.', 'error')
    }
  }

  async function retry(m: ChatMessage) {
    if (!chatId || !m.text) return
    actions.discardMessage(chatId, m.id)
    await actions.sendQuestion(chatId, m.text, m.input_mode === 'voice' ? 'voice' : 'text')
  }

  const askRecords = useCallback(
    async (question: string) => {
      try {
        const id = await ensureChat()
        return await actions.sendQuestion(id, question, 'voice')
      } catch {
        return null
      }
    },
    [actions, ensureChat],
  )

  const dropHandlers = canUpload
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        },
        onDragLeave: (e: React.DragEvent) => {
          if (e.currentTarget === e.target) setDragging(false)
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) void attach(f)
        },
      }
    : {}

  const composer = (size: 'hero' | 'docked') => (
    <Composer
      key={chatId ?? 'new'}
      patientId={patientId}
      value={draft}
      onChange={setDraft}
      onSubmit={(t, v) => void ask(t, v)}
      busy={busy}
      canAttach={canUpload}
      onAttach={(f) => void attach(f)}
      onVoiceMode={() => setVoiceOpen(true)}
      examples={examples}
      size={size}
      autoFocus
      placeholder={
        patient && patient.my_role !== 'owner'
          ? `Ask about ${patient.display_name.split(' ')[0]}’s records…`
          : 'Ask about your health records…'
      }
    />
  )

  const notFound = chatQ.error instanceof ApiError && (chatQ.error.code === 'NOT_FOUND' || chatQ.error.code === 'ACCESS_DENIED')
  const showHero = !chatId || (chatQ.isSuccess && messages.length === 0)
  const firstName = user?.display_name.split(' ')[0] ?? ''

  return (
    <div className="relative flex flex-1 flex-col" {...dropHandlers}>
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-brand-400 bg-brand-50/80">
          <p className="flex items-center gap-2 text-base font-medium text-brand-800">
            <IconUpload className="h-5 w-5" /> Drop a PDF to add it to {patient?.display_name ?? 'this profile'}’s records
          </p>
        </div>
      )}

      {notFound ? (
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-serif text-2xl text-ink">This chat isn’t available</h1>
          <p className="mt-2 text-sm text-ink-muted">It may have been deleted, or it belongs to someone else.</p>
          <Button className="mt-6" onClick={() => navigate(`/p/${patientId}`)}>Start a new chat</Button>
        </div>
      ) : chatId && chatQ.isLoading ? (
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8" aria-busy="true" aria-label="Loading chat">
          <Skeleton className="ml-auto h-10 w-2/3 rounded-3xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-3xl" />
        </div>
      ) : showHero ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-2xl">
            <div className="mb-2 flex items-center justify-center gap-3">
              <LogoMark size={38} />
              <h1 className="font-serif text-3xl tracking-tight text-ink sm:text-[2.6rem]">
                {greeting()}{firstName ? `, ${firstName}` : ''}
              </h1>
            </div>
            <p className="mb-7 text-center text-sm text-ink-muted">
              {patient && patient.my_role !== 'owner'
                ? `You’re viewing ${patient.display_name}’s records, shared with you.`
                : 'Ask about your records, add a report, or talk it through by voice.'}
            </p>
            {composer('hero')}
            {notice && <p className="mt-2 text-center text-sm font-medium text-danger-fg" role="alert">{notice}</p>}

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {canUpload && (
                <Chip icon={<IconPaperclip className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>Upload a report</Chip>
              )}
              <Chip icon={<IconWaveform className="h-4 w-4" />} onClick={() => setVoiceOpen(true)}>Talk by voice</Chip>
              <Chip icon={<IconBrief className="h-4 w-4" />} to={`/p/${patientId}/brief`}>Prepare for a visit</Chip>
              <Chip icon={<IconPill className="h-4 w-4" />} to={`/p/${patientId}/medicines`}>Medicines</Chip>
              <Chip icon={<IconHeartPulse className="h-4 w-4" />} to={`/p/${patientId}/vitals`}>Vitals</Chip>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void attach(f)
                e.target.value = ''
              }}
            />

            <div className="mx-auto mt-8 max-w-xl">
              <p className="mb-1 px-3 text-xs font-medium text-ink-subtle">Try asking</p>
              <ul>
                {examples.map((ex) => (
                  <li key={ex}>
                    <button
                      onClick={() => void ask(ex, false)}
                      disabled={busy}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-canvas-hover hover:text-ink"
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mx-auto w-full max-w-3xl flex-1 space-y-7 px-4 pb-8 pt-8" aria-live="polite">
            {messages.map((m) =>
              m.kind === 'attachment' ? (
                <AttachmentCard key={m.id} patientId={patientId} message={m} />
              ) : m.kind === 'answer' && m.answer ? (
                <AssistantAnswer key={m.id} answer={m.answer} />
              ) : m.kind === 'question' ? (
                <UserBubble key={m.id} message={m} onRetry={m.failed ? () => void retry(m) : undefined} />
              ) : null,
            )}
            {busy && <ThinkingRow />}
            {/* Scroll margin keeps the newest message clear of the docked composer. */}
            <div ref={endRef} className="scroll-mb-44" />
          </div>
          <div className="no-print sticky bottom-0 z-10 bg-gradient-to-t from-canvas via-canvas to-canvas/0 pt-6">
            <div className="mx-auto w-full max-w-3xl px-4 pb-3">
              {notice && <p className="mb-2 text-sm font-medium text-danger-fg" role="alert">{notice}</p>}
              {composer('docked')}
              <p className="mt-2 text-center text-[11px] text-ink-subtle">{COPY['COPY-02']}</p>
            </div>
          </div>
        </>
      )}

      {voiceOpen && patient && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas">
              <Spinner className="h-8 w-8 text-brand-600" />
            </div>
          }
        >
          <VoiceMode
            patientId={patientId}
            patientName={patient.display_name}
            onClose={() => setVoiceOpen(false)}
            askRecords={askRecords}
          />
        </Suspense>
      )}
    </div>
  )
}

function Chip({ icon, children, onClick, to }: { icon: ReactNode; children: ReactNode; onClick?: () => void; to?: string }) {
  const cls =
    'mv-press inline-flex items-center gap-1.5 rounded-xl border border-canvas-border bg-white px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-brand-200 hover:text-ink'
  return to ? (
    <Link to={to} className={cls}>{icon}{children}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{icon}{children}</button>
  )
}
