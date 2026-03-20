import type { IngredientPair, FinalIngredient, Phase0Output } from "./schemas.ts";

/**
 * Type guard for IngredientPair.
 */
export function isIngredientPair(value: unknown): value is IngredientPair {
    return (
        typeof value === "object" &&
        value !== null &&
        "raw" in value &&
        "normalized" in value &&
        typeof (value as IngredientPair).raw === "string" &&
        typeof (value as IngredientPair).normalized === "string"
    );
}

/**
 * Type guard for FinalIngredient.
 */
export function isFinalIngredient(value: unknown): value is FinalIngredient {
    if (!isIngredientPair(value)) return false;
    const ing = value as Record<string, unknown>;
    return (
        "status" in ing &&
        "reason" in ing &&
        typeof ing.status === "string" &&
        ["OK", "NON_OK", "AMBIGU", "ALLERGEN"].includes(ing.status) &&
        typeof ing.reason === "string"
    );
}

/**
 * Check if Phase 0 output indicates "not an ingredients image".
 */
export function isNotIngredientsImage(output: Phase0Output): boolean {
    return !output.is_valid_product ||
        (output.notes || []).some(
            (note) => typeof note === "string" && note.includes("IMAGE_NOT_INGREDIENTS")
        );
}

/**
 * Check if Phase 0 output has prompt injection flag.
 */
export function hasPromptInjectionFlag(output: Phase0Output): boolean {
    return (output.notes || []).some(
        (note: string) => typeof note === "string" && note.includes("PROMPT_INJECTION_DETECTED")
    );
}

/**
 * Check if an ingredient matches an allergen name (case-insensitive).
 */
export function ingredientMatchesAllergen(
    ingredient: IngredientPair,
    allergenNames: string[]
): boolean {
    const text = `${ingredient.raw} ${ingredient.normalized}`.toLowerCase();
    return allergenNames.some((name) => text.includes(name.toLowerCase()));
}

/**
 * Check if ingredient looks like an additive based on common patterns.
 */
export function isAdditiveIngredient(ingredient: { raw?: string; normalized?: string }): boolean {
    const additivePatterns = /épaississant|acidifiant|amidon transformé|加工澱粉|増粘|酸味料|colorant|conservateur|antioxydant|émulsifiant/i;
    const text = `${ingredient.raw ?? ""} ${ingredient.normalized ?? ""}`;
    return additivePatterns.test(text);
}
