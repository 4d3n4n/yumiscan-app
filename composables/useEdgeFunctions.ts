import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/functions-js'
import { mapCompanyConfigRows, type CompanyConfig } from '~/utils/company-config'
import type { PricingOffer } from '~/utils/pricing-offers'
import type {
  ScanAmbiguousAssistantRequest,
  ScanAmbiguousAssistantResponse,
  ScanAssistantTtsRequest,
  ScanAssistantTtsResponse,
} from '~/utils/scan-ai-assistant'

/** Message d'erreur quand la requête a timeout : le backend peut avoir terminé, inviter à vérifier l'historique. */
export const SCAN_TIMEOUT_MESSAGE = 'SCAN_TIMEOUT_OR_NETWORK'

type EdgeFunctionMethod = 'GET' | 'POST'

type EdgeFunctionOptions = {
  method?: EdgeFunctionMethod
  body?: unknown
  query?: Record<string, string | number>
  timeoutMs?: number
}

type FoodScanAnalyzeResponse = {
  scan_id?: string
}

type StripeFinalizeCheckoutResponse = {
  status: 'processed_now' | 'already_processed' | 'not_ready'
  purchase_id?: string | null
  credits_added?: number | null
}

async function parseEdgeFunctionError(response: Response): Promise<string> {
  const errorText = await response.text()

  try {
    const parsed = JSON.parse(errorText) as { message?: string; error?: string }
    return parsed.error ?? parsed.message ?? `HTTP ${response.status}`
  } catch {
    return errorText || `HTTP ${response.status}`
  }
}

export function useEdgeFunctions() {
  const supabase = useSupabase()

  async function callEdgeFunction<T>(
    functionName: string,
    options: EdgeFunctionOptions = {}
  ): Promise<T> {
    const { method, body, query, timeoutMs } = options
    const effectiveMethod = method ?? ((body || query) ? 'POST' : 'GET')
    const payload = body ?? (query ? Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== '')
    ) : undefined)

    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        method: effectiveMethod,
        body: payload,
        timeout: timeoutMs,
      })

      if (error) {
        if (error instanceof FunctionsHttpError || error instanceof FunctionsRelayError) {
          throw new Error(await parseEdgeFunctionError(error.context))
        }
        if (error instanceof FunctionsFetchError) {
          throw new Error(error.message)
        }
        throw error
      }

      return data as T
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(SCAN_TIMEOUT_MESSAGE)
      }
      throw e
    }
  }

  async function deleteScan(scanId: string): Promise<void> {
    await callEdgeFunction<{ success?: boolean }>('scan-delete', {
      method: 'POST',
      body: { scanId },
    })
  }

  async function stripeFinalizeCheckout(sessionId: string) {
    return callEdgeFunction<StripeFinalizeCheckoutResponse>('stripe-finalize-checkout', {
      method: 'POST',
      body: { session_id: sessionId },
    })
  }

  async function scanAmbiguousAssistant(payload: ScanAmbiguousAssistantRequest) {
    return callEdgeFunction<ScanAmbiguousAssistantResponse>('scan-ambiguous-assistant', {
      method: 'POST',
      body: {
        scan_id: payload.scan_id,
        language: payload.language ?? 'fr',
        force: payload.force ?? false,
        append_cards: payload.append_cards ?? false,
      },
      timeoutMs: 25_000,
    })
  }

  async function scanAssistantTts(payload: ScanAssistantTtsRequest) {
    return callEdgeFunction<ScanAssistantTtsResponse>('scan-assistant-tts', {
      method: 'POST',
      body: {
        scan_id: payload.scan_id,
        phrase_index: payload.phrase_index,
        language: payload.language ?? 'fr',
      },
      timeoutMs: 20_000,
    })
  }

  /** Admin : liste des utilisateurs (paginée, avec recherche optionnelle). */
  async function adminUsersList(params: { page?: number; perPage?: number; search?: string }) {
    return callEdgeFunction<{
      users: AdminUserListItem[]
      total: number
      page: number
      perPage: number
    }>('admin-users-list', { query: { page: params.page ?? 1, perPage: params.perPage ?? 50, search: params.search ?? '' } })
  }

  /** Admin : KPI tableau de bord. */
  async function adminKpi(params?: { startDate?: string; endDate?: string }) {
    const query: Record<string, string> = {}
    if (params?.startDate) query.startDate = params.startDate
    if (params?.endDate) query.endDate = params.endDate
    return callEdgeFunction<AdminKpiResponse>('admin-kpi', { query })
  }

  /** Admin : envoie un email de réinitialisation mot de passe à un utilisateur. */
  async function adminSendPasswordReset(payload: { user_id?: string; email?: string }) {
    return callEdgeFunction<{ success: boolean; message?: string; link?: string | null }>('admin-send-password-reset', {
      method: 'POST',
      body: payload,
    })
  }

  /** Admin : supprime un utilisateur cible. */
  async function adminDeleteUser(targetUserId: string) {
    return callEdgeFunction<{ success: boolean; message?: string }>('admin-delete-user', {
      method: 'POST',
      body: { target_user_id: targetUserId },
    })
  }

  /** Admin : liste des scans d'un utilisateur. */
  async function adminUserScans(userId: string) {
    return callEdgeFunction<{ scans: AdminScanRow[] }>('admin-user-scans', { query: { user_id: userId } })
  }

  async function adminAppConfig() {
    const response = await callEdgeFunction<{ items: { key: string; value: string }[] }>('admin-app-config')
    return mapCompanyConfigRows(response.items ?? [])
  }

  async function adminUpdateAppConfig(values: Partial<CompanyConfig>) {
    const response = await callEdgeFunction<{ items: { key: string; value: string }[] }>('admin-app-config', {
      method: 'POST',
      body: values,
    })
    return mapCompanyConfigRows(response.items ?? [])
  }

  async function adminPricingOffers() {
    const response = await callEdgeFunction<{ items: AdminPricingOffer[] }>('admin-pricing-offers')
    return response.items ?? []
  }

  async function adminUpdatePricingOffers(offers: AdminPricingOfferInput[]) {
    const response = await callEdgeFunction<{ items: AdminPricingOffer[] }>('admin-pricing-offers', {
      method: 'POST',
      body: { offers },
    })
    return response.items ?? []
  }

  return {
    foodScanAnalyze: (params: {
      imageBase64: string
      imageProcessedBase64?: string
      imageStoragePreviewBase64?: string
      language?: 'fr' | 'en'
      filters?: { noCrustaceans?: boolean; noGluten?: boolean; vegan?: boolean }
      allergenIds?: string[]
    }) => callEdgeFunction<FoodScanAnalyzeResponse>('food-scan-analyze', {
      method: 'POST',
      body: params,
      timeoutMs: 120_000, // 2 min : le pipeline peut durer 20–60 s en prod
    }),
    deleteScan,
    scanAmbiguousAssistant,
    scanAssistantTts,
    stripeFinalizeCheckout,
    adminUsersList,
    adminKpi,
    adminSendPasswordReset,
    adminDeleteUser,
    adminUserScans,
    adminAppConfig,
    adminUpdateAppConfig,
    adminPricingOffers,
    adminUpdatePricingOffers,
  }
}

