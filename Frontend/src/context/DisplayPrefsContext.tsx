import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Display preferences (FR-051): text size, high contrast, reduced motion, plus the
// app layout (which side the sidebar sits on and whether it is collapsed).
// Stored per device in localStorage and applied to <html> (DEC-09).

type TextScale = 100 | 125 | 150

interface DisplayPrefs {
  textScale: TextScale
  highContrast: boolean
  reducedMotion: boolean
  readAloudSpeed: number
  sidebarSide: 'left' | 'right'
  sidebarCollapsed: boolean
}

interface DisplayPrefsContextValue extends DisplayPrefs {
  setTextScale: (v: TextScale) => void
  setHighContrast: (v: boolean) => void
  setReducedMotion: (v: boolean) => void
  setReadAloudSpeed: (v: number) => void
  setSidebarSide: (v: 'left' | 'right') => void
  setSidebarCollapsed: (v: boolean) => void
}

const DEFAULTS: DisplayPrefs = {
  textScale: 100,
  highContrast: false,
  reducedMotion: false,
  readAloudSpeed: 1,
  sidebarSide: 'right',
  sidebarCollapsed: false,
}

const STORAGE_KEY = 'mv_display_prefs'
const Ctx = createContext<DisplayPrefsContextValue | null>(null)

function load(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULTS
}

export function DisplayPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(load)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--mv-text-scale', String(prefs.textScale / 100))
    root.setAttribute('data-contrast', prefs.highContrast ? 'high' : 'normal')
    root.setAttribute('data-reduced-motion', String(prefs.reducedMotion))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
  }, [prefs])

  const value: DisplayPrefsContextValue = {
    ...prefs,
    setTextScale: (textScale) => setPrefs((p) => ({ ...p, textScale })),
    setHighContrast: (highContrast) => setPrefs((p) => ({ ...p, highContrast })),
    setReducedMotion: (reducedMotion) => setPrefs((p) => ({ ...p, reducedMotion })),
    setReadAloudSpeed: (readAloudSpeed) => setPrefs((p) => ({ ...p, readAloudSpeed })),
    setSidebarSide: (sidebarSide) => setPrefs((p) => ({ ...p, sidebarSide })),
    setSidebarCollapsed: (sidebarCollapsed) => setPrefs((p) => ({ ...p, sidebarCollapsed })),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDisplayPrefs() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDisplayPrefs must be used within DisplayPrefsProvider')
  return ctx
}
