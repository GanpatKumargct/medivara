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
import type { ChatMessage, WomensHealth } from '../api/types'
import { buildAskSuggestions } from '../lib/ask-suggestions'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { chatKey, uploadProblem, useChatActions } from '../lib/chat'
import { COPY } from '../lib/copy'
import { LogoMark } from '../components/brand'
import { Composer } from '../components/chat/Composer'
import { AssistantAnswer, AttachmentCard, ThinkingRow, UserBubble } from '../components/chat/Messages'
import { Button, Skeleton, Spinner } from '../components/ui'
import { IconArrowUp, IconBrief, IconFlower, IconHeartPulse, IconPaperclip, IconPill, IconUpload, IconWaveform } from '../components/icons'
import { t } from '../lib/i18n'

const VoiceMode = lazy(() => import('../components/chat/VoiceMode'))

const GENERIC_EXAMPLES = [
  t("Which medicines are listed in my latest prescription?"),
  t("Summarise my most recent lab report"),
  t("Do my documents mention any allergies?"),
  t("When is my next follow-up?"),
]

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? t("Good evening") : h < 12 ? t("Good morning") : h < 17 ? t("Good afternoon") : t("Good evening")
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
  const detailsQ = useQuery({ queryKey: ['details', patientId], queryFn: () => api.getProfileDetails(patientId), enabled: !!patientQ.data })
  const womensQ = useQuery({ queryKey: ['womens-health', patientId], queryFn: () => api.getWomensHealth(patientId), enabled: !!patientQ.data })
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
  // Suggestions come from this profile's own documents, so each one has an answer; the
  // generic examples are used only when there is nothing to suggest yet.
  const timelineQ = useQuery({
    queryKey: ['timeline', patientId, 'ask-suggestions'],
    queryFn: () => api.getTimeline(patientId, { include_unverified: true }),
  })
  const fromDocuments = buildAskSuggestions(timelineQ.data)
  const examples = fromDocuments.length ? fromDocuments : GENERIC_EXAMPLES

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

  async function ask(text: string, inputMode: 'text' | 'voice' | 'sign') {
    setDraft('')
    try {
      const id = await ensureChat()
      await actions.sendQuestion(id, text, inputMode)
    } catch {
      setDraft(text)
      toast(t("MediVara couldn’t start a chat. Check your connection and try again."), 'error')
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
      toast(t("MediVara couldn’t start a chat. Check your connection and try again."), 'error')
    }
  }

  async function retry(m: ChatMessage) {
    if (!chatId || !m.text) return
    actions.discardMessage(chatId, m.id)
    await actions.sendQuestion(chatId, m.text, m.input_mode === 'voice' || m.input_mode === 'sign' ? m.input_mode : 'text')
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
      onSubmit={(t, mode) => void ask(t, mode)}
      busy={busy}
      canAttach={canUpload}
      onAttach={(f) => void attach(f)}
      onVoiceMode={() => setVoiceOpen(true)}
      patientName={patient?.display_name ?? ''}
      size={size}
      autoFocus
      placeholder={
        patient && patient.my_role !== 'owner'
          ? t("Ask about {{value}}’s records…", { value: patient.display_name.split(' ')[0] })
          : t("Ask about your health records…")
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
            <IconUpload className="h-5 w-5" /> {t("Drop a PDF to add it to")}{' '}{patient?.display_name ?? 'this profile'}{t("’s records")}</p>
        </div>
      )}

      {notFound ? (
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-serif text-2xl text-ink">{t("This chat isn’t available")}</h1>
          <p className="mt-2 text-sm text-ink-muted">{t("It may have been deleted, or it belongs to someone else.")}</p>
          <Button className="mt-6" onClick={() => navigate(`/p/${patientId}`)}>{t("Start a new chat")}</Button>
        </div>
      ) : chatId && chatQ.isLoading ? (
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8" aria-busy="true" aria-label={t("Loading chat")}>
          <Skeleton className="ml-auto h-10 w-2/3 rounded-3xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-3xl" />
        </div>
      ) : showHero ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[8vh] pt-10">
          <div className="w-full max-w-[680px]">
            <header className="flex flex-col items-center text-center">
              <span className="relative mb-5 inline-flex">
                <span className="absolute -inset-3 rounded-[24px] bg-brand-gradient-soft opacity-25 blur-xl" aria-hidden="true" />
                <LogoMark size={56} className="relative drop-shadow-[0_8px_18px_rgba(2,132,247,0.28)]" />
              </span>
              <h1 className="font-serif text-[2.1rem] leading-tight tracking-tight text-ink sm:text-[2.6rem]">
                {greeting()}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="mt-2 max-w-md text-[15px] text-ink-muted">
                {patient && patient.my_role !== 'owner'
                  ? t("You’re viewing {{display_name}}’s records, shared with you.", { display_name: patient.display_name })
                  : t("How can I help with your health records today?")}
              </p>
            </header>

            <div className="mt-8">{composer('hero')}</div>
            {notice && <p className="mt-2 text-center text-sm font-medium text-danger-fg" role="alert">{notice}</p>}

            <nav aria-label={t("Quick actions")} className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {canUpload ? (
                <ActionTile icon={<IconPaperclip />} tint="bg-brand-50 text-brand-700" title={t("Upload a report")} caption={t("PDF to your records")} onClick={() => fileRef.current?.click()} />
              ) : (
                <ActionTile icon={<IconPill />} tint="bg-brand-50 text-brand-700" title={t("Medicines")} caption={t("All in your documents")} to={`/p/${patientId}/medicines`} />
              )}
              <ActionTile icon={<IconWaveform />} tint="bg-violet-bg text-violet-fg" title={t("Talk by voice")} caption={t("Ask hands-free")} onClick={() => setVoiceOpen(true)} />
              <ActionTile icon={<IconBrief />} tint="bg-teal-bg text-teal-fg" title={t("Prepare for a visit")} caption={t("One-page doctor brief")} to={`/p/${patientId}/brief`} />
              {detailsQ.data?.sex === 'female' || (womensQ.data && womensQ.data.mode !== 'off') ? (
                <ActionTile icon={<IconFlower />} tint="bg-cyan-bg text-cyan-fg" title={t("Women’s health")} caption={womensCaption(womensQ.data)} to={`/p/${patientId}/womens-health`} />
              ) : (
                <ActionTile icon={<IconHeartPulse />} tint="bg-cyan-bg text-cyan-fg" title={t("Track vitals")} caption={t("BP, sugar, weight")} to={`/p/${patientId}/vitals`} />
              )}
            </nav>
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

            <section aria-labelledby="try-asking" className="mt-9">
              <h2 id="try-asking" className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                {t("Try asking")}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {examples.slice(0, 4).map((ex) => (
                  <li key={ex}>
                    <button
                      onClick={() => void ask(ex, 'text')}
                      disabled={busy}
                      className="group flex h-full w-full items-center justify-between gap-3 rounded-xl border border-canvas-border bg-white/70 px-3.5 py-2.5 text-left text-sm text-ink-muted transition-colors hover:border-brand-200 hover:bg-white hover:text-ink"
                    >
                      <span>{ex}</span>
                      <IconArrowUp className="h-4 w-4 shrink-0 rotate-45 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <p className="mt-8 text-center text-[11px] text-ink-subtle">{COPY['COPY-02']}</p>
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

/** One-line status for the Women's health tile, from the backend's own calculation. */
function womensCaption(wh: WomensHealth | undefined): string {
  const s = wh?.summary
  if (!wh || wh.mode === 'off') return 'Periods, pregnancy, after birth'
  if (wh.mode === 'pregnancy' && s?.pregnancy) return t("Week {{weeks}} of pregnancy", { weeks: s.pregnancy.weeks })
  if (wh.mode === 'postpartum' && s?.postpartum) return t('{{count}} weeks since birth', { count: s.postpartum.weeks_since_delivery })
  const d = s?.cycle.days_until_next_period
  if (d === null || d === undefined) return t('Log your period')
  return d > 0 ? t('Next period in about {{count}} days', { count: d }) : d === 0 ? t('Period expected today') : t('Period {{count}} days late', { count: -d })
}

function ActionTile({
  icon,
  tint,
  title,
  caption,
  onClick,
  to,
}: {
  icon: ReactNode
  tint: string
  title: string
  caption: string
  onClick?: () => void
  to?: string
}) {
  const cls =
    'mv-press group flex h-full flex-col items-start gap-2 rounded-2xl border border-canvas-border bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card'
  const body = (
    <>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px] ${tint}`}>{icon}</span>
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-subtle">{caption}</span>
      </span>
    </>
  )
  return to ? (
    <Link to={to} className={cls}>{body}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{body}</button>
  )
}
