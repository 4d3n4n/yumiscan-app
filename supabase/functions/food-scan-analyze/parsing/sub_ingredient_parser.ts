/**
 * Sub-ingredient parser for nested ingredient structures.
 * Handles Japanese parentheses notation like: 野菜（人参、筍、舞茸）
 *
 * BUG FIX (Bug 3+4):
 * - Supports nested parentheses with depth tracking
 * - Normalizes both () and （）styles
 */

// Ambiguous terms that should be flagged
const AMBIGUOUS_TERMS_JP = [
    "その他",  // others
    "等",      // etc.
    "他",      // other
];

const AMBIGUOUS_TERMS_FR = [
    "autres",
    "etc.",
    "other",
    "assaisonné",  // without details
    "épices",      // spices (generic)
];

export interface SubIngredient {
    id: string;                // Unique ID for tracking
    text_jp: string;           // Japanese text
    text_fr: string;           // French translation
    is_ambiguous: boolean;     // True if contains ambiguous term
    ambiguous_reason?: string; // Why it's flagged as ambiguous
    status?: "ok" | "ambiguous" | "contains_allergen";
    sub_ingredients?: SubIngredient[];
}

export interface ParsedIngredient {
    id: string;             // Unique ID for tracking
    main_text_jp: string;
    main_text_fr: string;
    has_sub_ingredients: boolean;
    sub_ingredients: SubIngredient[];
    status?: "ok" | "ambiguous" | "contains_allergen";
    is_ambiguous?: boolean;
    ambiguous_reason?: string;
}

/**
 * Check if a term is ambiguous
 */
function isAmbiguousTerm(text: string): { is_ambiguous: boolean; reason?: string } {
    const lowerText = text.toLowerCase();

    // Check Japanese terms
    for (const term of AMBIGUOUS_TERMS_JP) {
        if (text.includes(term)) {
            return { is_ambiguous: true, reason: `Contient '${term}' (terme générique)` };
        }
    }

    // Check French terms
    for (const term of AMBIGUOUS_TERMS_FR) {
        if (lowerText.includes(term)) {
            return { is_ambiguous: true, reason: `Contient '${term}' (terme générique)` };
        }
    }

    return { is_ambiguous: false };
}

/**
 * Smart split that respects nested parentheses.
 * Only splits on separators when outside of parentheses (depth === 0).
 *
 * Example: "調味液（食塩、醸造酢）、砂糖" → ["調味液（食塩、醸造酢）", "砂糖"]
 */
