// Real backend transport: same-origin /api/v1 through the Vite dev proxy (integration plan
// G-3), bearer token from the per-tab session, the contract's error envelope (§2) parsed
// into ApiError, and a forced sign-out on 401. The token never goes into a URL (FE-1.3).
import { ApiError } from './types'
import type { ApiErrorBody } from './types'

export const API_BASE = '/api/v1'

const TOKEN_KEY = 'mv_token'
const USER_KEY = 'mv_user_id'

// Per-tab session (sessionStorage) so two browser windows can hold two users (family demo).
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

type Query = Record<string, string | number | boolean | string[] | null | undefined>

export interface RequestOptions {
  json?: unknown
  form?: FormData
  query?: Query
  /** Return the raw Response (file download) instead of parsing JSON. */
  raw?: boolean
  /** Do not treat 401 as "session ended" (the login form shows its own message). */
  allowUnauthenticated?: boolean
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null
  try {
    const data = (await res.json()) as { error?: ApiErrorBody }
    body = data.error ?? null
  } catch {
    body = null
  }
  return new ApiError(
    res.status,
    body ?? {
      code: res.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      message: 'Something went wrong. Try again.',
      details: {},
      request_id: res.headers.get('X-Request-ID') ?? '',
    },
  )
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) {
    body = opts.form // the browser sets the multipart boundary
  } else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body })
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'MediVara can’t reach the server. Check that the backend is running, then try again.',
      details: {},
      request_id: '',
    })
  }

  if (!res.ok) {
    const error = await toApiError(res)
    if (res.status === 401 && !opts.allowUnauthenticated) {
      clearSession()
      window.dispatchEvent(new CustomEvent('mv:signout', { detail: { code: error.code } }))
    }
    throw error
  }
  if (opts.raw) return res as unknown as T
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
