import { describe, expect, it } from 'vitest'

import {
  centsToLocalizedPrice,
  formatPricingOfferLabel,
  getCheckoutPriceId,
  getDisplayPriceCents,
  hasActiveDiscount,
  isStripePriceId,
  normalizeDiscountPriceCents,
  normalizeStripePriceId,
  parseEuroStringToCents,
  parsePositiveInteger,
} from '../../utils/pricing-offers'

describe('pricing offers utils', () => {
  it('normalizes empty and zero discount values to null', () => {
    expect(normalizeDiscountPriceCents('')).toBeNull()
    expect(normalizeDiscountPriceCents('   ')).toBeNull()
    expect(normalizeDiscountPriceCents('0')).toBeNull()
    expect(normalizeDiscountPriceCents('0.00')).toBeNull()
    expect(normalizeDiscountPriceCents('0,00')).toBeNull()
  })

  it('parses a valid discount value in euro cents', () => {
    expect(normalizeDiscountPriceCents('5,99')).toBe(599)
    expect(parseEuroStringToCents('12.49')).toBe(1249)
  })

  it('parses positive integer credits and rejects zero or invalid values', () => {
    expect(parsePositiveInteger('100')).toBe(100)
    expect(parsePositiveInteger('0')).toBeNull()
    expect(parsePositiveInteger('abc')).toBeNull()
    expect(parsePositiveInteger(300)).toBe(300)
  })

  it('treats a discount as active only when the price and discount stripe id are both valid', () => {
    expect(hasActiveDiscount({
      full_price_cents: 749,
      discount_price_cents: 599,
      stripe_price_id_discount: 'price_discount_100',
    })).toBe(true)

    expect(hasActiveDiscount({
      full_price_cents: 749,
      discount_price_cents: 0,
      stripe_price_id_discount: 'price_discount_100',
    })).toBe(false)

    expect(hasActiveDiscount({
      full_price_cents: 749,
      discount_price_cents: 599,
      stripe_price_id_discount: '   ',
    })).toBe(false)
  })

  it('returns the correct checkout price id and display price', () => {
    const discountedOffer = {
      full_price_cents: 1249,
      discount_price_cents: 999,
      stripe_price_id_full: 'price_full_300',
      stripe_price_id_discount: 'price_discount_300',
    }
    const regularOffer = {
      full_price_cents: 749,
      discount_price_cents: null,
      stripe_price_id_full: 'price_full_100',
      stripe_price_id_discount: null,
    }

    expect(getCheckoutPriceId(discountedOffer)).toBe('price_discount_300')
    expect(getDisplayPriceCents(discountedOffer)).toBe(999)
    expect(getCheckoutPriceId(regularOffer)).toBe('price_full_100')
    expect(getDisplayPriceCents(regularOffer)).toBe(749)
  })

  it('normalizes nullable stripe ids by trimming empty values', () => {
    expect(normalizeStripePriceId('  price_live_123  ')).toBe('price_live_123')
    expect(normalizeStripePriceId('   ')).toBeNull()
  })

  it('validates stripe price ids with underscores', () => {
    expect(isStripePriceId('price_discount_300')).toBe(true)
    expect(isStripePriceId('prod_discount_300')).toBe(false)
  })

  it('formats prices and labels for display', () => {
    expect(centsToLocalizedPrice(749, 'fr-FR')).toBe('7,49')
    expect(formatPricingOfferLabel(300, 'fr')).toBe('300 credits')
    expect(formatPricingOfferLabel(300, 'en')).toBe('300 credits')
  })
})
