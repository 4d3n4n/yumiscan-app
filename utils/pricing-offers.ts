export type PricingOffer = {
  id: string
  code: string
  title: string
  credits: number
  full_price_cents: number
  discount_price_cents: number | null
  stripe_price_id_full: string | null
  stripe_price_id_discount: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

export type PricingOfferFormValues = {
  id?: string
  code: string
  title: string
  credits: string
  full_price: string
  discount_price: string
  stripe_price_id_full: string
  stripe_price_id_discount: string
  active: boolean
}

export function sanitizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

export function isStripePriceId(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^price_[A-Za-z0-9_]+$/.test(value.trim())
}

export function parseEuroStringToCents(raw: unknown): number | null {
  const value = sanitizeText(raw).replace(',', '.')
  if (!value) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null

  const amount = Number.parseFloat(value)
  if (!Number.isFinite(amount)) return null

  return Math.round(amount * 100)
}

export function parsePositiveInteger(raw: unknown): number | null {
  const value = sanitizeText(raw)
  if (!/^\d+$/.test(value)) return null
  const parsed = Number.parseInt(value, 10)
  return parsed > 0 ? parsed : null
}

export function normalizeDiscountPriceCents(raw: unknown): number | null {
  const cents = parseEuroStringToCents(raw)
  if (cents == null || cents <= 0) return null
  return cents
}

export function normalizeStripePriceId(raw: unknown): string | null {
  const value = sanitizeText(raw)
  return value.length > 0 ? value : null
}

export function hasActiveDiscount(offer: Pick<PricingOffer, 'full_price_cents' | 'discount_price_cents' | 'stripe_price_id_discount'>): boolean {
  return offer.discount_price_cents != null
    && offer.discount_price_cents > 0
    && offer.discount_price_cents < offer.full_price_cents
    && isStripePriceId(offer.stripe_price_id_discount)
}

export function getCheckoutPriceId(offer: Pick<PricingOffer, 'full_price_cents' | 'discount_price_cents' | 'stripe_price_id_full' | 'stripe_price_id_discount'>): string | null {
  if (hasActiveDiscount(offer)) {
    return offer.stripe_price_id_discount!.trim()
  }

  if (isStripePriceId(offer.stripe_price_id_full)) {
    return offer.stripe_price_id_full!.trim()
  }

  return null
}

export function getDisplayPriceCents(offer: Pick<PricingOffer, 'full_price_cents' | 'discount_price_cents' | 'stripe_price_id_discount'>): number {
  return hasActiveDiscount(offer)
    ? offer.discount_price_cents!
    : offer.full_price_cents
}

export function centsToLocalizedPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function pricingOfferToFormValues(offer: PricingOffer): PricingOfferFormValues {
  return {
    id: offer.id,
    code: offer.code,
    title: offer.title,
    credits: String(offer.credits),
    full_price: centsToEditableValue(offer.full_price_cents),
    discount_price: offer.discount_price_cents == null ? '' : centsToEditableValue(offer.discount_price_cents),
    stripe_price_id_full: offer.stripe_price_id_full ?? '',
    stripe_price_id_discount: offer.stripe_price_id_discount ?? '',
    active: offer.active,
  }
}

export function formatPricingOfferLabel(credits: number, locale: string): string {
  if (locale.startsWith('fr')) {
    return `${credits} credits`
  }
  return `${credits} credits`
}

function centsToEditableValue(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}
