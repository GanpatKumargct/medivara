// Chat state lives in the react-query cache, keyed by patient + chat id, not in
// component state. That keeps a conversation going when the URL changes from a new
// chat to /chat/:id, and lets voice mode add grounded turns to the same thread.
import { dateLocale } from './format'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { ApiError } from '../api/types'
import type { AskResponse, Chat, ChatDetail, ChatMessage, ListResponse } from '../api/types'
import { COPY } from './copy'
import { t } from './i18n'

export const chatKey = (patientId: string, chatId: string) => ['chat', patientId, chatId] as const
export const chatsKey = (patientId: string) => ['chats', patientId] as const

const ANSWER_TIMEOUT_MS = 30_000
let tempSeq = 0

function patchChat(qc: QueryClient, patientId: string, chatId: string, fn: (d: ChatDetail) => ChatDetail) {
  qc.setQueryData<ChatDetail>(chatKey(patientId, chatId), (old) => (old ? fn(old) : old))
}

function upsertChatInList(qc: QueryClient, patientId: string, chat: Chat) {
  qc.setQueryData<ListResponse<Chat>>(chatsKey(patientId), (old) => {
    if (!old) return old
    const rest = old.items.filter((c) => c.id !== chat.id)
    const isNew = rest.length === old.items.length
    return { ...old, items: [chat, ...rest], total: old.total + (isNew ? 1 : 0) }
  })
}

function tempMessage(chatId: string, fields: Partial<ChatMessage>): ChatMessage {
  tempSeq += 1
  return {
    id: `tmp_${tempSeq}`,
    chat_id: chatId,
    role: 'user',
    kind: 'question',
    text: null,
    input_mode: null,
    answer: null,
    document: null,
    created_at: new Date().toISOString(),
    pending: true,
    ...fields,
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

/** Client-side checks that mirror the server's upload rules (FE-3.2). Null when OK. */
export function uploadProblem(file: File): string | null {
  if (file.size > 10 * 1024 * 1024) return COPY['COPY-34b']
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') return COPY['COPY-34c']
  return null
}

function uploadErrorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'FILE_TOO_LARGE') return COPY['COPY-34b']
    if (e.code === 'UNSUPPORTED_FILE_TYPE') return COPY['COPY-34c']
    if (e.code === 'TOO_MANY_PAGES') return COPY['COPY-34e']
    return t(e.message)
  }
  return t("Upload failed. Try again.")
}

export function useChatActions(patientId: string) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  /** Create a chat on the server, seed its cache entry and move the URL to it. */
  const createChat = useCallback(async (): Promise<string> => {
    const chat = await api.createChat(patientId)
    qc.setQueryData<ChatDetail>(chatKey(patientId, chat.id), { chat, messages: [] })
    upsertChatInList(qc, patientId, chat)
    navigate(`/p/${patientId}/chat/${chat.id}`)
    return chat.id
  }, [patientId, qc, navigate])

  /** Ask a question in a chat. Resolves with the validated answer (also used by voice mode). */
  const sendQuestion = useCallback(
    async (chatId: string, question: string, inputMode: 'text' | 'voice' | 'sign'): Promise<AskResponse | null> => {
      const temp = tempMessage(chatId, { text: question, input_mode: inputMode })
      // Not awaited: an in-flight refetch must not overwrite the optimistic row, and the
      // row has to land in the same tick as a new chat's navigation (no empty-state flash).
      void qc.cancelQueries({ queryKey: chatKey(patientId, chatId) })
      patchChat(qc, patientId, chatId, (d) => ({ ...d, messages: [...d.messages, temp] }))
      try {
        const res = await withTimeout(api.sendChatMessage(patientId, chatId, question, inputMode), ANSWER_TIMEOUT_MS)
        patchChat(qc, patientId, chatId, (d) => ({
          chat: res.chat,
          messages: [...d.messages.filter((m) => m.id !== temp.id), res.user_message, res.assistant_message],
        }))
        upsertChatInList(qc, patientId, res.chat)
        return res.assistant_message.answer
      } catch {
        patchChat(qc, patientId, chatId, (d) => ({
          ...d,
          messages: d.messages.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)),
        }))
        return null
      }
    },
    [patientId, qc],
  )

  /** Drop a failed optimistic row (before retrying it). */
  const discardMessage = useCallback(
    (chatId: string, messageId: string) => {
      patchChat(qc, patientId, chatId, (d) => ({ ...d, messages: d.messages.filter((m) => m.id !== messageId) }))
    },
    [patientId, qc],
  )

  /** Upload a PDF to this profile's records and post it into the chat. */
  const attachFile = useCallback(
    async (chatId: string, file: File) => {
      const temp = tempMessage(chatId, { kind: 'attachment', file_name: file.name })
      patchChat(qc, patientId, chatId, (d) => ({ ...d, messages: [...d.messages, temp] }))
      try {
        const { document } = await api.uploadDocument(patientId, file)
        const { message, chat } = await api.attachDocumentToChat(patientId, chatId, document.id)
        patchChat(qc, patientId, chatId, (d) => ({
          chat,
          messages: d.messages.map((m) => (m.id === temp.id ? message : m)),
        }))
        upsertChatInList(qc, patientId, chat)
        void qc.invalidateQueries({ queryKey: ['documents', patientId] })
        void qc.invalidateQueries({ queryKey: ['patient', patientId] })
      } catch (e) {
        patchChat(qc, patientId, chatId, (d) => ({
          ...d,
          messages: d.messages.map((m) =>
            m.id === temp.id ? { ...m, pending: false, failed: true, text: uploadErrorText(e) } : m,
          ),
        }))
      }
    },
    [patientId, qc],
  )

  return { createChat, sendQuestion, discardMessage, attachFile }
}

/** "Today", "Yesterday", "Previous 7 days", "Previous 30 days", then "Month Year". */
export function historyGroup(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 86_400_000
  const time = d.getTime()
  if (time >= startOfToday) return t('Today')
  if (time >= startOfToday - day) return t('Yesterday')
  if (time >= startOfToday - 7 * day) return t('Previous 7 days')
  if (time >= startOfToday - 30 * day) return t('Previous 30 days')
  return d.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })
}

/** Plain-text version of a validated answer, for copying and for the voice agent to read out. */
export function answerAsText(answer: AskResponse): string {
  const lines: string[] = []
  if (answer.status === 'advice_redirect') lines.push(COPY['COPY-06'])
  if (answer.status === 'degraded' || answer.status === 'withheld') lines.push(COPY['COPY-10'] + ':')
  for (const st of answer.statements) lines.push(st.text)
  if ((answer.status === 'degraded' || answer.status === 'withheld' || answer.status === 'advice_redirect') && answer.evidence.length) {
    for (const ev of answer.evidence) lines.push(`“${ev.text}” (${ev.document_title})`)
  }
  if (answer.questions_for_doctor.length) {
    lines.push(t("Questions for your doctor:"))
    for (const q of answer.questions_for_doctor) lines.push(`- ${q}`)
  }
  return lines.join('\n')
}
