// Speech-to-text input (FR-056) via the browser Web Speech API (Chrome/Edge).
// en-IN. The final transcript is handed back for the user to review and edit —
// nothing is ever sent automatically. MediVara never receives audio.
import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionState = 'idle' | 'listening' | 'error'

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechInput(onFinal: (text: string) => void) {
  const [state, setState] = useState<RecognitionState>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const supported = getRecognitionCtor() !== null
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    setError(null)
    setInterim('')
    const rec = new Ctor()
    rec.lang = 'en-IN'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      setInterim(interimText)
      if (finalText) onFinalRef.current(finalText.trim())
    }
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error)
      setState('error')
    }
    rec.onend = () => {
      setState('idle')
      setInterim('')
    }
    recRef.current = rec
    setState('listening')
    rec.start()
    // Auto-stop after 15 s (SCR-10).
    window.setTimeout(() => {
      if (recRef.current === rec) rec.stop()
    }, 15000)
  }, [])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, state, interim, error, start, stop, listening: state === 'listening' }
}
