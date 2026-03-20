import type {
  ScanAmbiguousAssistantResponse,
  ScanAssistantStorePhrase,
} from "../_shared/scan-ai-assistant.ts";

import { buildFallbackAdditionalCards, buildFallbackResponse } from "./fallbacks.ts";
import {
  AdditionalCardsResponseSchema,
  AssistantResponseSchema,
} from "./schema.ts";
import {
  DEFAULT_ASSISTANT_CARD_COUNT,
  MAX_ASSISTANT_CARD_COUNT,
  type AssistantGenerationOptions,
  type AssistantLanguage,
  type AssistantScanContext,
} from "./types.ts";
import {
  asArray,
  asRecord,
  asString,
  buildCriteriaPhrase,
  buildMentionExamples,
  dedupeStrings,
  getCriterionLabelsForEvidence,
  getEvidenceIngredientLabels,
  getPrimaryEvidenceSet,
  hasRiskToken,
  inferAssistantMode,
  isValidHumanSentence,
  sanitizeContextualList,
  sanitizeLineWithFallback,
  sanitizeStorePhrase,
  stripRiskTokens,
} from "./helpers.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_KEY")?.trim();

type AssistantDraftResponse = Omit<ScanAmbiguousAssistantResponse, "mode">;

type AdditionalCardsDraftResponse = {
  store_phrases: ScanAssistantStorePhrase[];
};

const MAIN_RESPONSE_JSON_EXAMPLE = JSON.stringify({
  analysis_summary: "Le scan a releve la mention « soja », qui correspond a votre critere soja. Ce point suffit deja a ecarter ce produit.",
  ambiguity_reasons: [
    "L'etiquette fait apparaitre la mention « soja ».",
    "Ce point est incompatible avec votre critere soja.",
    "La bonne action est de demander une alternative plus sure.",
  ],
  checkpoints: [
    "Retenir que la mention « soja » pose probleme pour votre critere soja.",
    "Demander une alternative plus sure.",
    "Faire confirmer la recette exacte si besoin.",
  ],
  store_phrases: [
    {
      title: "Demander une alternative",
      user_language: "Je dois eviter le soja. Avez-vous une alternative plus sure ?",
      japanese: "大豆を避ける必要があります。より安全な代替品はありますか。",
      romaji: "Daizu o sakeru hitsuyo ga arimasu. Yori anzen na daitaihin wa arimasu ka.",
    },
    {
      title: "Montrer l'etiquette",
      user_language: "Pouvez-vous me montrer sur l'etiquette ce qui pose probleme ?",
      japanese: "問題のある表示をラベルで見せていただけますか。",
      romaji: "Mondai no aru hyoji o raberu de misete itadakemasu ka.",
    },
  ],
  risk_level: "avoid_if_uncertain",
  disclaimer: "L'Assistant IA aide a preparer la verification, mais ne remplace pas une confirmation humaine.",
}, null, 2);

const ADDITIONAL_CARDS_JSON_EXAMPLE = JSON.stringify({
  store_phrases: [
    {
      title: "Verifier la fabrication",
      user_language: "Pouvez-vous verifier s'il existe un risque de traces ?",
      japanese: "微量混入の可能性があるか確認していただけますか。",
      romaji: "Biryo konnyu no kanosei ga aru ka kakunin shite itadakemasu ka.",
    },
  ],
}, null, 2);

