// @ts-ignore Deno runtime resolves remote modules directly in Edge Functions.
import { z } from "https://esm.sh/zod@3.22.4";

// =============================================================================
// Config Constants
// =============================================================================

export const IMAGE_CONFIG = {
    MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
    MAX_DIMENSION_PX: 1080,
    ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
    BLUR_THRESHOLD: 100, // Laplacian variance threshold (lower = blurry)
    JPEG_QUALITY: 0.8,
} as const;

export const AI_CONFIG = {
    TIMEOUT_MS: 60_000, // 60 seconds
    MAX_RETRIES: 2,
} as const;

export const OutputLanguageSchema = z.enum(["fr", "en"]);

export type OutputLanguage = z.infer<typeof OutputLanguageSchema>;

// =============================================================================
// Payload Schemas
// =============================================================================

/**
 * Request payload schema for food-scan-analyze.
 * Image is sent directly as base64 (no storage/bucket); processed in memory only.
 */
export const RequestPayloadSchema = z.object({
    imageBase64: z.string().min(1, "imageBase64 is required"),
    imageProcessedBase64: z.string().min(1).optional(),
    imageStoragePreviewBase64: z.string().min(1).optional(),
    language: OutputLanguageSchema.default("fr"),
    filters: z.object({
        noCrustaceans: z.boolean().optional(),
        noGluten: z.boolean().optional(),
        vegan: z.boolean().optional(),
    }).optional(),
    allergenIds: z.array(z.string().uuid()).optional(),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

/**
 * Scan filters type.
 */
export const ScanFiltersSchema = z.object({
    noCrustaceans: z.boolean().optional().default(false),
    noGluten: z.boolean().optional().default(false),
    vegan: z.boolean().optional().default(false),
});

export type ScanFilters = z.infer<typeof ScanFiltersSchema>;

// =============================================================================
// Phase 0 - Gatekeeper & Draft OCR
// =============================================================================

export const Phase0OutputSchema = z.object({
    is_valid_product: z.boolean(),
    raw_text_draft: z.string(),
    notes: z.array(z.string()).optional().default([]),
    ocr_raw_text: z.string().optional(), // Added for debug visibility
});

export type Phase0Output = z.infer<typeof Phase0OutputSchema>;

// =============================================================================
// Phase 0.5 - Auditor / Corrector
// =============================================================================

export const Phase05OutputSchema = z.object({
    certified_raw_text: z.string(),
});

export type Phase05Output = z.infer<typeof Phase05OutputSchema>;

// =============================================================================
// Phase 1 - CODE Parsing (no schema, just types)
// =============================================================================

export interface Phase1Output {
    raw_tokens: string[];
    contains_tokens: string[];
}

// =============================================================================
// Phase 1.5 - Translation
// =============================================================================

export const TranslatedItemSchema = z.object({
    raw: z.string(),
    normalized_fr: z.string(),
});

export type TranslatedItem = z.infer<typeof TranslatedItemSchema>;

export const Phase15OutputSchema = z.object({
    items: z.array(TranslatedItemSchema),
});

export type Phase15Output = z.infer<typeof Phase15OutputSchema>;

// =============================================================================
// Phase 1.7 - CODE Allergen Mapping (no schema, just types)
// =============================================================================

export interface Phase17Output {
    allergen_ingredients: TranslatedItem[];
    unmapped: TranslatedItem[];
}

// =============================================================================
// Phase 2 - Classification
// =============================================================================

/**
 * Ingredient pair (raw + normalized).
 */
export const IngredientPairSchema = z.object({
    raw: z.string(),
    normalized: z.string(),
});

export type IngredientPair = z.infer<typeof IngredientPairSchema>;

/**
 * Ingredient with reason (for allergens/ambiguous).
 */
export const IngredientWithReasonSchema = IngredientPairSchema.extend({
    reason: z.string(),
});

export type IngredientWithReason = z.infer<typeof IngredientWithReasonSchema>;

/**
 * Phase 2 AI output schema - classification of unmapped ingredients.
 */
export const Phase2OutputSchema = z.object({
    ok_ingredients: z.array(IngredientPairSchema),
    not_ok_ingredients: z.array(IngredientPairSchema).default([]),
    ambiguous_ingredients: z.array(IngredientWithReasonSchema),
    allergens_ingredients: z.array(IngredientWithReasonSchema),
});

export type Phase2Output = z.infer<typeof Phase2OutputSchema>;

// =============================================================================
// Final Result Types
// =============================================================================

/**
 * Product status for the API response.
 */
export const ProductStatusSchema = z.enum([
    "ok",
    "ambiguous",
    "contains_allergen",
]);

export type ProductStatus = z.infer<typeof ProductStatusSchema>;

/**
 * Final API response schema.
 */
export const FoodScanResponseSchema = z.object({
    product_status: ProductStatusSchema,
    ok_ingredients: z.array(IngredientPairSchema),
    ambiguous_ingredients: z.array(IngredientWithReasonSchema),
    allergens_ingredients: z.array(IngredientWithReasonSchema),
    ingredient_tree: z.array(z.any()).optional(),
    meta: z.object({
        detected_language: z.string().optional(),
        phases_completed: z.array(z.string()).optional(),
        is_final: z.boolean().optional(),
        batch_progress: z.object({
            completed_batches: z.number(),
            total_batches: z.number(),
            completed_items: z.number(),
            total_items: z.number(),
        }).optional(),
    }).optional(),
});

export type FoodScanResponse = z.infer<typeof FoodScanResponseSchema>;

// =============================================================================
// Error Schemas
// =============================================================================

export const ErrorResponseSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// =============================================================================
// Legacy Types (for backward compatibility)
// =============================================================================

export const FinalIngredientSchema = z.object({
    raw: z.string(),
    normalized: z.string(),
    status: z.enum(["OK", "NON_OK", "AMBIGU", "ALLERGEN"]),
    reason: z.string(),
});

export type FinalIngredient = z.infer<typeof FinalIngredientSchema>;
