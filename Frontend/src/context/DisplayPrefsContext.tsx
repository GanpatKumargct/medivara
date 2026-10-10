import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Display preferences (FR-051): text size, high contrast, reduced motion, the app
// layout (which side the sidebar sits on, collapsed or not) and the colour theme.
// Stored per device in localStorage and applied to <html> (DEC-09).
//
// Theme ("gender mode"): "auto" follows the open profile — rose for a profile whose
// Medical ID says female, blue otherwise; "rose" or "blue" force one theme.

type TextScale = 100 | 125 | 150

interface DisplayPrefs {
  textScale: TextScale
  highContrast: boolean
  reducedMotion: boolean
  readAloudSpeed: number
  sidebarSide: 'left' | 'right'
  sidebarCollapsed: boolean
  themePreference: ThemePreference
}

export type ThemePreference = 'auto' | 'rose' | 'blue'
export type ThemeName = 'rose' | 'blue'

interface DisplayPrefsContextValue extends DisplayPrefs {
  /** The theme actually applied right now. */
  theme: ThemeName
  /** Set by the patient shell: the open profile's sex from its Medical ID (null outside a profile). */
  setProfileSex: (sex: string | null) => void
  setThemePreference: (v: ThemePreference) => void
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
  themePreference: 'auto',
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
  const [profileSex, setProfileSex] = useState<string | null>(null)
  const theme: ThemeName =
    prefs.themePreference === 'auto' ? (profileSex === 'female' ? 'rose' : 'blue') : prefs.themePreference

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'rose') root.setAttribute('data-theme', 'rose')
    else root.removeAttribute('data-theme')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'rose' ? '#FCF8F9' : '#FAFAF8')
  }, [theme])

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
    theme,
    setProfileSex,
    setThemePreference: (themePreference) => setPrefs((p) => ({ ...p, themePreference })),
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
