import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import { ApiError, type PatientSummary } from '../api/types'
import { AccessDeniedPage, NotFoundPage } from './states'
import { useAuth } from '../context/AuthContext'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'
import { Badge, Button } from './ui'
import { AiStatusBanner } from './common'
import { LogoLockup, LogoMark } from './brand'
import { PageTransition } from './motion'
import {
  IconAsk,
  IconBell,
  IconBrief,
  IconDoc,
  IconHand,
  IconHome,
  IconLogout,
  IconMenu,
  IconSettings,
  IconTimeline,
  IconUsers,
  IconX,
} from './icons'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  p0?: boolean
  ownerOnly?: boolean
  group: 'main' | 'more'
}

function navItems(patientId: string): NavItem[] {
  const base = `/p/${patientId}`
  return [
    { to: `${base}`, label: 'Dashboard', icon: <IconHome />, p0: true, group: 'main' },
    { to: `${base}/records`, label: 'Records', icon: <IconDoc />, p0: true, group: 'main' },
    { to: `${base}/timeline`, label: 'Timeline', icon: <IconTimeline />, p0: true, group: 'main' },
    { to: `${base}/ask`, label: 'Ask', icon: <IconAsk />, p0: true, group: 'main' },
    { to: `${base}/brief`, label: 'Brief', icon: <IconBrief />, p0: true, group: 'main' },
    { to: `${base}/visit-assist`, label: 'Visit Assist', icon: <IconHand />, p0: true, group: 'main' },
    { to: `${base}/reminders`, label: 'Reminders', icon: <IconBell />, group: 'more' },
    { to: `${base}/family`, label: 'Family', icon: <IconUsers />, ownerOnly: true, group: 'more' },
    { to: `${base}/settings`, label: 'Settings', icon: <IconSettings />, group: 'more' },
  ]
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export function PatientLayout() {
  const { patientId = '' } = useParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { data: patient, error: patientError } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.getPatient(patientId),
  })
  const items = navItems(patientId).filter((i) => !i.ownerOnly || patient?.my_role === 'owner')

  // No access to this profile (e.g. signed in as a user without a grant) → show
  // the Access-Denied page instead of the patient shell (FR-005).
  if (patientError instanceof ApiError && (patientError.code === 'ACCESS_DENIED' || patientError.code === 'NOT_FOUND')) {
    return (
      <div className="flex min-h-screen flex-col">
        <Topbar patient={undefined} onMenu={() => undefined} />
        <main className="mv-dotgrid flex-1">
          {patientError.code === 'ACCESS_DENIED' ? <AccessDeniedPage /> : <NotFoundPage />}
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Desktop sidebar */}
      <SidebarNav items={items} patient={patient} className="hidden md:flex" />

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="animate-fade-in absolute inset-0 bg-ink/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="animate-slide-in-right absolute left-0 top-0 h-full">
            <SidebarNav items={items} patient={patient} onNavigate={() => setDrawerOpen(false)} showClose onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Right column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar patient={patient} onMenu={() => setDrawerOpen(true)} />
        <main id="main" className="mv-dotgrid min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-4"><AiStatusBanner /></div>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
        <footer className="no-print border-t border-line bg-surface/70 px-6 py-4 text-center">
          <p className="mx-auto max-w-2xl text-xs text-ink-subtle">{COPY['COPY-02']}</p>
        </footer>
      </div>

      <MobileTabBar items={items.filter((i) => i.p0).slice(0, 5)} />
    </div>
  )
}

