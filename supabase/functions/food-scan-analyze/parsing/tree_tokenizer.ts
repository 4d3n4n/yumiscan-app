
/**
 * Tree-Based Tokenizer for Ingredient Lists.
 *
 * Parses raw ingredient text into a hierarchical tree structure based on:
 * 1. Separators (、, ,, ・, etc.) for splitting siblings.
 * 2. Parentheses ((), （）, [], etc.) for nesting children.
 *
 * Generates unique IDs for each node to allow stable mapping later.
 */

export interface IngredientNode {
    id: string;             // Unique ID (e.g. "root-0", "root-0-1")
    raw: string;            // Full text of this node including children (for reference)
    clean_text: string;     // Text of this node WITHOUT children's text (e.g. "Sugar" from "Sugar (Cane)")
    children: IngredientNode[];
    depth: number;
}

const SEPARATORS = ["、", "，", ",", "・", "：", ":", "/", "／", ";", "\n"];
const OPEN_PARENS = ["(", "（", "[", "［", "【"];
const CLOSE_PARENS = [")", "）", "]", "］", "】"];

/**
 * Main entry point: Tokenize text into a tree.
 */
export function tokenizeToTree(text: string, rootIdPrefix = "root"): IngredientNode[] {
    // 1. Normalize separators and cleanup basic noise
    const cleanText = preProcessText(text);

    // 2. Recursive parsing
    const nodes = parseRecursive(cleanText, rootIdPrefix, 0);

    // 3. Unwrap "Anonymous Parents" (e.g. "(A, B)") -> A, B
    return unwrapAnonymousParents(nodes);
}

/**
 * Unwrap nodes that have no text but have children.
 * This happens when top-level input is like "(A, B)" or "((A))".
 */
function unwrapAnonymousParents(nodes: IngredientNode[]): IngredientNode[] {
    return nodes.flatMap(node => {
        // Recurse on children first
        node.children = unwrapAnonymousParents(node.children);

        // If this node is "empty" (no own text) but has children, promote children
        if (node.clean_text === "" && node.children.length > 0) {
            return node.children;
        }

        return [node];
    });
}

/**
 * Recursively parse a string into nodes.
 * splits by separators, then checks for internal parentheses for recursion.
 */
function parseRecursive(text: string, idPrefix: string, depth: number): IngredientNode[] {
    const nodes: IngredientNode[] = [];

    // Default split
    const tokens = smartSplit(text);

    tokens.forEach((token, index) => {
        processToken(token, `${idPrefix}-${index}`, nodes, depth);
    });

    // Post-process: Merge "Orphan Parentheses"
    // If we have [Node A] and [Node B (empty text, children only)],
    // and Node B looks like it belongs to Node A (e.g. was separated by newline/comma),
    // we merge B's children into A and remove B.
    return mergeOrphans(nodes);
}

/**
 * Merges nodes that are just parentheses back into their likely parent.
 * Example: ["調味料", "(アミノ酸等)"] -> ["調味料(アミノ酸等)"]
 */
/**
 * Merges nodes that are just parentheses back into their likely parent.
 *
 * UPDATE: Disabled `mergeOrphans` because it incorrectly matches comma-separated items.
 * Example: "Spice Extract, (Contains...)" -> The comma implies separation.
 * `smartSplit` separates them. Merging them destroys the separation and makes "Spice Extract" the parent.
 * Since `preProcessText` removes newlines, any separation here is likely explicit (comma, etc.).
 * Therefore, we should NOT merge.
 */
function mergeOrphans(nodes: IngredientNode[]): IngredientNode[] {
    // strict: explicitly separated tokens should stay separated.
    return nodes;
}

function processToken(token: string, id: string, nodes: IngredientNode[], depth: number) {
    const trimmed = token.trim();
    // Strictly reject empty tokens to avoid "Empty Pills"
    if (!trimmed) return;

    const { mainText, contentInsideParens } = extractParenthesesContent(trimmed);

    const children: IngredientNode[] = [];
    if (contentInsideParens) {
        children.push(...parseRecursive(contentInsideParens, id, depth + 1));
    }

    nodes.push({
        id,
        raw: trimmed,
        clean_text: mainText,
        children,
        depth
    });
}

interface SmartSplitOptions {
    resetOnNewline?: boolean;
    ignoreParens?: boolean;
}

