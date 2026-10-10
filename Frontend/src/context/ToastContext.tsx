import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

// Success/info toasts (SCR-16). Auto-dismiss after 4 s and announced politely.

interface Toast {
  id: number
  message: string
  tone: 'success' | 'info' | 'error'
}

interface ToastContextValue {
  toast: (message: string, tone?: Toast['tone']) => void
}

const Ctx = createContext<ToastContextValue | null>(null)

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    seq += 1
    const id = seq
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        className="no-print fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              'rounded-lg px-4 py-2 text-sm font-medium shadow-pop ' +
              (t.tone === 'error'
                ? 'bg-danger-bg text-danger-fg border border-danger-border'
                : t.tone === 'info'
                  ? 'bg-info-bg text-info-fg border border-info-border'
                  : 'bg-ok-bg text-ok-fg border border-ok-border')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
