import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('stripe-webhook pricing resolution contract', () => {
  const functionPath = join(process.cwd(), 'supabase/functions/stripe-webhook/index.ts')
  const sharedPath = join(process.cwd(), 'supabase/functions/_shared/stripe-checkout.ts')
  const raw = readFileSync(functionPath, 'utf-8')
  const shared = readFileSync(sharedPath, 'utf-8')

  it('resolves purchased credits from pricing_offers instead of a fixed plan map', () => {
    expect(raw).toContain('resolveCheckoutSessionPayload')
    expect(shared).toContain('.from("pricing_offers")')
    expect(raw).toContain('pricing_offer_code')
    expect(shared).toContain('stripe_price_id_full')
    expect(shared).toContain('stripe_price_id_discount')
    expect(raw).not.toContain('STRIPE_PRICE_ID_100_CREDITS')
    expect(raw).not.toContain('STRIPE_PRICE_ID_300_CREDITS')
    expect(raw).not.toContain('CREDITS_BY_PLAN')
  })

  it('records the purchase plan from the resolved pricing offer code', () => {
    expect(raw).toContain('creditAndRecordPurchase')
    expect(shared).toContain('plan: offer.code')
    expect(shared).toContain('credits_added: creditsToAdd')
    expect(shared).not.toContain('.update({ paid_credits_balance')
    expect(shared).toContain('insertPurchaseError.code === "23505"')
  })
})