function smartSplit(text: string, separators: string[] = ['、', ',']): string[] {
    let depth = 0;
    let parts: string[] = [];
    let current = '';

    for (const char of text) {
        // Track parentheses depth (both full-width and half-width)
        if (char === '（' || char === '(') depth++;
        if (char === '）' || char === ')') depth--;

        // Only split on separator when depth === 0 (outside parentheses)
        if (separators.includes(char) && depth === 0) {
            if (current.trim()) parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    // Don't forget the last part
    if (current.trim()) parts.push(current.trim());

    return parts;
}

/**
 * Parse Japanese text to extract sub-ingredients from parentheses.
 * Example: "野菜（人参、筍、舞茸）" → ["人参", "筍", "舞茸"]
 *
 * BUG FIX: Normalizes () to （）and uses smartSplit for nested parentheses
 */
function extractSubIngredientsJP(raw: string): {
    main: string;
    subs: string[];
} {
    // Step 1: Normalize parentheses (support both styles)
    const normalized = raw
        .replace(/\(/g, '（')
        .replace(/\)/g, '）');

    // Match pattern: main（sub1、sub2、sub3）
    const match = normalized.match(/^([^（]+)（(.+)）$/);

    if (!match) {
        return { main: raw, subs: [] };
    }

    const main = match[1].trim();
    const subText = match[2];

    // Step 2: Use smart split to respect nested parentheses
    const subs = smartSplit(subText, ['、', ','])
        .filter(s => s.length > 0);

    return { main, subs };
}

/**
 * Match French translation with Japanese sub-ingredients.
 * Uses heuristics to extract sub-parts from French text.
 *
 * BUG FIX: Use smartSplit to respect nested parentheses.
 * E.g. "assaisonnement salé (sel, vinaigre de brassage)" should NOT be split.
 */
function extractSubIngredientsFR(normalized_fr: string, subsJP: string[]): string[] {
    // Pattern: main (sub1, sub2, sub3)
    const match = normalized_fr.match(/^([^(]+)\((.+)\)$/);

    if (!match || subsJP.length === 0) {
        return [];
    }

    const subText = match[2];

    // BUG FIX: Use smartSplit instead of naive split to respect nested parentheses
    const subsFR = smartSplit(subText, [',', '/'])
        .map(s => s.trim())
        .filter(s => s.length > 0);

    // If we have the same number of subs, assume 1-to-1 mapping
    if (subsFR.length === subsJP.length) {
        return subsFR;
    }

    // Otherwise, return what we have
    return subsFR;
}

/**
 * Parse a single ingredient to extract nested sub-ingredients.
 *
 * @param raw - Japanese ingredient text
 * @param normalized_fr - French translation (optional at first pass)
 * @param parentId - Prefix for ID generation
 * @returns Parsed ingredient with sub-ingredients
 */
export function parseIngredient(raw: string, normalized_fr: string = "", parentId: string = "root"): ParsedIngredient {
    const ingredientId = `${parentId}`;

    // Extract Japanese sub-ingredients
    const { main: mainJP, subs: subsJP } = extractSubIngredientsJP(raw);

    // 2. Check for Parentheses (Nested Ingredients)
    // Regex to capture: Name (Ingredients) [Trailing]
    // We look for the FIRST open paren and the LAST close paren to handle roughly?
    // Actually, to handle "A(B)C", we want to capture A, B, C.
    // But "A(B)C(D)" is harder.
    // For now, let's assume the outermost parens enclose the main sub-ingredients,
    // OR we just look for the pattern "Name (Content)".

    // Updated Regex to allow trailing text (handled as part of name or ignored? merged to name for now)
    // Matches: Group 1 (Name), Group 2 (Content), Group 3 (Trailing)
    // Note: We use [\s\S] for content to match newlines if any, though we cleaned them.
    // We use ungreedy match for name, but we need to find the matching paren block.
    // Simple regex might fail on nested parens.
    // But assuming simple depth or using the helper `extractParenthesesBlock` if implemented?
    // Let's stick to a robust regex for "Starts with Name, contains ( ... ) somewhere".

    // We will use a scanner approach or a smarter regex.
    // Pattern: ^([^（(]+)[（(](.+)[）)](.*)$
    // This assumes one main block.
    // If input is "A(B)C", $1=A, $2=B, $3=C.
    // We default to merging A and C as the name "A C".

    const parenMatch = raw.match(/^([^（(]+)[（(](.+)[）)](.*)$/);

    if (parenMatch) {
        const preText = parenMatch[1].trim();
        const content = parenMatch[2].trim();
        const postText = parenMatch[3].trim();

        let mainText = preText;
        if (postText) {
            mainText += " " + postText; // Merge trailing text into name
        }

        // Parse children (recursive)
        // We split the content by delimiters.
        // NOTE: The tokenizer might be needed here if the content is complex!
        // But for now we use simple split by 、 or ,
        const children: SubIngredient[] = smartSplit(content).map((c, idx) => {
            const parsed = parseIngredient(c, "", `${ingredientId}-${idx}`);
            const ambiguityResult = isAmbiguousTerm(parsed.main_text_jp);
            // Convert ParsedIngredient to SubIngredient
            return {
                id: parsed.id,
                text_jp: parsed.main_text_jp,
                text_fr: parsed.main_text_fr,
                is_ambiguous: ambiguityResult.is_ambiguous,
                ambiguous_reason: ambiguityResult.reason,
                status: parsed.status as any, // Propagate status if present (undefined usually)
                sub_ingredients: parsed.sub_ingredients
            };
        });

        return {
            id: ingredientId,
            main_text_jp: mainText,
            main_text_fr: normalized_fr, // We don't try to parse FR structure yet match logic?
            has_sub_ingredients: true,
            sub_ingredients: children
        };
    }

    // Extract French sub-ingredients (if available)
    const subsFR = normalized_fr ? extractSubIngredientsFR(normalized_fr, subsJP) : [];

    // If no sub-ingredients, return simple structure
    if (subsJP.length === 0) {
        return {
            id: ingredientId,
            main_text_jp: raw,
            main_text_fr: normalized_fr,
            has_sub_ingredients: false,
            sub_ingredients: [],
        };
    }

    // Match JP and FR subs (best effort)
    const subIngredients: SubIngredient[] = subsJP.map((subJP, index) => {
        const subId = `${ingredientId}.${index + 1}`;
        const subFR = subsFR[index] || ""; // Empty if not yet translated
        const { is_ambiguous, reason } = isAmbiguousTerm(subJP);

        // Recursive parsing for sub-ingredients
        // Use recursive call logic here but adapted for sub-interface
        const nestedParsed = parseIngredient(subJP, subFR, subId);

        return {
            id: subId,
            text_jp: nestedParsed.main_text_jp, // Use main text from recursive parse
            text_fr: nestedParsed.main_text_fr,
            is_ambiguous: is_ambiguous,
            ambiguous_reason: reason,
            sub_ingredients: nestedParsed.sub_ingredients.map(s => s as SubIngredient) // Cast back
        };
    });

    // Extract main text from French (before parentheses)
    let mainFR = normalized_fr;
    if (normalized_fr) {
        const mainFRMatch = normalized_fr.match(/^([^(]+)/);
        mainFR = mainFRMatch ? mainFRMatch[1].trim() : normalized_fr;
    }

    return {
        id: ingredientId,
        main_text_jp: mainJP,
        main_text_fr: mainFR,
        has_sub_ingredients: true,
        sub_ingredients: subIngredients,
    };
}

/**
 * Collect all identifiers and text from the tree for batch processing.
 */
export function collectAllNodes(ingredients: ParsedIngredient[]): { id: string; text_jp: string }[] {
    const nodes: { id: string; text_jp: string }[] = [];

    function traverse(node: ParsedIngredient | SubIngredient) {
        // Add current node
        const text = 'main_text_jp' in node ? node.main_text_jp : node.text_jp;
        nodes.push({ id: node.id, text_jp: text });

        // Traverse children
        if (node.sub_ingredients) {
            for (const child of node.sub_ingredients) {
                traverse(child);
            }
        }
    }

    for (const ingredient of ingredients) {
        traverse(ingredient);
    }

    return nodes;
}

/**
 * Populate translations back into the tree.
 */
export function populateTranslations(ingredients: ParsedIngredient[], translationMap: Map<string, string>): void {
    function traverse(node: ParsedIngredient | SubIngredient) {
        const textKey = 'main_text_jp' in node ? node.main_text_jp : node.text_jp;
        const translated = translationMap.get(textKey);

        if (translated) {
            if ('main_text_fr' in node) {
                node.main_text_fr = translated;
            } else {
                node.text_fr = translated;
            }
        }

        if (node.sub_ingredients) {
            for (const child of node.sub_ingredients) {
                traverse(child);
            }
        }
    }

    for (const ingredient of ingredients) {
        traverse(ingredient);
    }
}
