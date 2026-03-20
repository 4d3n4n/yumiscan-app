import type {
  AssistantEvidence,
  AssistantSelectedCriterion,
  ScanIngredientWithReason,
} from "../_shared/assistant-evidence.ts";
import type {
  ScanAmbiguousAssistantResponse,
  ScanAssistantMode,
  ScanAssistantStorePhrase,
} from "../_shared/scan-ai-assistant.ts";

import type {
  AssistantLanguage,
  AssistantPerspective,
  AssistantScanContext,
} from "./types.ts";

const LOW_VALUE_INGREDIENT_LABELS = new Set([
  "autre",
  "other",
  "acidifiant",
  "acidifier",
  "epaississant",
  "épaississant",
  "thickener",
  "assaisonnement",
  "seasoning",
  "additif",
  "additive",
  "arome",
  "arôme",
  "flavoring",
  "composition incomplete",
  "composition incomplète",
  "composition non entierement detaillee",
  "composition non entièrement détaillée",
]);

const DIETARY_PROFILE_LABELS = new Set([
  "halal",
  "vegan",
  "vegetarian",
  "vegetarien",
  "végétarien",
  "kosher",
  "kasher",
]);

export function inferAssistantMode(context: AssistantScanContext): ScanAssistantMode {
  if (context.productStatus === "contains_allergen" || context.allergenIngredients.length > 0) {
    return "allergen";
  }

  return "ambiguous";
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function parseResultJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return asRecord(value);
}

