import type { PricingOffer } from '~/utils/pricing-offers'

type UsePricingOffersPublicOptions = {
  immediate?: boolean
  ssr?: boolean
}

const PRICING_OFFERS_TTL_MS = 5 * 60 * 1000

function normalizePublicPricingOffers(offers: PricingOffer[]) {
  return [...offers]
    .filter(offer => offer.active)
    .sort((left, right) => left.credits - right.credits)
}

export function usePricingOffersPublic(options: UsePricingOffersPublicOptions = {}) {
  const { immediate = true, ssr = true } = options
  const supabase = useSupabase()
  const pricingOffers = useState<PricingOffer[]>('pricing-offers-public:data', () => [])
  const pricingLoading = useState<boolean>('pricing-offers-public:loading', () => false)
  const pricingFetchedAt = useState<number>('pricing-offers-public:fetched-at', () => 0)
  const pricingError = useState<string | null>('pricing-offers-public:error', () => null)

  function setPricingOffers(nextOffers: PricingOffer[]) {
    pricingOffers.value = normalizePublicPricingOffers(nextOffers)
    pricingFetchedAt.value = Date.now()
    pricingError.value = null
  }

  function invalidatePricingOffers() {
    pricingFetchedAt.value = 0
    pricingError.value = null
  }

  async function fetchPricingOffers(force = false) {
    const cacheIsFresh = pricingOffers.value.length > 0 && (Date.now() - pricingFetchedAt.value) < PRICING_OFFERS_TTL_MS
    if (!force && (pricingLoading.value || cacheIsFresh)) {
      return pricingOffers.value
    }

    pricingLoading.value = true
    pricingError.value = null

    try {
      const { data, error } = await supabase
        .from('pricing_offers')
        .select('id, code, title, credits, full_price_cents, discount_price_cents, stripe_price_id_full, stripe_price_id_discount, active')
        .eq('active', true)
        .order('credits', { ascending: true })

      if (error) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to load pricing offers',
          data: error,
        })
      }

      setPricingOffers((data ?? []) as PricingOffer[])
      return pricingOffers.value
    } catch (error) {
      pricingError.value = error instanceof Error ? error.message : String(error ?? 'Failed to load pricing offers')
      if (pricingOffers.value.length === 0) {
        pricingOffers.value = []
      }
      return pricingOffers.value
    } finally {
      pricingLoading.value = false
    }
  }

  if (import.meta.server && ssr) {
    onServerPrefetch(async () => {
      await fetchPricingOffers()
    })
  }

  if (import.meta.client && immediate) {
    void fetchPricingOffers()
  }

  return {
    pricingOffers: readonly(pricingOffers),
    pricingLoading: readonly(pricingLoading),
    pricingError: readonly(pricingError),
    setPricingOffers,
    invalidatePricingOffers,
    fetchPricingOffers,
  }
}
