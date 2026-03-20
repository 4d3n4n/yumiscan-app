
import { ParsedIngredient, SubIngredient } from "../parsing/sub_ingredient_parser";

/**
 * Get all leaf nodes (ingredients without sub-ingredients) from a tree.
 */
export function getLeaves(nodes: ParsedIngredient[]): SubIngredient[] {
    const leaves: SubIngredient[] = [];

    function traverse(node: ParsedIngredient | SubIngredient) {
        if (!node.sub_ingredients || node.sub_ingredients.length === 0) {
            leaves.push(node as unknown as SubIngredient);
        } else {
            node.sub_ingredients.forEach(traverse);
        }
    }
    nodes.forEach(traverse);
    return leaves;
}

/**
 * Propagate status from children to parents (Bottom-Up).
 *
 * Rules:
 * - If any child is ALLERGEN, parent is ALLERGEN.
 * - If any child is AMBIGUOUS (and not allergen), parent is AMBIGUOUS.
 * - Else OK.
 */
export function propagateStatus(node: ParsedIngredient | SubIngredient): "ok" | "ambiguous" | "contains_allergen" {
    if (!node.sub_ingredients || node.sub_ingredients.length === 0) {
        return (node.status as "ok" | "ambiguous" | "contains_allergen") || "ok";
    }

    let hasAllergen = false;
    let hasAmbiguous = false;

    for (const child of node.sub_ingredients) {
        const childStatus = propagateStatus(child);
        if (childStatus === "contains_allergen") hasAllergen = true;
        if (childStatus === "ambiguous") hasAmbiguous = true;
    }

    if (hasAllergen) {
        node.status = "contains_allergen";
    } else if (hasAmbiguous) {
        node.status = "ambiguous";
    } else {
        node.status = "ok";
    }

    return node.status as "ok" | "ambiguous" | "contains_allergen";
}
