/**
 * Tests du back-office admin : types et contrat des réponses Edge Functions.
 * Les appels réels (adminKpi, adminUsersList, etc.) sont couverts par les mocks en CI ou par des tests e2e.
 */
import { describe, it, expect } from 'vitest'
import type {
  AdminKpiResponse,
  AdminPricingOffer,
  AdminUserListItem,
  AdminScanRow,
} from '../../composables/useEdgeFunctions'
import { SCAN_TIMEOUT_MESSAGE } from '../../composables/useEdgeFunctions'

describe('useEdgeFunctions (admin)', () => {
  describe('SCAN_TIMEOUT_MESSAGE', () => {
    it('expose la constante de message timeout', () => {
      expect(SCAN_TIMEOUT_MESSAGE).toBe('SCAN_TIMEOUT_OR_NETWORK')
    })
  })

  describe('AdminKpiResponse', () => {
    it('accepte une réponse KPI valide (contrat)', () => {
      const sample: AdminKpiResponse = {
        users: { total: 10, period: 2, dau: 1, mau: 5 },
        scans: {
          allTimeTotal: 100,
          periodTotal: 20,
          byStatus: { ok: 80, contains_allergen: 10, ambiguous: 10 },
          freeInPeriod: 15,
          paidInPeriod: 5,
          theoreticalFreeCeiling: 50,
          topAllergens: { gluten: 5, arachide: 2 },
        },
        credits: { purchasedInPeriod: 30, conversionRate: 5.5 },
        finance: {
          scanAiModel: 'gemini-2.5-flash',
          assistantAiModel: 'gemini-2.5-flash',
          googleOcrCostEurPerRequest: 0.0015,
          scanAiCostEurPerRequest: 0.0002,
          assistantAiCostEurPerRequest: 0.0002,
          assistantCostIncludedInObservedMargin: false,
          revenueAmountCents: 5990,
          theoreticalCostAmountCents: 190,
          marginAmountCents: 5800,
          initialFreeCreditsInPeriod: 6,
          purchasedCreditsInPeriod: 30,
          maximumNonDailyCreditsExposureCount: 36,
          maximumPotentialCostAmountCents: 340,
          maximumPotentialMarginAmountCents: 5650,
        },
        performance: {
          trackedScansInPeriod: 12,
          minTotalDurationMs: 4200,
          avgTotalDurationMs: 6400,
          maxTotalDurationMs: 11800,
          p95TotalDurationMs: 9100,
          avgPhase0DurationMs: 1200,
          avgPhase05ImagePrepDurationMs: 180,
          avgPhase05DurationMs: 1400,
          avgPhase09DurationMs: 800,
          avgClassificationDurationMs: 2600,
          avgFinalizeDurationMs: 140,
          avgBatchDurationMs: 950,
        },
        paywall: { hitsInPeriod: 5 },
      }
      expect(sample.users.total).toBe(10)
      expect(sample.scans.byStatus.ok).toBe(80)
      expect(sample.finance.marginAmountCents).toBe(5800)
    })
  })

  describe('AdminUserListItem', () => {
    it('accepte un item utilisateur valide (contrat)', () => {
      const sample: AdminUserListItem = {
        id: 'user-uuid',
        email: 'admin@test.com',
        created_at: '2025-01-01T00:00:00Z',
        first_name: 'Jean',
        last_name: 'Dupont',
        free_scans_used: 3,
        paid_scans_used: 0,
        paid_credits_purchased: 0,
        scans_count: 3,
      }
      expect(sample.email).toBe('admin@test.com')
      expect(sample.scans_count).toBe(3)
    })
  })

  describe('AdminScanRow', () => {
    it('accepte une ligne scan valide (contrat)', () => {
      const sample: AdminScanRow = {
        id: 'scan-uuid',
        created_at: '2025-01-15T12:00:00Z',
        product_status: 'ok',
        result_json: { ingredients: [] },
        certified_raw_text: null,
        credit_consumed_type: 'free',
        image_storage_path: null,
        signed_image_url: null,
      }
      expect(sample.product_status).toBe('ok')
      expect(sample.credit_consumed_type).toBe('free')
    })
  })

  describe('AdminPricingOffer', () => {
    it('accepte une offre pricing admin valide (contrat)', () => {
      const sample: AdminPricingOffer = {
        id: 'pricing-uuid',
        code: '100_credits',
        title: '100 credits',
        credits: 100,
        full_price_cents: 749,
        discount_price_cents: null,
        stripe_price_id_full: 'price_full_100',
        stripe_price_id_discount: null,
        active: true,
      }

      expect(sample.code).toBe('100_credits')
      expect(sample.full_price_cents).toBe(749)
    })
  })
})
