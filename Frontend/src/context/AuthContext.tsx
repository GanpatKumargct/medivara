import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../api/endpoints'
import { clearSession, getCurrentUserId } from '../api/client'
import type { MeResponse, UserSummary } from '../api/types'

interface AuthContextValue {
  user: UserSummary | null
  me: MeResponse | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<MeResponse>
  signOut: () => Promise<void>
  refreshMe: () => Promise<MeResponse | null>
}

const Ctx = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    if (!getCurrentUserId()) {
      setUser(null)
      setMe(null)
      return null
    }
    try {
      const data = await api.getMe()
      setUser(data.user)
      setMe(data)
      return data
    } catch {
      setUser(null)
      setMe(null)
      return null
    }
  }, [])

  useEffect(() => {
    void refreshMe().finally(() => setLoading(false))
  }, [refreshMe])

  // React to a forced sign-out triggered elsewhere (401 handler).
  useEffect(() => {
    const onSignout = () => {
      setUser(null)
      setMe(null)
    }
    window.addEventListener('mv:signout', onSignout)
    return () => window.removeEventListener('mv:signout', onSignout)
  }, [])

  const signIn = async (email: string, password: string) => {
    await api.login(email, password)
    const data = await api.getMe()
    setUser(data.user)
    setMe(data)
    return data
  }

  const signOut = async () => {
    try {
      await api.logout()
    } finally {
      clearSession()
      setUser(null)
      setMe(null)
    }
  }

  return (
    <Ctx.Provider value={{ user, me, loading, signIn, signOut, refreshMe }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
