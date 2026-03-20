/**
 * YumiScan Analyze - Supabase Edge Function
 *
 * Analyzes product ingredient images for ingredient safety and allergen detection.
 *
 * Pipeline v3:
 * - Phase 0: Gatekeeper + Draft OCR (images → raw_text_draft)
 * - Phase 0.5: Auditor/Corrector (images + draft → certified_raw_text)
 * - Phase 1: CODE Parsing (certified_raw_text → tokens)
 * - Phase 1.5: Translation (tokens → translated items)
 * - Phase 1.7: CODE Allergen Mapping (items → allergens + unmapped)
 * - Phase 2: Classification (unmapped → 3 categories: ok, ambiguous, allergen)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAuthUser, requireScanCredits } from "../_shared/auth.ts";
import {
    DEFAULT_SCAN_BATCH_SIZE,
    DEFAULT_SCAN_AI_MODEL,
    MAX_SCAN_BATCH_SIZE,
    MIN_SCAN_BATCH_SIZE,
    getAppConfigBoolean,
    getAppConfigInteger,
    getAppConfigMap,
    getAppConfigString,
} from "../_shared/app-config.ts";

// Core modules
import { AppError, ErrorCode } from "./errors/mod.ts";
import {
    RequestPayloadSchema,
    IMAGE_CONFIG,
    type Phase2Output,
    type OutputLanguage,
} from "./validation/schemas.ts";
import { hasPromptInjectionFlag } from "./validation/guards.ts";
import { validateAndDecodeImage, compressImageForApi } from "./image/mod.ts";
import { logInfo, logError } from "./logging/mod.ts";

// Pipeline modules
import { callPhase0 } from "./ai/phase0.ts";
import { callPhase05 } from "./ai/phase05.ts";
import { callPhase09 } from "./ai/phase09.ts";
import { extractContainsLine } from "./parsing/tokenizer.ts";
import { tokenizeToTree, flattenTree, IngredientNode, checkParenthesisBalance } from "./parsing/tree_tokenizer.ts";
import { ParsedIngredient, SubIngredient } from "./parsing/sub_ingredient_parser.ts";
import { callPhase15 } from "./ai/phase15.ts";
import { callPhase2 } from "./ai/phase2.ts";
import { matchAllergenBlacklist, type AllergenKeywords } from "./mapping/allergen.ts";

// Product Status Type
export type ProductStatus = "ok" | "ambiguous" | "contains_allergen";



// Type for final response
interface ScanResponse {
    product_status: ProductStatus;
    ok_ingredients: any[];
    ambiguous_ingredients: any[];
    allergens_ingredients: any[];
    ingredient_tree?: ParsedIngredient[];
    meta: {
        detected_language?: string;
        phases_completed: string[];
        is_final: boolean;
        batch_progress: {
            completed_batches: number;
            total_batches: number;
            completed_items: number;
            total_items: number;
        };
    };
}

const VALID_SCAN_CREDIT_TYPES = ["free", "daily", "paid"] as const;
type ScanCreditType = (typeof VALID_SCAN_CREDIT_TYPES)[number];
type BatchProgress = ScanResponse["meta"]["batch_progress"];
type ClassifiedIngredient = {
    id: string;
    order: number;
    raw: string;
    normalized: string;
    status: ProductStatus;
    reason?: string;
};
type BatchProcessingResult = {
    batchIndex: number;
    classifiedItems: ClassifiedIngredient[];
    phase15Items: Array<{ id: string; raw: string; normalized_fr: string }>;
    mappedAllergens: Phase2Output["allergens_ingredients"];
    ambiguousItems: Phase2Output["ambiguous_ingredients"];
    aiAllergens: Phase2Output["allergens_ingredients"];
    phase17Debug: unknown[];
};
type ScanRuntimeConfig = {
    scanDebugEnabled: boolean;
    scanAiModel: string;
    scanBatchSize: number;
};
type ScanPerformanceState = {
    startedAtIso: string;
    startedAtMs: number;
    currentStage: string;
    status: "completed" | "failed";
    failedStage: string | null;
    phase0DurationMs: number | null;
    phase05ImagePrepDurationMs: number | null;
    phase05DurationMs: number | null;
    phase09DurationMs: number | null;
    classificationDurationMs: number | null;
    finalizeDurationMs: number | null;
    totalBatches: number;
    workerCount: number;
    batchDurationsMs: number[];
};

function averageNumberList(values: number[]) {
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildScanPerformancePayload(
    scanAiModel: string,
    scanBatchSize: number,
    state: ScanPerformanceState,
) {
    const completedAtMs = Date.now();

    return {
        version: 1,
        status: state.status,
        scan_ai_model: scanAiModel,
        scan_batch_size: scanBatchSize,
        started_at: state.startedAtIso,
        completed_at: new Date(completedAtMs).toISOString(),
        current_stage: state.currentStage,
        failed_stage: state.failedStage,
        total_duration_ms: completedAtMs - state.startedAtMs,
        phase0_duration_ms: state.phase0DurationMs,
        phase05_image_prep_duration_ms: state.phase05ImagePrepDurationMs,
        phase05_duration_ms: state.phase05DurationMs,
        phase09_duration_ms: state.phase09DurationMs,
        classification_duration_ms: state.classificationDurationMs,
        finalize_duration_ms: state.finalizeDurationMs,
        total_batches: state.totalBatches,
        worker_count: state.workerCount,
        average_batch_duration_ms: averageNumberList(state.batchDurationsMs),
        slowest_batch_duration_ms: state.batchDurationsMs.length > 0
            ? Math.max(...state.batchDurationsMs)
            : null,
    };
}

function storageExtensionFromMimeType(mimeType: string) {
    switch (mimeType) {
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        case "image/jpeg":
        default:
            return "jpg";
    }
}

function isValidScanCreditType(value: string): value is ScanCreditType {
    return (VALID_SCAN_CREDIT_TYPES as readonly string[]).includes(value);
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        batches.push(items.slice(index, index + size));
    }
    return batches;
}

function buildBatchProgress(
    completedBatches: number,
    totalBatches: number,
    completedItems: number,
    totalItems: number,
): BatchProgress {
    return {
        completed_batches: completedBatches,
        total_batches: totalBatches,
        completed_items: completedItems,
        total_items: totalItems,
    };
}

function buildFrontSafeResponse(
    items: ClassifiedIngredient[],
    detectedLanguage: OutputLanguage,
    phasesCompleted: string[],
    batchProgress: BatchProgress,
    ingredientTree?: ParsedIngredient[],
): ScanResponse {
    const sortedItems = [...items].sort((left, right) => left.order - right.order);
    const okIngredients = sortedItems
        .filter((item) => item.status === "ok")
        .map((item) => ({ raw: item.raw, normalized: item.normalized }));
    const ambiguousIngredients = sortedItems
        .filter((item) => item.status === "ambiguous")
        .map((item) => ({ raw: item.raw, normalized: item.normalized, reason: item.reason ?? "" }));
    const allergenIngredients = sortedItems
        .filter((item) => item.status === "contains_allergen")
        .map((item) => ({ raw: item.raw, normalized: item.normalized, reason: item.reason ?? "" }));

    return {
        product_status: computeFinalStatus(allergenIngredients.length, ambiguousIngredients.length),
        ok_ingredients: okIngredients,
        ambiguous_ingredients: ambiguousIngredients,
        allergens_ingredients: allergenIngredients,
        ...(ingredientTree ? { ingredient_tree: ingredientTree } : {}),
        meta: {
            detected_language: detectedLanguage,
            phases_completed: phasesCompleted,
            is_final: !!ingredientTree,
            batch_progress: batchProgress,
        },
    };
}

function classifyIngredientItems(
    translatedItems: Array<{ id: string; order: number; raw: string; normalized_fr: string }>,
    phase2Result: Phase2Output,
): ClassifiedIngredient[] {
    const classifiedByKey = new Map<string, { status: ProductStatus; reason?: string }>();

    for (const item of phase2Result.ambiguous_ingredients) {
        classifiedByKey.set(`${item.raw}::${item.normalized}`, {
            status: "ambiguous",
            reason: item.reason,
        });
    }

    for (const item of phase2Result.allergens_ingredients) {
        classifiedByKey.set(`${item.raw}::${item.normalized}`, {
            status: "contains_allergen",
            reason: item.reason,
        });
    }

    return translatedItems.map((item) => {
        const key = `${item.raw}::${item.normalized_fr}`;
        const classification = classifiedByKey.get(key);
        return {
            id: item.id,
            order: item.order,
            raw: item.raw,
            normalized: item.normalized_fr,
            status: classification?.status ?? "ok",
            reason: classification?.reason,
        };
    });
}

function hydrateTreeNode(
    node: IngredientNode,
    classifiedById: Map<string, ClassifiedIngredient>,
): ParsedIngredient {
    const current = classifiedById.get(node.id);
    const subIngredients = node.children.map((child) => hydrateTreeNode(child, classifiedById));

    let status = current?.status ?? "ok";
    let reason = current?.reason;

    if (subIngredients.length > 0) {
        const hasAllergen = subIngredients.some((child) => child.status === "contains_allergen");
        const hasAmbiguous = subIngredients.some((child) => child.status === "ambiguous");
        if (hasAllergen) {
            status = "contains_allergen";
        } else if (hasAmbiguous) {
            status = "ambiguous";
        } else {
            status = current?.status ?? "ok";
        }
    }

    return {
        id: node.id,
        main_text_jp: current?.raw ?? node.clean_text,
        main_text_fr: current?.normalized ?? node.clean_text,
        status,
        has_sub_ingredients: subIngredients.length > 0,
        sub_ingredients: subIngredients as SubIngredient[],
        is_ambiguous: status === "ambiguous",
        ambiguous_reason: reason,
    };
}

function getDefaultScanAiModel() {
    return Deno.env.get("SCAN_AI_MODEL")?.trim()
        || Deno.env.get("GEMINI_MODEL")?.trim()
        || DEFAULT_SCAN_AI_MODEL;
}

function getDefaultScanBatchSize() {
    const rawValue = Deno.env.get("SCAN_BATCH_SIZE")?.trim() ?? "";
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_SCAN_BATCH_SIZE;
    return Math.min(MAX_SCAN_BATCH_SIZE, Math.max(MIN_SCAN_BATCH_SIZE, parsed));
}

async function getScanRuntimeConfig(): Promise<ScanRuntimeConfig> {
    if (!supabaseAdmin) {
        return {
            scanDebugEnabled: false,
            scanAiModel: getDefaultScanAiModel(),
            scanBatchSize: getDefaultScanBatchSize(),
        };
    }

    try {
        const appConfigMap = await getAppConfigMap(supabaseAdmin, [
            "scan_debug_enabled",
            "scan_ai_model",
            "scan_batch_size",
        ]);

        return {
            scanDebugEnabled: getAppConfigBoolean(appConfigMap, "scan_debug_enabled", false),
            scanAiModel: getAppConfigString(appConfigMap, "scan_ai_model", getDefaultScanAiModel()),
            scanBatchSize: getAppConfigInteger(
                appConfigMap,
                "scan_batch_size",
                getDefaultScanBatchSize(),
                MIN_SCAN_BATCH_SIZE,
                MAX_SCAN_BATCH_SIZE,
            ),
        };
    } catch (error) {
        console.warn("[food-scan-analyze] app_config fallback used:", error instanceof Error ? error.message : String(error));
        return {
            scanDebugEnabled: false,
            scanAiModel: getDefaultScanAiModel(),
            scanBatchSize: getDefaultScanBatchSize(),
        };
    }
}
// =============================================================================
// Environment & Config
// =============================================================================

const GEMINI_KEY = Deno.env.get("GEMINI_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    : null;

// =============================================================================
// CORS
// =============================================================================

function getCorsHeaders(req: Request): HeadersInit {
    const origin = req.headers.get("origin");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
    const allowedOrigins: string[] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        supabaseUrl,
    ];
    let siteUrl = (Deno.env.get("SITE_URL") ?? "").trim();
    if (siteUrl.endsWith("/")) siteUrl = siteUrl.slice(0, -1);
    if (siteUrl && !allowedOrigins.includes(siteUrl)) allowedOrigins.push(siteUrl);
    const extraOrigins = Deno.env.get("ALLOWED_ORIGINS");
    if (extraOrigins) {
        extraOrigins.split(",").map((o) => o.trim()).filter(Boolean).forEach((o) => {
            if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
        });
    }
    const allowOrigin = origin && allowedOrigins.includes(origin)
        ? origin
        : null;

    const headers: Record<string, string> = {
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };

    if (allowOrigin) {
        headers["Access-Control-Allow-Origin"] = allowOrigin;
        headers["Access-Control-Allow-Credentials"] = "true";
    }

    return headers;
}

/**
 * Compute final product status based on ingredient classifications.
 *
 * Allergènes et critères à éviter sont gérés de manière uniforme.
 * Ils informent l'utilisateur sur les ingrédients à éviter (y compris halal),
 * la logique spéciale “halal/haram” n'est plus codée en dur.
 */
