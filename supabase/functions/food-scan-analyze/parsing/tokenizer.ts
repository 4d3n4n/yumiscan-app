/**
 * Deterministic tokenizer for Japanese ingredient lists.
 * Phase 1 (CODE) - No AI involved.
 *
 * Handles:
 * - Japanese punctuation (、・／)
 * - Parentheses grouping (maintaining depth)
 * - "Contains" allergen extraction (〜を含む)
 */

// ============================================================================
// CONTAINS LINE EXTRACTION
// ============================================================================

/**
 * Extract the "contains allergens" tokens from (一部に...を含む) for allergen detection.
 * The block itself is NOT removed from the text so it remains visible in the tokenized list.
 *
 * Japanese pattern: 一部に〜を含む or (〜を含む)
 *
 * @param text - Raw text from OCR
 * @returns cleanedText (unchanged, block kept for tokenization), containsLine, containsTokens
 */
export function extractContainsLine(text: string): {
    cleanedText: string;
    containsLine: string | null;
    containsTokens: string[];
} {
    const containsPatterns = [
        /[（(]一部に([\s\S]+?)を含む[）)]/g,
        /一部に([\s\S]+?)を含む/g,
        /[（(]([\s\S]+?)を含む[）)]/g,
    ];

    let containsLine: string | null = null;
    let containsTokens: string[] = [];

    for (const pattern of containsPatterns) {
        const match = text.match(pattern);
        if (match) {
            containsLine = match[0];
            const innerMatch = containsLine.match(/一部に([\s\S]+?)を含む/) ||
                containsLine.match(/[（(]([\s\S]+?)を含む[）)]/);
            if (innerMatch && innerMatch[1]) {
                containsTokens = innerMatch[1]
                    .split(/[・、,]/)
                    .map(t => t.trim())
                    .filter(t => t.length > 0);
            }
            break;
        }
    }

    // Keep the full text for tokenization so "(一部にえび、小麦...を含む)" stays in the list
    return { cleanedText: text, containsLine, containsTokens };
}

// ============================================================================
// SEPARATOR NORMALIZATION
// ============================================================================

// Patterns that indicate START of nutritional info (cut everything after)
const nutritionPatterns = [
    "栄養成分表示",  // Standard: "Nutritional information"
    "栄養成分",      // Short form
    "栄養表示",      // Alternative
    "熱量：",        // "Calories:" - sometimes nutrition starts directly
    "熱量(",        // "Calories(" with value
    "エネルギー：",   // "Energy:"
    "エネルギー(",   // "Energy(" with value
];

// Patterns that indicate START of ingredients list
const ingredientPatterns = [
    /原材料名[：:]/,   // Standard: "Ingredients:"
    /原材料[：:]/,     // Short form
    /原材料一覧[：:]/,  // "Ingredients list:"
];

/**
 * Remove nutritional information section from the text.
 */
export function removeNutritionInfo(text: string): string {
    let workingText = text;
    for (const pattern of nutritionPatterns) {
        const index = workingText.indexOf(pattern);
        if (index !== -1) {
            workingText = workingText.substring(0, index);
            break; // Stop at first match
        }
    }
    return workingText;
}

/**
 * Normalize Japanese and Western separators to a standard format.
 * Also handles multi-line labels where product name must be removed.
 *
 * KEY RULES:
 * 1. IGNORE everything BEFORE 原材料 or 原材料名 (product title/name)
 * 2. IGNORE everything AFTER 栄養成分表示 (nutritional info)
 * 3. SMART LINE JOINING: If line ends with separator → new ingredient; else → concat
 *
 * @param text - Raw text
 * @returns Normalized text with standard separators (ingredients only)
 */
