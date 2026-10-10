import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Splash } from './Splash'

function FullPageSpinner() {
  return <Splash />
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
