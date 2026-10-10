// Small motion helpers used across screens. Both respect reduced-motion.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  if (document.documentElement.getAttribute('data-reduced-motion') === 'true') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Count-up number for dashboard tiles. Jumps straight to the value if reduced-motion. */
export function AnimatedNumber({
  value,
  duration = 650,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    // Guarantee the final value even if rAF timing is unreliable.
    const done = window.setTimeout(() => setDisplay(value), duration + 60)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      clearTimeout(done)
    }
  }, [value, duration])

  return <span className={className}>{display}</span>
}

/** Re-plays a gentle fade-up each time the route path changes. */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="animate-fade-up">
      {children}
    </div>
  )
}