export function normalizeSeparators(text: string): string {
    // Separators that indicate "end of ingredient"
    const separators = ["、", "・", "／", "/", ",", ";"];

    // Step 0: Cut off nutritional info section
    let workingText = removeNutritionInfo(text);

    // Step 1: Find where ingredients actually start
    // Everything before this is product title/name - ignore it
    for (const pattern of ingredientPatterns) {
        const match = workingText.match(pattern);
        if (match && match.index !== undefined) {
            workingText = workingText.substring(match.index);
            break; // Stop at first match
        }
    }

    // Step 2: Split by newlines and process each line
    const lines = workingText.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);

    // Step 3: Filter out standalone product name lines (名称：xxx without 原材料)
    const filteredLines = lines.filter(line => {
        // Skip lines that are ONLY the product name (no ingredient info)
        if (/^名称[：:]\s*[^原材料]+$/.test(line) && !/原材料/.test(line)) {
            return false;
        }
        return true;
    });

    // Step 4: Smart join - concatenate or separate based on line ending
    let result = "";
    const openParensRegex = /[（(【［]$/;  // Ends with open parenthesis

    for (let i = 0; i < filteredLines.length; i++) {
        let line = filteredLines[i];

        // Check if we need to add a separator for the NEXT join
        // But first, process the current line (no modification needed for the line itself usually)
        // Wait, we modify 'line' to append separator if needed.

        result += line;

        // If this is not the last line, decide how to join with next
        if (i < filteredLines.length - 1) {
            const lastChar = line[line.length - 1];
            const endsWithSeparator = separators.includes(lastChar);
            const endsWithOpenParen = openParensRegex.test(line);

            if (endsWithSeparator) {
                // Already has separator, do nothing (join will be just concatenation)
            } else if (endsWithOpenParen) {
                // Ends with open paren (e.g. "Sugar ("), so assume continuation.
                // Do NOT add separator.
            } else {
                // Line ends with text (e.g. "Tofu"), and next line starts new item.
                // Force separator.
                result += "、";
            }
        }
    }

    // Step 5: Clean prefixes
    // Remove ingredient list prefix (原材料名：)
    result = result.replace(/原材料名[：:]\s*/g, "");
    result = result.replace(/原材料[：:]\s*/g, "");

    // Normalize full-width comma to Japanese comma
    result = result.replace(/，/g, "、");

    // Normalize full-width slash to half-width
    result = result.replace(/／/g, "/");

    // Remove excessive whitespace
    result = result.replace(/\s+/g, " ");

    return result.trim();
}

// ============================================================================
// ORPHAN PARENTHESES CLEANUP
// ============================================================================

/**
 * Remove orphan (unbalanced) parentheses from the start or end of a token.
 * Examples:
 * - "食用油脂）" → "食用油脂"
 * - "（ウコン" → "ウコン"
 * - "（正常な括弧）" → "（正常な括弧）" (balanced, kept as-is)
 */
function cleanOrphanParentheses(token: string): string {
    const openParens = ["（", "(", "【", "［"];
    const closeParens = ["）", ")", "】", "］"];

    let result = token;

    // Count balance
    let balance = 0;
    for (const char of result) {
        if (openParens.includes(char)) balance++;
        else if (closeParens.includes(char)) balance--;
    }

    // If balanced, return as-is
    if (balance === 0) return result;

    // Remove trailing close parens if we have too many closes
    while (balance < 0 && result.length > 0) {
        const lastChar = result[result.length - 1];
        if (closeParens.includes(lastChar)) {
            result = result.slice(0, -1);
            balance++;
        } else {
            break;
        }
    }

    // Remove leading open parens if we have too many opens
    while (balance > 0 && result.length > 0) {
        const firstChar = result[0];
        if (openParens.includes(firstChar)) {
            result = result.slice(1);
            balance--;
        } else {
            break;
        }
    }

    return result.trim();
}

// ============================================================================
// SMART TOKENIZATION
// ============================================================================

