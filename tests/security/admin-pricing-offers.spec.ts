import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('admin-pricing-offers function contract', () => {
  const functionPath = join(process.cwd(), 'supabase/functions/admin-pricing-offers/index.ts')
  const raw = readFileSync(functionPath, 'utf-8')

  it('requires admin auth and only exposes get/post', () => {
    expect(raw).toContain('requireAdmin(req)')
    expect(raw).toContain('req.method !== "GET" && req.method !== "POST"')
  })

  it('normalizes nullable discount fields and validates stripe price ids', () => {
    expect(raw).toContain('normalizeDiscountPriceCents')
    expect(raw).toContain('normalizeStripePriceId')
    expect(raw).toContain('Discount Stripe price ID is required')
    expect(raw).toContain('Invalid full Stripe price ID')
    expect(raw).toContain('No pricing offers provided')
  })
})