function buildPromptContext(context: AssistantScanContext, language: AssistantLanguage) {
  const { primary } = getPrimaryEvidenceSet(context);
  const primaryCriteria = getCriterionLabelsForEvidence(primary);

  return {
    assistant_mode: inferAssistantMode(context),
    user_language: language,
    scan_detected_language: context.detectedLanguage || "unknown",
    scan_status: context.productStatus,
    selected_allergens: context.selectedAllergens,
    selected_profiles: context.selectedProfileLabels,
    selected_allergen_criteria: context.selectedAllergenLabels,
    selected_profile_labels: context.selectedProfileLabels,
    selected_allergen_labels: context.selectedAllergenLabels,
    direct_blockers: context.evidenceMatrix.direct_blockers.slice(0, 8),
    ambiguous_scoped: context.evidenceMatrix.ambiguous_scoped.slice(0, 8),
    ambiguous_global: context.evidenceMatrix.ambiguous_global.slice(0, 8),
    evidence_priority: ["direct_blocker", "ambiguous_scoped", "ambiguous_global"],
    primary_criteria_labels: primaryCriteria,
    blocking_labels_clean: getEvidenceIngredientLabels(context.evidenceMatrix.direct_blockers).slice(0, 4),
    ambiguous_labels_clean: getEvidenceIngredientLabels([
      ...context.evidenceMatrix.ambiguous_scoped,
      ...context.evidenceMatrix.ambiguous_global,
    ]).slice(0, 4),
    blocking_mentions_hint: buildMentionExamples(
      getEvidenceIngredientLabels(context.evidenceMatrix.direct_blockers).slice(0, 4),
      language,
    ),
    ambiguous_mentions_hint: buildMentionExamples(
      getEvidenceIngredientLabels([
        ...context.evidenceMatrix.ambiguous_scoped,
        ...context.evidenceMatrix.ambiguous_global,
      ]).slice(0, 4),
      language,
    ),
    assistant_compatibility_descriptor: buildCriteriaPhrase(context, primaryCriteria, language, "assistant"),
    user_compatibility_descriptor: buildCriteriaPhrase(context, primaryCriteria, language, "user"),
    ambiguous_ingredients: context.ambiguousIngredients.slice(0, 8),
    detected_allergen_ingredients: context.allergenIngredients.slice(0, 8),
    certified_raw_text_excerpt: (context.certifiedRawText ?? "").slice(0, 1200),
  };
}

function buildMainJsonInstructions() {
  return [
    "Return a single valid JSON object only.",
    "Do not wrap the JSON in markdown fences.",
    "Do not omit required keys.",
    "Required JSON shape example:",
    MAIN_RESPONSE_JSON_EXAMPLE,
  ];
}

function buildAdditionalCardsJsonInstructions() {
  return [
    "Return a single valid JSON object only.",
    "Do not wrap the JSON in markdown fences.",
    "Do not omit required keys.",
    "Required JSON shape example:",
    ADDITIONAL_CARDS_JSON_EXAMPLE,
  ];
}

function buildAdditionalCardsPrompt(
  context: AssistantScanContext,
  language: AssistantLanguage,
  existingResponse: ScanAmbiguousAssistantResponse,
  remainingSlots: number,
) {
  const languageLabel = language === "fr" ? "French" : "English";
  const userContext = {
    ...buildPromptContext(context, language),
    assistant_mode: existingResponse.mode,
    existing_titles: existingResponse.store_phrases.map((phrase: ScanAssistantStorePhrase) => phrase.title),
  };

  return [
    "You are YumiScan Assistant IA.",
    `Write only ${remainingSlots} additional store phrase cards in ${languageLabel}.`,
    "Do not rewrite the summary, reasons or checkpoints.",
    "The new cards must complement the existing ones and avoid duplicate intent, duplicate Japanese or duplicate titles.",
    "Prefer practical cards for asking about additives, seasonings, full labels, simpler alternatives or safer nearby products depending on the scan context.",
    "Each store phrase must contain title, user_language, japanese and romaji.",
    "The japanese field must be polite, natural, and easy to show to a staff member.",
    "The romaji field must be plain ASCII.",
    "Never output plain language codes like fr or en in user_language.",
    "Use direct_blockers, ambiguous_scoped and ambiguous_global as the source of truth for scope.",
    "Never attach an ingredient to a criterion unless that criterion appears in the evidence item criterion_labels.",
    "If an item is ambiguous_global, describe it as an uncertainty for the selected criteria, not as a confirmed blocker.",
    "Never treat dietary profile labels such as halal, vegan, vegetarian or kosher as ingredients or allergens.",
    "Do not use generic labels such as other, acidifier, thickener, seasoning or additive as the main blocker unless no better evidence exists.",
    "Use blocking_labels_clean and ambiguous_labels_clean as your preferred wording anchors whenever they are available.",
    "For dietary profiles such as Halal or Vegan, ask for a compatible option. Never ask for an option 'without Halal' or 'without Vegan'.",
    "When blocker labels are available, mention them naturally as ingredient names or quoted label mentions, not as raw fragments like 'contains pork' or 'contient du porc'.",
    "For French output, every card title must be fully written in French and the prose must sound natural to a native speaker.",
    "Avoid boilerplate cards that could fit every scan. Ground the wording in the current evidence whenever possible.",
    'Bad French user_language: "Je ne peux pas consommer ce produit à cause de mes allergènes. Avez-vous une alternative plus sûre ?"',
    'Good French user_language when allergens are known: "Je dois éviter le lait et les oeufs. Avez-vous une alternative plus sûre ?"',
    'Good French user_language for Halal/Vegan style profiles: "Je cherche une option compatible avec mon régime Halal. Ce produit mentionne « porc ». Avez-vous une alternative plus adaptée ?"',
    'Bad French scoped wording: "La mention « soja » rend ce produit non compatible avec votre régime Halal."',
    'Good French scoped wording: "La mention « soja » correspond à votre critère soja. Elle ne doit pas être attribuée à votre régime Halal."',
    ...buildAdditionalCardsJsonInstructions(),
    "Context JSON:",
    JSON.stringify(userContext),
    "Existing response JSON:",
    JSON.stringify(existingResponse),
  ].join("\n");
}

