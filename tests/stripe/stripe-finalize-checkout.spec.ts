import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('stripe finalize checkout contract', () => {
  const functionPath = join(process.cwd(), 'supabase/functions/stripe-finalize-checkout/index.ts')
  const sharedPath = join(process.cwd(), 'supabase/functions/_shared/stripe-checkout.ts')
  const functionRaw = readFileSync(functionPath, 'utf-8')
  const sharedRaw = readFileSync(sharedPath, 'utf-8')

  it('authentifie l utilisateur et verifie que la session Stripe lui appartient', () => {
    expect(functionRaw).toContain('getAuthUser(req)')
    expect(functionRaw).toContain('session.user_id?.trim()')
    expect(functionRaw).toContain('status: "forbidden"')
  })

  it('reutilise la meme logique de reconciliation que le webhook', () => {
    expect(functionRaw).toContain('creditAndRecordPurchase(')
    expect(functionRaw).toContain('credits_added: result.creditsAdded ?? null')
    expect(functionRaw).toContain('findPricingOfferByCode')
    expect(functionRaw).toContain('findPricingOfferByPriceId')
    expect(sharedRaw).toContain('.from("user_purchases")')
    expect(sharedRaw).toContain('stripe_session_id')
    expect(sharedRaw).toContain('creditsAdded?: number')
    expect(sharedRaw).toContain('status: "already_processed"')
    expect(sharedRaw).toContain('status: "processed_now"')
  })
})
