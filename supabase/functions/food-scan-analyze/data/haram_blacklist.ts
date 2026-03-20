/**
 * Blacklist of explicitly haram ingredients.
 * Used in Phase 1.6 for fast CODE-based matching before AI classification.
 *
 * Format: lowercase strings for case-insensitive matching.
 * Includes Japanese (kanji, hiragana, katakana), French, and English terms.
 */

// ============================================================================
// PORK / PORC / 豚
// ============================================================================
export const PORK_TERMS = [
    // Japanese
    "豚", "豚肉", "ポーク", "豚脂", "豚骨", "豚エキス", "豚由来",
    "ベーコン", "ハム", "ソーセージ", "ラード", "とんこつ",

    // + additions (JP)
    "豚皮", "豚皮由来", "豚コラーゲン", "豚由来コラーゲン",
    "豚ゼラチン", "ポークエキス", "豚肉エキス", "豚抽出物",
    "豚たん白", "豚たんぱく", "豚プラセンタ", "豚由来ゼラチン",

    // French
    "porc", "lard", "saindoux", "bacon", "jambon", "saucisse", "cochon",
    "lardon", "pancetta", "coppa", "mortadelle", "rillettes",

    // + additions (FR)
    "graisse de porc", "couenne", "gélatine de porc", "collagène de porc",

    // English
    "pork", "ham", "bacon", "sausage", "lard", "pig",

    // + additions (EN)
    "pork fat", "pork gelatin", "porcine", "porcine gelatin", "pork collagen",
];

// ============================================================================
// ALCOHOL / ALCOOL / 酒
// ============================================================================
export const ALCOHOL_TERMS = [
    // Japanese
    "酒精", "みりん", "ミリン", "本みりん", "料理酒", "清酒", "日本酒",
    "ワイン", "ビール", "焼酎", "ブランデー", "ウイスキー", "ラム酒",
    "酒", "アルコール",

    // + additions (JP)
    "エタノール", "発酵アルコール", "醸造アルコール", "酒粕", "紹興酒",

    // French - NOTE: "vin" removed to avoid matching "vinaigre"
    "alcool", "mirin", "vin blanc", "vin rouge", "bière", "rhum", "cognac", "whisky", "vodka",
    "saké", "sake", "liqueur", "kirsch", "calvados", "armagnac",

    // + additions (FR)
    "éthanol", "spiritueux", "alcool éthylique",

    // English
    "alcohol", "wine", "beer", "rum", "brandy", "whiskey", "vodka", "liquor",

    // + additions (EN)
    "ethanol", "cooking wine", "rice wine",
];

// ============================================================================
// GELATIN / COLLAGEN (animal origin) / ゼラチン / コラーゲン
// ============================================================================
export const GELATIN_TERMS = [
    // Japanese
    "ゼラチン", "ゼラチンパウダー",

    // + additions (JP)
    "コラーゲン", "コラーゲンペプチド", "豚コラーゲン", "牛コラーゲン",

    // French
    "gélatine", "gelatine",

    // + additions (FR)
    "collagène", "hydrolysat de collagène", "peptides de collagène",

    // English
    "gelatin", "gelatine",

    // + additions (EN)
    "collagen", "collagen peptides", "hydrolyzed collagen",
];

// ============================================================================
// ANIMAL FAT (non-halal origin) / GRAISSE ANIMALE
// ============================================================================
export const ANIMAL_FAT_TERMS = [
    // Japanese
    "動物性油脂", "動物油脂", "牛脂", "ショートニング",

    // + additions (JP)
    "獣脂", "羊脂", "鶏脂",

    // French
    "graisse animale", "suif", "shortening",

    // + additions (FR)
    "graisse de boeuf", "graisse de bœuf", "graisse de poulet", "graisse de canard",

    // English
    "animal fat", "tallow", "shortening",

    // + additions (EN)
    "beef tallow", "chicken fat", "duck fat",
];

// ============================================================================
// MEAT DERIVATIVES / DÉRIVÉS DE VIANDE
// ============================================================================
export const MEAT_DERIVATIVES_TERMS = [
    // Japanese
    "コンソメ", // Consommé (usually beef/chicken)
    "ブイヨン", // Bouillon (usually beef/chicken)
    "肉エキス", // Meat extract

    // + additions (JP) common on labels
    "チキンエキス", "ビーフエキス", "ポークエキス",
    "チキンブイヨン", "ビーフブイヨン",
    "チキンコンソメ", "ビーフコンソメ",
    "動物性たん白", "動物性たんぱく", "動物性タンパク",
    "動物性タンパク加水分解物",
    "加水分解たん白", "加水分解タンパク", // (can be plant too, keep for AI check if too many FPs)

    // French
    "bouillon", "consommé", "extrait de viande",

    // + additions (FR)
    "extrait de poulet", "extrait de boeuf", "extrait de bœuf", "extrait de porc",
    "arôme viande", "arôme de viande",

    // English
    "bouillon", "consommé", "meat extract",

    // + additions (EN)
    "chicken extract", "beef extract", "pork extract",
    "meat flavor", "meat flavour",
];