function sanitizeAdditionalStorePhrases(
  candidatePhrases: ScanAssistantStorePhrase[],
  fallbackPhrases: ScanAssistantStorePhrase[],
  context: AssistantScanContext,
  language: AssistantLanguage,
) {
  return candidatePhrases
    .slice(0, 3)
    .map((phrase: ScanAssistantStorePhrase, index: number) =>
      sanitizeStorePhrase(
        phrase,
        fallbackPhrases[index] ?? fallbackPhrases[0],
        context,
        language,
      ))
    .filter((phrase: ScanAssistantStorePhrase) => (
      phrase.title.length >= 4
      && isValidHumanSentence(phrase.user_language, 14)
      && phrase.japanese.length >= 8
      && phrase.romaji.length >= 8
    ));
}

function cleanModelJson(rawText: string) {
  return rawText
    .replace(/```(?:json)?/gi, "")
    .trim();
}

function extractModelText(payload: Record<string, unknown>) {
  const candidates = asArray<Record<string, unknown>>(payload.candidates);
  const content = asRecord(candidates[0]?.content);
  const parts = asArray<Record<string, unknown>>(content?.parts);

  return parts
    .map((part) => asString(part.text))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildPrompt(
  context: AssistantScanContext,
  language: AssistantLanguage,
  options: AssistantGenerationOptions = {},
) {
  const languageLabel = language === "fr" ? "French" : "English";
  const userContext = buildPromptContext(context, language);

  return [
    "You are YumiScan Assistant IA.",
    "Your job is to help a traveler understand a risky or ambiguous food scan and ask useful questions in a Japanese store.",
    `Write the analysis_summary, ambiguity_reasons, checkpoints and disclaimer in ${languageLabel}.`,
    "If assistant_mode is allergen, explain clearly why the product is not suitable and help the user ask for a safer alternative or clarification in store.",
    "If assistant_mode is ambiguous, explain the doubt and help the user verify the label safely.",
    "When assistant_mode is allergen, prioritize concise blocker ingredient names and never repeat long product titles or packaging names in the summary.",
    "Write store_phrases as short, practical cards for a user talking to store staff in Japan.",
    "Each store phrase must contain title, user_language, japanese and romaji.",
    "The japanese field must be polite, natural, and easy to show to a staff member.",
    "The romaji field must be plain ASCII.",
    "Never output plain language codes like fr or en in user_language.",
    "The user_language field must always be a complete sentence in the user's language.",
    "Use direct_blockers, ambiguous_scoped and ambiguous_global as the source of truth.",
    "Never attach an ingredient to a criterion unless that criterion is listed in the evidence item criterion_labels.",
    "Never turn ambiguous_scoped or ambiguous_global evidence into a confirmed blocker.",
    "When an ingredient only belongs to one selected criterion, do not mention the user's other selected criteria in the same causal sentence.",
    "Never treat dietary profile labels such as halal, vegan, vegetarian or kosher as ingredients or allergens.",
    'Do not use generic labels such as "other", "acidifier", "thickener", "seasoning" or "additive" as the main blocker unless no better evidence exists.',
    "Use blocking_labels_clean and ambiguous_labels_clean as your preferred wording anchors whenever they are available.",
    "If concrete blocker or ambiguity labels are available, mention one or two of them in the summary or first card.",
    "If the selected criteria are dietary profiles such as Halal or Vegan, speak about compatibility with that profile, not about 'allergens'.",
    "If an ambiguity is global, describe it as uncertainty affecting the selected criteria, not as proof that all criteria are already blocked.",
    "When blocker labels are available, rewrite them as natural ingredient names or quoted label mentions. Never copy awkward fragments such as 'contains pork' or 'contient du porc' into the summary.",
    "For French output, all titles must be written in French and the summary must read like natural French prose.",
    "Avoid generic placeholder prose that could fit any scan. Ground the wording in the current evidence whenever possible.",
    "Do not ask for an option 'without Halal' or 'without Vegan'. Ask for an option compatible with that profile instead.",
    'Bad French summary: "poulet et contient du porc ont été détectés dans ce produit. Pour votre profil, il doit être considéré comme non consommable."',
    'Good French summary: "Le scan a relevé des mentions comme « porc ». Comme cela ne semble pas compatible avec votre régime Halal, le plus prudent est d\'écarter ce produit."',
    'Bad French scoped summary: "La mention « soja » rend ce produit non compatible avec votre régime Halal."',
    'Good French scoped summary: "Le scan a relevé la mention « soja », qui correspond à votre critère soja. Ce point suffit déjà à écarter ce produit."',
    'Good French global ambiguity summary: "Le doute principal vient de la mention « sauce ». Tant que ce point n\'est pas clarifié, il peut concerner l\'ensemble de vos critères sélectionnés."',
    'Bad French user_language: "Je ne peux pas consommer ce produit à cause de mes allergènes. Avez-vous une alternative plus sûre ?"',
    'Good French user_language when allergens are known: "Je dois éviter le lait et les oeufs. Avez-vous une alternative plus sûre ?"',
    'Good French user_language for Halal/Vegan style profiles: "Je cherche une option compatible avec mon régime Halal. Ce produit mentionne « porc ». Avez-vous une alternative plus adaptée ?"',
    "Never mention internal risk tokens like probably_ok, check_required or avoid_if_uncertain in prose fields.",
    "Do not promise safety, do not give medical advice, and do not invent missing facts.",
    "If the scan remains uncertain, prefer caution and human verification.",
    "Allowed risk_level values: probably_ok, check_required, avoid_if_uncertain.",
    `Limit store_phrases to ${DEFAULT_ASSISTANT_CARD_COUNT} cards max.`,
    "Limit ambiguity_reasons and checkpoints to 3 items max each.",
    ...buildMainJsonInstructions(),
    ...(options.forceRegeneration
      ? [
        "This request is an explicit regeneration.",
        "Keep the same facts, but avoid repeating the same wording, titles and card framing as the previous saved answer.",
        "Return a meaningfully refreshed phrasing while staying grounded in the scan evidence.",
        ...(options.regenerationAttempt && options.regenerationAttempt > 1
          ? [
            "Your previous regeneration attempt was still too close to the saved answer.",
            "You must noticeably change the summary wording, card titles, checkpoint phrasing and card ordering while keeping the same evidence.",
            "Do not reuse the same opening sentence or the same card title stems as the previous answer.",
          ]
          : []),
      ]
      : []),
    "Context JSON:",
    JSON.stringify(userContext),
    ...(options.forceRegeneration && options.previousResponse
      ? [
        "Previous saved response JSON:",
        JSON.stringify(options.previousResponse),
      ]
      : []),
  ].join("\n");
}

function buildAssistantJsonRepairPrompt(
  rawText: string,
  errorMessage: string,
  language: AssistantLanguage,
) {
  return [
    "You are repairing a model output so it matches the required JSON contract.",
    `The final prose must stay in ${language === "fr" ? "French" : "English"}.`,
    "Return valid JSON only.",
    "Do not use markdown fences.",
    "Keep grounded facts only. Remove unsupported claims.",
    "Keep concrete wording when the source already contains it.",
    "Validation error:",
    errorMessage,
    ...buildMainJsonInstructions(),
    "Invalid model output to repair:",
    rawText,
  ].join("\n");
}

function buildAdditionalCardsRepairPrompt(
  rawText: string,
  errorMessage: string,
  language: AssistantLanguage,
) {
  return [
    "You are repairing a model output so it matches the required JSON contract for additional cards.",
    `The final prose must stay in ${language === "fr" ? "French" : "English"}.`,
    "Return valid JSON only.",
    "Do not use markdown fences.",
    "Keep grounded facts only. Remove unsupported claims.",
    "Validation error:",
    errorMessage,
    ...buildAdditionalCardsJsonInstructions(),
    "Invalid model output to repair:",
    rawText,
  ].join("\n");
}

function normalizeAssistantDraft(
  validated: AssistantDraftResponse,
): AssistantDraftResponse {
  return {
    analysis_summary: validated.analysis_summary.trim(),
    ambiguity_reasons: dedupeStrings(validated.ambiguity_reasons).slice(0, 3),
    checkpoints: dedupeStrings(validated.checkpoints).slice(0, 3),
    store_phrases: validated.store_phrases.slice(0, DEFAULT_ASSISTANT_CARD_COUNT).map((phrase: ScanAssistantStorePhrase) => ({
      title: phrase.title.trim(),
      user_language: phrase.user_language.trim(),
      japanese: phrase.japanese.trim(),
      romaji: phrase.romaji.trim(),
    })),
    risk_level: validated.risk_level,
    disclaimer: validated.disclaimer.trim(),
  };
}

function parseAssistantDraft(rawText: string) {
  const parsed = JSON.parse(cleanModelJson(rawText));
  const validated = AssistantResponseSchema.parse(parsed);

  return normalizeAssistantDraft(validated as AssistantDraftResponse);
}

function parseAdditionalCardsDraft(rawText: string) {
  const parsed = JSON.parse(cleanModelJson(rawText));
  const validated = AdditionalCardsResponseSchema.parse(parsed);

  return {
    store_phrases: validated.store_phrases.map((phrase: ScanAssistantStorePhrase) => ({
      title: phrase.title.trim(),
      user_language: phrase.user_language.trim(),
      japanese: phrase.japanese.trim(),
      romaji: phrase.romaji.trim(),
    })),
  } satisfies AdditionalCardsDraftResponse;
}

function getRegenerationTemperature(options: AssistantGenerationOptions) {
  if (!options.forceRegeneration) {
    return 0.45;
  }

  if (options.regenerationAttempt && options.regenerationAttempt > 1) {
    return 0.82;
  }

  return 0.68;
}

async function requestGeminiText(
  modelName: string,
  prompt: string,
  temperature: number,
) {
  if (!GEMINI_KEY) {
    throw new Error("GEMINI_KEY not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = asString(asRecord(payload.error)?.message) || `Gemini API ${response.status}`;
    throw new Error(detail);
  }

  const rawText = extractModelText(payload);
  if (!rawText) {
    throw new Error("Empty Gemini response");
  }

  return rawText;
}

async function parseWithRepair<T>(params: {
  rawText: string;
  modelName: string;
  parse: (value: string) => T;
  buildRepairPrompt: (rawText: string, errorMessage: string) => string;
}) {
  try {
    return params.parse(params.rawText);
  } catch (error) {
    const repairPrompt = params.buildRepairPrompt(
      params.rawText,
      error instanceof Error ? error.message : String(error),
    );
    const repairedText = await requestGeminiText(params.modelName, repairPrompt, 0.18);
    return params.parse(repairedText);
  }
}

function sanitizeAssistantResponse(
  candidate: AssistantDraftResponse,
  context: AssistantScanContext,
  language: AssistantLanguage,
): ScanAmbiguousAssistantResponse {
  const fallback = buildFallbackResponse(context, language);
  const safeSummary = sanitizeLineWithFallback(
    candidate.analysis_summary,
    fallback.analysis_summary,
    context,
    language,
    "summary",
    28,
  );
  const safeDisclaimer = stripRiskTokens(candidate.disclaimer);
  const fallbackPhrases = fallback.store_phrases;
  const safePhrases = candidate.store_phrases
    .slice(0, DEFAULT_ASSISTANT_CARD_COUNT)
    .map((phrase: ScanAssistantStorePhrase, index: number) =>
      sanitizeStorePhrase(
        phrase,
        fallbackPhrases[index] ?? fallbackPhrases[0],
        context,
        language,
      ))
    .filter((phrase: ScanAssistantStorePhrase) => (
      phrase.title.length >= 4
      && isValidHumanSentence(phrase.user_language, 14)
      && phrase.japanese.length >= 8
      && phrase.romaji.length >= 8
    ));

  const safeDisclaimerValue = isValidHumanSentence(safeDisclaimer, 20) && !hasRiskToken(safeDisclaimer)
    ? safeDisclaimer
    : fallback.disclaimer;

  return {
    mode: inferAssistantMode(context),
    analysis_summary: safeSummary,
    ambiguity_reasons: sanitizeContextualList(
      candidate.ambiguity_reasons,
      fallback.ambiguity_reasons,
      context,
      language,
      "reason",
      12,
    ),
    checkpoints: sanitizeContextualList(
      candidate.checkpoints,
      fallback.checkpoints,
      context,
      language,
      "checkpoint",
      12,
    ),
    store_phrases: safePhrases.length > 0 ? safePhrases : fallbackPhrases,
    risk_level: candidate.risk_level,
    disclaimer: safeDisclaimerValue,
  };
}

export async function callGeminiAssistant(
  context: AssistantScanContext,
  language: AssistantLanguage,
  modelName: string,
  options: AssistantGenerationOptions = {},
): Promise<ScanAmbiguousAssistantResponse> {
  const rawText = await requestGeminiText(
    modelName,
    buildPrompt(context, language, options),
    getRegenerationTemperature(options),
  );

  const draft = await parseWithRepair<AssistantDraftResponse>({
    rawText,
    modelName,
    parse: parseAssistantDraft,
    buildRepairPrompt: (invalidText, errorMessage) =>
      buildAssistantJsonRepairPrompt(invalidText, errorMessage, language),
  });

  return sanitizeAssistantResponse(draft, context, language);
}

export async function callGeminiAdditionalCards(
  context: AssistantScanContext,
  language: AssistantLanguage,
  modelName: string,
  existingResponse: ScanAmbiguousAssistantResponse,
  remainingSlots: number,
) {
  const rawText = await requestGeminiText(
    modelName,
    buildAdditionalCardsPrompt(context, language, existingResponse, remainingSlots),
    0.62,
  );

  const draft = await parseWithRepair<AdditionalCardsDraftResponse>({
    rawText,
    modelName,
    parse: parseAdditionalCardsDraft,
    buildRepairPrompt: (invalidText, errorMessage) =>
      buildAdditionalCardsRepairPrompt(invalidText, errorMessage, language),
  });

  const fallbackPhrases = buildFallbackAdditionalCards(context, language, existingResponse);
  const limitedDraftPhrases = draft.store_phrases
    .slice(0, Math.min(remainingSlots, MAX_ASSISTANT_CARD_COUNT))
    .map((phrase: ScanAssistantStorePhrase) => ({
      title: phrase.title.trim(),
      user_language: phrase.user_language.trim(),
      japanese: phrase.japanese.trim(),
      romaji: phrase.romaji.trim(),
    }));

  const safePhrases = sanitizeAdditionalStorePhrases(
    limitedDraftPhrases,
    fallbackPhrases,
    context,
    language,
  );

  return safePhrases.slice(0, remainingSlots);
}
