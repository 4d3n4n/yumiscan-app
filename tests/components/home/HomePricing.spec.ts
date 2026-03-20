import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HomePricing from '../../../components/home/HomePricing.vue'

const { loadStripeMock, getAuthenticatedHeadersMock } = vi.hoisted(() => ({
  loadStripeMock: vi.fn(),
  getAuthenticatedHeadersMock: vi.fn(),
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: loadStripeMock,
}))

vi.mock('~/utils/supabase-auth', () => ({
  getAuthenticatedHeaders: getAuthenticatedHeadersMock,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tm: () => ['Intro A ', 'Intro B ', 'Intro C ', 'Intro D'],
    rt: (value: string) => value,
    locale: ref('fr'),
  }),
}))

describe('HomePricing', () => {
  const user = ref<{ id: string } | null>({ id: 'user-1' })
  const pricingOffers = ref([{
    id: 'offer-100',
    code: '100_credits',
    title: '100 credits',
    credits: 100,
    full_price_cents: 749,
    discount_price_cents: null,
    stripe_price_id_full: 'price_full_100',
    stripe_price_id_discount: null,
    active: true,
  }])
  const pricingLoading = ref(false)
  const pricingError = ref<string | null>(null)
  const fetchPricingOffersMock = vi.fn()
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    getAuthenticatedHeadersMock.mockResolvedValue({
      Authorization: 'Bearer test-token',
      apikey: 'public-key',
      'Content-Type': 'application/json',
    })
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('nextTick', nextTick)
    vi.stubGlobal('onMounted', onMounted)
    vi.stubGlobal('onUnmounted', onUnmounted)
    vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
    vi.stubGlobal('useLocalePath', () => (path: string) => (path === '/' ? '/fr' : `/fr${path}`))
    vi.stubGlobal('useRoute', () => ({ fullPath: '/fr/pricing' }))
    vi.stubGlobal('useAuth', () => ({ user }))
    vi.stubGlobal('useSupabase', () => ({ auth: {} }))
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'public-key',
        stripePublishableKey: 'pk_test_123',
      },
    }))
    vi.stubGlobal('useForegroundRefreshGate', () => ({
      shouldRun: () => true,
    }))
    vi.stubGlobal('usePricingOffersPublic', () => ({
      pricingOffers,
      pricingLoading,
      pricingError,
      fetchPricingOffers: fetchPricingOffersMock,
    }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('detruit le checkout embed precedent avant d en monter un nouveau', async () => {
    const firstCheckout = {
      mount: vi.fn(),
      unmount: vi.fn(),
      destroy: vi.fn(),
    }
    const secondCheckout = {
      mount: vi.fn(),
      unmount: vi.fn(),
      destroy: vi.fn(),
    }

    loadStripeMock.mockResolvedValue({
      initEmbeddedCheckout: vi
        .fn()
        .mockResolvedValueOnce(firstCheckout)
        .mockResolvedValueOnce(secondCheckout),
    })

    fetchMock.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ clientSecret: 'cs_test_123' }),
    })

    const wrapper = mount(HomePricing, {
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: true,
          AuthGuardModal: {
            template: '<div class="auth-guard-modal" />',
          },
          AppEmoji: {
            template: '<span class="app-emoji" />',
          },
        },
      },
    })

    const planButton = wrapper.find('button.bold-btn--secondary')
    expect(planButton.exists()).toBe(true)

    await planButton.trigger('click')
    await flushPromises()
    await nextTick()

    expect(firstCheckout.mount).toHaveBeenCalledTimes(1)
    expect(firstCheckout.destroy).not.toHaveBeenCalled()

    await planButton.trigger('click')
    await flushPromises()
    await nextTick()

    expect(firstCheckout.destroy).toHaveBeenCalledTimes(1)
    expect(secondCheckout.mount).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('revalide le pricing au retour sur la page avec un fetch forcé', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))

    const wrapper = mount(HomePricing, {
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: true,
          AuthGuardModal: {
            template: '<div class="auth-guard-modal" />',
          },
          AppEmoji: {
            template: '<span class="app-emoji" />',
          },
        },
      },
    })

    fetchPricingOffersMock.mockClear()

    vi.advanceTimersByTime(10_001)
    window.dispatchEvent(new Event('pageshow'))
    await flushPromises()

    expect(fetchPricingOffersMock).toHaveBeenCalledWith(true)

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('peut masquer la carte de reassurance paiement pour la page pricing dediee', () => {
    const wrapper = mount(HomePricing, {
      props: {
        showPaymentSummary: false,
      },
      global: {
        stubs: {
          Teleport: true,
          AuthGuardModal: {
            template: '<div class="auth-guard-modal" />',
          },
          AppEmoji: {
            template: '<span class="app-emoji" />',
          },
          PaymentMethodsMarquee: {
            template: '<div class="payment-methods-marquee" />',
          },
        },
      },
    })

    expect(wrapper.text()).not.toContain('home.pricing.trust.title')
  })
})
