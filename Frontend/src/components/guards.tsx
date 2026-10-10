import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8 text-brand-600" />
    </div>
  )
}

/** Protect a route: must be signed in and past onboarding. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, me, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (me?.onboarding_required && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

/** Decide where a freshly-signed-in user should land. */
export function RootRedirect() {
  const { user, me, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (me?.onboarding_required) return <Navigate to="/onboarding" replace />
  return <Navigate to="/profiles" replace />
}
