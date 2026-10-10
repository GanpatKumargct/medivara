// Dummy-data client plumbing: simulated latency, the current session, and the
// access guard. In a real build this file would hold the fetch wrapper (bearer
// token, error-envelope parsing, 401 handling). The shapes it returns are identical.
import { ApiError } from './types'
import type { ApiErrorBody, Role, Scope } from './types'
import { GRANTS, USERS } from '../dummy-data/accounts'
import { db } from '../dummy-data/db'

const TOKEN_KEY = 'mv_token'
const USER_KEY = 'mv_user_id'

// Per-tab session (sessionStorage) so two browser windows can hold two users
// (family demo). Token is never placed in a URL (FE-1.3).
export function setSession(token: string, userId: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, userId)
}
export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}
export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}
export function getCurrentUserId(): string | null {
  return sessionStorage.getItem(USER_KEY)
}

let requestSeq = 0
export function newRequestId(): string {
  requestSeq += 1
  return `req_${Date.now().toString(36)}${requestSeq.toString(36).padStart(4, '0')}`
}

/** Simulated network latency. */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function apiError(status: number, code: string, message: string, details: Record<string, unknown> = {}): ApiError {
  const body: ApiErrorBody = { code, message, details, request_id: newRequestId() }
  return new ApiError(status, body)
}

export function requireAuth(): string {
  const uid = getCurrentUserId()
  if (!uid) throw apiError(401, 'UNAUTHENTICATED', 'Please sign in.')
  return uid
}

export interface AccessContext {
  userId: string
  role: Role
  scopes: Scope[]
}

/**
 * Access guard (FR-005). Returns the viewer's role + scopes for a patient, using
 * the seeded owner grants plus any runtime grants held in db.grants. Throws 403
 * ACCESS_DENIED when there is no active grant.
 */
export function requireAccess(patientId: string): AccessContext {
  const userId = requireAuth()

  // Runtime grants (created/revoked during the session) take priority.
  const runtime = db.grants[patientId]?.find(
    (g) => g.grantee.user_id === userId && g.status === 'active',
  )
  if (runtime) {
    return { userId, role: runtime.role, scopes: runtime.scopes }
  }

  const seed = GRANTS.find(
    (g) => g.patient_id === patientId && g.grantee_user_id === userId && g.status === 'active',
  )
  if (seed) {
    return { userId, role: seed.role, scopes: seed.scopes }
  }

  throw apiError(403, 'ACCESS_DENIED', 'You don’t have access to this profile.')
}

export function requireScope(ctx: AccessContext, scope: Scope) {
  if (ctx.role === 'owner') return
  if (!ctx.scopes.includes(scope)) {
    throw apiError(403, 'SCOPE_REQUIRED', 'You don’t have permission for this action.', {
      required_scope: scope,
    })
  }
}

export function requireOwner(ctx: AccessContext) {
  if (ctx.role !== 'owner') {
    throw apiError(403, 'OWNER_ONLY', 'Only the profile owner can do this.')
  }
}

export function currentUser() {
  const uid = getCurrentUserId()
  return USERS.find((u) => u.id === uid) ?? null
}
