// Read-aloud (FR-055) via the browser SpeechSynthesis API. Reads only text passed
// to it (which is validated, on-screen text). Prefers on-device en-IN voices.
import { currentLanguage } from './i18n'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useReadAloud(rate = 1) {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  const pickVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices()
    const { speech, code } = currentLanguage()
    return (
      voices.find((v) => v.lang === speech && v.localService) ||
      voices.find((v) => v.lang === speech) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(code)) ||
      voices.find((v) => v.lang === 'en-IN' && v.localService) ||
      voices.find((v) => v.lang === 'en-IN') ||
      voices.find((v) => v.lang.startsWith('en') && v.localService) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null
    )
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = currentLanguage().speech
      u.rate = rate
      const v = pickVoice()
      if (v) u.voice = v
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      utterRef.current = u
      setSpeaking(true)
      window.speechSynthesis.speak(u)
    },
    [rate, pickVoice],
  )

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking, supported }
}