function computeFinalStatus(
    allergenCount: number,
    ambiguousCount: number
): ProductStatus {
    if (allergenCount > 0) return "contains_allergen";

    if (ambiguousCount > 0) return "ambiguous";

    // Everything is OK
    return "ok";
}

function getLocalizedAllergenName(
    row: { name: string; name_en?: string | null },
    outputLanguage: OutputLanguage,
): string {
    if (outputLanguage === "en" && row.name_en && row.name_en.trim().length > 0) {
        return row.name_en.trim();
    }

    return row.name;
}

function mergeLocalizedKeywords(
    baseKeywords: string[] | null | undefined,
    localizedKeywords: string[] | null | undefined,
): string[] {
    return Array.from(new Set([...(baseKeywords || []), ...(localizedKeywords || [])].filter(Boolean)));
}

// reclassifyAllergens removed — replaced by deterministic Phase 1.7 mapping

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Validate configuration
        if (!GEMINI_KEY) {
            throw new AppError(ErrorCode.CONFIG_MISSING, "GEMINI_KEY not configured");
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            throw new AppError(ErrorCode.CONFIG_MISSING, "Supabase credentials not configured");
        }

        // Authenticate user and ensure they have scan credits
        const { user, supabase } = await getAuthUser(req);
        await requireScanCredits(supabase, user.id);
        const runtimeConfig = await getScanRuntimeConfig();

        // Parse and validate request body
        const rawBody = await req.json().catch(() => {
            throw new AppError(ErrorCode.INVALID_PAYLOAD, "Invalid JSON body");
        });

        const payloadResult = RequestPayloadSchema.safeParse(rawBody);
        if (!payloadResult.success) {
            throw new AppError(
                ErrorCode.INVALID_PAYLOAD,
                payloadResult.error.errors.map((e: { message: string }) => e.message).join(", ")
            );
        }

        const {
            imageBase64,
            imageProcessedBase64,
            imageStoragePreviewBase64,
            allergenIds,
            language,
        } = payloadResult.data;

        // Image originale (obligatoire) : decode et validation en mémoire
        const validated = validateAndDecodeImage(imageBase64);
        const imageOriginal = validated.buffer;
        const mimeType = validated.mimeType;

        if (imageOriginal.byteLength > IMAGE_CONFIG.MAX_SIZE_BYTES) {
            throw new AppError(ErrorCode.IMAGE_TOO_LARGE);
        }

        // Image processed (optionnelle, envoyée par le front : contraste/netteté pour meilleure lecture des virgules)
        let imageProcessed: ArrayBuffer | null = null;
        let mimeProcessed: string | null = null;
        if (imageProcessedBase64) {
            const validatedProcessed = validateAndDecodeImage(imageProcessedBase64);
            if (validatedProcessed.buffer.byteLength <= IMAGE_CONFIG.MAX_SIZE_BYTES) {
                imageProcessed = validatedProcessed.buffer;
                mimeProcessed = validatedProcessed.mimeType;
            }
        }

        let imageStoragePreview: ArrayBuffer | null = null;
        let mimeStoragePreview: string | null = null;
        if (imageStoragePreviewBase64) {
            const validatedStoragePreview = validateAndDecodeImage(imageStoragePreviewBase64);
            if (validatedStoragePreview.buffer.byteLength <= IMAGE_CONFIG.MAX_SIZE_BYTES) {
                imageStoragePreview = validatedStoragePreview.buffer;
                mimeStoragePreview = validatedStoragePreview.mimeType;
            }
        }

        // Resolve allergen names and keywords from catalog (single query)
        let allergenNames: string[] = [];
        let allergenKeywords: AllergenKeywords[] = [];
        if (allergenIds && allergenIds.length > 0 && supabaseAdmin) {
            const { data: allergenRows, error: allergenError } = await supabaseAdmin
                .from("allergens")
                .select("id, name, name_en, slug, ingredients, ingredients_en")
                .in("id", allergenIds);

            if (allergenError) {
                throw new AppError(ErrorCode.INVALID_ALLERGEN_IDS, allergenError.message);
            }

            const foundIds = new Set((allergenRows || []).map((r: { id: string }) => r.id));
            const missingIds = allergenIds.filter((id: string) => !foundIds.has(id));
            if (missingIds.length > 0) {
                throw new AppError(ErrorCode.INVALID_ALLERGEN_IDS, `Invalid IDs: ${missingIds.join(", ")}`);
            }

            // Tous les allergènes sélectionnés (y compris halal) sont traités uniformément
            allergenNames = (allergenRows || []).map((row: { name: string; name_en?: string | null }) =>
                getLocalizedAllergenName(row, language)
            ).filter(Boolean);
            allergenKeywords = (allergenRows || []).map((row: {
                name: string;
                name_en?: string | null;
                ingredients: string[] | null;
                ingredients_en?: string[] | null;
            }) => ({
                allergenName: getLocalizedAllergenName(row, language),
                ingredients: language === "en"
                    ? mergeLocalizedKeywords(row.ingredients, row.ingredients_en)
                    : (row.ingredients || [])
            }));
        }

        const performanceState: ScanPerformanceState = {
            startedAtIso: new Date().toISOString(),
            startedAtMs: Date.now(),
            currentStage: "phase0",
            status: "completed",
            failedStage: null,
            phase0DurationMs: null,
            phase05ImagePrepDurationMs: null,
            phase05DurationMs: null,
            phase09DurationMs: null,
            classificationDurationMs: null,
            finalizeDurationMs: null,
            totalBatches: 0,
            workerCount: 0,
            batchDurationsMs: [],
        };

        logInfo("Starting pipeline v3 (Cloud Vision + Gemini)", {
            userId: user.id,
            imageSize: imageOriginal.byteLength,
            allergenCount: allergenNames.length,
            scanAiModel: runtimeConfig.scanAiModel,
            scanBatchSize: runtimeConfig.scanBatchSize,
        });

        // =====================================================================
        // PHASE 0: Gatekeeper + Draft OCR (image ORIGINALE pour OCR Vision)
        // =====================================================================
        let phase0;
        const phase0StartedAtMs = Date.now();
        try {
            phase0 = await callPhase0(GEMINI_KEY, runtimeConfig.scanAiModel, imageOriginal, mimeType);
        } catch (e) {
            console.error("Phase 0 failed", e);
            throw new AppError(ErrorCode.GEMINI_API_ERROR, "OCR or validation failed");
        }
        performanceState.phase0DurationMs = Date.now() - phase0StartedAtMs;

        if (hasPromptInjectionFlag(phase0)) {
            throw new AppError(ErrorCode.PROMPT_INJECTION_SUSPECTED);
        }

        if (!phase0.is_valid_product) {
            throw new AppError(ErrorCode.NOT_INGREDIENTS_IMAGE, "Image does not contain an ingredients list");
        }

        if (!phase0.raw_text_draft || phase0.raw_text_draft.trim().length === 0) {
            throw new AppError(ErrorCode.NO_TEXT_IN_IMAGE, "No text detected on image");
        }
        if (phase0.raw_text_draft.length < 10) {
            throw new AppError(ErrorCode.NO_TEXT_IN_IMAGE, "Image does not contain sufficient text");
        }

        logInfo("Phase 0 complete", {
            rawTextLength: phase0.raw_text_draft.length,
            is_valid: phase0.is_valid_product,
            durationMs: performanceState.phase0DurationMs,
        });

        // Phase 0.5 reçoit deux images quand le front envoie une image processed : originale (2000px) + traitée (2000px)
        const PHASE05_MAX_PX = 2000;
        performanceState.currentStage = "phase05_image_prep";
        const phase05ImagePrepStartedAtMs = Date.now();
        const { buffer: imageForPhase05Original, mimeType: mimeForPhase05Original } = await compressImageForApi(
            imageOriginal,
            mimeType,
            PHASE05_MAX_PX
        );
        let imageForPhase05Processed: ArrayBuffer | null = null;
        let mimeForPhase05Processed: string | null = null;
        if (imageProcessed && mimeProcessed) {
            const compressed = await compressImageForApi(imageProcessed, mimeProcessed, PHASE05_MAX_PX);
            imageForPhase05Processed = compressed.buffer;
            mimeForPhase05Processed = compressed.mimeType;
        }
        performanceState.phase05ImagePrepDurationMs = Date.now() - phase05ImagePrepStartedAtMs;

        logInfo("Phase 0.5 images", {
            hasProcessed: !!imageForPhase05Processed,
            durationMs: performanceState.phase05ImagePrepDurationMs,
        });

        // =====================================================================
        // PHASE 0.5: Auditor / Corrector (image originale + image processed si fournie + draft + OCR brut)
        // =====================================================================
        performanceState.currentStage = "phase05";
        const phase05StartedAtMs = Date.now();
        const phase05 = await callPhase05(
            GEMINI_KEY,
            runtimeConfig.scanAiModel,
            imageForPhase05Original,
            imageForPhase05Processed,
            phase0.raw_text_draft,
            mimeForPhase05Original,
            mimeForPhase05Processed ?? undefined,
            phase0.ocr_raw_text ?? undefined
        );
        performanceState.phase05DurationMs = Date.now() - phase05StartedAtMs;

        logInfo("Phase 0.5 complete", {
            certifiedTextLength: phase05.certified_raw_text.length,
            durationMs: performanceState.phase05DurationMs,
        });

        // =====================================================================
        // PHASE 0.9: Structural Repair (Conditional) — Multimodal (image + prompt)
        // =====================================================================

        let certifiedText = phase05.certified_raw_text;
        let phase09Result: { repaired_text: string; was_repaired: boolean } | null = null;

        const isBalanced = checkParenthesisBalance(certifiedText);

        if (!isBalanced) {
            performanceState.currentStage = "phase09";
            logInfo("Unbalanced parentheses detected. Triggering Phase 0.9 (Multimodal)");
            const phase09StartedAtMs = Date.now();

            phase09Result = await callPhase09(
                GEMINI_KEY,
                runtimeConfig.scanAiModel,
                imageForPhase05Original,
                imageForPhase05Processed,
                certifiedText,
                mimeForPhase05Original
            );

            if (phase09Result.was_repaired) {
                certifiedText = phase09Result.repaired_text;
            }
            performanceState.phase09DurationMs = Date.now() - phase09StartedAtMs;

            logInfo("Phase 0.9 complete", {
                was_repaired: phase09Result.was_repaired,
                repaired_text_length: phase09Result.repaired_text.length,
                durationMs: performanceState.phase09DurationMs,
            });
        } else {
            logInfo("Parentheses are balanced. Skipping Phase 0.9");
        }

        // =========================================================================
        // Phase 1: Tokenization (Tree-Based)
        // =========================================================================

        /**
         * Pre-tokenization cleanup: strip nutrition block and OCR line breaks.
         * Applied after Phase 0.5 so Phase 1 receives a single-line, ingredients-only string.
         */
        const cleanForTokenization = (text: string): string => {
            let s = (text || "").trim();
            // Remove nutrition section (栄養成分表示 and everything after)
            s = s.replace(/\n?栄養成分表示[\s\S]*$/g, "").trim();
            // Also catch trailing lines that are clearly nutrition (熱量, 蛋白質, etc.)
            s = s.replace(/\n(熱量|蛋白質|脂質|炭水化物|食塩相当量)[\s\S]*$/g, "").trim();
            // Remove all remaining newlines (OCR artifacts / mid-word breaks)
            s = s.replace(/\n/g, "");
            return s;
        };

        /**
         * Normalize Japanese Punctuation (User Request)
         * - Convert • (interpunct) etc. to 、 (comma)
         * - This is done AFTER visual verification (Phase 0.5) and BEFORE logic (Phase 1)
         */
        const normalizeJapanesePunctuation = (text: string): string => {
            return text.replace(/[・･,，､]/g, "、");
        };

        const normalizedForTokenization = normalizeJapanesePunctuation(cleanForTokenization(certifiedText));

        const phase1 = {
            raw_tokens: [] as string[],
            contains_tokens: [] as string[]
        };

        // Re-implement "Contains" logic on the NORMALIZED text
        const { cleanedText: textForTree, containsTokens } = extractContainsLine(normalizedForTokenization);
        phase1.contains_tokens = containsTokens;

        // Re-tokenize with the text stripped of "Contains..." line
        const treeClean = tokenizeToTree(textForTree);
        const flatCleanNodes = flattenTree(treeClean);
        phase1.raw_tokens = flatCleanNodes.map(n => n.clean_text); // Populate for debug

        logInfo("Phase 1 (Tree Tokenization) complete", {
            rootCount: treeClean.length,
            totalNodes: flatCleanNodes.length
        });

        const phase09Executed = phase09Result !== null;
        const flatNodesWithOrder = flatCleanNodes.map((node, order) => ({ node, order }));
        const totalItems = flatNodesWithOrder.length;
        const totalBatches = Math.max(1, Math.ceil(totalItems / runtimeConfig.scanBatchSize));
        performanceState.totalBatches = totalBatches;
        const basePhasesCompleted = phase09Executed ? ["0", "0.5", "0.9", "1"] : ["0", "0.5", "1"];
        const initialResult = buildFrontSafeResponse(
            [],
            language,
            basePhasesCompleted,
            buildBatchProgress(0, totalBatches, 0, totalItems),
        );

        if (!supabaseAdmin) {
            throw new AppError(ErrorCode.CONFIG_MISSING, "Supabase admin client not configured");
        }

        const { data: scanRow, error: scanInsertError } = await supabaseAdmin
            .from("scans")
            .insert({
                user_id: user.id,
                certified_raw_text: phase05.certified_raw_text,
                product_status: null,
                result_json: initialResult,
                pipeline_version: "v3-progressive",
                selected_allergen_ids: allergenIds || [],
                processing_status: "processing",
                processing_error: null,
                debug_json: null,
            })
            .select("id")
            .single();

        if (scanInsertError || !scanRow?.id) {
            logError("Failed to create processing scan", {
                userId: user.id,
                error: scanInsertError?.message ?? "Missing scan id",
            });
            throw new AppError(
                ErrorCode.INTERNAL_ERROR,
                `Failed to create processing scan: ${scanInsertError?.message ?? "Missing scan id"}`,
            );
        }

        const scanId = scanRow.id as string;

        const markScanFailed = async (message: string) => {
            performanceState.status = "failed";
            performanceState.failedStage = performanceState.currentStage;
            const performancePayload = buildScanPerformancePayload(
                runtimeConfig.scanAiModel,
                runtimeConfig.scanBatchSize,
                performanceState,
            );

            await supabaseAdmin
                .from("scans")
                .update({
                    processing_status: "failed",
                    processing_error: message,
                    performance_json: performancePayload,
                })
                .eq("id", scanId);
        };

        const processScanInBackground = async () => {
            try {
                const debugEnabled = runtimeConfig.scanDebugEnabled;
                const batches = chunkArray(flatNodesWithOrder, runtimeConfig.scanBatchSize);
                performanceState.currentStage = "classification";
                const classifiedById = new Map<string, ClassifiedIngredient>();
                const phase15ItemsDebug: Array<{ raw: string; normalized_fr: string }> = [];
                const mappedAllergensDebug: Phase2Output["allergens_ingredients"] = [];
                const ambiguousItemsDebug: Phase2Output["ambiguous_ingredients"] = [];
                const aiAllergensDebug: Phase2Output["allergens_ingredients"] = [];
                const phase17DebugRecords: unknown[] = [];
                let completedBatches = 0;
                let completedItems = 0;
                let persistChain = Promise.resolve();
                const classificationStartedAtMs = Date.now();

                const queuePartialPersist = (nextResult: ScanResponse) => {
                    persistChain = persistChain.then(async () => {
                        const { error: updateError } = await supabaseAdmin
                            .from("scans")
                            .update({
                                result_json: nextResult,
                                processing_status: "processing",
                                processing_error: null,
                            })
                            .eq("id", scanId);

                        if (updateError) {
                            throw updateError;
                        }
                    });

                    return persistChain;
                };

                const processBatch = async (
                    batchEntries: Array<{ node: IngredientNode; order: number }>,
                    batchIndex: number,
                ): Promise<BatchProcessingResult> => {
                    const batchStartedAtMs = Date.now();

                    try {
                        const translationResult = await callPhase15(
                            GEMINI_KEY,
                            runtimeConfig.scanAiModel,
                            batchEntries.map((entry) => entry.node.clean_text),
                            language,
                        );

                        const translatedItems = batchEntries.map((entry, index) => ({
                            id: entry.node.id,
                            order: entry.order,
                            raw: entry.node.clean_text,
                            normalized_fr: translationResult.items[index]?.normalized_fr || entry.node.clean_text,
                        }));

                        const {
                            allergens_ingredients: mappedAllergens,
                            unmapped,
                            debug_info: phase17Debug,
                        } = matchAllergenBlacklist(translatedItems, allergenKeywords, {
                            reasonPrefix: language === "en" ? "Family" : "Famille",
                        });

                        let phase2Result: Phase2Output = {
                            ok_ingredients: [],
                            not_ok_ingredients: [],
                            ambiguous_ingredients: [],
                            allergens_ingredients: [],
                        };

                        if (unmapped.length > 0 && allergenNames.length > 0) {
                            phase2Result = await callPhase2(
                                GEMINI_KEY,
                                runtimeConfig.scanAiModel,
                                unmapped.map((item) => ({
                                    raw: item.raw,
                                    normalized_fr: item.normalized_fr,
                                })),
                                allergenKeywords,
                                language,
                            );
                        } else if (unmapped.length > 0) {
                            phase2Result.ok_ingredients = unmapped.map((item) => ({
                                raw: item.raw,
                                normalized: item.normalized_fr,
                            }));
                        }

                        phase2Result.allergens_ingredients.push(...mappedAllergens);

                        return {
                            batchIndex,
                            classifiedItems: classifyIngredientItems(translatedItems, phase2Result),
                            phase15Items: translatedItems.map((item) => ({
                                id: item.id,
                                raw: item.raw,
                                normalized_fr: item.normalized_fr,
                            })),
                            mappedAllergens,
                            ambiguousItems: phase2Result.ambiguous_ingredients,
                            aiAllergens: phase2Result.allergens_ingredients.filter(
                                (item) =>
                                    !mappedAllergens.some(
                                        (mapped) =>
                                            mapped.raw === item.raw &&
                                            mapped.normalized === item.normalized &&
                                            mapped.reason === item.reason,
                                    ),
                            ),
                            phase17Debug,
                        };
                    } finally {
                        performanceState.batchDurationsMs.push(Date.now() - batchStartedAtMs);
                    }
                };

                let nextBatchIndex = 0;
                const workerCount = Math.min(2, Math.max(1, batches.length));
                performanceState.workerCount = workerCount;

                const workers = Array.from({ length: workerCount }, async () => {
                    while (true) {
                        const currentBatchIndex = nextBatchIndex;
                        nextBatchIndex += 1;

                        if (currentBatchIndex >= batches.length) {
                            return;
                        }

                        const batchResult = await processBatch(batches[currentBatchIndex], currentBatchIndex);

                        for (const item of batchResult.classifiedItems) {
                            classifiedById.set(item.id, item);
                        }

                        phase15ItemsDebug.push(
                            ...batchResult.phase15Items.map((item) => ({
                                raw: item.raw,
                                normalized_fr: item.normalized_fr,
                            })),
                        );
                        mappedAllergensDebug.push(...batchResult.mappedAllergens);
                        ambiguousItemsDebug.push(...batchResult.ambiguousItems);
                        aiAllergensDebug.push(...batchResult.aiAllergens);
                        phase17DebugRecords.push(...batchResult.phase17Debug);

                        completedBatches += 1;
                        completedItems += batches[currentBatchIndex].length;

                        const partialResult = buildFrontSafeResponse(
                            Array.from(classifiedById.values()),
                            language,
                            [...basePhasesCompleted, "1.5", "1.7", "2"],
                            buildBatchProgress(completedBatches, totalBatches, completedItems, totalItems),
                        );

                        await queuePartialPersist(partialResult);
                    }
                });

                await Promise.all(workers);
                await persistChain;
                performanceState.classificationDurationMs = Date.now() - classificationStartedAtMs;

                const reconstructedTree = treeClean.map((node) => hydrateTreeNode(node, classifiedById));

                logInfo("Phase 7 (Tree Reconstruction) complete", {
                    reconstructedRoots: reconstructedTree.length,
                    scanId,
                    durationMs: performanceState.classificationDurationMs,
                });

                const finalResult = buildFrontSafeResponse(
                    Array.from(classifiedById.values()),
                    language,
                    [...basePhasesCompleted, "1.5", "1.7", "2", "7"],
                    buildBatchProgress(totalBatches, totalBatches, totalItems, totalItems),
                    reconstructedTree,
                );

                const finalProductStatus = finalResult.product_status;
                const ocrRequestCount = 1;
                const geminiRequestCount = phase09Executed ? 5 : 4;
                const debugPayload = debugEnabled
                    ? {
                        phase0: {
                            raw_text_draft: phase0.raw_text_draft,
                            is_valid: phase0.is_valid_product,
                            ocr_raw_from_vision: phase0.ocr_raw_text,
                        },
                        allergen_context: {
                            selected_ids: allergenIds || [],
                            resolved_names: allergenNames || [],
                        },
                        phase05: {
                            certified_raw_text: phase05.certified_raw_text,
                        },
                        phase09: phase09Result
                            ? {
                                was_triggered: true,
                                was_repaired: phase09Result.was_repaired,
                                repaired_text: phase09Result.repaired_text,
                                diff_len: phase09Result.repaired_text.length - phase05.certified_raw_text.length,
                            }
                            : { was_triggered: false },
                        phase1: {
                            pre_tokenization_normalized: normalizedForTokenization,
                            tree_roots: treeClean.map((node) => ({
                                id: node.id,
                                clean_text: node.clean_text,
                                raw: node.raw,
                                has_children: node.children.length > 0,
                            })),
                        },
                        phase1_flattened: {
                            count: flatCleanNodes.length,
                            nodes: flatCleanNodes.map((node) => node.clean_text),
                        },
                        phase1_5: {
                            translated_count: phase15ItemsDebug.length,
                            samples: phase15ItemsDebug.slice(0, 5),
                        },
                        phase1_7: {
                            allergen_count: mappedAllergensDebug.length,
                            allergens: mappedAllergensDebug,
                            debug: phase17DebugRecords,
                        },
                        phase2: {
                            ambiguous: ambiguousItemsDebug,
                            allergens: [...mappedAllergensDebug, ...aiAllergensDebug],
                        },
                        phase7: {
                            tree_roots: reconstructedTree.length,
                            leaves_processed: flatCleanNodes.length,
                            ingredient_tree: reconstructedTree,
                        },
                    }
                    : null;

                performanceState.currentStage = "finalize";
                const finalizeStartedAtMs = Date.now();
                const { data: finalizedScan, error: finalizeError } = await supabaseAdmin.rpc(
                    "consume_scan_credit_and_finalize_scan",
                    {
                        p_scan_id: scanId,
                        p_user_id: user.id,
                        p_product_status: finalProductStatus,
                        p_result_json: finalResult,
                        p_debug_json: debugPayload ?? undefined,
                        p_certified_raw_text: phase05.certified_raw_text,
                        p_pipeline_version: "v3-progressive",
                        p_selected_allergen_ids: allergenIds || [],
                        p_ocr_request_count: ocrRequestCount,
                        p_gemini_request_count: geminiRequestCount,
                        p_phase09_executed: phase09Executed,
                    },
                );
                performanceState.finalizeDurationMs = Date.now() - finalizeStartedAtMs;

                const finalizedRow = Array.isArray(finalizedScan) ? finalizedScan[0] : finalizedScan;
                const creditType = finalizedRow?.credit_consumed_type;

                if (finalizeError || !creditType) {
                    logError("Failed to finalize scan transactionally", {
                        userId: user.id,
                        scanId,
                        error: finalizeError?.message ?? "Missing credit_consumed_type",
                    });
                    await markScanFailed(
                        finalizeError?.message ?? "Le scan n'a pas pu etre finalise correctement.",
                    );
                    return;
                }

                if (!isValidScanCreditType(creditType)) {
                    logError("Invalid scan credit type produced by progressive finalize RPC", {
                        userId: user.id,
                        scanId,
                        creditType,
                    });
                    await markScanFailed(`Invalid credit type: ${creditType}`);
                    return;
                }

                logInfo("Scan credit consumed", {
                    userId: user.id,
                    scanId,
                    creditType,
                    ocrRequestCount,
                    geminiRequestCount,
                    phase09Executed,
                    scanAiModel: runtimeConfig.scanAiModel,
                    scanBatchSize: runtimeConfig.scanBatchSize,
                    totalDurationMs: Date.now() - performanceState.startedAtMs,
                });

                performanceState.currentStage = "completed";
                const performancePayload = buildScanPerformancePayload(
                    runtimeConfig.scanAiModel,
                    runtimeConfig.scanBatchSize,
                    performanceState,
                );
                const { error: performanceError } = await supabaseAdmin
                    .from("scans")
                    .update({ performance_json: performancePayload })
                    .eq("id", scanId);

                if (performanceError) {
                    logError("Failed to persist scan performance metrics", {
                        userId: user.id,
                        scanId,
                        error: performanceError.message,
                    });
                }

                try {
                    const imageBufferForStorage = imageStoragePreview ?? imageForPhase05Original;
                    const contentType = mimeStoragePreview ?? mimeForPhase05Original;
                    const imageBytes = new Uint8Array(imageBufferForStorage);
                    const extension = storageExtensionFromMimeType(contentType);
                    const imageFileName = `${user.id}/${crypto.randomUUID()}.${extension}`;

                    const { error: uploadError } = await supabaseAdmin.storage
                        .from("scan-images")
                        .upload(imageFileName, imageBytes, {
                            contentType,
                            upsert: false,
                        });

                    if (uploadError) {
                        logError("Storage upload failed", {
                            userId: user.id,
                            scanId,
                            error: uploadError.message,
                        });
                    } else {
                        const { error: updateScanError } = await supabaseAdmin
                            .from("scans")
                            .update({ image_storage_path: imageFileName })
                            .eq("id", scanId);

                        if (updateScanError) {
                            logError("Failed to update scan image path", {
                                userId: user.id,
                                scanId,
                                error: updateScanError.message,
                            });
                        }
                    }
                } catch (storageError) {
                    logError("Storage upload exception", {
                        userId: user.id,
                        scanId,
                        error: String(storageError),
                    });
                }
            } catch (backgroundError) {
                const appError = AppError.from(backgroundError);
                logError("Progressive scan processing failed", {
                    userId: user.id,
                    scanId,
                    code: appError.code,
                    message: appError.internalMessage,
                });
                await markScanFailed(appError.message);
            }
        };

        const processPromise = processScanInBackground();
        const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;

        if (edgeRuntime?.waitUntil) {
            edgeRuntime.waitUntil(processPromise);
        } else {
            void processPromise;
        }

        return new Response(JSON.stringify({ scan_id: scanId }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        const appError = AppError.from(error);
        logError("Request failed", {
            code: appError.code,
            message: appError.internalMessage
        });
        return appError.toResponse(corsHeaders);
    }
});