// ============================================================================
// BLOOD / SANG / 血
// ============================================================================
export const BLOOD_TERMS = [
    // Japanese
    "血", "血液", "ブラッドソーセージ",

    // + additions (JP)
    "血漿", "血しょう", "ヘモグロビン", "血液製剤",

    // French
    "sang", "boudin",

    // + additions (FR)
    "plasma", "hémoglobine",

    // English
    "blood", "blood sausage",

    // + additions (EN)
    "plasma", "hemoglobin", "haemoglobin",
];

// ============================================================================
// ENZYMES / RENNET (often animal origin)
// ============================================================================
export const ENZYME_RENNET_TERMS = [
    // Japanese
    "レンネット", "動物性酵素",

    // French
    "présure",

    // English
    "rennet",
];

// ============================================================================
// NON-HALAL MEAT (Chicken, Beef, etc.) / VIANDE (Poulet, Bœuf)
// ============================================================================
export const NON_HALAL_MEAT_TERMS = [
    // Japanese
    "鶏", "鶏肉", "チキン", "とり", "鳥肉", // Chicken
    "牛", "牛肉", "ビーフ", "牛エキス", // Beef
    "肉", "ミート", // Meat
    "羊", "ラム", "マトン", // Lamb
    "鴨", "アヒル", // Duck
    // French
    "poulet", "volaille", "dinde", "canard",
    "bœuf", "boeuf", "vache", "veau",
    "viande", "chair",
    "mouton", "agneau",
    // English
    "chicken", "poultry", "turkey", "duck",
    "beef", "cow", "veal",
    "meat",
    "lamb", "mutton", "sheep",
];

// ============================================================================
// COMBINED BLACKLIST - Separated by script type for smart matching
// ============================================================================

// Japanese terms (kanji, hiragana, katakana) - use includes() matching
export const JAPANESE_HARAM_TERMS: string[] = [
    // Pork
    "豚", "豚肉", "ポーク", "豚脂", "豚骨", "豚エキス", "豚由来",
    "ベーコン", "ハム", "ソーセージ", "ラード", "とんこつ",
    // + additions (JP) Pork
    "豚皮", "豚皮由来", "豚コラーゲン", "豚由来コラーゲン",
    "豚ゼラチン", "ポークエキス", "豚肉エキス", "豚抽出物",
    "豚たん白", "豚たんぱく", "豚プラセンタ", "豚由来ゼラチン",

    // Alcohol
    "酒精", "みりん", "ミリン", "本みりん", "料理酒", "清酒", "日本酒",
    "ワイン", "ビール", "焼酎", "ブランデー", "ウイスキー", "ラム酒",
    "酒", "アルコール",
    // + additions (JP) Alcohol
    "エタノール", "発酵アルコール", "醸造アルコール", "酒粕", "紹興酒",

    // Gelatin/Collagen
    "ゼラチン", "ゼラチンパウダー",
    // + additions (JP) Gelatin/Collagen
    "コラーゲン", "コラーゲンペプチド", "豚コラーゲン", "牛コラーゲン",

    // Animal fat
    "動物性油脂", "動物油脂", "牛脂", "ショートニング",
    // + additions (JP) Animal Fat
    "獣脂", "羊脂", "鶏脂",

    // Meat derivatives
    "コンソメ", "ブイヨン", "肉エキス",
    // + additions (JP) Meat derivatives
    "チキンエキス", "ビーフエキス", "ポークエキス",
    "チキンブイヨン", "ビーフブイヨン",
    "チキンコンソメ", "ビーフコンソメ",
    "動物性たん白", "動物性たんぱく", "動物性タンパク",
    "動物性タンパク加水分解物",

    // Blood
    "血", "血液", "ブラッドソーセージ",
    // + additions (JP) Blood
    "血漿", "血しょう", "ヘモグロビン", "血液製剤",

    // Enzymes/Rennet
    "レンネット", "動物性酵素",

    // Meat (Chicken, Beef...) - Base list
    "鶏", "鶏肉", "チキン", "とり", "鳥肉",
    "牛", "牛肉", "ビーフ", "牛エキス",
    "肉", "ミート",
    "羊", "ラム", "マトン",
    "鴨", "アヒル",
].map(term => term.toLowerCase());

