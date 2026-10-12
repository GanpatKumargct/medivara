// Interface language picker (DEC-29). Shows each language in its own script. Choosing one
// saves it to the account when signed in, then reloads the app in that language.
import { useState } from 'react'
import * as api from '../api/endpoints'
import { getCurrentUserId } from '../api/http'
import { LANGUAGES, currentLanguage, setLanguage, t } from '../lib/i18n'
import { cn } from '../lib/cn'

export function LanguagePicker({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [saving, setSaving] = useState(false)
  const current = currentLanguage().code

  async function choose(code: string) {
    if (code === current) return
    setSaving(true)
    try {
      if (getCurrentUserId()) await api.updatePreferences(code)
    } catch {
      /* the choice still applies in this browser */
    }
    setLanguage(code, { chosen: true })
  }

  return (
    <label className={cn('inline-flex items-center gap-2 text-sm text-ink', className)}>
      {!compact && <span>{t('Language')}</span>}
      <select
        value={current}
        disabled={saving}
        onChange={(e) => void choose(e.target.value)}
        aria-label={t('Language')}
        className="rounded-lg border border-canvas-border bg-white px-2.5 py-1.5 text-sm text-ink focus:border-brand-300 focus:outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.native}{l.code !== 'en' ? ` · ${l.english}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
