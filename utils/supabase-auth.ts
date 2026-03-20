import type { Session, SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '~/types/supabase'

const SESSION_REFRESH_WINDOW_MS = 60_000
const AUTH_OPERATION_TIMEOUT_MS = 8_000
const INVALID_AUTH_ERROR_PATTERN = /auth session missing|invalid(?: refresh)? token|refresh token.*(?:invalid|not found)|jwt.*(?:invalid|expired)|session.*expired|user from sub claim in jwt does not exist|token has expired|invalid claim|session_not_found/i

type AuthResolutionState = 'authenticated' | 'unauthenticated' | 'unknown'

type AuthSessionResolution = {
  state: AuthResolutionState
  session: Session | null
}

const authOperationQueues = new WeakMap<SupabaseClient<Database>, Promise<unknown>>()

function withTimeout<T>(promise: Promise<T>, ms = AUTH_OPERATION_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error('Auth operation timed out.'))
    }, ms)

    promise.then(
      (value) => {
        globalThis.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        globalThis.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function runSerializedAuthOperation<T>(
  supabase: SupabaseClient<Database>,
  task: () => Promise<T>,
): Promise<T> {
  const previous = authOperationQueues.get(supabase) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(task)

  authOperationQueues.set(supabase, next.catch(() => undefined))
  return next
}

export async function safeSignOut(supabase: SupabaseClient<Database>): Promise<void> {
  if (typeof supabase.auth.signOut !== 'function') return
  await runSerializedAuthOperation(supabase, async () => {
    try {
      await withTimeout(supabase.auth.signOut({ scope: 'local' }))
    } catch {
      // Ignore logout failures when the session is already invalid.
    }
  })
}

export async function verifySupabasePassword(options: {
  supabaseUrl: string
  anonKey: string
  email: string
  password: string
}): Promise<boolean> {
  const supabaseUrl = options.supabaseUrl.trim().replace(/\/$/, '')
  const anonKey = options.anonKey.trim()
  if (!supabaseUrl || !anonKey || !options.email || !options.password) {
    return false
  }

  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), AUTH_OPERATION_TIMEOUT_MS)

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
      },
      body: JSON.stringify({
        email: options.email,
        password: options.password,
      }),
      signal: controller.signal,
    })

    return response.ok
  } catch {
    return false
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

function shouldRefreshSession(session: Session | null): boolean {
  if (!session?.expires_at) return false
  return (session.expires_at * 1000) - Date.now() <= SESSION_REFRESH_WINDOW_MS
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function isInvalidAuthError(error: unknown): boolean {
  if (!error) return false

  const candidate = error as { status?: number; code?: string; message?: string }
  if (candidate.status === 400 || candidate.status === 401 || candidate.status === 403) {
    return true
  }

  const message = normalizeError(error).message
  return INVALID_AUTH_ERROR_PATTERN.test(message)
}

async function validateResolvedSession(
  supabase: SupabaseClient<Database>,
  session: Session,
): Promise<AuthSessionResolution> {
  if (typeof supabase.auth.getUser !== 'function') {
    return { state: 'authenticated', session }
  }

  try {
    const { data, error } = await withTimeout(supabase.auth.getUser())
    if (error || !data.user) {
      return {
        state: isInvalidAuthError(error) ? 'unauthenticated' : 'unknown',
        session: isInvalidAuthError(error) ? null : session,
      }
    }

    return {
      state: 'authenticated',
      session: {
        ...session,
        user: data.user,
      },
    }
  } catch (error) {
    return {
      state: isInvalidAuthError(error) ? 'unauthenticated' : 'unknown',
      session: isInvalidAuthError(error) ? null : session,
    }
  }
}

async function readSessionSnapshotInternal(
  supabase: SupabaseClient<Database>,
  hintedSession?: Session | null,
): Promise<Session | null> {
  if (hintedSession !== undefined) {
    return hintedSession
  }

  const sessionData = await withTimeout(supabase.auth.getSession())
  return sessionData.data.session ?? null
}

export async function getSessionSnapshot(
  supabase: SupabaseClient<Database>,
  hintedSession?: Session | null,
): Promise<Session | null> {
  return runSerializedAuthOperation(supabase, async () => {
    try {
      return await readSessionSnapshotInternal(supabase, hintedSession)
    } catch (error) {
      if (isInvalidAuthError(error)) {
        return null
      }
      throw error
    }
  })
}

export async function resolveAuthenticatedSession(
  supabase: SupabaseClient<Database>,
  hintedSession?: Session | null,
): Promise<AuthSessionResolution> {
  return runSerializedAuthOperation(supabase, async () => {
    try {
      const session = await readSessionSnapshotInternal(supabase, hintedSession)

      if (!session) {
        return { state: 'unauthenticated', session: null }
      }

      if (!shouldRefreshSession(session)) {
        return await validateResolvedSession(supabase, session)
      }

      try {
        const { data: refreshData, error: refreshError } = await withTimeout(supabase.auth.refreshSession())
        if (refreshError || !refreshData.session) {
          return {
            state: isInvalidAuthError(refreshError) ? 'unauthenticated' : 'unknown',
            session: isInvalidAuthError(refreshError) ? null : session,
          }
        }

        return await validateResolvedSession(supabase, refreshData.session)
      } catch (error) {
        return {
          state: isInvalidAuthError(error) ? 'unauthenticated' : 'unknown',
          session: isInvalidAuthError(error) ? null : session,
        }
      }
    } catch (error) {
      return {
        state: isInvalidAuthError(error) ? 'unauthenticated' : 'unknown',
        session: null,
      }
    }
  })
}

export async function getAuthenticatedSession(
  supabase: SupabaseClient<Database>,
  hintedSession?: Session | null,
): Promise<Session | null> {
  const resolution = await resolveAuthenticatedSession(supabase, hintedSession)
  return resolution.state === 'authenticated' ? resolution.session : null
}

export async function getAuthenticatedHeaders(
  supabase: SupabaseClient<Database>,
  supabaseKey?: string,
): Promise<Record<string, string> | null> {
  const session = await getAuthenticatedSession(supabase)
  if (!session?.access_token) {
    return null
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...(supabaseKey ? { apikey: String(supabaseKey) } : {}),
  }
}
