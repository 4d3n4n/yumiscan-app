/**
 * Phase 1.7: Allergen blacklist mapping (CODE).
 * Deterministic pre-classification of allergen ingredients before AI Phase 2.
 *
 * Same pattern as haram blacklist (Phase 1.6):
 * - JP terms: includes() matching
 * - Latin terms: word boundary regex matching
 * - Cross-check: JP partial match → verify FR translation confirms
 */

export interface TranslatedItem {
    id?: string;
    raw: string;
    normalized_fr: string;
}

export interface AllergenKeywords {
    allergenName: string;
    ingredients: string[]; // keywords from DB
}

export interface AllergenMappingResult {
    allergens_ingredients: Array<{ raw: string; normalized: string; reason: string }>;
    unmapped: TranslatedItem[];
    debug_info: Array<{
        raw: string;
        matched_term: string;
        allergen_family: string;
    }>;
}

// ============================================================================
// Character detection helpers
// ============================================================================

function isJapaneseChar(char: string): boolean {
    const code = char.charCodeAt(0);
    return (
        (code >= 0x3040 && code <= 0x309F) || // Hiragana
        (code >= 0x30A0 && code <= 0x30FF) || // Katakana
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4DBF)    // CJK Extension A
    );
}

function isJapaneseTerm(text: string): boolean {
    if (text.length === 0) return false;
    const japaneseChars = [...text].filter(isJapaneseChar).length;
    return japaneseChars > text.length / 2;
}

/**
 * Word boundary match for Latin terms.
 * "soja" matches "sauce soja", "de soja", but NOT "sojamilk" (hypothetical).
 */
function matchesWholeWord(text: string, term: string): boolean {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    return regex.test(text);
}

// ============================================================================
// Core matching
// ============================================================================

/**
 * Build pre-computed lookup structures from allergen keywords.
 * Splits each allergen's keywords into JP vs Latin for appropriate matching.
 *
 * This is called ONCE at pipeline start, not per-ingredient.
 */
export function buildAllergenLookup(allergenKeywords: AllergenKeywords[]): {
    jpTerms: Array<{ term: string; allergenName: string }>;
    latinTerms: Array<{ term: string; allergenName: string }>;
} {
    const jpTerms: Array<{ term: string; allergenName: string }> = [];
    const latinTerms: Array<{ term: string; allergenName: string }> = [];

    for (const allergen of allergenKeywords) {
        for (const keyword of allergen.ingredients) {
            const lower = keyword.toLowerCase();
            if (isJapaneseTerm(keyword)) {
                jpTerms.push({ term: lower, allergenName: allergen.allergenName });
            } else {
                latinTerms.push({ term: lower, allergenName: allergen.allergenName });
            }
        }
    }

    // Sort by term length DESC → longer/more specific terms match first
    jpTerms.sort((a, b) => b.term.length - a.term.length);
    latinTerms.sort((a, b) => b.term.length - a.term.length);

    return { jpTerms, latinTerms };
}

/**
 * Check if an ingredient matches any allergen keyword.
 * Returns the matched allergen family name and the matched keyword, or null.
 *
 * Logic (same as haram blacklist):
 * 1. Check JP raw text with includes()
 *    - Exact match (keyword === raw) → confirmed
 *    - Partial match (keyword is substring) → cross-check with FR translation
 * 2. Check FR translation with word boundary regex
 */
function findAllergenMatch(
    raw: string,
    normalizedFr: string,
    jpTerms: Array<{ term: string; allergenName: string }>,
    latinTerms: Array<{ term: string; allergenName: string }>
): { allergenName: string; matchedTerm: string } | null {
    const lowerRaw = raw.toLowerCase();
    const lowerFr = normalizedFr.toLowerCase();

    // Check 1: JP terms in raw text
    for (const { term, allergenName } of jpTerms) {
        if (lowerRaw.includes(term)) {
            const isExactMatch = term === lowerRaw;

            if (isExactMatch) {
                // Exact match → confirmed
                return { allergenName, matchedTerm: term };
            }

            // Partial/substring match → cross-check with FR
            // Look for any Latin term from the SAME allergen family in the FR text
            const frConfirmed = latinTerms.some(
                lt => lt.allergenName === allergenName && matchesWholeWord(lowerFr, lt.term)
            );

            if (frConfirmed) {
                return { allergenName, matchedTerm: term };
            }
            // else: JP partial match without FR confirmation → skip (avoid false positives)
        }
    }

    // Check 2: Latin terms in FR translation
    for (const { term, allergenName } of latinTerms) {
        if (matchesWholeWord(lowerFr, term)) {
            return { allergenName, matchedTerm: term };
        }
    }

    return null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Match ingredients against allergen keywords from the database.
 *
 * Deterministic CODE operation (no AI).
 *
 * @param items - Translated items (unmapped after haram check)
 * @param allergenKeywords - User's selected allergen families with their keywords
 * @returns Separated allergens and remaining unmapped items
 */
export function matchAllergenBlacklist(
    items: TranslatedItem[],
    allergenKeywords: AllergenKeywords[],
    options: { reasonPrefix?: string } = {}
): AllergenMappingResult {
    // If no allergens selected, everything stays unmapped
    if (allergenKeywords.length === 0) {
        return {
            allergens_ingredients: [],
            unmapped: items,
            debug_info: []
        };
    }

    // Build lookup once
    const { jpTerms, latinTerms } = buildAllergenLookup(allergenKeywords);
    const reasonPrefix = options.reasonPrefix ?? "Famille";

    const allergens_ingredients: Array<{ raw: string; normalized: string; reason: string }> = [];
    const unmapped: TranslatedItem[] = [];
    const debug_info: Array<{ raw: string; matched_term: string; allergen_family: string }> = [];

    for (const item of items) {
        const match = findAllergenMatch(item.raw, item.normalized_fr, jpTerms, latinTerms);

        if (match) {
            allergens_ingredients.push({
                raw: item.raw,
                normalized: item.normalized_fr,
                reason: `${reasonPrefix}: ${match.allergenName}`
            });
            debug_info.push({
                raw: item.raw,
                matched_term: match.matchedTerm,
                allergen_family: match.allergenName
            });
        } else {
            unmapped.push(item);
        }
    }

    return { allergens_ingredients, unmapped, debug_info };
}
