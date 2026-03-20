// @ts-ignore Deno local imports require the .ts extension in Edge Functions.
import { matchAllergenBlacklist, type AllergenKeywords, type TranslatedItem } from "../mapping/allergen.ts";

type Phase2OutputLanguage = "fr" | "en";

export type Phase2IngredientPair = {
    raw: string;
    normalized: string;
};

export type Phase2IngredientWithReason = Phase2IngredientPair & {
    reason: string;
};

export type Phase2ClassificationOutput = {
    ok_ingredients: Phase2IngredientPair[];
    not_ok_ingredients: Phase2IngredientPair[];
    ambiguous_ingredients: Phase2IngredientWithReason[];
    allergens_ingredients: Phase2IngredientWithReason[];
};

function getFamilyReasonPrefix(outputLanguage: Phase2OutputLanguage): "Famille" | "Family" {
    return outputLanguage === "en" ? "Family" : "Famille";
}

function buildIngredientKey(raw: string, normalized: string): string {
    return `${raw}::${normalized}`;
}

function dedupeIngredientPairs<T extends { raw: string; normalized: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    const deduped: T[] = [];

    for (const item of items) {
        const key = buildIngredientKey(item.raw, item.normalized);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
    }

    return deduped;
}

function filterPhase2ItemsToAllowedKeys<T extends { raw: string; normalized: string }>(
    items: T[],
    allowedKeys: Set<string>,
): T[] {
    return dedupeIngredientPairs(
        items.filter((item) => allowedKeys.has(buildIngredientKey(item.raw, item.normalized))),
    );
}

export function sanitizePhase2Output(
    unmapped: TranslatedItem[],
    output: Phase2ClassificationOutput,
    allergenKeywords: AllergenKeywords[],
    outputLanguage: Phase2OutputLanguage,
): Phase2ClassificationOutput {
    const allowedKeys = new Set(
        unmapped.map((item) => buildIngredientKey(item.raw, item.normalized_fr)),
    );

    const okIngredients = filterPhase2ItemsToAllowedKeys(output.ok_ingredients, allowedKeys);
    const ambiguousIngredients = filterPhase2ItemsToAllowedKeys(output.ambiguous_ingredients, allowedKeys);
    const allergenCandidates = filterPhase2ItemsToAllowedKeys(output.allergens_ingredients, allowedKeys);

    const deterministicAllergens = matchAllergenBlacklist(
        allergenCandidates.map((item) => ({
            raw: item.raw,
            normalized_fr: item.normalized,
        })),
        allergenKeywords,
        { reasonPrefix: getFamilyReasonPrefix(outputLanguage) },
    ).allergens_ingredients;

    const keptAllergenKeys = new Set(
        deterministicAllergens.map((item) => buildIngredientKey(item.raw, item.normalized)),
    );

    const downgradedAllergens = allergenCandidates
        .filter((item) => !keptAllergenKeys.has(buildIngredientKey(item.raw, item.normalized)))
        .map((item) => ({ raw: item.raw, normalized: item.normalized }));

    return {
        ok_ingredients: dedupeIngredientPairs([...okIngredients, ...downgradedAllergens]),
        not_ok_ingredients: [],
        ambiguous_ingredients: ambiguousIngredients.filter(
            (item) => !keptAllergenKeys.has(buildIngredientKey(item.raw, item.normalized)),
        ),
        allergens_ingredients: dedupeIngredientPairs(deterministicAllergens),
    };
}