/** Types pour le back-office admin (alignés sur les Edge Functions). */
export type AdminUserListItem = {
  id: string
  email: string | null
  created_at: string | null
  first_name: string
  last_name: string
  free_scans_used: number
  paid_scans_used: number
  paid_credits_purchased: number
  scans_count: number
}

export type AdminKpiResponse = {
  users: { total: number; period: number; dau: number; mau: number }
  scans: {
    allTimeTotal: number
    periodTotal: number
    byStatus: Record<string, number>
    freeInPeriod: number
    paidInPeriod: number
    theoreticalFreeCeiling: number
    topAllergens: Record<string, number>
  }
  credits: { purchasedInPeriod: number; conversionRate: number }
  finance: {
    scanAiModel: string
    assistantAiModel: string
    googleOcrCostEurPerRequest: number
    scanAiCostEurPerRequest: number
    assistantAiCostEurPerRequest: number
    assistantCostIncludedInObservedMargin: boolean
    revenueAmountCents: number
    theoreticalCostAmountCents: number
    marginAmountCents: number
    initialFreeCreditsInPeriod: number
    purchasedCreditsInPeriod: number
    maximumNonDailyCreditsExposureCount: number
    maximumPotentialCostAmountCents: number
    maximumPotentialMarginAmountCents: number
  }
  performance: {
    trackedScansInPeriod: number
    minTotalDurationMs: number | null
    avgTotalDurationMs: number | null
    maxTotalDurationMs: number | null
    p95TotalDurationMs: number | null
    avgPhase0DurationMs: number | null
    avgPhase05ImagePrepDurationMs: number | null
    avgPhase05DurationMs: number | null
    avgPhase09DurationMs: number | null
    avgClassificationDurationMs: number | null
    avgFinalizeDurationMs: number | null
    avgBatchDurationMs: number | null
  }
  paywall: { hitsInPeriod: number }
}

export type AdminScanRow = {
  id: string
  created_at: string
  product_status: string
  result_json: unknown
  certified_raw_text: string | null
  credit_consumed_type: string | null
  image_storage_path: string | null
  signed_image_url?: string | null
}

export type AdminPricingOffer = PricingOffer

type AdminPricingOfferInput = {
  code: string
  title: string
  credits: string
  full_price: string
  discount_price: string
  stripe_price_id_full: string
  stripe_price_id_discount: string
  active: boolean
}
