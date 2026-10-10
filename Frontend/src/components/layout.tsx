// Patient app shell, laid out like a desktop AI assistant: the chat or section fills
// the main area, and a sidebar (sections, family profiles, chat history, account)
// sits on the side the user chose — right by default — collapsing to an icon rail.
// On small screens the sidebar becomes a drawer.
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { ApiError, type ChatDetail, type PatientSummary } from '../api/types'
import { AccessDeniedPage, NotFoundPage } from './states'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'
import { Badge } from './ui'
import { AiStatusBanner } from './common'
import { LogoMark } from './brand'
import { PageTransition } from './motion'
import { Sidebar } from './shell/Sidebar'
import { IconMenu, IconPlus } from './icons'

export function PatientLayout() {
  const { patientId = '' } = useParams()
  const prefs = useDisplayPrefs()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isNewChat = useMatch('/p/:patientId')
  const isChat = useMatch('/p/:patientId/chat/:chatId')
  const inChat = !!(isNewChat || isChat)

  const { data: patient, error: patientError } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.getPatient(patientId),
  })

  useEffect(() => setDrawerOpen(false), [location.pathname])

  // No access to this profile (e.g. signed in as a user without a grant) → show
  // the Access-Denied page instead of the patient shell (FR-005).
  if (patientError instanceof ApiError && (patientError.code === 'ACCESS_DENIED' || patientError.code === 'NOT_FOUND')) {
    return (
      <div className="min-h-screen bg-canvas">
        {patientError.code === 'ACCESS_DENIED' ? <AccessDeniedPage /> : <NotFoundPage />}
      </div>
    )
  }

  const side = prefs.sidebarSide
  const sidebar = (
    <div className="hidden h-full md:flex">
      <Sidebar patientId={patientId} patient={patient} collapsed={prefs.sidebarCollapsed} />
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <a href="#main" className="skip-link">Skip to main content</a>
      {side === 'left' && sidebar}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar patient={patient} patientId={patientId} onMenu={() => setDrawerOpen(true)} />
        <main id="main" className="mv-scroll relative min-h-0 flex-1 overflow-y-auto">
          {inChat ? (
            <div className="flex min-h-full flex-col">
              <AiStatusBanner className="mx-auto w-full max-w-3xl px-4 pt-3" />
              <div className="flex flex-1 flex-col">
                <Outlet />
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-8">
              <AiStatusBanner className="mb-4" />
              <PageTransition>
                <Outlet />
              </PageTransition>
              <p className="no-print mx-auto mt-12 max-w-2xl text-center text-xs text-ink-subtle">{COPY['COPY-02']}</p>
            </div>
          )}
        </main>
      </div>

      {side === 'right' && sidebar}

      {drawerOpen && (
        <MobileDrawer side={side} onClose={() => setDrawerOpen(false)}>
          <Sidebar patientId={patientId} patient={patient} collapsed={false} mobile onClose={() => setDrawerOpen(false)} />
        </MobileDrawer>
      )}
    </div>
  )
}

function MobileDrawer({ side, onClose, children }: { side: 'left' | 'right'; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="animate-fade-in absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn('animate-fade-in absolute top-0 h-full shadow-pop focus:outline-none', side === 'right' ? 'right-0' : 'left-0')}
      >
        {children}
      </div>
    </div>
  )
}

function TopBar({ patient, patientId, onMenu }: { patient?: PatientSummary; patientId: string; onMenu: () => void }) {
  const prefs = useDisplayPrefs()
  const navigate = useNavigate()
  const chatMatch = useMatch('/p/:patientId/chat/:chatId')
  const chatId = chatMatch?.params.chatId
  const { data: chat } = useQuery<ChatDetail>({
    queryKey: ['chat', patientId, chatId ?? ''],
    queryFn: () => api.getChat(patientId, chatId!),
    enabled: !!chatId,
  })

  const menuButton = (
    <button onClick={onMenu} aria-label="Open menu" className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-hover md:hidden">
      <IconMenu />
    </button>
  )

  return (
    <header className="no-print flex h-12 shrink-0 items-center gap-2 px-3 sm:px-4">
      {prefs.sidebarSide === 'left' && menuButton}
      <span className="md:hidden"><LogoMark size={26} /></span>
      {patient && (
        <span className="hidden min-w-0 items-center gap-2 sm:flex">
          <span className="truncate text-sm font-medium text-ink">{patient.display_name}</span>
          <Badge tone={patient.my_role === 'owner' ? 'neutral' : 'info'}>
            {patient.my_role === 'owner' ? 'Your profile' : 'Shared with you'}
          </Badge>
        </span>
      )}
      <div className="min-w-0 flex-1 text-center">
        {chat && (
          <p className="truncate text-sm text-ink-muted" title={chat.chat.title}>{chat.chat.title}</p>
        )}
      </div>
      {api.API_MODE === 'dummy' && (
        <Badge tone="warn" className="whitespace-nowrap" title={COPY['COPY-32']}>
          <span className="sm:hidden">MOCK DATA</span>
          <span className="hidden sm:inline">{COPY['COPY-32']}</span>
        </Badge>
      )}
      <button
        onClick={() => navigate(`/p/${patientId}`)}
        aria-label="New chat"
        title="New chat"
        className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-hover md:hidden"
      >
        <IconPlus />
      </button>
      {prefs.sidebarSide === 'right' && menuButton}
    </header>
  )
}
