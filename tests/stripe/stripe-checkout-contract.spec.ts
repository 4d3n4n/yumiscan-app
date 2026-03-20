import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('stripe-checkout dynamic pricing contract', () => {
  const functionPath = join(process.cwd(), 'supabase/functions/stripe-checkout/index.ts')
  const raw = readFileSync(functionPath, 'utf-8')

  it('loads the pricing offer from database instead of fixed env price ids', () => {
    expect(raw).toContain('.from("pricing_offers")')
    expect(raw).toContain('.eq("code", offerCode)')
    expect(raw).toContain('getCheckoutPriceId')
    expect(raw).not.toContain('STRIPE_PRICE_ID_100_CREDITS')
    expect(raw).not.toContain('STRIPE_PRICE_ID_300_CREDITS')
  })

  it('keeps the checkout return url on account with the session id placeholder', () => {
    expect(raw).toContain('/app/account?session_id={CHECKOUT_SESSION_ID}')
  })
})
