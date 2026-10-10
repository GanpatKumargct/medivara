// App sidebar, in the style of a desktop AI assistant: new chat, a profile switcher
// for family members, the app's sections, and the saved chat history ("Recents") with
// search, rename and delete. It collapses to an icon rail and can sit on either side.
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/endpoints'
import type { Chat, ListResponse, PatientSummary } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { useDisplayPrefs } from '../../context/DisplayPrefsContext'
import { useToast } from '../../context/ToastContext'
import { chatsKey, historyGroup } from '../../lib/chat'
import { cn } from '../../lib/cn'
import { avatarTint, initials } from '../../lib/format'
import { LogoLockup } from '../brand'
import { AddFamilyMemberDialog } from '../family/AddFamilyMemberDialog'
import {
  IconAsk,
  IconBell,
  IconBrief,
  IconCheck,
  IconChevronDown,
  IconDoc,
  IconDots,
  IconFlower,
  IconGrid,
  IconHand,
  IconHeartPulse,
  IconHome,
  IconIdCard,
  IconLogout,
  IconPencil,
  IconPill,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSidebar,
  IconSidebarLeft,
  IconTimeline,
  IconTrash,
  IconUserPlus,
  IconUsers,
  IconX,
} from '../icons'
import { Button, Dialog } from '../ui'

interface NavItem {
  key: string
  to: string
  label: string
  icon: ReactNode
  ownerOnly?: boolean
  more?: boolean
  /** Shown for female profiles, or when women's health tracking is on. */
  womens?: boolean
}

function navItems(base: string): NavItem[] {
  return [
    { key: 'chat', to: base, label: 'Chat', icon: <IconAsk /> },
    { key: 'overview', to: `${base}/overview`, label: 'Overview', icon: <IconHome /> },
    { key: 'records', to: `${base}/records`, label: 'Records', icon: <IconDoc /> },
    { key: 'timeline', to: `${base}/timeline`, label: 'Timeline', icon: <IconTimeline /> },
    { key: 'vitals', to: `${base}/vitals`, label: 'Vitals', icon: <IconHeartPulse /> },
    { key: 'medicines', to: `${base}/medicines`, label: 'Medicines', icon: <IconPill /> },
    { key: 'womens-health', to: `${base}/womens-health`, label: 'Women’s health', icon: <IconFlower />, womens: true },
    { key: 'reminders', to: `${base}/reminders`, label: 'Reminders', icon: <IconBell />, more: true },
    { key: 'brief', to: `${base}/brief`, label: 'Doctor visit brief', icon: <IconBrief />, more: true },
    { key: 'visit-assist', to: `${base}/visit-assist`, label: 'Visit Assist (ISL)', icon: <IconHand />, more: true },
    { key: 'medical-id', to: `${base}/medical-id`, label: 'Medical ID', icon: <IconIdCard />, more: true },
    { key: 'family', to: `${base}/family`, label: 'Family & sharing', icon: <IconUsers />, ownerOnly: true, more: true },
    { key: 'services', to: `${base}/services`, label: 'Health services', icon: <IconGrid />, more: true },
  ]
}

const MORE_KEY = 'mv_sidebar_more'

function readMore(): boolean {
  try {
    return localStorage.getItem(MORE_KEY) === '1'
  } catch {
    return false
  }
}

/** Close a popover on outside click or Escape. */
function useDismiss(ref: RefObject<HTMLElement>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onClose])
}

