import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../api/endpoints'
import type { PatientSummary } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useDisplayPrefs } from '../context/DisplayPrefsContext'
import { cn } from '../lib/cn'
import { COPY } from '../lib/copy'
import { Badge, Button } from './ui'
import { AiStatusBanner } from './common'
import {
  IconAsk,
  IconBell,
  IconBrief,
  IconDoc,
  IconHand,
  IconHome,
  IconSettings,
  IconTimeline,
  IconUsers,
} from './icons'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  p0?: boolean
  ownerOnly?: boolean
}

function navItems(patientId: string): NavItem[] {
  const base = `/p/${patientId}`
  return [
    { to: `${base}`, label: 'Dashboard', icon: <IconHome />, p0: true },
    { to: `${base}/records`, label: 'Records', icon: <IconDoc />, p0: true },
    { to: `${base}/timeline`, label: 'Timeline', icon: <IconTimeline />, p0: true },
    { to: `${base}/ask`, label: 'Ask', icon: <IconAsk />, p0: true },
    { to: `${base}/brief`, label: 'Brief', icon: <IconBrief />, p0: true },
    { to: `${base}/visit-assist`, label: 'Visit Assist', icon: <IconHand />, p0: true },
    { to: `${base}/reminders`, label: 'Reminders', icon: <IconBell /> },
    { to: `${base}/family`, label: 'Family', icon: <IconUsers />, ownerOnly: true },
    { to: `${base}/settings`, label: 'Settings', icon: <IconSettings /> },
  ]
}

export function PatientLayout() {
  const { patientId = '' } = useParams()
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.getPatient(patientId),
  })
  const items = navItems(patientId).filter((i) => !i.ownerOnly || patient?.my_role === 'owner')

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Header patient={patient} />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5">
        <Sidebar items={items} />
        <main id="main" className="min-w-0 flex-1 pb-20 md:pb-5">
          <div className="mb-4">
            <AiStatusBanner />
          </div>
          <Outlet />
        </main>
      </div>
      <BottomBar items={items.filter((i) => i.p0).slice(0, 5)} patientId={patientId} />
      <Footer />
    </div>
  )
}

function Header({ patient }: { patient?: PatientSummary }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [displayOpen, setDisplayOpen] = useState(false)
  const [acctOpen, setAcctOpen] = useState(false)

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-brand-700">MediVara</span>
          {patient && (
            <span className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-ink-muted">·</span>
              <span className="text-sm font-medium text-ink">{patient.display_name}</span>
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
            <Button variant="secondary" size="sm" onClick={() => setAcctOpen((o) => !o)} aria-expanded={acctOpen}>
              {user?.display_name?.split(' ')[0] ?? 'Account'}
            </Button>
            {acctOpen && (
              <div className="absolute right-0 z-40 mt-1 w-48 rounded-lg border border-line bg-surface p-1 shadow-pop">
                <button
                  className="block w-full rounded px-3 py-2 text-left text-sm text-ink hover:bg-surface-muted"
                  onClick={() => {
                    void signOut().then(() => navigate('/login'))
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function DisplayMenu({ onClose }: { onClose: () => void }) {
  const p = useDisplayPrefs()
  return (
    <div
      className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-line bg-surface p-3 shadow-pop"
      role="menu"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Text size</p>
      <div className="flex gap-1">
        {([100, 125, 150] as const).map((s) => (
          <button
            key={s}
            onClick={() => p.setTextScale(s)}
            className={cn(
              'flex-1 rounded border px-2 py-1 text-sm',
              p.textScale === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line text-ink-muted',
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
      <Button size="sm" variant="ghost" className="mt-3 w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  )
}

function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <nav className="no-print hidden w-52 shrink-0 md:block" aria-label="Main">
      <ul className="sticky top-20 space-y-1">
        {items.map((i) => (
          <li key={i.to}>
            <NavLink
              to={i.to}
              end={i.label === 'Dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                )
              }
            >
              <span className="shrink-0">{i.icon}</span>
              {i.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function BottomBar({ items }: { items: NavItem[]; patientId: string }) {
  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface md:hidden" aria-label="Main">
      <ul className="flex">
        {items.map((i) => (
          <li key={i.to} className="flex-1">
            <NavLink
              to={i.to}
              end={i.label === 'Dashboard'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                  isActive ? 'text-brand-700' : 'text-ink-muted',
                )
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

function Footer() {
  return (
    <footer className="no-print border-t border-line bg-surface px-4 py-4 text-center md:py-5">
      <p className="mx-auto max-w-2xl text-xs text-ink-subtle">{COPY['COPY-02']}</p>
      {api.API_MODE === 'dummy' && (
        // G-6: never demo mocks by accident.
        <p role="status" className="fixed bottom-3 right-3 z-50 rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-black shadow">
          {COPY['COPY-32']}
        </p>
      )}
    </footer>
  )
}
