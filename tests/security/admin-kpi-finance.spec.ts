import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('admin-kpi financial metrics contract', () => {
  const functionPath = join(process.cwd(), 'supabase/functions/admin-kpi/index.ts')
  const raw = readFileSync(functionPath, 'utf-8')

  it('calculates revenue from purchase amounts and costs from persisted scan request counts', () => {
    expect(raw).toContain('amount_cents')
    expect(raw).toContain('ocr_request_count')
    expect(raw).toContain('gemini_request_count')
    expect(raw).toContain('SCAN_AI_REQUEST_COST_FLOOR_MULTIPLIER = 4')
    expect(raw).toContain('google_ocr_cost_eur_per_request')
    expect(raw).toContain('scan_ai_cost_eur_per_request')
    expect(raw).toContain('assistant_ai_cost_eur_per_request')
    expect(raw).toContain('row.gemini_request_count ?? 4) * SCAN_AI_REQUEST_COST_FLOOR_MULTIPLIER')
    expect(raw).toContain('revenueAmountCents')
    expect(raw).toContain('theoreticalCostAmountCents')
    expect(raw).toContain('marginAmountCents')
  })

  it('exposes a max non-daily credits scenario based on free and purchased credits only', () => {
    expect(raw).toContain('initialFreeCreditsInPeriod')
    expect(raw).toContain('maximumNonDailyCreditsExposureCount')
    expect(raw).toContain('maximumPotentialCostAmountCents')
    expect(raw).toContain('maximumPotentialMarginAmountCents')
    expect(raw).toContain('purchasedCreditsInPeriod')
    expect(raw).toContain('scanAiCostEurPerRequest * 5 * SCAN_AI_REQUEST_COST_FLOOR_MULTIPLIER')
  })

  it('aggregates persisted scan performance metrics for the admin dashboard', () => {
    expect(raw).toContain('performance_json')
    expect(raw).toContain('trackedScansInPeriod')
    expect(raw).toContain('minTotalDurationMs')
    expect(raw).toContain('avgTotalDurationMs')
    expect(raw).toContain('maxTotalDurationMs')
  })
})