// Latin terms (French/English) - use word boundary matching
export const LATIN_HARAM_TERMS: string[] = [
    // Pork
    "porc", "lard", "saindoux", "bacon", "jambon", "saucisse", "cochon",
    "lardon", "pancetta", "coppa", "mortadelle", "rillettes",
    "pork", "ham", "sausage", "pig",
    // + additions Pork
    "graisse de porc", "couenne", "gélatine de porc", "collagène de porc",
    "pork fat", "pork gelatin", "porcine", "porcine gelatin", "pork collagen",

    // Alcohol
    "alcool", "mirin", "vin", "bière", "rhum", "cognac", "whisky", "vodka",
    "saké", "sake", "liqueur", "kirsch", "calvados", "armagnac",
    "alcohol", "wine", "beer", "rum", "brandy", "whiskey", "liquor",
    // + additions Alcohol
    "éthanol", "spiritueux", "alcool éthylique",
    "ethanol", "cooking wine", "rice wine",

    // Gelatin/Collagen
    "gélatine", "gelatine", "gelatin",
    // + additions Gelatin/Collagen
    "collagène", "hydrolysat de collagène", "peptides de collagène",
    "collagen", "collagen peptides", "hydrolyzed collagen",

    // Animal fat
    "graisse animale", "suif", "shortening", "animal fat", "tallow",
    // + additions Animal fat
    "graisse de boeuf", "graisse de bœuf", "graisse de poulet", "graisse de canard",
    "beef tallow", "chicken fat", "duck fat",

    // Meat derivatives
    "bouillon", "consommé", "extrait de viande", "meat extract",
    // + additions Meat derivatives
    "extrait de poulet", "extrait de boeuf", "extrait de bœuf", "extrait de porc",
    "arôme viande", "arôme de viande",
    "chicken extract", "beef extract", "pork extract",
    "meat flavor", "meat flavour",

    // Blood
    "sang", "boudin", "blood", "blood sausage",
    // + additions Blood
    "plasma", "hémoglobine", "hemoglobin", "haemoglobin",

    // Enzymes/Rennet
    "présure", "rennet",

    // Meat (Chicken, Beef...) - Base list
    "poulet", "volaille", "dinde", "canard",
    "bœuf", "boeuf", "vache", "veau",
    "viande", "chair",
    "mouton", "agneau",
    "chicken", "poultry", "turkey", "duck",
    "beef", "cow", "veal",
    "meat",
    "lamb", "mutton", "sheep",
].map(term => term.toLowerCase());

// Combined for backwards compatibility
export const HARAM_BLACKLIST: string[] = [...JAPANESE_HARAM_TERMS, ...LATIN_HARAM_TERMS];

// Whitelist terms that should NEVER match as haram (extra safety layer)
const SAFE_TERMS = [
    "vinaigre", "酢", "醸造酢", "ビネガー", "vinegar", "米酢", "りんご酢",
    "balsamic", "バルサミコ"
];

/**
 * Check if a character is Japanese (kanji, hiragana, katakana)
 */
function isJapaneseChar(char: string): boolean {
    const code = char.charCodeAt(0);
    return (
        (code >= 0x3040 && code <= 0x309F) || // Hiragana
        (code >= 0x30A0 && code <= 0x30FF) || // Katakana
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4DBF)    // CJK Extension A
    );
}

/**
 * Check if term is primarily Japanese
 */
function isJapaneseTerm(text: string): boolean {
    const japaneseChars = [...text].filter(isJapaneseChar).length;
    return japaneseChars > text.length / 2;
}

/**
 * Check if a Latin term matches as a whole word in the text.
 * "vin" matches "vin rouge", "du vin", but NOT "vinaigre"
 */
function matchesWholeWord(text: string, term: string): boolean {
    // Escape special regex characters in the term
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundary regex
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    return regex.test(text);
}

/**
 * Check if an ingredient matches the haram blacklist.
 *
 * Supports BOTH Japanese and Latin text:
 * - Japanese: Exact match (word boundaries don't work with Japanese)
 * - Latin (French/English): Word boundary matching
 *
 * BUG FIX (Bug 10): Added Japanese term support for direct matching
 *
 * @param text - The text to check (Japanese or French/English)
 * @returns true if the text contains a haram term
 */
export function isHaramIngredient(text: string): boolean {
    const lowerText = text.toLowerCase();

    // First check if this is a safe term (vinegar, etc.)
    if (SAFE_TERMS.some(safe => lowerText.includes(safe.toLowerCase()))) {
        return false;
    }

    // Check Japanese terms: use includes so tokens like "野菜色素)酒精" still match "酒精"
    for (const term of JAPANESE_HARAM_TERMS) {
        if (lowerText.includes(term)) {
            return true;
        }
    }

    // Check Latin terms with word boundary matching
    // "vin" matches "vin rouge" but NOT "vinaigre"
    for (const term of LATIN_HARAM_TERMS) {
        if (matchesWholeWord(lowerText, term)) {
            return true;
        }
    }

    return false;
}

/**
 * Get the matching haram term if found.
 * @param text - The text to check
 * @returns The matching term or null
 */
export function getMatchingHaramTerm(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Check safe terms first
    if (SAFE_TERMS.some(safe => lowerText.includes(safe.toLowerCase()))) {
        return null;
    }

    // Check Japanese terms
    for (const term of JAPANESE_HARAM_TERMS) {
        if (lowerText.includes(term)) {
            return term;
        }
    }

    // Check Latin terms with word boundaries
    for (const term of LATIN_HARAM_TERMS) {
        if (matchesWholeWord(lowerText, term)) {
            return term;
        }
    }

    return null;
}