export function Sidebar({
  patientId,
  patient,
  collapsed,
  mobile,
  onClose,
}: {
  patientId: string
  patient?: PatientSummary
  collapsed: boolean
  mobile?: boolean
  onClose?: () => void
}) {
  const prefs = useDisplayPrefs()
  const navigate = useNavigate()
  const location = useLocation()
  const base = `/p/${patientId}`
  const side = prefs.sidebarSide
  const [showMore, setShowMore] = useState(readMore)

  const detailsQ = useQuery({ queryKey: ['details', patientId], queryFn: () => api.getProfileDetails(patientId), enabled: !!patient })
  const womensQ = useQuery({ queryKey: ['womens-health', patientId], queryFn: () => api.getWomensHealth(patientId), enabled: !!patient })
  const showWomens = detailsQ.data?.sex === 'female' || (womensQ.data?.mode ?? 'off') !== 'off'
  const items = navItems(base).filter(
    (i) => (!i.ownerOnly || patient?.my_role === 'owner') && (!i.womens || showWomens || location.pathname.startsWith(i.to)),
  )
  const isActive = (item: NavItem) =>
    item.key === 'chat'
      ? location.pathname === base || location.pathname.startsWith(`${base}/chat/`)
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  const moreActive = items.some((i) => i.more && isActive(i))
  const moreOpen = showMore || moreActive

  function toggleMore() {
    setShowMore((v) => {
      try {
        localStorage.setItem(MORE_KEY, v ? '0' : '1')
      } catch {
        /* the toggle still works for this visit */
      }
      return !v
    })
  }

  const ToggleIcon = side === 'right' ? IconSidebar : IconSidebarLeft

  if (collapsed && !mobile) {
    return (
      <aside
        aria-label="Main navigation"
        className={cn(
          'mv-sidebar no-print flex h-full w-[60px] shrink-0 flex-col items-center gap-1 bg-canvas-sidebar py-3',
          side === 'right' ? 'border-l border-canvas-border' : 'border-r border-canvas-border',
        )}
      >
        <RailButton label="Expand sidebar" onClick={() => prefs.setSidebarCollapsed(false)}>
          <ToggleIcon />
        </RailButton>
        <RailButton label="New chat" onClick={() => navigate(base)} accent>
          <IconPlus />
        </RailButton>
        <div className="my-1 h-px w-8 bg-canvas-border" />
        {items.map((i) => (
          <RailLink key={i.key} to={i.to} label={i.label} active={isActive(i)}>
            {i.icon}
          </RailLink>
        ))}
        <div className="mt-auto" />
        <AccountMenu compact />
      </aside>
    )
  }

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'mv-sidebar no-print flex h-full w-[280px] shrink-0 flex-col bg-canvas-sidebar',
        !mobile && (side === 'right' ? 'border-l border-canvas-border' : 'border-r border-canvas-border'),
      )}
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <Link to={base} onClick={onClose} aria-label="MediVara — new chat" className="rounded-lg px-1.5 py-1">
          <LogoLockup markSize={26} />
        </Link>
        {mobile ? (
          <IconButton label="Close menu" onClick={() => onClose?.()}>
            <IconX />
          </IconButton>
        ) : (
          <IconButton label="Collapse sidebar" onClick={() => prefs.setSidebarCollapsed(true)}>
            <ToggleIcon />
          </IconButton>
        )}
      </div>

      <div className="px-3">
        <button
          onClick={() => {
            navigate(base)
            onClose?.()
          }}
          className="mv-press flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas-hover"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
            <IconPlus className="h-4 w-4" />
          </span>
          New chat
        </button>
      </div>

      <div className="px-3 pt-2">
        <ProfileSwitcher patientId={patientId} patient={patient} onNavigate={onClose} />
      </div>

      <div className="mv-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <nav aria-label="Sections" className="space-y-0.5">
          {items
            .filter((i) => !i.more || moreOpen)
            .map((i) => (
              <NavLink
                key={i.key}
                to={i.to}
                end={i.key === 'chat'}
                onClick={onClose}
                aria-current={isActive(i) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors [&_svg]:h-[18px] [&_svg]:w-[18px]',
                  isActive(i) ? 'bg-canvas-active font-medium text-ink' : 'text-ink-muted hover:bg-canvas-hover hover:text-ink',
                )}
              >
                {i.icon}
                {i.label}
              </NavLink>
            ))}
          {!moreActive && (
            <button
              onClick={toggleMore}
              aria-expanded={moreOpen}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-subtle transition-colors hover:bg-canvas-hover hover:text-ink"
            >
              <IconChevronDown className={cn('h-[18px] w-[18px] transition-transform', moreOpen && 'rotate-180')} />
              {moreOpen ? 'Less' : 'More'}
            </button>
          )}
        </nav>

        <Recents patientId={patientId} onNavigate={onClose} />
      </div>

      <div className="border-t border-canvas-border p-2">
        <AccountMenu onNavigate={onClose} />
      </div>
    </aside>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-canvas-hover hover:text-ink"
    >
      {children}
    </button>
  )
}

