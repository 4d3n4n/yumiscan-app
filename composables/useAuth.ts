import type { Session, User } from '@supabase/supabase-js'
import {
  getSessionSnapshot,
  resolveAuthenticatedSession,
  safeSignOut,
} from '~/utils/supabase-auth'

type AuthSubscription = { unsubscribe: () => void }
type AuthResolutionState = 'authenticated' | 'unauthenticated' | 'unknown'

let authInitPromise: Promise<void> | null = null
let authSubscription: AuthSubscription | null = null
let authResolutionSequence = 0
const OPTIMISTIC_AUTH_MIN_TTL_MS = 60_000
const REMOTE_IDENTITY_REFRESH_TTL_MS = 5_000

function hasFreshLocalSession(session: Session | null | undefined) {
  if (!session?.user) return false
  if (!session.expires_at) return true
  return (session.expires_at * 1000) - Date.now() > OPTIMISTIC_AUTH_MIN_TTL_MS
}

async function resolveAuthState(
  supabase: ReturnType<typeof useSupabase>,
  user: Ref<User | null>,
  loading: Ref<boolean>,
  initialized: Ref<boolean>,
  status: Ref<AuthResolutionState>,
  session: Session | null | undefined,
  sequence: number,
) {
  try {
    const shouldBlockUi = !initialized.value && !user.value
    if (shouldBlockUi) {
      loading.value = true
    }

    if (!session) {
      if (sequence === authResolutionSequence) {
        user.value = null
        status.value = 'unauthenticated'
        initialized.value = true
        loading.value = false
      }
      return
    }

    const validatedSession = await resolveAuthenticatedSession(supabase, session)
    if (sequence !== authResolutionSequence) {
      return
    }

    if (validatedSession.state === 'authenticated') {
      user.value = validatedSession.session?.user ?? null
    } else if (validatedSession.state === 'unauthenticated') {
      user.value = null
    }

    status.value = validatedSession.state
    initialized.value = true
    loading.value = false
  } catch {
    if (sequence === authResolutionSequence) {
      status.value = 'unknown'
      initialized.value = true
      loading.value = false
    }
  }
}

function applyResolvedAuthState(
  user: Ref<User | null>,
  loading: Ref<boolean>,
  initialized: Ref<boolean>,
  status: Ref<AuthResolutionState>,
  resolution: Awaited<ReturnType<typeof resolveAuthenticatedSession>>,
) {
  if (resolution.state === 'authenticated') {
    user.value = resolution.session?.user ?? null
  } else if (resolution.state === 'unauthenticated') {
    user.value = null
  }

  status.value = resolution.state
  initialized.value = true
  loading.value = false
}

async function initializeAuthState(
  supabase: ReturnType<typeof useSupabase>,
  user: Ref<User | null>,
  loading: Ref<boolean>,
  initialized: Ref<boolean>,
  status: Ref<AuthResolutionState>,
) {
  if (authInitPromise) {
    await authInitPromise
    return
  }

  authInitPromise = (async () => {
    if (!authSubscription) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        authResolutionSequence += 1
        try {
          await resolveAuthState(
            supabase,
            user,
            loading,
            initialized,
            status,
            session as Session | null,
            authResolutionSequence,
          )
        } catch {
          status.value = 'unknown'
          initialized.value = true
          loading.value = false
        }
      })
      authSubscription = authListener.subscription
    }

    const optimisticSession = await getSessionSnapshot(supabase).catch(() => null)

    if (optimisticSession && hasFreshLocalSession(optimisticSession)) {
      user.value = optimisticSession.user ?? null
      status.value = 'authenticated'
      initialized.value = true
      loading.value = false

      authResolutionSequence += 1
      void resolveAuthState(
        supabase,
        user,
        loading,
        initialized,
        status,
        optimisticSession,
        authResolutionSequence,
      )
      return
    }

    authResolutionSequence += 1
    const initialResolution = optimisticSession
      ? await resolveAuthenticatedSession(supabase, optimisticSession)
      : await resolveAuthenticatedSession(supabase)

    if (initialResolution.state === 'authenticated' && initialResolution.session) {
      await resolveAuthState(
        supabase,
        user,
        loading,
        initialized,
        status,
        initialResolution.session,
        authResolutionSequence,
      )
      return
    }

    if (initialResolution.state === 'unauthenticated') {
      user.value = null
    }
    status.value = initialResolution.state
    initialized.value = true
    loading.value = false
  })()

  try {
    await authInitPromise
  } finally {
    authInitPromise = null
  }
}

export function useAuth() {
  const supabase = useSupabase()
  const user = useState<User | null>('auth-user', () => null)
  const loading = useState<boolean>('auth-loading', () => true)
  const initialized = useState<boolean>('auth-initialized', () => false)
  const authStatus = useState<AuthResolutionState>('auth-status', () => 'unknown')
  const lastRemoteIdentityRefreshAt = useState<number>('auth-last-remote-refresh-at', () => 0)
  const localePath = useLocalePath()

  if (import.meta.client && !initialized.value) {
    void initializeAuthState(supabase, user, loading, initialized, authStatus)
  }

  const signOut = async () => {
    await safeSignOut(supabase)
    user.value = null
    authStatus.value = 'unauthenticated'
    loading.value = false
    initialized.value = true
    navigateTo(localePath('/login'))
  }

  const refreshUserIdentity = async (options?: { force?: boolean }) => {
    if (!initialized.value && !user.value) {
      await initializeAuthState(supabase, user, loading, initialized, authStatus)
      return
    }

    const now = Date.now()
    if (!options?.force && now - lastRemoteIdentityRefreshAt.value < REMOTE_IDENTITY_REFRESH_TTL_MS) {
      return
    }

    lastRemoteIdentityRefreshAt.value = now
    authResolutionSequence += 1
    const sequence = authResolutionSequence

    try {
      const resolution = await resolveAuthenticatedSession(supabase)
      if (sequence !== authResolutionSequence) return
      applyResolvedAuthState(user, loading, initialized, authStatus, resolution)
    } catch {
      if (sequence === authResolutionSequence) {
        authStatus.value = 'unknown'
        initialized.value = true
        loading.value = false
      }
    }
  }

  return { user, loading, initialized, authStatus, signOut, refreshUserIdentity }
}