export function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const record = asRecord(value);
  if (record) {
    const serializedEntries = Object.keys(record)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);
    return `{${serializedEntries.join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

export function fnv1aHash(value: string) {
  let hash = 0x811c9dc5;

  for (const symbol of value) {
    hash ^= symbol.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeComparisonLabel(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function isLowValueIngredientLabel(value: string) {
  return LOW_VALUE_INGREDIENT_LABELS.has(normalizeComparisonLabel(value));
}

export function isDietaryProfileLabel(value: string) {
  return DIETARY_PROFILE_LABELS.has(normalizeComparisonLabel(value));
}

export function stripRiskTokens(value: string) {
  return normalizeWhitespace(
    value.replace(/\b(probably_ok|check_required|avoid_if_uncertain)\b/gi, " "),
  );
}

export function hasRiskToken(value: string) {
  return /\b(probably_ok|check_required|avoid_if_uncertain)\b/i.test(value);
}

export function isLanguageCodeOnly(value: string) {
  return /^(fr|en|ja|jp|romaji|fr-fr|fr_ca|en-us|en-gb)$/i.test(normalizeWhitespace(value));
}

export function hasNonAscii(value: string) {
  return /[^\x00-\x7F]/.test(value);
}

export function isValidHumanSentence(value: string, minimumLength = 16) {
  const normalized = stripRiskTokens(value);
  return normalized.length >= minimumLength && !isLanguageCodeOnly(normalized);
}

export function normalizeVisibleAssistantText(value: string) {
  return normalizeWhitespace(
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, " "),
  ).toLowerCase();
}

export function buildAssistantResponseComparisonSignature(response: ScanAmbiguousAssistantResponse) {
  return stableSerialize({
    mode: response.mode,
    risk_level: response.risk_level,
    analysis_summary: normalizeVisibleAssistantText(response.analysis_summary),
    ambiguity_reasons: response.ambiguity_reasons.map((reason) => normalizeVisibleAssistantText(reason)),
    checkpoints: response.checkpoints.map((checkpoint) => normalizeVisibleAssistantText(checkpoint)),
    store_phrases: response.store_phrases.map((phrase) => ({
      title: normalizeVisibleAssistantText(phrase.title),
      user_language: normalizeVisibleAssistantText(phrase.user_language),
      japanese: normalizeWhitespace(phrase.japanese),
      romaji: normalizeVisibleAssistantText(phrase.romaji),
    })),
    disclaimer: normalizeVisibleAssistantText(response.disclaimer),
  });
}

export function areAssistantResponsesMeaningfullyDifferent(
  previousResponse: ScanAmbiguousAssistantResponse | null | undefined,
  nextResponse: ScanAmbiguousAssistantResponse,
) {
  if (!previousResponse) {
    return true;
  }

  return buildAssistantResponseComparisonSignature(previousResponse)
    !== buildAssistantResponseComparisonSignature(nextResponse);
}

export function buildPhraseDedupKey(phrase: ScanAssistantStorePhrase) {
  return normalizeComparisonLabel(`${phrase.title}::${phrase.japanese}::${phrase.romaji}`);
}

export function mergeStorePhrases(
  existing: ScanAssistantStorePhrase[],
  additions: ScanAssistantStorePhrase[],
  maxCount: number,
) {
  const merged: ScanAssistantStorePhrase[] = [];
  const seen = new Set<string>();

  for (const phrase of [...existing, ...additions]) {
    const dedupeKey = buildPhraseDedupKey(phrase);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(phrase);
    if (merged.length >= maxCount) break;
  }

  return merged;
}

export function toIngredientWithReason(value: unknown): ScanIngredientWithReason | null {
  const record = asRecord(value);
  if (!record) return null;

  const raw = asString(record.raw);
  const normalized = asString(record.normalized) || raw;
  const reason = asString(record.reason);

  if (!raw || !reason) return null;
  return { raw, normalized, reason };
}

export function getIngredientWithReasonList(record: Record<string, unknown> | null, key: string) {
  return asArray<unknown>(record?.[key])
    .map(toIngredientWithReason)
    .filter((item): item is ScanIngredientWithReason => item !== null);
}

export function localizeAllergenName(
  allergen: { name?: string | null; name_en?: string | null },
  language: AssistantLanguage,
) {
  if (language === "en" && allergen.name_en?.trim()) {
    return allergen.name_en.trim();
  }

  return allergen.name?.trim() ?? "";
}

export function joinHumanList(values: string[], language: AssistantLanguage) {
  const uniqueValues = dedupeStrings(values);
  if (uniqueValues.length === 0) return "";
  if (uniqueValues.length === 1) return uniqueValues[0];
  if (uniqueValues.length === 2) {
    return language === "fr"
      ? `${uniqueValues[0]} et ${uniqueValues[1]}`
      : `${uniqueValues[0]} and ${uniqueValues[1]}`;
  }

  const last = uniqueValues.length > 0 ? uniqueValues[uniqueValues.length - 1] : "";
  const head = uniqueValues.slice(0, -1).join(", ");
  return language === "fr" ? `${head} et ${last}` : `${head}, and ${last}`;
}

export function splitSelectedCriteria(labels: string[]) {
  const selectedProfileLabels: string[] = [];
  const selectedAllergenLabels: string[] = [];

  for (const label of dedupeStrings(labels)) {
    if (isDietaryProfileLabel(label)) {
      selectedProfileLabels.push(label);
      continue;
    }

    selectedAllergenLabels.push(label);
  }

  return {
    selectedProfileLabels,
    selectedAllergenLabels,
  };
}

export function buildSelectedCriteria(
  allergenRows: Array<{ name?: string | null; name_en?: string | null }>,
  language: AssistantLanguage,
) {
  const selectedCriteria: AssistantSelectedCriterion[] = [];

  for (const row of allergenRows) {
    const label = localizeAllergenName(row, language);
    if (!label) continue;

    const aliases = dedupeStrings([
      label,
      row.name?.trim() ?? "",
      row.name_en?.trim() ?? "",
    ]);

    const isProfile = aliases.some((alias) => isDietaryProfileLabel(alias));
    selectedCriteria.push({
      label,
      kind: isProfile ? "profile" : "allergen",
      aliases,
    });
  }

  return selectedCriteria;
}

export function getCriterionLabelsForEvidence(evidences: AssistantEvidence[]) {
  return dedupeStrings(evidences.flatMap((evidence) => evidence.criterion_labels));
}

export function getCriterionKindForLabels(context: AssistantScanContext, criterionLabels: string[]) {
  const kinds = new Set(
    criterionLabels
      .map((label) => context.selectedCriteria.find((criterion) => criterion.label === label)?.kind)
      .filter((kind): kind is "allergen" | "profile" => kind === "allergen" || kind === "profile"),
  );

  if (kinds.size === 0) return "mixed";
  if (kinds.size === 1) return [...kinds][0];
  return "mixed";
}

export function cleanIngredientDisplayLabel(value: string) {
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

export function getEvidenceIngredientLabels(evidences: AssistantEvidence[]) {
  return dedupeStrings(
    evidences
      .map((evidence) => cleanIngredientDisplayLabel(evidence.ingredient_label))
      .filter(Boolean),
  );
}

export function getPrimaryEvidenceSet(context: AssistantScanContext) {
  if (context.evidenceMatrix.direct_blockers.length > 0) {
    return {
      primary: context.evidenceMatrix.direct_blockers,
      secondary: [
        ...context.evidenceMatrix.ambiguous_scoped,
        ...context.evidenceMatrix.ambiguous_global,
      ],
      classification: "direct_blocker" as const,
    };
  }

  if (context.evidenceMatrix.ambiguous_scoped.length > 0) {
    return {
      primary: context.evidenceMatrix.ambiguous_scoped,
      secondary: context.evidenceMatrix.ambiguous_global,
      classification: "ambiguous_scoped" as const,
    };
  }

  return {
    primary: context.evidenceMatrix.ambiguous_global,
    secondary: [] as AssistantEvidence[],
    classification: "ambiguous_global" as const,
  };
}

function getPerspectivePossessive(
  language: AssistantLanguage,
  perspective: AssistantPerspective,
) {
  if (perspective === "assistant") {
    return language === "fr" ? "votre" : "your";
  }

  return language === "fr" ? "mon" : "my";
}

function buildProfileCriteriaPhrase(
  labels: string[],
  language: AssistantLanguage,
  perspective: AssistantPerspective,
  possessive: string,
) {
  if (labels.length === 1) {
    if (language === "fr") {
      return perspective === "assistant"
        ? `votre régime ${labels[0]}`
        : `mon régime ${labels[0]}`;
    }

    return `${possessive} ${labels[0]} diet`;
  }

  if (language === "fr") {
    return perspective === "assistant"
      ? "vos critères alimentaires"
      : "mes critères alimentaires";
  }

  return `${possessive} dietary requirements`;
}

function buildAllergenCriteriaPhrase(
  labels: string[],
  language: AssistantLanguage,
  perspective: AssistantPerspective,
  possessive: string,
) {
  if (labels.length === 1) {
    return language === "fr"
      ? `${possessive} allergène ${labels[0]}`
      : `${possessive} ${labels[0]} allergen restriction`;
  }

  if (language === "fr") {
    return perspective === "assistant"
      ? "vos allergènes sélectionnés"
      : "mes allergènes sélectionnés";
  }

  return `${possessive} selected allergens`;
}

export function buildCriteriaPhrase(
  context: AssistantScanContext,
  criterionLabels: string[],
  language: AssistantLanguage,
  perspective: AssistantPerspective = "assistant",
) {
  const labels = dedupeStrings(criterionLabels);
  if (labels.length === 0) {
    return getCompatibilityDescriptor(context, language, perspective);
  }

  const labelKind = getCriterionKindForLabels(context, labels);
  const possessive = getPerspectivePossessive(language, perspective);

  if (labelKind === "profile") {
    return buildProfileCriteriaPhrase(labels, language, perspective, possessive);
  }

  if (labelKind === "allergen") {
    return buildAllergenCriteriaPhrase(labels, language, perspective, possessive);
  }

  const joined = joinHumanList(labels, language);
  return language === "fr"
    ? `${possessive} critères ${joined}`
    : `${possessive} criteria ${joined}`;
}

export function buildUserNeedSentence(
  context: AssistantScanContext,
  criterionLabels: string[],
  language: AssistantLanguage,
) {
  const labels = dedupeStrings(criterionLabels);
  if (labels.length === 0) {
    return language === "fr"
      ? "Je cherche une option plus sûre pour mon profil alimentaire."
      : "I need a safer option for my food profile.";
  }

  const profileLabels = labels.filter((label) =>
    context.selectedCriteria.find((criterion) => criterion.label === label)?.kind === "profile");
  const allergenLabels = labels.filter((label) =>
    context.selectedCriteria.find((criterion) => criterion.label === label)?.kind === "allergen");

  if (language === "fr") {
    const parts: string[] = [];
    if (allergenLabels.length > 0) {
      parts.push(`Je dois éviter ${joinHumanList(allergenLabels, language)}.`);
    }
    if (profileLabels.length === 1) {
      parts.push(`Je cherche une option compatible avec mon régime ${profileLabels[0]}.`);
    } else if (profileLabels.length > 1) {
      parts.push("Je cherche une option compatible avec mes critères alimentaires.");
    }
    return parts.join(" ");
  }

  const parts: string[] = [];
  if (allergenLabels.length > 0) {
    parts.push(`I need to avoid ${joinHumanList(allergenLabels, language)}.`);
  }
  if (profileLabels.length === 1) {
    parts.push(`I need an option compatible with my ${profileLabels[0]} diet.`);
  } else if (profileLabels.length > 1) {
    parts.push("I need an option compatible with my dietary requirements.");
  }
  return parts.join(" ");
}

export function buildQuotedLabelList(values: string[], language: AssistantLanguage) {
  const labels = dedupeStrings(values).map((value) => cleanIngredientDisplayLabel(value)).filter(Boolean);
  if (labels.length === 0) return "";

  const quoted = labels.map((label) => language === "fr" ? `« ${label} »` : `"${label}"`);
  if (quoted.length === 1) {
    return language === "fr"
      ? `la mention ${quoted[0]}`
      : `the mention ${quoted[0]}`;
  }

  return language === "fr"
    ? `les mentions ${joinHumanList(quoted, language)}`
    : `the mentions ${joinHumanList(quoted, language)}`;
}

export function buildMentionExamples(values: string[], language: AssistantLanguage) {
  const labels = dedupeStrings(values).map((value) => cleanIngredientDisplayLabel(value)).filter(Boolean);
  if (labels.length === 0) return "";

  const quoted = labels.map((label) => language === "fr" ? `« ${label} »` : `"${label}"`);
  if (quoted.length === 1) {
    return language === "fr"
      ? `la mention ${quoted[0]}`
      : `the mention ${quoted[0]}`;
  }

  return language === "fr"
    ? `des mentions comme ${joinHumanList(quoted, language)}`
    : `mentions such as ${joinHumanList(quoted, language)}`;
}

function buildProfileDescriptor(
  label: string,
  normalizedLabel: string,
  language: AssistantLanguage,
  possessive: string,
  perspective: AssistantPerspective,
) {
  const knownDietaryProfile = [
    "halal",
    "vegan",
    "vegetarian",
    "vegetarien",
    "végétarien",
    "kosher",
    "kasher",
  ].includes(normalizedLabel);

  if (knownDietaryProfile) {
    if (language === "fr") {
      return perspective === "assistant"
        ? `votre régime ${label}`
        : `mon régime ${label}`;
    }

    return `${possessive} ${label} diet`;
  }

  return language === "fr"
    ? `${possessive} profil ${label}`
    : `${possessive} ${label} dietary profile`;
}

export function getCompatibilityDescriptor(
  context: AssistantScanContext,
  language: AssistantLanguage,
  perspective: AssistantPerspective = "assistant",
) {
  const possessive = getPerspectivePossessive(language, perspective);

  if (context.selectedProfileLabels.length === 1) {
    const label = context.selectedProfileLabels[0];
    return buildProfileDescriptor(
      label,
      normalizeComparisonLabel(label),
      language,
      possessive,
      perspective,
    );
  }

  if (context.selectedProfileLabels.length > 1) {
    if (language === "fr") {
      return perspective === "assistant"
        ? "vos critères alimentaires"
        : "mes critères alimentaires";
    }

    return `${possessive} dietary requirements`;
  }

  if (context.selectedAllergenLabels.length === 1) {
    const label = context.selectedAllergenLabels[0];
    return language === "fr"
      ? `${possessive} critère ${label}`
      : `${possessive} ${label} restriction`;
  }

  if (context.selectedAllergenLabels.length > 1) {
    if (language === "fr") {
      return perspective === "assistant"
        ? "vos allergènes sélectionnés"
        : "mes allergènes sélectionnés";
    }

    return `${possessive} selected allergens`;
  }

  if (language === "fr") {
    return perspective === "assistant"
      ? "votre profil alimentaire"
      : "mon profil alimentaire";
  }

  return `${possessive} food profile`;
}

function rankIngredientLabel(label: string) {
  let score = label.length;
  if (label.includes(",")) score += 24;
  if (label.length > 42) score += 12;
  return score;
}

export function buildHelpfulIngredientLabels(items: ScanIngredientWithReason[]) {
  const labels = dedupeStrings(
    items
      .map((item) => cleanIngredientDisplayLabel(item.normalized || item.raw))
      .filter(Boolean),
  );
  const specificLabels = labels.filter((label) =>
    !isLowValueIngredientLabel(label) && !isDietaryProfileLabel(label));
  const rankedLabels = (specificLabels.length > 0 ? specificLabels : labels)
    .sort((left, right) => rankIngredientLabel(left) - rankIngredientLabel(right));

  const kept: string[] = [];

  for (const label of rankedLabels) {
    const current = label.toLowerCase();
    const isVerboseVariant = kept.some((existing) => {
      const previous = existing.toLowerCase();
      return current !== previous && current.includes(previous) && label.length >= existing.length + 8;
    });

    if (isVerboseVariant) continue;
    kept.push(label);
    if (kept.length >= 3) break;
  }

  return kept;
}

export function mentionsAnyReferenceLabel(value: string, labels: string[]) {
  const normalizedValue = normalizeComparisonLabel(value);
  if (!normalizedValue) return false;

  return dedupeStrings(labels).some((label) => {
    const normalizedLabel = normalizeComparisonLabel(cleanIngredientDisplayLabel(label));
    return normalizedLabel.length >= 3 && normalizedValue.includes(normalizedLabel);
  });
}

export function collectMentionedEvidence(context: AssistantScanContext, value: string) {
  const normalizedValue = normalizeComparisonLabel(value);
  if (!normalizedValue) return [] as AssistantEvidence[];

  return [
    ...context.evidenceMatrix.direct_blockers,
    ...context.evidenceMatrix.ambiguous_scoped,
    ...context.evidenceMatrix.ambiguous_global,
  ].filter((evidence) => {
    const normalizedLabel = normalizeComparisonLabel(cleanIngredientDisplayLabel(evidence.ingredient_label));
    return normalizedLabel.length >= 3 && normalizedValue.includes(normalizedLabel);
  });
}

function mentionsCriterionOutsideEvidence(
  value: string,
  selectedLabels: string[],
  allowedCriterionLabels: string[],
) {
  return selectedLabels.some((label) =>
    mentionsAnyReferenceLabel(value, [label])
    && allowedCriterionLabels.length > 0
    && !allowedCriterionLabels.includes(label));
}

function usesInvalidProfileWording(normalizedValue: string) {
  return (
    normalizedValue.includes("sans halal")
    || normalizedValue.includes("without halal")
    || normalizedValue.includes("sans vegan")
    || normalizedValue.includes("without vegan")
    || normalizedValue.includes("sans vegetarian")
    || normalizedValue.includes("without vegetarian")
    || normalizedValue.includes("sans vegetarien")
    || normalizedValue.includes("without kosher")
    || normalizedValue.includes("sans kosher")
  );
}

function usesRawBlockingFragment(normalizedValue: string) {
  return (
    normalizedValue.includes("contient du")
    || normalizedValue.includes("contiennent du")
    || normalizedValue.includes("contains ")
    || normalizedValue.includes("may contain")
  );
}

function usesGenericAllergenPlaceholder(
  normalizedValue: string,
  hasSelectedAllergens: boolean,
  selectedAllergensKnown: boolean,
) {
  if (!hasSelectedAllergens) {
    return false;
  }

  return (
    (
      normalizedValue.includes("mes allergenes")
      || normalizedValue.includes("my allergens")
      || normalizedValue.includes("allergene concerne")
      || normalizedValue.includes("relevant allergen")
      || normalizedValue.includes("selected allergens")
    )
    && !selectedAllergensKnown
  );
}

function usesGenericProfilePlaceholder(
  normalizedValue: string,
  profileCount: number,
  profileLabelsKnown: boolean,
) {
  if (profileCount !== 1) {
    return false;
  }

  return (
    (
      normalizedValue.includes("votre profil")
      || normalizedValue.includes("your profile")
      || normalizedValue.includes("mon profil")
      || normalizedValue.includes("my profile")
    )
    && !profileLabelsKnown
  );
}

export function shouldPreferFallbackLine(
  value: string,
  fallback: string,
  context: AssistantScanContext,
  language: AssistantLanguage,
  surface: "summary" | "reason" | "checkpoint" | "title" | "user_language",
) {
  const normalizedValue = normalizeComparisonLabel(value);
  const normalizedFallback = normalizeComparisonLabel(fallback);

  if (!normalizedValue) return true;
  if (normalizedValue === normalizedFallback) return false;

  const hasDietaryProfiles = context.selectedProfileLabels.length > 0;
  const hasSelectedAllergens = context.selectedAllergenLabels.length > 0;
  const profileLabelsKnown = mentionsAnyReferenceLabel(value, context.selectedProfileLabels);
  const selectedAllergensKnown = mentionsAnyReferenceLabel(value, context.selectedAllergenLabels);
  const cleanBlockingLabels = getEvidenceIngredientLabels(context.evidenceMatrix.direct_blockers);
  const mentionedEvidence = collectMentionedEvidence(context, value);
  const allowedCriterionLabels = getCriterionLabelsForEvidence(mentionedEvidence);
  const mentionedProfileOutsideEvidence = mentionsCriterionOutsideEvidence(
    value,
    context.selectedProfileLabels,
    allowedCriterionLabels,
  );
  const mentionedAllergenOutsideEvidence = mentionsCriterionOutsideEvidence(
    value,
    context.selectedAllergenLabels,
    allowedCriterionLabels,
  );

  if (hasDietaryProfiles && /\b(allergene|allergen|allergenes|allergens)\b/.test(normalizedValue)) {
    return true;
  }

  if (mentionedProfileOutsideEvidence || mentionedAllergenOutsideEvidence) {
    return true;
  }

  if (
    hasDietaryProfiles
    && usesInvalidProfileWording(normalizedValue)
  ) {
    return true;
  }

  if (
    surface !== "user_language"
    && cleanBlockingLabels.length > 0
    && usesRawBlockingFragment(normalizedValue)
  ) {
    return true;
  }

  if (
    language === "fr"
    && surface === "title"
    && /\b(ask|check|show|look|ingredient|cross|contact|label|product)\b/.test(normalizedValue)
  ) {
    return true;
  }

  if (usesGenericAllergenPlaceholder(normalizedValue, hasSelectedAllergens, selectedAllergensKnown)) {
    return true;
  }

  if (usesGenericProfilePlaceholder(
    normalizedValue,
    context.selectedProfileLabels.length,
    profileLabelsKnown,
  )) {
    return true;
  }

  return false;
}

export function sanitizeLineWithFallback(
  value: string,
  fallback: string,
  context: AssistantScanContext,
  language: AssistantLanguage,
  surface: "summary" | "reason" | "checkpoint" | "title" | "user_language",
  minimumLength = 12,
) {
  const cleaned = stripRiskTokens(value);
  if (!isValidHumanSentence(cleaned, minimumLength)) {
    return fallback;
  }

  return shouldPreferFallbackLine(cleaned, fallback, context, language, surface)
    ? fallback
    : cleaned;
}

export function sanitizeContextualList(
  values: string[],
  fallback: string[],
  context: AssistantScanContext,
  language: AssistantLanguage,
  surface: "reason" | "checkpoint",
  minimumLength = 12,
) {
  const sanitized = dedupeStrings(
    values
      .slice(0, 3)
      .map((value, index) =>
        sanitizeLineWithFallback(
          value,
          fallback[index] ?? fallback[0],
          context,
          language,
          surface,
          minimumLength,
        ))
      .filter((value) => isValidHumanSentence(value, minimumLength)),
  );

  if (sanitized.length > 0) {
    return sanitized.slice(0, 3);
  }

  return fallback.slice(0, 3);
}

export function sanitizeStorePhrase(
  phrase: ScanAssistantStorePhrase,
  fallback: ScanAssistantStorePhrase,
  context: AssistantScanContext,
  language: AssistantLanguage,
): ScanAssistantStorePhrase {
  const title = sanitizeLineWithFallback(
    phrase.title,
    fallback.title,
    context,
    language,
    "title",
    4,
  );
  const userLanguage = sanitizeLineWithFallback(
    phrase.user_language,
    fallback.user_language,
    context,
    language,
    "user_language",
    14,
  );
  const japanese = normalizeWhitespace(phrase.japanese);
  const romaji = normalizeWhitespace(phrase.romaji);

  return {
    title: title.length >= 4 ? title : fallback.title,
    user_language: userLanguage,
    japanese: japanese.length >= 8 && hasNonAscii(japanese)
      ? japanese
      : fallback.japanese,
    romaji: romaji.length >= 8 && !hasNonAscii(romaji)
      ? romaji
      : fallback.romaji,
  };
}
