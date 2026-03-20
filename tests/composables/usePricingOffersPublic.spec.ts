import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

describe('usePricingOffersPublic', () => {
  beforeEach(() => {
    vi.resetModules()

    const stateStore = new Map<string, ReturnType<typeof ref>>()

    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
      if (!stateStore.has(key)) {
        stateStore.set(key, ref(init()))
      }
      return stateStore.get(key)
    })
    vi.stubGlobal('readonly', <T>(value: T) => value)
    vi.stubGlobal('onServerPrefetch', vi.fn())
    vi.stubGlobal('useSupabase', () => ({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('remplace le cache public avec les offres actives triées par credits', async () => {
    const { usePricingOffersPublic } = await import('../../composables/usePricingOffersPublic')
    const { pricingOffers, setPricingOffers } = usePricingOffersPublic({ immediate: false, ssr: false })

    setPricingOffers([
      {
        id: 'inactive-offer',
        code: 'inactive',
        title: 'Inactive',
        credits: 500,
        full_price_cents: 1999,
        discount_price_cents: null,
        stripe_price_id_full: 'price_inactive',
        stripe_price_id_discount: null,
        active: false,
      },
      {
        id: 'offer-300',
        code: '300_credits',
        title: '300 credits',
        credits: 300,
        full_price_cents: 1499,
        discount_price_cents: 1099,
        stripe_price_id_full: 'price_full_300',
        stripe_price_id_discount: 'price_discount_300',
        active: true,
      },
      {
        id: 'offer-100',
        code: '100_credits',
        title: '100 credits',
        credits: 100,
        full_price_cents: 749,
        discount_price_cents: null,
        stripe_price_id_full: 'price_full_100',
        stripe_price_id_discount: null,
        active: true,
      },
    ])

    expect(pricingOffers.value.map(offer => offer.id)).toEqual(['offer-100', 'offer-300'])
  })
})
