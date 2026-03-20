import { requireAdmin } from "../_shared/admin.ts";
import {
  DEFAULT_ASSISTANT_AI_MODEL,
  DEFAULT_SCAN_AI_MODEL,
  getAppConfigMap,
  getAppConfigString,
} from "../_shared/app-config.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const SCAN_AI_REQUEST_COST_FLOOR_MULTIPLIER = 4;

function parseEurConfigValue(value: string | null | undefined): number {
  const normalized = (value?.trim() ?? "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return asRecord(value);
}

function asDurationMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function averageDuration(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function minDuration(values: number[]): number | null {
  return values.length > 0 ? Math.min(...values) : null;
}

function maxDuration(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function percentileDuration(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1));
  return sorted[index] ?? null;
}

function getDefaultScanAiModel() {
  return Deno.env.get("SCAN_AI_MODEL")?.trim()
    || Deno.env.get("GEMINI_MODEL")?.trim()
    || DEFAULT_SCAN_AI_MODEL;
}

function getDefaultAssistantAiModel() {
  return Deno.env.get("ASSISTANT_AI_MODEL")?.trim()
    || Deno.env.get("GEMINI_MODEL")?.trim()
    || DEFAULT_ASSISTANT_AI_MODEL;
}

async function getRequestPayload(req: Request): Promise<Record<string, string>> {
  if (req.method !== "POST") return {};
  const body = await req.json().catch(() => ({})) as Record<string, string | undefined>;
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => typeof value === "string" && value.trim() !== "")
  ) as Record<string, string>;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 405,
    });
  }
  try {
    const { serviceClient } = await requireAdmin(req);

    const url = new URL(req.url);
    const payload = await getRequestPayload(req);
    const startDate = payload.startDate ?? url.searchParams.get("startDate");
    const endDate = payload.endDate ?? url.searchParams.get("endDate");

    // 1. Utilisateurs All-time (nécessaire pour calculer le max théorique)
    const { data: allProfiles, error: profilesErr } = await serviceClient
      .from("user_profiles")
      .select("id, created_at");

    if (profilesErr) throw profilesErr;

    let totalUsers = 0;
    let sumDaysSinceSignup = 0;
    const nowMs = Date.now();

    for (const p of allProfiles || []) {
      totalUsers++;
      const signupAgeMs = nowMs - new Date(p.created_at).getTime();
      const days = Math.floor(signupAgeMs / (24 * 60 * 60 * 1000));
      sumDaysSinceSignup += (days > 0 ? days : 0);
    }

    // 2. Config KPI globale
    const appConfigMap = await getAppConfigMap(serviceClient, [
      "free_scans_count",
      "scan_ai_model",
      "assistant_ai_model",
      "google_ocr_cost_eur_per_request",
      "scan_ai_cost_eur_per_request",
      "assistant_ai_cost_eur_per_request",
      "gemini_flash_cost_eur_per_request",
    ]);
    const baseFreeScans = Number.parseInt(appConfigMap.free_scans_count ?? "5", 10) || 5;
    const scanAiModel = getAppConfigString(appConfigMap, "scan_ai_model", getDefaultScanAiModel());
    const assistantAiModel = getAppConfigString(appConfigMap, "assistant_ai_model", getDefaultAssistantAiModel());
    const googleOcrCostEurPerRequest = parseEurConfigValue(appConfigMap.google_ocr_cost_eur_per_request);
    const scanAiCostEurPerRequest = parseEurConfigValue(
      appConfigMap.scan_ai_cost_eur_per_request ?? appConfigMap.gemini_flash_cost_eur_per_request,
    );
    const assistantAiCostEurPerRequest = parseEurConfigValue(appConfigMap.assistant_ai_cost_eur_per_request);

    // Plafond théorique : quota initial * users + 1 daily par jour depuis leur inscription
    const theoreticalFreeScansCeiling = (totalUsers * baseFreeScans) + sumDaysSinceSignup;

    // 3. Filtrage en fonction de la période
    let usersQuery = serviceClient.from("user_profiles").select("id", { count: "exact", head: true });
    if (startDate) usersQuery = usersQuery.gte("created_at", startDate);
    if (endDate) usersQuery = usersQuery.lte("created_at", endDate);
    const usersInPeriodRes = await usersQuery;

    let scansQuery = serviceClient
      .from("scans")
      .select("id, user_id, product_status, credit_consumed_type, result_json, ocr_request_count, gemini_request_count, performance_json");
    if (startDate) scansQuery = scansQuery.gte("created_at", startDate);
    if (endDate) scansQuery = scansQuery.lte("created_at", endDate);
    const { data: scansData, error: scansErr } = await scansQuery;
    if (scansErr) throw scansErr;

    const byStatus: Record<string, number> = {};
    const topAllergensMap: Record<string, number> = {};
    let periodTotalScans = 0;
    let periodFreeScans = 0;
    let periodPaidScans = 0;
    let totalOcrRequestCount = 0;
    let totalGeminiRequestCount = 0;
    const totalDurationValues: number[] = [];
    const phase0DurationValues: number[] = [];
    const phase05ImagePrepDurationValues: number[] = [];
    const phase05DurationValues: number[] = [];
    const phase09DurationValues: number[] = [];
    const classificationDurationValues: number[] = [];
    const finalizeDurationValues: number[] = [];
    const batchDurationValues: number[] = [];

    for (const row of scansData || []) {
      periodTotalScans++;
      const s = row.product_status || "unknown";
      byStatus[s] = (byStatus[s] || 0) + 1;

      if (row.credit_consumed_type === "paid") {
        periodPaidScans++;
      } else if (row.credit_consumed_type === "free" || row.credit_consumed_type === "daily") {
        periodFreeScans++;
      }

      totalOcrRequestCount += row.ocr_request_count ?? 1;
      totalGeminiRequestCount += (row.gemini_request_count ?? 4) * SCAN_AI_REQUEST_COST_FLOOR_MULTIPLIER;

      const performanceJson = parseJsonRecord(row.performance_json);
      if (performanceJson) {
        const totalDurationMs = asDurationMs(performanceJson.total_duration_ms);
        const phase0DurationMs = asDurationMs(performanceJson.phase0_duration_ms);
        const phase05ImagePrepDurationMs = asDurationMs(performanceJson.phase05_image_prep_duration_ms);
        const phase05DurationMs = asDurationMs(performanceJson.phase05_duration_ms);
        const phase09DurationMs = asDurationMs(performanceJson.phase09_duration_ms);
        const classificationDurationMs = asDurationMs(performanceJson.classification_duration_ms);
        const finalizeDurationMs = asDurationMs(performanceJson.finalize_duration_ms);
        const averageBatchDurationMs = asDurationMs(performanceJson.average_batch_duration_ms);

        if (totalDurationMs != null) totalDurationValues.push(totalDurationMs);
        if (phase0DurationMs != null) phase0DurationValues.push(phase0DurationMs);
        if (phase05ImagePrepDurationMs != null) phase05ImagePrepDurationValues.push(phase05ImagePrepDurationMs);
        if (phase05DurationMs != null) phase05DurationValues.push(phase05DurationMs);
        if (phase09DurationMs != null) phase09DurationValues.push(phase09DurationMs);
        if (classificationDurationMs != null) classificationDurationValues.push(classificationDurationMs);
        if (finalizeDurationMs != null) finalizeDurationValues.push(finalizeDurationMs);
        if (averageBatchDurationMs != null) batchDurationValues.push(averageBatchDurationMs);
      }

      // Extraction des top allergènes
      const rJson = row.result_json as { allergens_ingredients?: { reason: string }[] };
      if (rJson && Array.isArray(rJson.allergens_ingredients)) {
        for (const item of rJson.allergens_ingredients) {
          if (item?.reason) {
            topAllergensMap[item.reason] = (topAllergensMap[item.reason] || 0) + 1;
          }
        }
      }
    }

    // Convert and sort topAllergens
    const topAllergensEnt = Object.entries(topAllergensMap).sort((a, b) => b[1] - a[1]);
    const topAllergens = Object.fromEntries(topAllergensEnt);

    let purchasesQuery = serviceClient.from("user_purchases").select("user_id, credits_added, amount_cents");
    if (startDate) purchasesQuery = purchasesQuery.gte("created_at", startDate);
    if (endDate) purchasesQuery = purchasesQuery.lte("created_at", endDate);
    const { data: purchasesData } = await purchasesQuery;

    let purchasedCreditsInPeriod = 0;
    let revenueAmountCents = 0;
    for (const row of purchasesData || []) {
      purchasedCreditsInPeriod += (row.credits_added || 0);
      revenueAmountCents += (row.amount_cents || 0);
    }

    const initialFreeCreditsInPeriod = (Number(usersInPeriodRes.count) || 0) * baseFreeScans;
    const maximumNonDailyCreditsExposureCount = initialFreeCreditsInPeriod + purchasedCreditsInPeriod;
    const maxTheoreticalCostPerNonDailyScanEur =
      googleOcrCostEurPerRequest + (scanAiCostEurPerRequest * 5 * SCAN_AI_REQUEST_COST_FLOOR_MULTIPLIER);

    const theoreticalCostAmountCents = Math.round((
      totalOcrRequestCount * googleOcrCostEurPerRequest
      + totalGeminiRequestCount * scanAiCostEurPerRequest
    ) * 100);
    const marginAmountCents = revenueAmountCents - theoreticalCostAmountCents;
    const maximumPotentialCostAmountCents = Math.round(
      maximumNonDailyCreditsExposureCount * maxTheoreticalCostPerNonDailyScanEur * 100,
    );
    const maximumPotentialMarginAmountCents = revenueAmountCents - maximumPotentialCostAmountCents;

    // 4. DAU / MAU global (indépendant du filtre temporel pour toujours avoir la santé de l'app)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Pour compter les distinct, on aggrege coté fonction
    const [dauRes, mauRes, allPurchasesRes] = await Promise.all([
      serviceClient.from("scans").select("user_id").gte("created_at", oneDayAgo),
      serviceClient.from("scans").select("user_id").gte("created_at", thirtyDaysAgo),
      serviceClient.from("user_purchases").select("user_id"),
    ]);

    const dauSet = new Set((dauRes.data || []).map(r => r.user_id));
    const mauSet = new Set((mauRes.data || []).map(r => r.user_id));
    const buyersSet = new Set((allPurchasesRes.data || []).map(r => r.user_id));

    const conversionRate = totalUsers > 0 ? (buyersSet.size / totalUsers) * 100 : 0;

    let hitsQuery = serviceClient.from("paywall_hits").select("id", { count: "exact", head: true });
    if (startDate) hitsQuery = hitsQuery.gte("created_at", startDate);
    if (endDate) hitsQuery = hitsQuery.lte("created_at", endDate);
    const hitsRes = await hitsQuery;

    const { count: allTimeScans } = await serviceClient.from("scans").select("id", { count: "exact", head: true });

    const kpi = {
      users: {
        total: totalUsers,
        period: Number(usersInPeriodRes.count) || 0,
        dau: dauSet.size,
        mau: mauSet.size,
      },
      scans: {
        allTimeTotal: Number(allTimeScans) || 0,
        periodTotal: periodTotalScans,
        byStatus,
        freeInPeriod: periodFreeScans,
        paidInPeriod: periodPaidScans,
        theoreticalFreeCeiling: theoreticalFreeScansCeiling,
        topAllergens,
      },
      credits: {
        purchasedInPeriod: purchasedCreditsInPeriod,
        conversionRate,
      },
      finance: {
        scanAiModel,
        assistantAiModel,
        googleOcrCostEurPerRequest,
        scanAiCostEurPerRequest,
        assistantAiCostEurPerRequest,
        assistantCostIncludedInObservedMargin: false,
        revenueAmountCents,
        theoreticalCostAmountCents,
        marginAmountCents,
        initialFreeCreditsInPeriod,
        purchasedCreditsInPeriod,
        maximumNonDailyCreditsExposureCount,
        maximumPotentialCostAmountCents,
        maximumPotentialMarginAmountCents,
      },
      performance: {
        trackedScansInPeriod: totalDurationValues.length,
        minTotalDurationMs: minDuration(totalDurationValues),
        avgTotalDurationMs: averageDuration(totalDurationValues),
        maxTotalDurationMs: maxDuration(totalDurationValues),
        p95TotalDurationMs: percentileDuration(totalDurationValues, 95),
        avgPhase0DurationMs: averageDuration(phase0DurationValues),
        avgPhase05ImagePrepDurationMs: averageDuration(phase05ImagePrepDurationValues),
        avgPhase05DurationMs: averageDuration(phase05DurationValues),
        avgPhase09DurationMs: averageDuration(phase09DurationValues),
        avgClassificationDurationMs: averageDuration(classificationDurationValues),
        avgFinalizeDurationMs: averageDuration(finalizeDurationValues),
        avgBatchDurationMs: averageDuration(batchDurationValues),
      },
      paywall: {
        hitsInPeriod: Number(hitsRes.count) || 0,
      }
    };

    return new Response(JSON.stringify(kpi), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    const status = message.includes("Forbidden") ? 403 : message.includes("token") || message.includes("auth") ? 401 : 500;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status,
    });
  }
});
