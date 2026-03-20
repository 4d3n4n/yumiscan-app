import { computed, readonly, ref, watch } from 'vue'
import { getServerDayKey } from '~/utils/server-day'

/**
 * Crédits de scan : chargés à la connexion et réactifs.
 * Expose hasCredits (instantané), hasDailyCredit, refreshCredits() pour mettre à jour après achat/scan.
 */

type CreditsSnapshot = {
  freeScansUsed: number
  freeScansAllowed: number
  paidCreditsPurchased: number
  paidScansUsed: number
  dailyCreditUsedAt: string | null // YYYY-MM-DD or null
}

const creditsData = ref<CreditsSnapshot | null>(null)

const creditsUserId = ref<string | null>(null)
const creditsLoading = ref(false)
const creditsSyncError = ref<string | null>(null)
let creditsLastFetchedAt = 0
let creditsLastFetchedUserId: string | null = null
let creditsFetchInFlight: Promise<void> | null = null
const CREDITS_CACHE_TTL_MS = 30_000

function creditsQueryKey(userId: string) {
  return ['credits', userId] as const
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error ?? 'Unknown credits sync error')
}

async function fetchCredits(
  supabase: ReturnType<typeof useSupabase>,
  queryClient: ReturnType<typeof useNuxtApp>['$queryClient'],
  userId: string,
  force = false,
) {
  const cacheIsFresh = !force
    && creditsLastFetchedUserId === userId
    && !!creditsData.value
    && (Date.now() - creditsLastFetchedAt) < CREDITS_CACHE_TTL_MS
  if (cacheIsFresh) return

  if (!force && creditsFetchInFlight) {
    await creditsFetchInFlight
    return
  }

  const run = (async () => {
    creditsLoading.value = true
    creditsSyncError.value = null
    const previousData = creditsData.value
    try {
      const [profileRes, configRes, purchasesRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('free_scans_used, paid_scans_used, daily_credit_used_at')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('app_config')
          .select('value')
          .eq('key', 'free_scans_count')
          .single(),
        supabase
          .from('user_purchases')
          .select('credits_added')
          .eq('user_id', userId),
      ])

      if (profileRes.error) throw profileRes.error
      if (purchasesRes.error) throw purchasesRes.error

      const profile = profileRes.data
      if (!profile) {
        setCreditsSnapshot(queryClient, userId, null)
        return
      }

      const freeAllowed = Number(configRes.data?.value ?? 3)
      const paidCreditsPurchased = (purchasesRes.data ?? []).reduce((total, purchase) => {
        return total + Number(purchase.credits_added ?? 0)
      }, 0)

      setCreditsSnapshot(queryClient, userId, {
        freeScansUsed: profile.free_scans_used ?? 0,
        freeScansAllowed: freeAllowed,
        paidCreditsPurchased,
        paidScansUsed: profile.paid_scans_used ?? 0,
        dailyCreditUsedAt: profile.daily_credit_used_at ?? null,
      })
      creditsLastFetchedUserId = userId
      creditsLastFetchedAt = Date.now()
    } catch (error) {
      creditsSyncError.value = getErrorMessage(error)

      // Keep the last successful snapshot for the same user to avoid false
      // "no credits" states when a transient fetch fails client-side.
      if (!previousData || creditsUserId.value !== userId) {
        creditsData.value = null
      }
    } finally {
      creditsLoading.value = false
    }
  })()

  const inFlight = run.finally(() => {
    if (creditsFetchInFlight === inFlight) {
      creditsFetchInFlight = null
    }
  })
  creditsFetchInFlight = inFlight

  await creditsFetchInFlight
}

function setCreditsSnapshot(
  queryClient: ReturnType<typeof useNuxtApp>['$queryClient'],
  userId: string,
  snapshot: CreditsSnapshot | null,
) {
  creditsData.value = snapshot

  if (!snapshot) {
    queryClient.removeQueries({ queryKey: creditsQueryKey(userId), exact: true })
    return
  }

  queryClient.setQueryData(creditsQueryKey(userId), snapshot)
}

export function useCredits() {
  const supabase = useSupabase()
  const { user, initialized, authStatus } = useAuth()
  const { $queryClient } = useNuxtApp()
  const creditsReliable = computed(() => !creditsLoading.value && !creditsSyncError.value && !!creditsData.value)

  /** Crédit journalier disponible (non utilisé aujourd'hui) */
  const hasDailyCredit = computed(() => {
    const d = creditsData.value
    if (!d) return false
    const today = getServerDayKey()
    return !d.dailyCreditUsedAt || d.dailyCreditUsedAt < today
  })

  const hasCredits = computed(() => {
    if (creditsSyncError.value) return true
    const d = creditsData.value
    if (!d) return false
    if (d.freeScansUsed < d.freeScansAllowed) return true
    if (hasDailyCredit.value) return true
    return (d.paidCreditsPurchased - d.paidScansUsed) > 0
  })

  /** Alerte crédits faibles (≤5 au total) */
  const isLowCredits = computed(() => {
    if (creditsSyncError.value) return false
    const d = creditsData.value
    if (!d) return false
    const freeLeft = Math.max(0, d.freeScansAllowed - d.freeScansUsed)
    const paidLeft = Math.max(0, d.paidCreditsPurchased - d.paidScansUsed)
    const dailyLeft = hasDailyCredit.value ? 1 : 0
    const total = freeLeft + dailyLeft + paidLeft
    return total <= 5
  })

  const refreshCredits = async () => {
    const id = creditsUserId.value
    if (id) await fetchCredits(supabase, $queryClient, id, true)
  }

  function applyPurchasedCreditsDelta(creditsAdded: number) {
    const id = creditsUserId.value
    const current = creditsData.value

    if (!id || !current) return
    if (!Number.isFinite(creditsAdded) || creditsAdded === 0) return

    setCreditsSnapshot($queryClient, id, {
      ...current,
      paidCreditsPurchased: Math.max(0, current.paidCreditsPurchased + creditsAdded),
    })
  }

  if (import.meta.client) {
    watch(
      () => [initialized.value, authStatus.value, user.value?.id ?? null] as const,
      async ([isReady, resolvedAuthStatus, userId]) => {
        if (!isReady) {
          creditsLoading.value = false
          return
        }

        if (resolvedAuthStatus === 'unknown') {
          creditsLoading.value = false
          return
        }

        const previousUserId = creditsUserId.value
        creditsUserId.value = userId
        if (previousUserId && previousUserId !== userId) {
          creditsData.value = null
          creditsLastFetchedAt = 0
          creditsLastFetchedUserId = null
        }
        if (!userId) {
          creditsLastFetchedAt = 0
          creditsLastFetchedUserId = null
          if (previousUserId) {
            setCreditsSnapshot($queryClient, previousUserId, null)
          } else {
            creditsData.value = null
          }
          creditsLoading.value = false
          return
        }

        const cachedSnapshot = $queryClient.getQueryData<NonNullable<typeof creditsData.value>>(creditsQueryKey(userId))
        if (cachedSnapshot) {
          creditsData.value = cachedSnapshot
        }

        await fetchCredits(supabase, $queryClient, userId)
      },
      { immediate: true },
    )
  }

  return {
    hasCredits,
    hasDailyCredit,
    isLowCredits,
    creditsReliable,
    creditsData: readonly(creditsData),
    creditsLoading: readonly(creditsLoading),
    creditsSyncError: readonly(creditsSyncError),
    creditsUserId: readonly(creditsUserId),
    refreshCredits,
    applyPurchasedCreditsDelta,
  }
}