function RailButton({ label, onClick, accent, children }: { label: string; onClick: () => void; accent?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl transition-colors [&_svg]:h-5 [&_svg]:w-5',
        accent ? 'bg-brand-600 text-white hover:bg-brand-700' : 'text-ink-muted hover:bg-canvas-hover hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function RailLink({ to, label, active, children }: { to: string; label: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl transition-colors [&_svg]:h-5 [&_svg]:w-5',
        active ? 'bg-canvas-active text-ink' : 'text-ink-muted hover:bg-canvas-hover hover:text-ink',
      )}
    >
      {children}
    </Link>
  )
}

// --- Profile switcher -------------------------------------------------------

function ProfileSwitcher({ patientId, patient, onNavigate }: { patientId: string; patient?: PatientSummary; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const patientsQ = useQuery({ queryKey: ['patients'], queryFn: api.getPatients })
  useDismiss(ref, open, () => setOpen(false))

  const name = patient?.display_name ?? 'Loading…'
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2.5 rounded-xl border border-canvas-border bg-white/70 px-2 py-1.5 text-left transition-colors hover:bg-white"
      >
        <Avatar id={patientId} name={name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-[11px] text-ink-subtle">
            {patient ? (patient.my_role === 'owner' ? 'Profile you manage' : `Shared by ${patient.owner_display_name}`) : ' '}
          </span>
        </span>
        <IconChevronDown className={cn('h-4 w-4 shrink-0 text-ink-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="animate-scale-in absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-canvas-border bg-white p-1 shadow-pop">
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Switch profile</p>
          <ul className="max-h-64 overflow-y-auto mv-scroll">
            {(patientsQ.data?.items ?? []).map((p) => (
              <li key={p.id}>
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onNavigate?.()
                    navigate(`/p/${p.id}`)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-canvas-hover"
                >
                  <Avatar id={p.id} name={p.display_name} small />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{p.display_name}</span>
                    <span className="block truncate text-[11px] text-ink-subtle">
                      {p.my_role === 'owner' ? 'You manage this' : `Shared by ${p.owner_display_name}`}
                    </span>
                  </span>
                  {p.id === patientId && <IconCheck className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1 h-px bg-canvas-border" />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setAdding(true)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas-hover"
          >
            <IconUserPlus className="h-4 w-4 text-ink-muted" /> Add family member
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onNavigate?.()
              navigate('/profiles')
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas-hover"
          >
            <IconUsers className="h-4 w-4 text-ink-muted" /> All profiles &amp; invitations
          </button>
        </div>
      )}
      <AddFamilyMemberDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

export function Avatar({ id, name, small }: { id: string; name: string; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        small ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs',
        avatarTint(id),
      )}
    >
      {initials(name)}
    </span>
  )
}

// --- Recents (chat history) -------------------------------------------------

function Recents({ patientId, onNavigate }: { patientId: string; onNavigate?: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Chat | null>(null)
  const chatsQ = useQuery({ queryKey: chatsKey(patientId), queryFn: () => api.listChats(patientId) })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = chatsQ.data?.items ?? []
    return q
      ? items.filter((c) => c.title.toLowerCase().includes(q) || (c.last_message_preview ?? '').toLowerCase().includes(q))
      : items
  }, [chatsQ.data, query])

  const groups = useMemo(() => {
    const out: { label: string; chats: Chat[] }[] = []
    for (const c of filtered) {
      const label = historyGroup(c.updated_at)
      const g = out.find((x) => x.label === label)
      if (g) g.chats.push(c)
      else out.push({ label, chats: [c] })
    }
    return out
  }, [filtered])

  const setList = (fn: (items: Chat[]) => Chat[]) =>
    qc.setQueryData<ListResponse<Chat>>(chatsKey(patientId), (old) => (old ? { ...old, items: fn(old.items) } : old))

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameChat(patientId, id, title),
    onSuccess: (chat) => {
      setList((items) => items.map((c) => (c.id === chat.id ? chat : c)))
      qc.setQueryData(['chat', patientId, chat.id], (old: { chat: Chat } | undefined) => (old ? { ...old, chat } : old))
    },
    onError: () => toast('Couldn’t rename this chat.', 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteChat(patientId, id),
    onSuccess: (_v, id) => {
      setList((items) => items.filter((c) => c.id !== id))
      qc.removeQueries({ queryKey: ['chat', patientId, id] })
      setDeleting(null)
      if (location.pathname.endsWith(`/chat/${id}`)) navigate(`/p/${patientId}`)
      toast('Chat deleted')
    },
    onError: () => toast('Couldn’t delete this chat.', 'error'),
  })

  return (
    <section aria-label="Recent chats" className="mt-5">
      <div className="flex items-center justify-between px-2 pb-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Recents</h2>
        <button
          onClick={() => {
            setSearching((s) => !s)
            setQuery('')
          }}
          aria-label={searching ? 'Close search' : 'Search chats'}
          aria-expanded={searching}
          className="rounded p-1 text-ink-subtle hover:bg-canvas-hover hover:text-ink"
        >
          {searching ? <IconX className="h-3.5 w-3.5" /> : <IconSearch className="h-3.5 w-3.5" />}
        </button>
      </div>
      {searching && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your chats"
          aria-label="Search your chats"
          className="mb-2 w-full rounded-lg border border-canvas-border bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand-300 focus:outline-none"
        />
      )}

      {chatsQ.isLoading && <p className="px-2 py-1 text-xs text-ink-subtle">Loading chats…</p>}
      {chatsQ.error && (
        <button onClick={() => void chatsQ.refetch()} className="px-2 py-1 text-xs text-danger-fg underline">
          Couldn’t load chats. Retry
        </button>
      )}
      {chatsQ.data && filtered.length === 0 && (
        <p className="px-2 py-1 text-xs leading-relaxed text-ink-subtle">
          {query ? 'No chats match your search.' : 'No chats yet. Your conversations will appear here.'}
        </p>
      )}

      {groups.map((g) => (
        <div key={g.label} className="mt-2">
          <p className="px-2 pb-0.5 text-[11px] text-ink-subtle">{g.label}</p>
          <ul className="space-y-px">
            {g.chats.map((c) => (
              <ChatRow
                key={c.id}
                patientId={patientId}
                chat={c}
                renaming={renaming === c.id}
                onStartRename={() => setRenaming(c.id)}
                onRename={(title) => {
                  setRenaming(null)
                  if (title && title !== c.title) rename.mutate({ id: c.id, title })
                }}
                onDelete={() => setDeleting(c)}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}

      {deleting && (
        <Dialog
          open
          onClose={() => setDeleting(null)}
          title="Delete chat?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(deleting.id)}>Delete</Button>
            </>
          }
        >
          <p className="text-sm text-ink">
            “{deleting.title}” and its answers will be deleted. Documents you added in this chat stay in your records.
          </p>
        </Dialog>
      )}
    </section>
  )
}

function ChatRow({
  patientId,
  chat,
  renaming,
  onStartRename,
  onRename,
  onDelete,
  onNavigate,
}: {
  patientId: string
  chat: Chat
  renaming: boolean
  onStartRename: () => void
  onRename: (title: string) => void
  onDelete: () => void
  onNavigate?: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [draft, setDraft] = useState(chat.title)
  const ref = useRef<HTMLLIElement>(null)
  useDismiss(ref, menu, () => setMenu(false))

  if (renaming) {
    return (
      <li className="px-1">
        <input
          autoFocus
          value={draft}
          maxLength={80}
          aria-label="Chat name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onRename(draft.trim())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename(draft.trim())
            if (e.key === 'Escape') {
              setDraft(chat.title)
              onRename(chat.title)
            }
          }}
          className="w-full rounded-lg border border-brand-300 bg-white px-2 py-1 text-sm text-ink focus:outline-none"
        />
      </li>
    )
  }

  return (
    <li ref={ref} className="group relative">
      <NavLink
        to={`/p/${patientId}/chat/${chat.id}`}
        onClick={onNavigate}
        title={chat.title}
        className={({ isActive }) =>
          cn(
            'block truncate rounded-lg py-1.5 pl-2 pr-8 text-sm transition-colors',
            isActive ? 'bg-canvas-active text-ink' : 'text-ink-muted hover:bg-canvas-hover hover:text-ink',
          )
        }
      >
        {chat.title}
      </NavLink>
      <button
        onClick={() => setMenu((m) => !m)}
        aria-label={`Options for ${chat.title}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-subtle transition-opacity hover:bg-canvas-active hover:text-ink focus:opacity-100',
          menu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <IconDots className="h-4 w-4" />
      </button>
      {menu && (
        <div role="menu" className="animate-scale-in absolute right-0 top-full z-40 mt-1 w-40 rounded-xl border border-canvas-border bg-white p-1 shadow-pop">
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false)
              setDraft(chat.title)
              onStartRename()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas-hover"
          >
            <IconPencil className="h-4 w-4" /> Rename
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false)
              onDelete()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-danger-fg hover:bg-danger-bg"
          >
            <IconTrash className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </li>
  )
}

// --- Account menu -----------------------------------------------------------

function AccountMenu({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  const prefs = useDisplayPrefs()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => setOpen(false))
  const name = user?.display_name ?? 'Account'
  const settingsPath = location.pathname.match(/^\/p\/[^/]+/)?.[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={compact ? `Account: ${name}` : undefined}
        title={compact ? name : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-canvas-hover',
          compact ? 'h-10 w-10 justify-center' : 'w-full px-2 py-1.5',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
          {initials(name)}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{name}</span>
            <span className="block truncate text-[11px] text-ink-subtle">{user?.email}</span>
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'animate-scale-in absolute bottom-full z-40 mb-1 w-60 rounded-xl border border-canvas-border bg-white p-1 shadow-pop',
            compact ? (prefs.sidebarSide === 'right' ? 'right-0' : 'left-0') : 'left-0 right-0 w-auto',
          )}
        >
          <p className="truncate px-2 pb-1 pt-1.5 text-xs text-ink-subtle">{user?.email}</p>
          {settingsPath && (
            <MenuItem
              icon={<IconSettings className="h-4 w-4" />}
              onClick={() => {
                setOpen(false)
                onNavigate?.()
                navigate(`${settingsPath}/settings`)
              }}
            >
              Settings
            </MenuItem>
          )}
          <MenuItem
            icon={prefs.sidebarSide === 'right' ? <IconSidebarLeft className="h-4 w-4" /> : <IconSidebar className="h-4 w-4" />}
            onClick={() => {
              setOpen(false)
              prefs.setSidebarSide(prefs.sidebarSide === 'right' ? 'left' : 'right')
            }}
          >
            Move sidebar to the {prefs.sidebarSide === 'right' ? 'left' : 'right'}
          </MenuItem>
          <div className="my-1 h-px bg-canvas-border" />
          <MenuItem
            icon={<IconLogout className="h-4 w-4" />}
            onClick={() => void signOut().then(() => navigate('/login'))}
          >
            Sign out
          </MenuItem>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-canvas-hover">
      <span className="text-ink-muted">{icon}</span>
      {children}
    </button>
  )
}