/**
 * Extract allergen declaration pattern like （一部にえび・小麦・卵を含む）
 * Returns the individual allergen tokens and the text with the declaration removed.
 *
 * Example:
 * Input: "砂糖、塩、（一部にえび・小麦・卵を含む）"
 * Output: {
 *   cleanedText: "砂糖、塩",
 *   allergenTokens: ["えび", "小麦", "卵"]
 * }
 */
function extractAllergenDeclaration(text: string): { cleanedText: string; allergenTokens: string[] } {
    const allergenTokens: string[] = [];

    // Pattern: （一部に...を含む） or (一部に...を含む)
    const pattern = /[（(]一部に([^）)]+)を含む[）)]/g;

    let cleanedText = text;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const allergenList = match[1]; // Extract: "えび・小麦・卵・乳成分・ごま・大豆・鶏肉・豚肉"

        // Split by ・ or 、 (clean newlines from OCR first)
        const allergens = allergenList
            .replace(/\n/g, '')  // BUG FIX (Bug 11): Remove OCR newline artifacts
            .split(/[・、]/)
            .map(a => a.trim())
            .filter(a => a.length > 0);

        allergenTokens.push(...allergens);

        // Remove the full declaration from text
        cleanedText = cleanedText.replace(match[0], "");
    }

    return { cleanedText, allergenTokens };
}

/**
 * Tokenize text while respecting parentheses depth.
 * This ensures compound ingredients like "野菜（人参、筍）" stay together.
 *
 * @param text - Normalized text
 * @returns Array of tokens
 */
export function tokenize(text: string): string[] {
    // First, extract allergen declarations (if any)
    const { cleanedText, allergenTokens } = extractAllergenDeclaration(text);

    const tokens: string[] = [];
    let buffer = "";
    let parenDepth = 0;

    // Separators to split on (only at depth 0)
    const separators = new Set(["、", ",", "・", ";", "/"]);

    // Parentheses pairs
    const openParens = new Set(["（", "(", "【", "［"]);
    const closeParens = new Set(["）", ")", "】", "］"]);

    for (const char of cleanedText) {
        if (openParens.has(char)) {
            parenDepth++;
            buffer += char;
        } else if (closeParens.has(char)) {
            parenDepth = Math.max(0, parenDepth - 1);
            buffer += char;
        } else if (separators.has(char) && parenDepth === 0) {
            // Cut here
            const trimmed = buffer.trim();
            if (trimmed.length > 0) {
                tokens.push(trimmed);
            }
            buffer = "";
        } else {
            buffer += char;
        }
    }

    // Don't forget the last buffer
    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
        tokens.push(trimmed);
    }

    // Add extracted allergen tokens to the end (they'll be processed like normal ingredients)
    tokens.push(...allergenTokens);

    return tokens;
}

// ============================================================================
// MAIN PARSING FUNCTION
// ============================================================================

export interface Phase1Result {
    raw_tokens: string[];
    contains_tokens: string[];
}

/**
 * Alternative Phase 1 pipeline: extract contains + normalizeSeparators + tokenize (flat list).
 * Main index uses extractContainsLine + tokenizeToTree instead. Kept for standalone/test use.
 *
 * @param certifiedRawText - The certified raw text from Phase 0.5
 * @returns Parsed tokens and contains tokens
 */
export function parseIngredients(certifiedRawText: string): Phase1Result {
    // Step 1: Extract "contains" line
    const { cleanedText, containsTokens } = extractContainsLine(certifiedRawText);

    // Step 2: Normalize separators
    const normalized = normalizeSeparators(cleanedText);

    // Step 3: Tokenize with parentheses awareness
    const raw_tokens = tokenize(normalized);

    // Step 4: Clean orphan parentheses from all tokens
    const cleanedRawTokens = raw_tokens
        .map(cleanOrphanParentheses)
        .filter(t => t.length > 0);

    const cleanedContainsTokens = containsTokens
        .map(cleanOrphanParentheses)
        .filter(t => t.length > 0);

    return {
        raw_tokens: cleanedRawTokens,
        contains_tokens: cleanedContainsTokens,
    };
}