function SidebarNav({
  items,
  patient,
  className,
  onNavigate,
  showClose,
  onClose,
}: {
  items: NavItem[]
  patient?: PatientSummary
  className?: string
  onNavigate?: () => void
  showClose?: boolean
  onClose?: () => void
}) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const main = items.filter((i) => i.group === 'main')
  const more = items.filter((i) => i.group === 'more')

  return (
    <aside
      className={cn(
        'no-print w-64 shrink-0 flex-col bg-gradient-to-b from-[#0B3B8C] via-[#0C357E] to-[#071f4a] text-white',
        'sticky top-0 h-screen',
        className ?? 'flex',
      )}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <Link to={`/p/${patient?.id ?? ''}`} onClick={onNavigate} aria-label="Medivara home">
          <LogoLockup tone="light" markSize={30} />
        </Link>
        {showClose && (
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1 text-brand-100 hover:bg-white/10">
            <IconX />
          </button>
        )}
      </div>

      {patient && (
        <div className="mx-4 mt-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
          <p className="truncate text-sm font-semibold">{patient.display_name}</p>
          <p className="text-xs text-brand-100/80">
            {patient.my_role === 'owner' ? 'Your records' : 'Shared with you'} · synthetic
          </p>
        </div>
      )}

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
        {main.map((i) => <SidebarLink key={i.to} item={i} onNavigate={onNavigate} />)}
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-brand-100/60">More</p>
        {more.map((i) => <SidebarLink key={i.to} item={i} onNavigate={onNavigate} />)}
      </nav>

      {/* Profile card */}
      <div className="m-3 flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient-soft text-sm font-bold text-[#06304f]">
          {initials(user?.display_name ?? 'U')}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.display_name}</p>
          <p className="truncate text-xs text-brand-100/70">Signed in</p>
        </div>
        <button
          onClick={() => void signOut().then(() => navigate('/login'))}
          aria-label="Sign out"
          className="rounded-lg p-1.5 text-brand-100 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconLogout className="h-5 w-5" />
        </button>
      </div>
    </aside>
  )
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.label === 'Dashboard'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive ? 'bg-white/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-brand-100/75 hover:bg-white/10 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient-soft transition-all duration-300',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />
          <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
          {item.label}
        </>
      )}
    </NavLink>
  )
}

function Topbar({ patient, onMenu }: { patient?: PatientSummary; onMenu: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [displayOpen, setDisplayOpen] = useState(false)
  const [acctOpen, setAcctOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-surface/85 px-4 py-3 backdrop-blur transition-shadow duration-300 sm:px-6',
        scrolled ? 'border-line shadow-card' : 'border-transparent',
      )}
    >
      <div className="flex items-center gap-3">
        <button onClick={onMenu} aria-label="Open menu" className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted md:hidden">
          <IconMenu />
        </button>
        <span className="md:hidden"><LogoMark size={28} /></span>
        {patient && (
          <span className="hidden items-center gap-2 md:flex">
            <span className="text-sm font-semibold text-ink">{patient.display_name}</span>
            <Badge tone={patient.my_role === 'owner' ? 'brand' : 'info'}>
              {patient.my_role === 'owner' ? 'You' : 'Shared with you'}
            </Badge>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Button variant="secondary" size="sm" onClick={() => setDisplayOpen((o) => !o)} aria-expanded={displayOpen}>
            <span className="font-semibold">Aa</span>
            <span className="sr-only">Display settings</span>
          </Button>
          {displayOpen && <DisplayMenu onClose={() => setDisplayOpen(false)} />}
        </div>
        <div className="relative">
          <button
            onClick={() => setAcctOpen((o) => !o)}
            aria-expanded={acctOpen}
            className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              {initials(user?.display_name ?? 'U')}
            </span>
            <span className="hidden sm:inline">{user?.display_name?.split(' ')[0] ?? 'Account'}</span>
          </button>
          {acctOpen && (
            <div className="animate-scale-in absolute right-0 z-40 mt-2 w-48 rounded-xl border border-line bg-surface p-1 shadow-pop">
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
                onClick={() => void signOut().then(() => navigate('/login'))}
              >
                <IconLogout className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function DisplayMenu({ onClose }: { onClose: () => void }) {
  const p = useDisplayPrefs()
  return (
    <div className="animate-scale-in absolute right-0 z-40 mt-2 w-64 rounded-xl border border-line bg-surface p-3 shadow-pop" role="menu">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Text size</p>
      <div className="flex gap-1">
        {([100, 125, 150] as const).map((s) => (
          <button
            key={s}
            onClick={() => p.setTextScale(s)}
            className={cn(
              'flex-1 rounded-lg border px-2 py-1 text-sm transition-colors',
              p.textScale === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-muted hover:bg-surface-muted',
            )}
          >
            {s}%
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center justify-between text-sm text-ink">
        High contrast
        <input type="checkbox" checked={p.highContrast} onChange={(e) => p.setHighContrast(e.target.checked)} className="h-5 w-5" />
      </label>
      <label className="mt-2 flex items-center justify-between text-sm text-ink">
        Reduce motion
        <input type="checkbox" checked={p.reducedMotion} onChange={(e) => p.setReducedMotion(e.target.checked)} className="h-5 w-5" />
      </label>
      <Button size="sm" variant="ghost" className="mt-3 w-full" onClick={onClose}>Done</Button>
    </div>
  )
}

function MobileTabBar({ items }: { items: NavItem[] }) {
  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden" aria-label="Main">
      <ul className="flex">
        {items.map((i) => (
          <li key={i.to} className="flex-1">
            <NavLink
              to={i.to}
              end={i.label === 'Dashboard'}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-ink-muted')
              }
            >
              {i.icon}
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