/**
 * Smartly splits text by separators, IGNORING separators inside parentheses.
 */
function smartSplit(text: string, options: SmartSplitOptions = {}): string[] {
    const tokens: string[] = [];
    let currentToken = "";
    let parenDepth = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (options.resetOnNewline && char === "\n") {
            parenDepth = 0; // Force reset
        }

        if (!options.ignoreParens) {
            if (OPEN_PARENS.includes(char)) {
                parenDepth++;
            } else if (CLOSE_PARENS.includes(char)) {
                if (parenDepth > 0) parenDepth--;
            }
        }

        const isSeparator = SEPARATORS.includes(char);

        // If we hit a separator AND we are at depth 0, we split.
        if (isSeparator && parenDepth === 0) {
            if (currentToken.trim().length > 0) {
                tokens.push(currentToken.trim());
            }
            currentToken = "";
        } else {
            currentToken += char;
        }
    }

    if (currentToken.trim().length > 0) {
        tokens.push(currentToken.trim());
    }

    return tokens;
}

/**
 * Extracts "MainText" and "ChildContent" from a string like "Sugar (Cane, Beet)".
 * Returns: { mainText: "Sugar", contentInsideParens: "Cane, Beet" }
 */
function extractParenthesesContent(text: string): { mainText: string, contentInsideParens: string | null } {
    // Find the FIRST open parenthesis that starts a block covering the rest of the string (roughly)
    // Or just find the first open parenthesis?
    // Usually "Ingredient (Sub1, Sub2)" -> Split at first paren.

    let firstOpenIdx = -1;
    for (let i = 0; i < text.length; i++) {
        if (OPEN_PARENS.includes(text[i])) {
            firstOpenIdx = i;
            break;
        }
    }

    if (firstOpenIdx === -1) {
        return { mainText: text.trim(), contentInsideParens: null };
    }

    const mainText = text.substring(0, firstOpenIdx).trim();

    // Extract content inside. We assume the *last* closing parenthesis closes this block?
    // Not necessarily. "A (B) C (D)" -> distinct siblings, woud have been split by smartSplit if separated by commas.
    // If "A (B) C (D)" shows up as ONE token, it means there was no comma between them.
    // In Japanese labeling, "Sugar (Beet) Salt" is ambiguous without commas.
    // But usually `smartSplit` handles the top level.
    // So `text` here is likely "Miso (Soybean, Rice, Salt)".

    // We assume the parens enclose the end specific details.
    // Let's find the matching closing paren for the first open paren.
    let depth = 0;
    let closeIdx = -1;
    for (let i = firstOpenIdx; i < text.length; i++) {
        if (OPEN_PARENS.includes(text[i])) depth++;
        if (CLOSE_PARENS.includes(text[i])) {
            depth--;
            if (depth === 0) {
                closeIdx = i;
                break;
            }
        }
    }

    if (closeIdx !== -1) {
        // Content inside parens
        const content = text.substring(firstOpenIdx + 1, closeIdx);
        return { mainText, contentInsideParens: content };
    }

    // Unbalanced or weird? Just return as is.
    // Note: If Phase 0.9 works, we should rarely reach here with unbalanced parens.
    return { mainText: text.trim(), contentInsideParens: null };
}

/**
 * Pre-processes text to remove noise and normalize structures BEFORE tokenization.
 *
 * CONTRACT: The caller (index.ts) must have already run cleanForTokenization:
 * - Nutrition block removed (栄養成分表示…, 熱量|蛋白質…)
 * - All newlines removed (OCR artifacts)
 * We only do safety newline removal here and prefix/bracket normalization.
 *
 * Scalability Note: This runs on per-request text (~1-2KB max).
 */
