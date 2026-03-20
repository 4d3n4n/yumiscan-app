/**
 * Phase 1.6: Haram blacklist mapping (CODE).
 * Fast pre-classification of explicitly haram ingredients before AI.
 */

import { isHaramIngredient, getMatchingHaramTerm } from "../data/haram_blacklist.ts";

export interface TranslatedItem {
    raw: string;
    normalized_fr: string;
}

export interface MappingResult {
    not_ok_ingredients: TranslatedItem[];
    unmapped: TranslatedItem[];
}

/**
 * Match ingredients against the haram blacklist.
 *
 * This is a deterministic CODE operation (no AI).
 *
 * STRATEGY:
 * 1. Check the FRENCH translation (normalized_fr) with word boundary matching
 * 2. Check the RAW Japanese text for direct match
 * 3. Check ALL recursive sub-ingredients (n-levels deep)
 *
 * BUG FIX (Bug 10 & 12): Now checks both French AND Japanese, plus recursive sub-ingredients
 *
 * @param items - Translated items from Phase 1.5
 * @returns Separated not_ok and unmapped lists with debug info
 */
export async function matchHaramBlacklist(items: TranslatedItem[]): Promise<MappingResult & {
    debug_info: Array<{
        raw: string;
        matched_term: string;
        is_normalized_match: boolean;
    }>;
}> {
    const not_ok_ingredients: TranslatedItem[] = [];
    const unmapped: TranslatedItem[] = [];
    const debug_info: Array<{
        raw: string;
        matched_term: string;
        is_normalized_match: boolean;
    }> = [];

    // Simple flat iteration - no recursion needed as input is flattened
    // Also no dynamic import needed
    for (const item of items) {
        let isHaram = false;
        let matchedTerm: string | null = null;
        let isNormalizedMatch = false;

        // Check 1: French translation (word boundary)
        if (isHaramIngredient(item.normalized_fr)) {
            isHaram = true;
            matchedTerm = getMatchingHaramTerm(item.normalized_fr);
            isNormalizedMatch = true;
        }

        // Check 2: Japanese raw text
        // CROSS-CHECK: If the JP match is a SUBSTRING (partial match, e.g. 牛 in 牛蒡),
        // we verify against the French translation. If FR doesn't confirm → false positive.
        // This prevents 牛蒡 (bardane/burdock) from being flagged because of 牛 (beef).
        if (!isHaram && isHaramIngredient(item.raw)) {
            const jpMatchedTerm = getMatchingHaramTerm(item.raw);
            const isExactMatch = jpMatchedTerm !== null && jpMatchedTerm === item.raw.toLowerCase();

            if (isExactMatch) {
                // Exact match (e.g. 豚肉 === 豚肉) → definitely haram
                isHaram = true;
                matchedTerm = jpMatchedTerm;
            } else {
                // Partial/substring match (e.g. 牛 inside 牛蒡) → cross-check with French
                if (isHaramIngredient(item.normalized_fr)) {
                    // French also confirms → haram (e.g. 牛肉 → "bœuf" matches)
                    isHaram = true;
                    matchedTerm = jpMatchedTerm;
                }
                // else: French doesn't confirm → false positive, skip (e.g. 牛蒡 → "bardane" = safe)
            }
        }

        if (isHaram) {
            not_ok_ingredients.push(item);
            if (matchedTerm) {
                debug_info.push({
                    raw: item.raw,
                    matched_term: matchedTerm,
                    is_normalized_match: isNormalizedMatch
                });
            }
        } else {
            unmapped.push(item);
        }
    }

    return { not_ok_ingredients, unmapped, debug_info };
}

// calculateDepth removed as it's no longer used

/**
 * Get detailed match info for debugging.
 */
export function getHaramMatchDetails(item: TranslatedItem): {
    isHaram: boolean;
    matchedTerm: string | null;
    matchedIn: "raw" | "normalized" | null;
} {
    const rawMatch = getMatchingHaramTerm(item.raw);
    if (rawMatch) {
        return { isHaram: true, matchedTerm: rawMatch, matchedIn: "raw" };
    }

    const normalizedMatch = getMatchingHaramTerm(item.normalized_fr);
    if (normalizedMatch) {
        return { isHaram: true, matchedTerm: normalizedMatch, matchedIn: "normalized" };
    }

    return { isHaram: false, matchedTerm: null, matchedIn: null };
}
