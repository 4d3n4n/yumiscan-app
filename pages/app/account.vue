<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useQuery, useMutation } from '@tanstack/vue-query'
import { PhSpinnerGap, PhLock, PhInfo, PhTranslate } from '@phosphor-icons/vue'
import type { UserProfile, AppConfigRow } from '~/utils/types'
import { sortAllergensByLocale } from '~/utils/allergens'
import { retryQueryExceptAuth } from '~/utils/query'

const { t, locale } = useI18n()

useHead({ title: computed(() => t('account.meta_title')), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const route = useRoute()
const router = useRouter()
const supabase = useSupabase()
const { user, loading: authLoading, initialized, refreshUserIdentity, authStatus } = useAuth()
const { hasDailyCredit, creditsData } = useCredits()
const { stripeFinalizeCheckout } = useEdgeFunctions()
const { invalidateAppData } = useAppDataInvalidation()
const { reset: resetOnboarding } = useOnboarding()
const { shouldRun: shouldRunAccountForegroundRefresh } = useForegroundRefreshGate(10_000)
const isCheckingAuth = computed(() => (!initialized.value && !user.value) || (authLoading.value && !user.value))
const userEmail = ref('')
const stripeSyncStatus = ref<'idle' | 'syncing' | 'timed_out'>('idle')
let stripeSyncCancelled = false
const stripeSyncSessionId = ref<string | null>(null)
const stripeFinalizeAttempted = ref(false)
const stripeFinalizeAttempts = ref(0)
const accountMainContentId = 'main-content'

type StripeFinalizeResult = Awaited<ReturnType<typeof stripeFinalizeCheckout>>

function handleAuthVisibilityRefresh() {
  if (!import.meta.client || document.visibilityState === 'hidden') return
  if (!shouldRunAccountForegroundRefresh()) return
  void refreshUserIdentity()
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function completeStripeSync(creditsAdded?: number | null) {
  await invalidateAppData('credits_purchased', {
    creditsAdded: typeof creditsAdded === 'number' ? creditsAdded : undefined,
  })

  stripeSyncStatus.value = 'idle'

  const nextQuery = { ...route.query }
  delete nextQuery.session_id
  await router.replace({ query: nextQuery })
}

async function findRecordedStripePurchase(sessionId: string) {
  const { data, error } = await supabase
    .from('user_purchases')
    .select('id, credits_added')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()

  if (error || !data?.id) return null

  return {
    id: data.id,
    creditsAdded: Number(data.credits_added ?? 0),
  }
}

async function triggerStripeFinalize(sessionId: string) {
  if (stripeFinalizeAttempts.value >= 3) {
    return null
  }

  stripeFinalizeAttempted.value = true
  stripeFinalizeAttempts.value += 1

  try {
    return await stripeFinalizeCheckout(sessionId)
  } catch {
    stripeFinalizeAttempted.value = false
    return null
  }
}

function isStripeFinalizeCompleted(
  result: StripeFinalizeResult | null,
): result is StripeFinalizeResult & { status: 'processed_now' | 'already_processed' } {
  return result?.status === 'processed_now' || result?.status === 'already_processed'
}

async function syncCompletedStripeFinalize(result: StripeFinalizeResult | null) {
  if (!isStripeFinalizeCompleted(result)) {
    if (result?.status === 'not_ready') {
      stripeFinalizeAttempted.value = false
    }
    return false
  }

  await completeStripeSync(result.credits_added)
  return true
}

async function syncRecordedStripePurchase(sessionId: string) {
  const purchase = await findRecordedStripePurchase(sessionId)
  if (!purchase) return false

  await completeStripeSync(purchase.creditsAdded)
  return true
}

async function pollStripeCheckoutUntilSynced(sessionId: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (stripeSyncCancelled) return

    if (await syncRecordedStripePurchase(sessionId)) {
      return
    }

    if (attempt >= 1 && !stripeFinalizeAttempted.value) {
      const result = await triggerStripeFinalize(sessionId)
      if (await syncCompletedStripeFinalize(result)) {
        return
      }
    }

    if (attempt < 14) {
      await sleep(2000)
    }
  }

  if (!stripeSyncCancelled) {
    stripeSyncStatus.value = 'timed_out'
  }
}

async function finalizeStripeCheckout(sessionId: string) {
  stripeSyncStatus.value = 'syncing'

  const immediateFinalize = await triggerStripeFinalize(sessionId)
  if (stripeSyncCancelled) return

  if (await syncCompletedStripeFinalize(immediateFinalize)) {
    return
  }

  await pollStripeCheckoutUntilSynced(sessionId)
}

watch(
  () => [initialized.value, user.value?.id ?? null, user.value?.email ?? null, route.query.session_id as string | undefined] as const,
  async ([isReady, userId, email, sessionId]) => {
    if (!isReady) return

    userEmail.value = email ?? ''

    if (!userId || !sessionId || stripeSyncSessionId.value === sessionId) {
      return
    }

    stripeSyncSessionId.value = sessionId
    stripeFinalizeAttempted.value = false
    stripeFinalizeAttempts.value = 0
    await finalizeStripeCheckout(sessionId)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stripeSyncCancelled = true
  if (import.meta.client) {
    document.removeEventListener('visibilitychange', handleAuthVisibilityRefresh)
    window.removeEventListener('pageshow', handleAuthVisibilityRefresh)
  }
})

onMounted(() => {
  if (shouldRunAccountForegroundRefresh()) {
    void refreshUserIdentity()
  }

  if (import.meta.client) {
    document.addEventListener('visibilitychange', handleAuthVisibilityRefresh, { passive: true })
    window.addEventListener('pageshow', handleAuthVisibilityRefresh, { passive: true })
  }
})

const { data: profile } = useQuery({
  queryKey: ['user-profile'],
  queryFn: async (): Promise<UserProfile | null> => {
    if (!user.value?.id) throw new Error('User not found')
    const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', user.value.id).single()
    if (error) throw error
    return data as UserProfile
  },
  enabled: computed(() => !isCheckingAuth.value && !!user.value?.id),
})

const { data: allergensCatalog, isLoading: allergensLoading } = useQuery({
  queryKey: ['allergens'],
  queryFn: async () => {
    const { data, error } = await supabase.from('allergens').select('id, name, name_en, slug')
    if (error) throw error
    return data || []
  },
  enabled: computed(() => !isCheckingAuth.value),
})

const allAllergens = computed(() => sortAllergensByLocale(allergensCatalog.value ?? [], locale.value))

const { data: entitlements } = useQuery({
  queryKey: ['entitlements'],
  queryFn: async () => {
    const { data, error } = await supabase.functions.invoke<{
      isActive: boolean
      endsAt: string | null
      status: string | null
      plan: string | null
    }>('entitlements', {
      method: 'POST',
    })
    if (error) return null
    return data
  },
  enabled: computed(() => !isCheckingAuth.value && !authLoading.value && !!user.value),
  retry: retryQueryExceptAuth,
})

const { data: appConfig } = useQuery({
  queryKey: ['app-config'],
  queryFn: async (): Promise<{ free_scans_count: number }> => {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .eq('key', 'free_scans_count')
      .single()
    if (error) return { free_scans_count: 3 }
    const row = data as AppConfigRow | null
    return { free_scans_count: row ? Number.parseInt(row.value, 10) || 3 : 3 }
  },
  enabled: computed(() => !isCheckingAuth.value),
})

const userAllergensSet = computed(() => new Set<string>(profile.value?.preferences ?? []))
const canRenderWarmAccount = computed(() => !!profile.value && authStatus.value !== 'unauthenticated')
const showAccountInitialLoading = computed(() => isCheckingAuth.value && !canRenderWarmAccount.value)
const showAccountLoggedOutState = computed(() => !showAccountInitialLoading.value && !user.value && !canRenderWarmAccount.value)

const freeScansCount = computed(() => creditsData.value?.freeScansAllowed ?? appConfig.value?.free_scans_count ?? 3)
const freeScansUsed = computed(() => creditsData.value?.freeScansUsed ?? profile.value?.free_scans_used ?? 0)
const paidScansUsed = computed(() => creditsData.value?.paidScansUsed ?? profile.value?.paid_scans_used ?? 0)
const paidCreditsPurchased = computed(() => creditsData.value?.paidCreditsPurchased ?? 0)

const updateProfileMutation = useMutation({
  mutationFn: async (data: { first_name: string; last_name: string }): Promise<void> => {
    if (!user.value?.id) throw new Error('User not found')
    const payload: Pick<UserProfile, 'first_name' | 'last_name'> = { first_name: data.first_name, last_name: data.last_name }
    const { error } = await supabase.from('user_profiles').update(payload as never).eq('user_id', user.value.id)
    if (error) throw error
  },
  onSuccess: () => invalidateAppData('profile_updated'),
})

const toggleAllergenMutation = useMutation({
  mutationFn: async (allergenId: string): Promise<void> => {
    if (!user.value?.id) throw new Error('User not found')
    const current = (profile.value?.preferences ?? []) as string[]
    let next = current

    if (current.includes(allergenId)) {
      next = current.filter(id => id !== allergenId)
    } else if (current.length < 5) {
      next = [...current, allergenId]
    }

    const { error } = await supabase.from('user_profiles').update({ preferences: next, updated_at: new Date().toISOString() } as never).eq('user_id', user.value.id)
    if (error) throw error
  },
  onSuccess: () => invalidateAppData('allergens_updated'),
})

function onEmailUpdated(newEmail: string) {
  userEmail.value = newEmail
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="showAccountInitialLoading" class="min-h-screen flex flex-col bg-background">
      <div class="flex-1 flex items-center justify-center pt-4 pb-24 md:pt-20 md:pb-0">
        <PhSpinnerGap class="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>

    <!-- Not logged in -->
    <div v-else-if="showAccountLoggedOutState" class="min-h-screen flex flex-col bg-background pt-4 pb-24 md:pt-20 md:pb-0">
      <main :id="accountMainContentId" class="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <div class="max-w-sm text-center space-y-6">
          <div
            class="bold-card--static p-3.5 text-left"
            style="border-color: hsl(var(--primary) / 0.18);"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                  style="background: hsl(var(--primary) / 0.1); border: 1.5px solid hsl(var(--primary) / 0.18);"
                >
                  <PhTranslate :size="15" weight="bold" class="text-primary" />
                </span>
                <p class="text-sm font-bold font-heading leading-tight">{{ t('account.language.title') }}</p>
              </div>
              <UiLanguageSelector />
            </div>
          </div>
          <div
            class="w-16 h-16 flex items-center justify-center mx-auto"
            style="background: hsl(var(--primary) / 0.1); border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);"
          >
            <PhLock :size="28" weight="duotone" class="text-primary" />
          </div>
          <h1 class="text-2xl font-black font-heading tracking-tight">{{ t('account.restricted.title') }}</h1>
          <p class="text-muted-foreground text-sm leading-relaxed font-medium">
            {{ t('account.restricted.desc') }}
          </p>
          <div class="flex flex-col gap-3">
            <NuxtLink :to="$localePath('/login?redirect=/app/dashboard')">
              <button class="bold-btn bold-btn--primary bold-btn--lg bold-btn--pill w-full">{{ t('account.restricted.btn_login') }}</button>
            </NuxtLink>
            <NuxtLink :to="$localePath('/signup?redirect=/app/dashboard')">
              <button class="bold-btn bold-btn--secondary bold-btn--lg bold-btn--pill w-full">{{ t('account.restricted.btn_signup') }}</button>
            </NuxtLink>
          </div>
        </div>
      </main>
    </div>

    <!-- Account -->
    <div v-else class="min-h-screen flex flex-col bg-background pb-24 md:pt-28 md:pb-0">
      <main :id="accountMainContentId" class="flex-1 container mx-auto px-4 py-6 pb-16">
        <div class="max-w-md mx-auto flex flex-col gap-6">

        <div
          class="bold-card--static p-3.5"
          style="border-color: hsl(var(--primary) / 0.18);"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                style="background: hsl(var(--primary) / 0.1); border: 1.5px solid hsl(var(--primary) / 0.18);"
              >
                <PhTranslate :size="15" weight="bold" class="text-primary" />
              </span>
              <p class="text-sm font-bold font-heading leading-tight">{{ t('account.language.title') }}</p>
            </div>
            <UiLanguageSelector />
          </div>
        </div>

        <!-- Profile + password -->
        <AccountProfileSection
          v-if="profile"
          :profile="{ first_name: profile.first_name, last_name: profile.last_name }"
          :email="userEmail"
          :is-saving="updateProfileMutation.isPending.value"
          :plan="entitlements?.plan ?? null"
          :has-paid-credits="paidCreditsPurchased > 0 || paidScansUsed > 0"
          :scan-count="freeScansUsed + paidScansUsed"
          @save="(d) => updateProfileMutation.mutateAsync(d)"
          @email-updated="onEmailUpdated"
        />

        <!-- Credits -->
        <AccountCreditsSection
          :free-scans-count="freeScansCount"
          :free-scans-used="freeScansUsed"
          :paid-scans-used="paidScansUsed"
          :paid-credits-purchased="paidCreditsPurchased"
          :daily-credit-available="hasDailyCredit"
        />

        <div
          v-if="stripeSyncStatus !== 'idle'"
          class="bold-card--static p-4 space-y-1"
          style="border-color: hsl(var(--primary) / 0.22);"
        >
          <p class="text-sm font-bold font-heading">
            {{ t('account.order_history.syncing_title') }}
          </p>
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{
              stripeSyncStatus === 'syncing'
                ? t('account.order_history.syncing_desc')
                : t('account.order_history.sync_timeout_desc')
            }}
          </p>
        </div>

        <!-- Historique des commandes -->
        <AccountOrderHistory />

        <!-- Allergens -->
        <AccountAllergensSection
          :all-allergens="allAllergens"
          :user-allergens="userAllergensSet"
          :is-loading="allergensLoading"
          @toggle="(id) => toggleAllergenMutation.mutate(id)"
        />

        <!-- CTA Banner -->
        <HomeCtaBanner />

        <!-- Onboarding replay card -->
        <div
          class="bold-card--static p-5 space-y-4 relative overflow-hidden"
          style="border-color: hsl(var(--primary) / 0.25);"
        >
          <div
            class="absolute inset-0 pointer-events-none opacity-[0.035]"
            style="background: repeating-linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)) 8px, transparent 8px, transparent 16px);"
          />
          <div class="relative flex items-start gap-3">
            <div
              class="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              style="background: hsl(var(--primary) / 0.12);"
            >
              <PhInfo :size="18" weight="fill" class="text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold font-heading leading-snug">{{ t('account.onboarding_replay.title') }}</p>
              <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {{ t('account.onboarding_replay.desc') }}
              </p>
            </div>
          </div>
          <button
            class="bold-btn bold-btn--secondary bold-btn--pill bold-btn--sm w-full relative"
            @click="resetOnboarding()"
          >
            {{ t('account.onboarding_replay.btn_replay') }}
          </button>
        </div>

          <!-- Danger zone -->
          <AccountDangerSection />
        </div>
      </main>
    </div>
  </div>
</template>
