// Interface language (DEC-29). English text is the translation key ("gettext style"), so any
// string without a translation simply shows in English. Translations live in
// src/locales/<code>.json; `npm run i18n:extract` lists every key.
//
// main.tsx waits for `i18nReady` before loading the app, and changing the language reloads
// the page: module-level label lists are then translated too, with no per-component wiring.
import i18next from 'i18next'

export interface Language {
  code: string
  /** The language's own name, shown in the picker. */
  native: string
  english: string
  /** BCP 47 tag for dictation and read-aloud. */
  speech: string
}

// The 10 most spoken languages in India, plus English (DEC-29, tier 1).
export const LANGUAGES: Language[] = [
  { code: 'en', native: 'English', english: 'English', speech: 'en-IN' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', speech: 'hi-IN' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', speech: 'bn-IN' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', speech: 'ta-IN' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu', speech: 'te-IN' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', speech: 'mr-IN' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', speech: 'gu-IN' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada', speech: 'kn-IN' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam', speech: 'ml-IN' },
  { code: 'or', native: 'ଓଡ଼ିଆ', english: 'Odia', speech: 'or-IN' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi', speech: 'pa-IN' },
]

const STORAGE_KEY = 'mv.language'
const CHOSEN_KEY = 'mv.language.chosen' // set when the user picks a language themselves
const codes = new Set(LANGUAGES.map((l) => l.code))

function initialLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && codes.has(saved)) return saved
  } catch {
    /* storage unavailable: fall through */
  }
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return codes.has(browser) ? browser : 'en'
}

// One file per language; only English (plural forms) and the chosen language are fetched.
const loaders = import.meta.glob<{ default: Record<string, string> }>('../locales/[a-z][a-z].json')

const language = initialLanguage()

/** Resolves when the chosen language's strings are loaded; main.tsx starts the app after it. */
export const i18nReady: Promise<void> = (async () => {
  const resources: Record<string, { translation: Record<string, string> }> = {}
  const load = async (code: string) => {
    const loader = loaders[`../locales/${code}.json`]
    if (!loader) return
    try {
      resources[code] = { translation: (await loader()).default }
    } catch {
      /* offline or missing: that language falls back to English */
    }
  }
  await Promise.all([load('en'), language !== 'en' ? load(language) : Promise.resolve()])
  await i18next.init({
    lng: language,
    fallbackLng: 'en',
    resources,
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false }, // React escapes; templates use {{name}}
  })
  document.documentElement.lang = language
})()

/** Translate an English string. Missing translations return the English text. */
export function t(text: string, options?: Record<string, unknown>): string {
  return i18next.t(text, options) as string
}

export function currentLanguage(): Language {
  return LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]
}

/** Save the language and reload so every screen, including module-level labels, uses it. */
export function setLanguage(code: string, options: { chosen?: boolean } = {}): void {
  if (!codes.has(code)) return
  try {
    localStorage.setItem(STORAGE_KEY, code)
    if (options.chosen) localStorage.setItem(CHOSEN_KEY, '1')
  } catch {
    /* without storage the choice lasts for this page only */
  }
  if (code !== language) window.location.reload()
}

/** True when this browser's language was picked by the user (not just guessed). */
export function languageWasChosen(): boolean {
  try {
    return localStorage.getItem(CHOSEN_KEY) === '1'
  } catch {
    return false
  }
}
