/**
 * Indique si l'utilisateur connecté est admin (user_profiles.is_admin).
 * Utilisé pour la page de test Sentry/Discord (/example-error).
 */
import { ref, watch } from 'vue'
import { useSupabase } from './useSupabase'

const isAdminState = ref<boolean | null>(null)
const adminLoadingState = ref(true)
let adminRequestSequence = 0
let adminLastCheckedAt = 0
let adminLastCheckedUserId: string | null = null
let adminCheckInFlight: Promise<void> | null = null
const ADMIN_CACHE_TTL_MS = 30_000

export function useAdmin() {
  const supabase = useSupabase()
  const { user, initialized, authStatus } = useAuth()

  async function check(userId = user.value?.id ?? null) {
    const cacheIsFresh = !!userId
      && adminLastCheckedUserId === userId
      && isAdminState.value !== null
      && (Date.now() - adminLastCheckedAt) < ADMIN_CACHE_TTL_MS
    if (cacheIsFresh) {
      adminLoadingState.value = false
      return
    }

    if (adminCheckInFlight) {
      await adminCheckInFlight
      return
    }

    const run = (async () => {
      adminRequestSequence += 1
      const requestId = adminRequestSequence
      const preserveKnownAdminAccess = !!userId
        && adminLastCheckedUserId === userId
        && isAdminState.value === true

      if (!preserveKnownAdminAccess) {
        adminLoadingState.value = true
        isAdminState.value = null
      }

      if (!initialized.value || authStatus.value === 'unknown') {
        if (!preserveKnownAdminAccess) {
          adminLoadingState.value = false
        }
        return
      }

      if (!userId) {
        if (requestId === adminRequestSequence) {
          isAdminState.value = false
          adminLoadingState.value = false
        }
        return
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', userId)
        .single() as { data: { is_admin: boolean } | null }

      if (requestId !== adminRequestSequence) {
        return
      }

      isAdminState.value = data?.is_admin === true
      adminLastCheckedUserId = userId
      adminLastCheckedAt = Date.now()
      adminLoadingState.value = false
    })()

    const inFlight = run.finally(() => {
      if (adminCheckInFlight === inFlight) {
        adminCheckInFlight = null
      }
    })
    adminCheckInFlight = inFlight

    await adminCheckInFlight
  }

  if (import.meta.client) {
    watch(
      () => [initialized.value, authStatus.value, user.value?.id ?? null] as const,
      async ([isReady, resolvedAuthStatus, userId]) => {
        if (!isReady) {
          adminLoadingState.value = false
          isAdminState.value = null
          adminLastCheckedAt = 0
          adminLastCheckedUserId = null
          return
        }

        if (resolvedAuthStatus === 'unknown') {
          adminLoadingState.value = false
          return
        }

        if (adminLastCheckedUserId && adminLastCheckedUserId !== userId) {
          isAdminState.value = null
          adminLastCheckedAt = 0
          adminLastCheckedUserId = null
        }

        if (!userId) {
          adminLastCheckedAt = 0
          adminLastCheckedUserId = null
        }

        await check(userId)
      },
      { immediate: true },
    )
  }

  return { isAdmin: isAdminState, loading: adminLoadingState, check }
}
