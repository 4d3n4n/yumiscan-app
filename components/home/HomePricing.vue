<script setup lang="ts">
import { PhCheck, PhPackage, PhTrendUp, PhShieldCheck, PhSpinnerGap, PhGift, PhX } from '@phosphor-icons/vue'
import type { StripeEmbeddedCheckout } from '@stripe/stripe-js'
import AuthGuardModal from '~/components/auth/AuthGuardModal.vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import PaymentMethodsMarquee from '~/components/pricing/PaymentMethodsMarquee.vue'
import { APP_EMOJI } from '~/utils/emojis'
import { loadStripe } from '@stripe/stripe-js'
import { useI18n } from 'vue-i18n'
import { getAuthenticatedHeaders } from '~/utils/supabase-auth'
import {
  centsToLocalizedPrice,
  formatPricingOfferLabel,
  getDisplayPriceCents,
  hasActiveDiscount,
} from '~/utils/pricing-offers'

const props = withDefaults(defineProps<{
  showPaymentSummary?: boolean
}>(), {
  showPaymentSummary: true,
})

const { t, tm, rt, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { user } = useAuth()
const showAuthModal = ref(false)
const isLoading = ref<string | null>(null)
const checkoutError = ref<string | null>(null)
const showEmbeddedCheckout = ref(false)
const embeddedClientSecret = ref<string | null>(null)
const checkoutContainerRef = ref<HTMLDivElement | null>(null)
let embeddedCheckoutInstance: StripeEmbeddedCheckout | null = null
let embeddedCheckoutMountToken = 0

const PRICING_FOREGROUND_REFRESH_COOLDOWN_MS = 10_000
const { shouldRun: shouldRunPricingForegroundRefresh } = useForegroundRefreshGate(PRICING_FOREGROUND_REFRESH_COOLDOWN_MS)

const getArrayMessages = (key: string) => {
  const result = tm(key)
  if (Array.isArray(result)) {
    return result.map(msg => rt(msg))
  }
  return [] // Fallback temp array
}

type PricingPlanCard = {
  id: string
  name: string
  credits: number
  price: string
  fullPrice: string | null
  pricePerCredit: string
  description: string
  features: string[]
  popular: boolean
  badge?: string
}

const supabase = useSupabase()
const pricingLocale = computed(() => (locale.value === 'fr' ? 'fr-FR' : 'en-US'))
const introSpans = computed(() => getArrayMessages('home.pricing.intro_spans'))
const pricingAuthRedirect = computed(() => route.fullPath || localePath('/pricing'))

const {
  pricingOffers,
  pricingLoading,
  pricingError,
  fetchPricingOffers,
} = usePricingOffersPublic()

const plans = computed<PricingPlanCard[]>(() =>
  (pricingOffers.value ?? []).map((offer) => {
    const displayPriceCents = getDisplayPriceCents(offer)
    const hasDiscount = hasActiveDiscount(offer)
    const pricePerCredit = centsToLocalizedPrice(
      Math.round(displayPriceCents / Math.max(offer.credits, 1)),
      pricingLocale.value,
    )

    return {
      id: offer.code,
      name: offer.title || formatPricingOfferLabel(offer.credits, locale.value),
      credits: offer.credits,
      price: centsToLocalizedPrice(displayPriceCents, pricingLocale.value),
      fullPrice: hasDiscount ? centsToLocalizedPrice(offer.full_price_cents, pricingLocale.value) : null,
      pricePerCredit: `${pricePerCredit}€ / ${t('home.pricing.per_credit_suffix')}`,
      description: t(`home.pricing.plans.${offer.code}.desc`),
      features: getArrayMessages(`home.pricing.plans.${offer.code}.features`),
      popular: offer.code === '300_credits',
      badge: offer.code === '300_credits' ? t('home.pricing.plans.300_credits.badge') : undefined,
    }
  }),
)

const destroyEmbeddedCheckoutInstance = () => {
  const checkoutInstance = embeddedCheckoutInstance
  embeddedCheckoutInstance = null
  if (!checkoutInstance) {
    return
  }

  try {
    checkoutInstance.destroy()
  } catch {
    try {
      checkoutInstance.unmount()
    } catch {
      // Ignore teardown failures: we still want the UI state to close cleanly.
    }
  }
}

const closeEmbeddedCheckout = () => {
  embeddedCheckoutMountToken += 1
  destroyEmbeddedCheckoutInstance()
  showEmbeddedCheckout.value = false
  embeddedClientSecret.value = null
}

const handleSelectPlan = async (planId: string) => {
  if (!user.value) {
    showAuthModal.value = true
    return
  }

  isLoading.value = planId
  checkoutError.value = null
  const mountToken = ++embeddedCheckoutMountToken
  try {
    const config = useRuntimeConfig()
    const headers = await getAuthenticatedHeaders(supabase, config.public.supabaseKey)
    if (!headers) { showAuthModal.value = true; return }

    const res = await fetch(`${config.public.supabaseUrl}/functions/v1/stripe-checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan: planId }),
    })
    const data = await res.json()
    if (data.clientSecret) {
      if (mountToken !== embeddedCheckoutMountToken) {
        return
      }
      destroyEmbeddedCheckoutInstance()
      embeddedClientSecret.value = data.clientSecret
      showEmbeddedCheckout.value = true
      await nextTick()
      await mountEmbeddedCheckout(data.clientSecret, mountToken)
      return
    }
    checkoutError.value = data?.error ?? `${t('home.pricing.error_checkout')} (${res.status})`
  } catch (e) {
    checkoutError.value = e instanceof Error ? e.message : t('home.pricing.error_checkout')
  } finally {
    isLoading.value = null
  }
}

async function mountEmbeddedCheckout(clientSecret: string, mountToken: number) {
  const config = useRuntimeConfig()
  const pk = config.public.stripePublishableKey as string
  if (!pk) {
    checkoutError.value = t('home.pricing.error_missing_key')
    closeEmbeddedCheckout()
    return
  }
  const stripe = await loadStripe(pk)
  if (!stripe) {
    checkoutError.value = t('home.pricing.error_load')
    closeEmbeddedCheckout()
    return
  }
  const checkout = await stripe.initEmbeddedCheckout({
    fetchClientSecret: () => Promise.resolve(clientSecret),
  })
  if (mountToken !== embeddedCheckoutMountToken) {
    checkout.destroy()
    return
  }

  destroyEmbeddedCheckoutInstance()
  embeddedCheckoutInstance = checkout
  const mountTarget = checkoutContainerRef.value?.querySelector('#stripe-embedded-checkout')
  if (!(mountTarget instanceof HTMLElement)) {
    destroyEmbeddedCheckoutInstance()
    return
  }
  checkout.mount(mountTarget)
  isLoading.value = null
}

async function refreshPricingOnForeground() {
  if (pricingLoading.value) {
    return
  }

  if (!shouldRunPricingForegroundRefresh()) {
    return
  }

  await fetchPricingOffers(true)
}

function handlePricingVisibilityChange() {
  if (document.visibilityState !== 'visible') {
    return
  }

  void refreshPricingOnForeground()
}

function handlePricingPageShow() {
  void refreshPricingOnForeground()
}

onMounted(() => {
  window.addEventListener('pageshow', handlePricingPageShow)
  document.addEventListener('visibilitychange', handlePricingVisibilityChange)
})

onUnmounted(() => {
  window.removeEventListener('pageshow', handlePricingPageShow)
  document.removeEventListener('visibilitychange', handlePricingVisibilityChange)
})

onBeforeUnmount(() => {
  closeEmbeddedCheckout()
})
</script>

<template>
  <section id="pricing" data-scroll-offset="116">
  <h2 class="font-heading text-[0.8125rem] font-extrabold uppercase tracking-[0.12em] mb-5 flex items-center gap-2 after:flex-1 after:h-[2.5px] after:bg-[hsl(var(--muted-foreground)/0.35)] after:rounded-sm">{{ t('home.pricing.title') }}</h2>

  <div class="pricing-intro -mt-3 mb-5">
    <div class="pricing-intro__icon">
      <PhGift :size="20" weight="duotone" />
    </div>
    <p class="pricing-intro__text">
      <strong class="text-foreground">{{ introSpans[0] || '' }}</strong>{{ introSpans[1] || '' }}
      <strong class="text-foreground">{{ introSpans[2] || '' }}</strong>
      <span class="text-muted-foreground">{{ introSpans[3] || '' }}</span>
    </p>
  </div>

  <div
    v-if="checkoutError"
    class="mb-4 p-3 text-sm font-medium rounded-lg flex items-start gap-2"
    style="border: 2px solid hsl(var(--destructive) / 0.5); background: hsl(var(--destructive) / 0.1); color: hsl(var(--destructive));"
  >
    <AppEmoji :name="APP_EMOJI.checkoutError" :size="24" class="shrink-0" />
    <span>{{ checkoutError }}</span>
  </div>

  <div class="space-y-6">
    <div
      v-if="pricingLoading"
      class="bold-card--static p-4 flex items-center gap-3"
      style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);"
    >
      <PhSpinnerGap :size="18" class="animate-spin text-primary" />
      <p class="text-sm font-medium text-muted-foreground">{{ t('home.pricing.loading') }}</p>
    </div>

    <div
      v-else-if="pricingError || plans.length === 0"
      class="bold-card--static p-4"
      style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius);"
    >
      <p class="text-sm font-bold text-foreground">{{ t('home.pricing.empty') }}</p>
    </div>

    <!-- Plan cards -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="bold-card--static relative flex flex-col overflow-visible"
        :style="plan.popular ? 'box-shadow: var(--bold-shadow-lg); border-color: hsl(var(--primary));' : ''"
      >
        <!-- Popular badge -->
        <div v-if="plan.popular" class="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span class="bold-pill bold-pill--primary text-[9px] px-3 py-0.5">{{ plan.badge }}</span>
        </div>

        <div class="p-5 flex-1 flex flex-col">
          <div class="flex items-center gap-2.5 mb-4">
            <div
              class="w-10 h-10 flex items-center justify-center"
              :class="plan.popular ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'"
              style="border: 2px solid var(--bold-border-color); border-radius: 10px;"
            >
              <PhPackage v-if="!plan.popular" :size="20" weight="duotone" />
              <PhTrendUp v-else :size="20" weight="duotone" />
            </div>
            <div>
              <h3 class="font-extrabold text-base font-heading">{{ plan.name }}</h3>
              <p class="text-[11px] text-muted-foreground font-medium">{{ plan.description }}</p>
            </div>
          </div>

          <div class="mb-4">
            <div class="flex items-baseline gap-1">
              <span v-if="plan.fullPrice" class="text-sm font-bold text-muted-foreground line-through mr-1">{{ plan.fullPrice }}&euro;</span>
              <span class="text-3xl font-black font-heading tracking-tight">{{ plan.price }}&euro;</span>
              <span class="text-muted-foreground text-xs font-medium">{{ t('home.pricing.one_time') }}</span>
            </div>
            <p class="text-[11px] text-muted-foreground font-medium mt-0.5">
              {{ plan.pricePerCredit }}
            </p>
          </div>

          <ul class="space-y-2 mb-5 flex-1">
            <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
              <span
                class="mt-0.5 shrink-0 w-4 h-4 rounded flex items-center justify-center"
                style="border: 1.5px solid var(--bold-border-color); background: hsl(var(--accent) / 0.1);"
              >
                <PhCheck :size="10" weight="bold" class="text-accent" />
              </span>
              <span class="text-xs text-foreground/80 font-medium leading-tight">{{ feature }}</span>
            </li>
          </ul>

          <button
            :disabled="isLoading === plan.id"
            :class="[
              'bold-btn w-full bold-btn--pill',
              plan.popular ? 'bold-btn--primary' : 'bold-btn--secondary'
            ]"
            style="padding: 0.6rem 1rem; font-size: 0.8125rem;"
            @click="handleSelectPlan(plan.id)"
          >
            <PhSpinnerGap v-if="isLoading === plan.id" class="h-4 w-4 animate-spin" />
            <template v-else>{{ t('home.pricing.cta_buy') }} {{ plan.name }}</template>
          </button>
        </div>
      </div>
    </div>

    <!-- Payment summary -->
    <div
      v-if="props.showPaymentSummary"
      class="bold-card--static p-4"
    >
      <div class="flex items-start gap-3 mb-3">
        <div
          class="w-10 h-10 shrink-0 flex items-center justify-center"
          style="border: 2px solid var(--bold-border-color); border-radius: 10px; background: hsl(var(--accent) / 0.1);"
        >
          <img src="/images/payment/stripe.webp" alt="Stripe" class="h-6 w-auto object-contain">
        </div>
        <div>
          <h4 class="font-bold text-sm font-heading">{{ t('home.pricing.trust.title') }}</h4>
          <p class="text-xs text-muted-foreground font-medium">
            {{ t('home.pricing.trust.desc') }}
          </p>
        </div>
      </div>
      <PaymentMethodsMarquee compact :interactive="false" :rows="1" />
    </div>
  </div>

  <!-- Modal paiement intégré (même page) -->
  <Teleport to="body">
    <div
      v-if="showEmbeddedCheckout"
      class="fixed inset-0 z-[100] flex flex-col bg-background"
      style="border: 2.5px solid var(--bold-border-color); box-shadow: var(--bold-shadow-lg);"
    >
      <header
        class="flex items-center justify-between shrink-0 px-5 py-4"
        style="border-bottom: 2.5px solid var(--bold-border-color); background: hsl(var(--card));"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 flex items-center justify-center shrink-0"
            style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius); background: hsl(var(--primary) / 0.1); color: hsl(var(--primary));"
          >
            <PhShieldCheck :size="20" weight="duotone" />
          </div>
          <div>
            <h3 class="font-bold font-heading text-lg text-foreground">{{ t('home.pricing.modal_title') }}</h3>
            <p class="text-xs text-muted-foreground font-medium">{{ t('home.pricing.modal_desc') }}</p>
          </div>
        </div>
        <button
          type="button"
          class="bold-btn bold-btn--ghost bold-btn--sm w-10 h-10 p-0 rounded-[var(--bold-radius)] text-muted-foreground hover:text-foreground"
          :aria-label="t('common.cancel')"
          @click="closeEmbeddedCheckout"
        >
          <PhX :size="20" />
        </button>
      </header>
      <div ref="checkoutContainerRef" class="flex-1 min-h-0 overflow-auto p-4 md:p-5" style="background: hsl(var(--muted) / 0.3);">
        <div id="stripe-embedded-checkout" class="min-h-[400px] w-full" />
      </div>
    </div>
  </Teleport>

  <AuthGuardModal
    :open="showAuthModal"
    :redirect-to="pricingAuthRedirect"
    @close="showAuthModal = false"
  />
  </section>
</template>

<style scoped>
.pricing-intro {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: hsl(var(--primary) / 0.06);
  border: 2.5px solid hsl(var(--primary) / 0.2);
  border-radius: var(--bold-radius, 14px);
  box-shadow: var(--bold-shadow-xs);
}

.pricing-intro__icon {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  border: 2px solid hsl(var(--primary) / 0.25);
  border-radius: 10px;
}

.pricing-intro__text {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.45;
  color: hsl(var(--foreground) / 0.9);
  margin: 0;
  padding-top: 0.15rem;
}
</style>
