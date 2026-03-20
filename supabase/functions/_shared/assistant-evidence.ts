export type ScanIngredientWithReason = {
  raw: string;
  normalized: string;
  reason: string;
};

export type AssistantCriterionKind = "allergen" | "profile";

export type AssistantSelectedCriterion = {
  label: string;
  kind: AssistantCriterionKind;
  aliases: string[];
};

export type AssistantEvidenceClassification =
  | "direct_blocker"
  | "ambiguous_scoped"
  | "ambiguous_global";

export type AssistantEvidenceScope = "one" | "many" | "all_selected";

export type AssistantEvidence = {
  ingredient_label: string;
  ingredient_raw: string;
  classification: AssistantEvidenceClassification;
  criterion_labels: string[];
  criterion_kind: AssistantCriterionKind | "mixed";
  reason: string;
  scope: AssistantEvidenceScope;
};

export type AssistantEvidenceMatrix = {
  direct_blockers: AssistantEvidence[];
  ambiguous_scoped: AssistantEvidence[];
  ambiguous_global: AssistantEvidence[];
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeComparisonLabel(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean)));
}

function cleanIngredientDisplayLabel(value: string) {
  let next = normalizeWhitespace(value)
    .replace(/^["'`«»]+|["'`«»]+$/g, "")
    .replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, "");

  const leadingPatterns = [
    /^(?:contains?|may contain|with)\s+/i,
    /^(?:traces?\s+of|trace\s+of)\s+/i,
    /^(?:contient|contiennent)\s+(?:du|de la|des|de l'|d')\s+/i,
    /^(?:presence|présence)\s+de\s+/i,
    /^(?:traces?\s+de)\s+/i,
    /^(?:ingredient|ingrédient|ingredients|ingrédients)\s*:\s*/i,
    /^(?:allergene|allergène|allergen)\s*:\s*/i,
  ];

  for (const pattern of leadingPatterns) {
    next = next.replace(pattern, "");
  }

  return next
    .replace(/^\b(?:du|de la|des|de l'|d')\b\s*/i, "")
    .replace(/^\b(?:the|a|an)\b\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function matchesAlias(text: string, alias: string) {
  const normalizedText = normalizeComparisonLabel(text);
  const normalizedAlias = normalizeComparisonLabel(alias);
  if (!normalizedText || !normalizedAlias || normalizedAlias.length < 3) return false;

  if (/^[a-z0-9\s-]+$/i.test(normalizedAlias)) {
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(normalizedText);
  }

  return normalizedText.includes(normalizedAlias);
}

function extractExplicitCriterionText(reason: string) {
  const match = reason.match(/(?:family|famille|criterion|critere|critère)\s*:\s*(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function findCriterionLabelsForReason(reason: string, criteria: AssistantSelectedCriterion[]) {
  const explicit = extractExplicitCriterionText(reason);
  const candidateTexts = [explicit, reason].filter(Boolean);
  const labels = new Set<string>();

  for (const text of candidateTexts) {
    for (const criterion of criteria) {
      if (criterion.aliases.some((alias) => matchesAlias(text, alias))) {
        labels.add(criterion.label);
      }
    }
  }

  return [...labels];
}

function inferCriterionKind(
  criterionLabels: string[],
  criteriaByLabel: Map<string, AssistantSelectedCriterion>,
): AssistantCriterionKind | "mixed" {
  const kinds = new Set(
    criterionLabels
      .map((label) => criteriaByLabel.get(label)?.kind)
      .filter((kind): kind is AssistantCriterionKind => kind === "allergen" || kind === "profile"),
  );

  if (kinds.size === 0) return "mixed";
  if (kinds.size === 1) return [...kinds][0];
  return "mixed";
}

function toEvidence(
  item: ScanIngredientWithReason,
  classification: AssistantEvidenceClassification,
  criterionLabels: string[],
  criteriaByLabel: Map<string, AssistantSelectedCriterion>,
  allSelectedLabels: string[],
): AssistantEvidence {
  const finalCriterionLabels = classification === "ambiguous_global"
    ? allSelectedLabels
    : criterionLabels;

  const scope: AssistantEvidenceScope = classification === "ambiguous_global"
    ? "all_selected"
    : finalCriterionLabels.length <= 1
    ? "one"
    : "many";

  return {
    ingredient_label: cleanIngredientDisplayLabel(item.normalized || item.raw),
    ingredient_raw: item.raw,
    classification,
    criterion_labels: finalCriterionLabels,
    criterion_kind: inferCriterionKind(finalCriterionLabels, criteriaByLabel),
    reason: normalizeWhitespace(item.reason),
    scope,
  };
}

export function buildAssistantEvidenceMatrix(input: {
  selectedCriteria: AssistantSelectedCriterion[];
  ambiguousIngredients: ScanIngredientWithReason[];
  allergenIngredients: ScanIngredientWithReason[];
}): AssistantEvidenceMatrix {
  const criteriaByLabel = new Map(input.selectedCriteria.map((criterion) => [criterion.label, criterion]));
  const allSelectedLabels = dedupeStrings(input.selectedCriteria.map((criterion) => criterion.label));

  const direct_blockers = input.allergenIngredients.map((item) => {
    let criterionLabels = findCriterionLabelsForReason(item.reason, input.selectedCriteria);

    if (criterionLabels.length === 0 && allSelectedLabels.length === 1) {
      criterionLabels = [...allSelectedLabels];
    }

    return toEvidence(item, "direct_blocker", dedupeStrings(criterionLabels), criteriaByLabel, allSelectedLabels);
  });

  const ambiguous_scoped: AssistantEvidence[] = [];
  const ambiguous_global: AssistantEvidence[] = [];

  for (const item of input.ambiguousIngredients) {
    const criterionLabels = dedupeStrings(findCriterionLabelsForReason(item.reason, input.selectedCriteria));
    const classification: AssistantEvidenceClassification = (
      criterionLabels.length === 0
      || (allSelectedLabels.length > 1 && criterionLabels.length >= allSelectedLabels.length)
    )
      ? "ambiguous_global"
      : "ambiguous_scoped";

    const evidence = toEvidence(item, classification, criterionLabels, criteriaByLabel, allSelectedLabels);
    if (classification === "ambiguous_scoped") {
      ambiguous_scoped.push(evidence);
    } else {
      ambiguous_global.push(evidence);
    }
  }

  return {
    direct_blockers,
    ambiguous_scoped,
    ambiguous_global,
  };
}
