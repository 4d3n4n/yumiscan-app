import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('Stripe account refresh contract', () => {
  it('declenche la finalisation Stripe immediatement au retour sur /app/account et propage les credits', () => {
    const accountPage = readFileSync(resolve(rootDir, 'pages/app/account.vue'), 'utf8')
    const invalidation = readFileSync(resolve(rootDir, 'composables/useAppDataInvalidation.ts'), 'utf8')
    const edgeFunctions = readFileSync(resolve(rootDir, 'composables/useEdgeFunctions.ts'), 'utf8')

    expect(accountPage).toContain("route.query.session_id")
    expect(accountPage).toContain('const immediateFinalize = await triggerStripeFinalize(sessionId)')
    expect(accountPage).toContain(".from('user_purchases')")
    expect(accountPage).toContain(".eq('stripe_session_id', sessionId)")
    expect(accountPage).toContain('stripeFinalizeCheckout(sessionId)')
    expect(accountPage).toContain("invalidateAppData('credits_purchased', {")
    expect(accountPage).toContain('creditsAdded: typeof creditsAdded === \'number\' ? creditsAdded : undefined')
    expect(accountPage).toContain("queryKey: ['entitlements']")
    expect(invalidation).toContain("['stripe-order-history']")
    expect(invalidation).toContain('applyPurchasedCreditsDelta(payload.creditsAdded)')
    expect(edgeFunctions).toContain('credits_added?: number | null')
  })
})