export function preProcessText(text: string): string {
    let res = text;

    // 0. Safety: remove any remaining newlines (caller should have done this; handles \r and other callers)
    res = res.replace(/[\r\n]+/g, "");

    // 0b. Insert separator after closing paren when followed by text (new ingredient).
    // Japanese labels follow JAS norms: once a parenthesized sub-list closes,
    // the next text is always a new sibling ingredient at the same depth.
    //
    // Pass 1: ") SPACE(s) TEXT" → ")、TEXT" (e.g. "食用油脂) 鶏五目おこわ" → "食用油脂)、鶏五目おこわ")
    res = res.replace(/([）)])\s+(?=[^\s、，,・：:;/／)）\]］】])/g, "$1、");
    // Pass 2: ")TEXT" (no space) → ")、TEXT" (e.g. "醸造酢)食用油脂" → "醸造酢)、食用油脂")
    res = res.replace(/([）)])(?=[^\s、，,・：:;/／)）\]］】])/g, "$1、");

    // 1. Remove administrative prefixes/noise
    // "名称:..." or "原材料名:..." often appear at start.
    // We treat specific keywords as noise to be stripped.
    const noisePatterns = [
        /^[\s\n]*名称[:\s]+/mu,
        /^[\s\n]*原材料名[:\s]+/mu,
        /^[\s\n]*すし[:\s]*/mu, // Specific to the user's example if "Sushi" appears as a label
    ];

    for (const pattern of noisePatterns) {
        res = res.replace(pattern, "");
    }

    // 2. Normalize Separators inside ALL Brackets (Standardization)
    // Strategy: Find content inside any type of brackets and replace non-standard
    // separators (like '・') with the standard comma '、'.
    // This ensures that "Soup(A・B)" is parsed as "Soup" -> children ["A", "B"].

    // Supported brackets: (), [], {}, 【】, （）, 「」, ［］
    // We use a regex that matches balanced pairs (non-recursive for simplicity, but effective for 99% of labels).
    const bracketPairs = [
        { open: "\\(", close: "\\)" },
        { open: "（", close: "）" },
        { open: "\\[", close: "\\]" },
        { open: "［", close: "］" },
        { open: "【", close: "】" },
        { open: "「", close: "」" },
        { open: "{", close: "}" }
    ];

    for (const pair of bracketPairs) {
        // Regex explanation:
        // pair.open        -> Opening bracket
        // ([^pair.close]*) -> Capture content that is NOT the closing bracket (greedy is fine here for single level)
        // pair.close       -> Closing bracket
        // Global flag 'g' to catch all occurrences
        const regex = new RegExp(`${pair.open}([^${pair.close}]*)${pair.close}`, "g");

        res = res.replace(regex, (match, content) => {
            // Replace '・' with '、' inside the captured content
            // We can also normalize space-separated lists if needed, but '・' is the main culprit.
            const normalizedContent = content.replace(/・/g, "、");

            // Reconstruct the bracket with normalized content
            // We strip the backslashes from the pair definition for reconstruction if needed,
            // but simpler to just use the first char of match/suffix?
            // Actually, we know the brackets from the match, but we want to preserve them exactly.
            // Let's grab the actual brackets used in the match.
            const openChar = match.charAt(0);
            const closeChar = match.charAt(match.length - 1);

            return `${openChar}${normalizedContent}${closeChar}`;
        });
    }

    // 3. (Legacy) "Contains" logic is now handled by the generic normalization above.
    // If we have "(一部に...)" it will be normalized to "(一部に...、...)"
    // and then parsed as a node "(一部に...)" with children.
    // If it's at the top level without a prefix, `unwrapAnonymousParents` will flatten it.

    return res;
}

/**
 * Checks if parentheses are balanced in the text.
 * Returns true if balanced, false if unbalanced (e.g. missing closing paren).
 */
export function checkParenthesisBalance(text: string): boolean {
    let depth = 0;
    for (const char of text) {
        if (OPEN_PARENS.includes(char)) {
            depth++;
        } else if (CLOSE_PARENS.includes(char)) {
            depth--;
        }
        // If depth goes negative, it means we have a closing paren without opening one.
        // This is also "unbalanced" but usually less critical for the "huge token" bug (which is caused by failure to close).
        // But strictly speaking it is unbalanced.
        if (depth < 0) return false;
    }
    return depth === 0;
}

/**
 * Flattens the tree into a list of "Leaf-like" nodes for AI analysis.
 * We want to send specific items to AI:
 * - Leaves (no children)
 * - Parents (context might be needed, but usually we verify the leaf).
 *
 * Strategy: Return ALL nodes in a flat list. ID maps back to tree.
 */
export function flattenTree(nodes: IngredientNode[]): IngredientNode[] {
    let flat: IngredientNode[] = [];
    for (const node of nodes) {
        flat.push(node);
        if (node.children.length > 0) {
            flat = flat.concat(flattenTree(node.children));
        }
    }
    return flat;
}
