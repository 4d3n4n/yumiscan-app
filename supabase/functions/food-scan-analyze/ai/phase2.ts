/**
 * Phase 2: Classification
 *
 * Classifies unmapped ingredients into 3 categories:
 * - ok_ingredients
 * - ambiguous_ingredients
 * - allergens_ingredients (based on user-selected criteria)
 */

import { AppError, ErrorCode } from "../errors/mod.ts";
import { Phase2OutputSchema, type Phase2Output, type TranslatedItem, AI_CONFIG, type OutputLanguage } from "../validation/schemas.ts";
import type { AllergenKeywords } from "../mapping/allergen.ts";
import { sanitizePhase2Output } from "../classification/phase2_sanitizer.ts";
import { buildPhase2Prompt } from "./prompts.ts";

/**
 * Extract JSON from Gemini response text.
 */
function extractJsonFromResponse(raw: string): string {
    let s = (raw || "").trim();

    const jsonBlockPattern = /```(?:json)?\s*([\s\S]*?)```/;
    const jsonBlock = jsonBlockPattern.exec(s);
    if (jsonBlock) {
        s = (jsonBlock[1] || "").trim();
    }

    const firstBrace = s.indexOf("{");
    if (firstBrace >= 0) {
        let depth = 0;
        let end = -1;
        for (let i = firstBrace; i < s.length; i++) {
            const ch = s[i];
            if (ch === "{") depth++;
            else if (ch === "}") {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end >= 0) {
            s = s.slice(firstBrace, end + 1);
        }
    }

    return s;
}

/**
 * Build fallback output when AI fails.
 * Puts all unmapped ingredients in ok_ingredients as safe default.
 */
function buildFallbackOutput(unmapped: TranslatedItem[]): Phase2Output {
    return {
        ok_ingredients: unmapped.map(item => ({ raw: item.raw, normalized: item.normalized_fr })),
        not_ok_ingredients: [],
        ambiguous_ingredients: [],
        allergens_ingredients: [],
    };
}

/**
 * Call Gemini API for Phase 2: Classification.
 *
 * @param geminiKey - Gemini API key
 * @param unmapped - Unmapped ingredients from deterministic allergen mapping
 * @param allergenBlacklist - User's allergen/criteria blacklist (names)
 * @returns Phase 2 output with classified ingredients
 */
export async function callPhase2(
    geminiKey: string,
    modelName: string,
    unmapped: TranslatedItem[],
    allergenKeywords: AllergenKeywords[],
    outputLanguage: OutputLanguage,
): Promise<Phase2Output> {
    // If nothing to classify, return empty result
    if (unmapped.length === 0) {
        return {
            ok_ingredients: [],
            not_ok_ingredients: [],
            ambiguous_ingredients: [],
            allergens_ingredients: [],
        };
    }

    // No selected criterion means the scan must stay neutral:
    // we do not surface ambiguous or blocking statuses without an active profile.
    if (allergenKeywords.length === 0) {
        return buildFallbackOutput(unmapped);
    }

    const allergenBlacklist = allergenKeywords.map((item) => item.allergenName);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

    const prompt = buildPhase2Prompt(unmapped, allergenBlacklist, outputLanguage);

    // Setup timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.2,
                },
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errMsg = data?.error?.message ?? data?.message ?? JSON.stringify(data);
            console.error("[Phase2] Gemini API error:", response.status, errMsg);
            throw new AppError(ErrorCode.GEMINI_API_ERROR, `Gemini API ${response.status}: ${errMsg}`);
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
            console.warn("[Phase2] No text in response, using fallback");
            return buildFallbackOutput(unmapped);
        }

        // Parse JSON
        const jsonStr = extractJsonFromResponse(rawText);
        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            console.warn("[Phase2] Failed to parse JSON, using fallback");
            return buildFallbackOutput(unmapped);
        }

        // Validate schema
        const result = Phase2OutputSchema.safeParse(parsed);
        if (!result.success) {
            console.warn("[Phase2] Schema validation failed, using fallback:", result.error.errors);
            return buildFallbackOutput(unmapped);
        }

        // L'IA ne doit plus produire de not_ok_ingredients pour halal/haram.
        // On force le tableau à rester vide et on utilise uniquement
        // ok_ingredients / ambiguous_ingredients / allergens_ingredients.
        const output = sanitizePhase2Output(
            unmapped,
            result.data,
            allergenKeywords,
            outputLanguage,
        );
        output.not_ok_ingredients = [];
        return output;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new AppError(ErrorCode.AI_TIMEOUT, "Phase 2 classification timed out");
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
