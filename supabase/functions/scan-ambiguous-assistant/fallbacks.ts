import type {
  ScanAmbiguousAssistantResponse,
  ScanAssistantMode,
  ScanAssistantRiskLevel,
  ScanAssistantStorePhrase,
} from "../_shared/scan-ai-assistant.ts";

import type {
  AssistantCriteriaFocusKind,
  AssistantLanguage,
  AssistantScanContext,
  FallbackEvidenceClassification,
} from "./types.ts";
import {
  buildCriteriaPhrase,
  buildMentionExamples,
  buildQuotedLabelList,
  buildUserNeedSentence,
  dedupeStrings,
  getCriterionKindForLabels,
  getCriterionLabelsForEvidence,
  getEvidenceIngredientLabels,
  getPrimaryEvidenceSet,
  inferAssistantMode,
  joinHumanList,
  mergeStorePhrases,
  areAssistantResponsesMeaningfullyDifferent,
} from "./helpers.ts";

// These strings are deterministic backend fallbacks. They are only used when the
// model output is missing, invalid, too close to the previous answer, or fails
// post-sanitization. They are not frontend copy.
function inferRiskLevel(context: AssistantScanContext): ScanAssistantRiskLevel {
  if (context.productStatus === "contains_allergen") return "avoid_if_uncertain";
  if (context.allergenIngredients.length > 0) return "avoid_if_uncertain";
  if (context.ambiguousIngredients.length > 0) return "check_required";
  return "probably_ok";
}

function buildAllergenPrimaryCardTitle(language: AssistantLanguage, focusedKind: AssistantCriteriaFocusKind) {
  if (language === "fr") {
    return focusedKind === "profile" ? "Demander une alternative compatible" : "Demander une alternative";
  }

  return focusedKind === "profile" ? "Ask for a compatible option" : "Ask for an alternative";
}

function buildAllergenTertiaryCardTitle(language: AssistantLanguage, focusedKind: AssistantCriteriaFocusKind) {
  if (language === "fr") {
    return focusedKind === "profile" ? "Chercher une option plus simple" : "Vérifier les traces";
  }

  return focusedKind === "profile" ? "Look for a simpler option" : "Look for no-trace option";
}

function buildAllergenPrimaryUserSentence(
  language: AssistantLanguage,
  userNeed: string,
  primaryMentions: string,
) {
  if (language === "fr") {
    const mentionSuffix = primaryMentions ? ` L'étiquette fait apparaître ${primaryMentions}.` : "";
    return `${userNeed}${mentionSuffix} Avez-vous une alternative plus adaptée ?`;
  }

  const mentionSuffix = primaryMentions ? ` The label shows ${primaryMentions}.` : "";
  return `${userNeed}${mentionSuffix} Do you have a safer alternative?`;
}

function buildAllergenTertiaryUserSentence(
  language: AssistantLanguage,
  focusedKind: AssistantCriteriaFocusKind,
  assistantCriteria: string,
) {
  if (language === "fr") {
    return focusedKind === "profile"
      ? `Avez-vous un produit plus simple ou plus clairement compatible avec ${assistantCriteria} ?`
      : `Je cherche une option plus sûre pour ${assistantCriteria}. Pouvez-vous vérifier aussi le risque de traces ?`;
  }

  return focusedKind === "profile"
    ? `Do you have a simpler product or one that is more clearly compatible with ${assistantCriteria}?`
    : `I need a safer option for ${assistantCriteria}. Could you also check the trace risk?`;
}

function buildAmbiguousTraceUserSentence(
  context: AssistantScanContext,
  language: AssistantLanguage,
  assistantCriteria: string,
) {
  if (context.evidenceMatrix.ambiguous_global.length > 0) {
    return language === "fr"
      ? "Pouvez-vous confirmer s'il existe un risque de traces ou de contamination croisée pour mes critères sélectionnés ?"
      : "Could you confirm whether there is any trace or cross-contact risk for my selected criteria?";
  }

  return language === "fr"
    ? `Pouvez-vous confirmer s'il existe un risque de traces ou de contamination croisée pour ${assistantCriteria} ?`
    : `Could you confirm whether there is any trace or cross-contact risk for ${assistantCriteria}?`;
}

function buildAllergenShowLabelCard(
  language: AssistantLanguage,
  assistantCriteria: string,
): ScanAssistantStorePhrase {
  return {
    title: language === "fr" ? "Faire montrer l'etiquette" : "Show the label",
    user_language: language === "fr"
      ? `Pouvez-vous me montrer sur l'étiquette ce qui pose problème pour ${assistantCriteria} ?`
      : `Could you show me on the label what makes this product a poor match for ${assistantCriteria}?`,
    japanese: "この商品のどの原材料またはアレルゲンが問題か、見せていただけますか。",
    romaji: "Kono shohin no dono genzairyo matawa arerugen ga mondai ka, misete itadakemasu ka.",
  };
}

function buildAmbiguousIngredientUserSentence(
  language: AssistantLanguage,
  primaryMentions: string,
  assistantCriteria: string,
) {
  if (language === "fr") {
    return primaryMentions
      ? `Pouvez-vous vérifier précisément ${primaryMentions} et me dire si cela pose un problème pour ${assistantCriteria} ?`
      : `Pouvez-vous vérifier précisément ce point douteux pour ${assistantCriteria} ?`;
  }

  return primaryMentions
    ? `Could you check ${primaryMentions} and tell me whether it is a problem for ${assistantCriteria}?`
    : `Could you check this unclear point for ${assistantCriteria}?`;
}

function buildAmbiguousIngredientCard(
  language: AssistantLanguage,
  primaryMentions: string,
  assistantCriteria: string,
): ScanAssistantStorePhrase {
  return {
    title: language === "fr" ? "Verifier un ingredient" : "Ingredient check",
    user_language: buildAmbiguousIngredientUserSentence(language, primaryMentions, assistantCriteria),
    japanese: "すみません、この商品に気になる原材料や関連するアレルゲンが含まれているか確認していただけますか。",
    romaji: "Sumimasen, kono shohin ni ki ni naru genzairyo ya kanren suru arerugen ga fukumarete iru ka kakunin shite itadakemasu ka.",
  };
}

function buildAmbiguousTraceCard(
  context: AssistantScanContext,
  language: AssistantLanguage,
  assistantCriteria: string,
): ScanAssistantStorePhrase {
  return {
    title: language === "fr" ? "Verifier les traces" : "Cross-contact check",
    user_language: buildAmbiguousTraceUserSentence(context, language, assistantCriteria),
    japanese: "同じ製造ラインでアレルゲンを扱っているか、または微量混入の可能性があるか教えていただけますか。",
    romaji: "Onaji seizo rain de arerugen o atsukatte iru ka, matawa biryo konnyu no kanosei ga aru ka oshiete itadakemasu ka.",
  };
}

function buildPackagingCard(language: AssistantLanguage): ScanAssistantStorePhrase {
  return {
    title: language === "fr" ? "Voir l'emballage" : "Product label check",
    user_language: language === "fr"
      ? "Avez-vous la fiche produit complète ou l'emballage original pour vérifier la composition exacte ?"
      : "Do you have the full product sheet or the original packaging so we can verify the exact composition?",
    japanese: "原材料表示や商品情報のわかるパッケージを見せていただけますか。",
    romaji: "Genzairyo hyoji ya shohin joho no wakaru pakkeji o misete itadakemasu ka.",
  };
}

type FallbackEvidenceSummary = {
  primaryExamples: string;
  primaryMentions: string;
  secondaryMentions: string;
  assistantCriteria: string;
  classification: FallbackEvidenceClassification;
};

function buildAllergenPrimaryCard(
  language: AssistantLanguage,
  focusedKind: AssistantCriteriaFocusKind,
  userNeed: string,
  primaryMentions: string,
): ScanAssistantStorePhrase {
  return {
    title: buildAllergenPrimaryCardTitle(language, focusedKind),
    user_language: buildAllergenPrimaryUserSentence(language, userNeed, primaryMentions),
    japanese: "この商品はアレルゲンのため食べられません。より安全な代替品はありますか。",
    romaji: "Kono shohin wa arerugen no tame taberaremasen. Yori anzen na daitaihin wa arimasu ka.",
  };
}

function buildAllergenTertiaryCard(
  language: AssistantLanguage,
  focusedKind: AssistantCriteriaFocusKind,
  assistantCriteria: string,
): ScanAssistantStorePhrase {
  return {
    title: buildAllergenTertiaryCardTitle(language, focusedKind),
    user_language: buildAllergenTertiaryUserSentence(language, focusedKind, assistantCriteria),
    japanese: "このアレルゲンや微量混入の心配がない商品を探しています。手伝っていただけますか。",
    romaji: "Kono arerugen ya biryo konnyu no shinpai ga nai shohin o sagashite imasu. Tetsudatte itadakemasu ka.",
  };
}

function buildAllergenFallbackPhrases(
  language: AssistantLanguage,
  focusedKind: AssistantCriteriaFocusKind,
  userNeed: string,
  primaryMentions: string,
  assistantCriteria: string,
): ScanAssistantStorePhrase[] {
  return [
    buildAllergenPrimaryCard(language, focusedKind, userNeed, primaryMentions),
    buildAllergenShowLabelCard(language, assistantCriteria),
    buildAllergenTertiaryCard(language, focusedKind, assistantCriteria),
  ];
}

function buildAmbiguousFallbackPhrases(
  context: AssistantScanContext,
  language: AssistantLanguage,
  primaryMentions: string,
  assistantCriteria: string,
): ScanAssistantStorePhrase[] {
  return [
    buildAmbiguousIngredientCard(language, primaryMentions, assistantCriteria),
    buildAmbiguousTraceCard(context, language, assistantCriteria),
    buildPackagingCard(language),
  ];
}

function buildFrenchAllergenAdditionalPhrases(
  assistantCriteria: string,
  userNeed: string,
  focusedKind: AssistantCriteriaFocusKind,
): ScanAssistantStorePhrase[] {
  const simplerOptionSentence = focusedKind === "profile"
    ? "Avez-vous une version plus simple, avec moins d'ingrédients ou une étiquette plus claire ?"
    : `Avez-vous une version plus simple qui reste plus sûre pour ${assistantCriteria} ?`;

  return [
    {
      title: "Verifier la compatibilite",
      user_language: `Pouvez-vous confirmer si ce produit reste compatible avec ${assistantCriteria} ?`,
      japanese: "私の食事条件に合う、似た商品の中でもっと安全なものを見せていただけますか。",
      romaji: "Watashi no shokuji joken ni au, nita shohin no naka de motto anzen na mono o misete itadakemasu ka.",
    },
    {
      title: "Montrer un produit voisin",
      user_language: `${userNeed} Pouvez-vous me montrer un produit similaire mais plus sûr ?`,
      japanese: "問題になる原材料を確認したいので、原材料表示を全部見せていただけますか。",
      romaji: "Mondai ni naru genzairyo o kakunin shitai node, genzairyo hyoji o zenbu misete itadakemasu ka.",
    },
    {
      title: "Demander une option plus simple",
      user_language: simplerOptionSentence,
      japanese: "ソースや追加の味付けがない、もっとシンプルなものはありますか。",
      romaji: "Sosu ya tsuika no ajitsuke ga nai, motto shinpuru na mono wa arimasu ka.",
    },
  ];
}

function buildEnglishAllergenAdditionalPhrases(
  assistantCriteria: string,
  userNeed: string,
  focusedKind: AssistantCriteriaFocusKind,
): ScanAssistantStorePhrase[] {
  const simplerOptionSentence = focusedKind === "profile"
    ? "Do you have a simpler version with fewer ingredients or a clearer label?"
    : `Do you have a simpler version that stays safer for ${assistantCriteria}?`;

  return [
    {
      title: "Check compatibility",
      user_language: `Could you confirm whether this product stays compatible with ${assistantCriteria}?`,
      japanese: "私の食事条件に合う、似た商品の中でもっと安全なものを見せていただけますか。",
      romaji: "Watashi no shokuji joken ni au, nita shohin no naka de motto anzen na mono o misete itadakemasu ka.",
    },
    {
      title: "Ask for a nearby alternative",
      user_language: `${userNeed} Could you show me a similar product that is safer?`,
      japanese: "問題になる原材料を確認したいので、原材料表示を全部見せていただけますか。",
      romaji: "Mondai ni naru genzairyo o kakunin shitai node, genzairyo hyoji o zenbu misete itadakemasu ka.",
    },
    {
      title: "Ask for a simpler option",
      user_language: simplerOptionSentence,
      japanese: "ソースや追加の味付けがない、もっとシンプルなものはありますか。",
      romaji: "Sosu ya tsuika no ajitsuke ga nai, motto shinpuru na mono wa arimasu ka.",
    },
  ];
}

function buildFrenchAmbiguousAdditionalPhrases(): ScanAssistantStorePhrase[] {
  return [
    {
      title: "Demander le detail des additifs",
      user_language: "Pouvez-vous préciser quels additifs ou quels agents épaississants sont utilisés dans ce produit ?",
      japanese: "この商品に使われている添加物や増粘剤の詳細を教えていただけますか。",
      romaji: "Kono shohin ni tsukawarete iru tenkabutsu ya zokinenzai no shosai o oshiete itadakemasu ka.",
    },
    {
      title: "Verifier la sauce ou l'assaisonnement",
      user_language: "Pouvez-vous vérifier le détail de la sauce ou de l'assaisonnement utilisé ?",
      japanese: "使われているソースや調味料の内容を確認していただけますか。",
      romaji: "Tsukawarete iru sosu ya chomiryo no naiyo o kakunin shite itadakemasu ka.",
    },
    {
      title: "Chercher un produit plus simple",
      user_language: "Avez-vous une version plus simple avec moins d'ingrédients ou sans assaisonnement ajouté ?",
      japanese: "原材料が少ないものや、追加の味付けがないものはありますか。",
      romaji: "Genzairyo ga sukunai mono ya, tsuika no ajitsuke ga nai mono wa arimasu ka.",
    },
  ];
}

function buildEnglishAmbiguousAdditionalPhrases(): ScanAssistantStorePhrase[] {
  return [
    {
      title: "Ask about additives",
      user_language: "Could you tell me which additives or thickeners are used in this product?",
      japanese: "この商品に使われている添加物や増粘剤の詳細を教えていただけますか。",
      romaji: "Kono shohin ni tsukawarete iru tenkabutsu ya zokinenzai no shosai o oshiete itadakemasu ka.",
    },
    {
      title: "Check the sauce or seasoning",
      user_language: "Could you check the details of the sauce or seasoning used here?",
      japanese: "使われているソースや調味料の内容を確認していただけますか。",
      romaji: "Tsukawarete iru sosu ya chomiryo no naiyo o kakunin shite itadakemasu ka.",
    },
    {
      title: "Look for a simpler option",
      user_language: "Do you have a simpler version with fewer ingredients or no extra seasoning?",
      japanese: "原材料が少ないものや、追加の味付けがないものはありますか。",
      romaji: "Genzairyo ga sukunai mono ya, tsuika no ajitsuke ga nai mono wa arimasu ka.",
    },
  ];
}

function buildAllergenCheckpoints(
  language: AssistantLanguage,
  summary: FallbackEvidenceSummary,
) {
  const detectedText = summary.primaryExamples
    ? (language === "fr"
      ? `Retenir que ${summary.primaryExamples} pose problème pour ${summary.assistantCriteria}.`
      : `Keep in mind that ${summary.primaryExamples} is a problem for ${summary.assistantCriteria}.`)
    : (language === "fr"
      ? `Retenir qu'un élément détecté pose problème pour ${summary.assistantCriteria}.`
      : `Keep in mind that a detected element is a problem for ${summary.assistantCriteria}.`);

  const actionText = language === "fr"
    ? `Demander une alternative plus sûre pour ${summary.assistantCriteria}.`
    : `Ask for a safer alternative for ${summary.assistantCriteria}.`;

  const followUpText = summary.secondaryMentions
    ? (language === "fr"
      ? `Signaler aussi que l'étiquette reste floue sur ${summary.secondaryMentions}.`
      : `Also mention that the label remains unclear about ${summary.secondaryMentions}.`)
    : (language === "fr"
      ? "Si besoin, faire confirmer la recette exacte ou demander un produit voisin plus sûr."
      : "If needed, confirm the exact recipe or ask for a safer nearby product.");

  return dedupeStrings([detectedText, actionText, followUpText]);
}

function buildAmbiguousCheckpoints(
  language: AssistantLanguage,
  summary: FallbackEvidenceSummary,
) {
  const evidenceText = summary.primaryExamples
    ? (language === "fr"
      ? `Vérifier précisément l'origine ou la composition de ${summary.primaryExamples}.`
      : `Check the exact origin or composition of ${summary.primaryExamples}.`)
    : (language === "fr"
      ? "Vérifier certains additifs ou assaisonnements insuffisamment détaillés."
      : "Check additives or seasonings that remain insufficiently detailed on the label.");

  const riskText = summary.classification === "ambiguous_global"
    ? (language === "fr"
      ? "Tant que ce point n'est pas clarifié, il peut concerner l'ensemble de vos critères sélectionnés."
      : "Until this point is clarified, it may affect all of your selected criteria.")
    : (language === "fr"
      ? `Tant que ce point n'est pas clarifié, il peut poser problème pour ${summary.assistantCriteria}.`
      : `Until this point is clarified, it may be a problem for ${summary.assistantCriteria}.`);

  const packagingText = language === "fr"
    ? "Faire confirmer la recette exacte, la fiche produit ou l'emballage d'origine."
    : "Confirm the exact recipe using the product sheet or the original packaging.";

  return dedupeStrings([evidenceText, riskText, packagingText]);
}

function buildAllergenReasons(
  language: AssistantLanguage,
  summary: FallbackEvidenceSummary,
) {
  const mentionText = summary.primaryMentions
    ? (language === "fr"
      ? `L'étiquette fait apparaître ${summary.primaryMentions}.`
      : `The label shows ${summary.primaryMentions}.`)
    : (language === "fr"
      ? "Un ou plusieurs ingrédients bloquants ont été détectés dans ce produit."
      : "One or more blocking ingredients were detected in this product.");

  const compatibilityText = language === "fr"
    ? `Ce point n'est pas compatible avec ${summary.assistantCriteria}.`
    : `This point is not compatible with ${summary.assistantCriteria}.`;

  const actionText = summary.secondaryMentions
    ? (language === "fr"
      ? `L'étiquette reste aussi imprécise sur ${summary.secondaryMentions}.`
      : `The label also stays unclear about ${summary.secondaryMentions}.`)
    : (language === "fr"
      ? "La bonne action est de chercher une alternative plus sûre, pas de revalider ce produit."
      : "The right next step is to ask for a safer alternative, not to re-validate this product.");

  return dedupeStrings([mentionText, compatibilityText, actionText]);
}

function buildAllergenSummary(
  language: AssistantLanguage,
  summary: FallbackEvidenceSummary,
) {
  if (summary.primaryMentions) {
    if (summary.secondaryMentions) {
      return language === "fr"
        ? `Le scan a relevé ${summary.primaryMentions}, ce qui suffit déjà à bloquer le produit pour ${summary.assistantCriteria}. L'étiquette reste aussi floue sur ${summary.secondaryMentions}.`
        : `The scan picked up ${summary.primaryMentions}, which is already enough to block this product for ${summary.assistantCriteria}. The label also stays unclear about ${summary.secondaryMentions}.`;
    }

    return language === "fr"
      ? `Le scan a relevé ${summary.primaryMentions}, ce qui suffit déjà à bloquer le produit pour ${summary.assistantCriteria}.`
      : `The scan picked up ${summary.primaryMentions}, which is already enough to block this product for ${summary.assistantCriteria}.`;
  }

  return language === "fr"
    ? `Le scan a détecté un élément non compatible avec ${summary.assistantCriteria}. Ce produit doit être écarté.`
    : `The scan detected something incompatible with ${summary.assistantCriteria}. This product should be avoided.`;
}

function buildAmbiguousSummary(
  language: AssistantLanguage,
  summary: FallbackEvidenceSummary,
) {
  if (!summary.primaryMentions) {
    return language === "fr"
      ? "Le doute principal vient de certains additifs ou assaisonnements mal détaillés par l'étiquette. Une vérification humaine est recommandée."
      : "The main uncertainty comes from additives or seasonings that stay too vague on the label. A human check is recommended.";
  }

  if (summary.classification === "ambiguous_global") {
    return language === "fr"
      ? `Le doute principal vient de ${summary.primaryMentions}. Tant que ce point n'est pas clarifié, il peut concerner l'ensemble de vos critères sélectionnés.`
      : `The main uncertainty comes from ${summary.primaryMentions}. Until this point is clarified, it may affect all of your selected criteria.`;
  }

  return language === "fr"
    ? `Le doute principal vient de ${summary.primaryMentions}. L'étiquette ne permet pas encore de confirmer si cela reste compatible avec ${summary.assistantCriteria}.`
    : `The main uncertainty comes from ${summary.primaryMentions}. The label does not clearly confirm whether that stays compatible with ${summary.assistantCriteria}.`;
}

function buildFallbackDisclaimer(language: AssistantLanguage) {
  return language === "fr"
    ? "L'Assistant IA aide à préparer la vérification, mais ne remplace pas une confirmation humaine. En cas de doute persistant, n'achetez pas le produit."
    : "The AI Assistant helps you prepare the verification, but it does not replace human confirmation. If the doubt remains, do not buy the product.";
}

function buildFallbackAmbiguityReasons(
  language: AssistantLanguage,
  mode: ScanAssistantMode,
  summary: FallbackEvidenceSummary,
  ambiguityReasons: string[],
) {
  if (mode === "allergen") {
    return buildAllergenReasons(language, summary);
  }

  if (ambiguityReasons.length > 0) {
    return ambiguityReasons;
  }

  return [
    language === "fr"
      ? "Le terme utilisé sur l'étiquette reste trop générique pour conclure avec certitude."
      : "The term used on the label is still too generic to conclude safely.",
  ];
}

export function buildFallbackPhrases(
  context: AssistantScanContext,
  language: AssistantLanguage,
  mode: ScanAssistantMode,
): ScanAssistantStorePhrase[] {
  const { primary } = getPrimaryEvidenceSet(context);
  const primaryLabels = getEvidenceIngredientLabels(primary).slice(0, 3);
  const primaryMentions = buildMentionExamples(primaryLabels, language);
  const focusedCriteriaLabels = getCriterionLabelsForEvidence(primary);
  const assistantCriteria = buildCriteriaPhrase(context, focusedCriteriaLabels, language, "assistant");
  const userNeed = buildUserNeedSentence(context, focusedCriteriaLabels, language);
  const focusedKind = getCriterionKindForLabels(context, focusedCriteriaLabels);

  if (mode === "allergen") {
    return buildAllergenFallbackPhrases(
      language,
      focusedKind,
      userNeed,
      primaryMentions,
      assistantCriteria,
    );
  }

  return buildAmbiguousFallbackPhrases(context, language, primaryMentions, assistantCriteria);
}

export function buildFallbackAdditionalPhrases(
  context: AssistantScanContext,
  language: AssistantLanguage,
  mode: ScanAssistantMode,
): ScanAssistantStorePhrase[] {
  const { primary } = getPrimaryEvidenceSet(context);
  const focusedCriteriaLabels = getCriterionLabelsForEvidence(primary);
  const assistantCriteria = buildCriteriaPhrase(context, focusedCriteriaLabels, language, "assistant");
  const userNeed = buildUserNeedSentence(context, focusedCriteriaLabels, language);
  const focusedKind = getCriterionKindForLabels(context, focusedCriteriaLabels);

  if (mode === "allergen") {
    return language === "fr"
      ? buildFrenchAllergenAdditionalPhrases(assistantCriteria, userNeed, focusedKind)
      : buildEnglishAllergenAdditionalPhrases(assistantCriteria, userNeed, focusedKind);
  }

  return language === "fr"
    ? buildFrenchAmbiguousAdditionalPhrases()
    : buildEnglishAmbiguousAdditionalPhrases();
}

export function buildFallbackResponse(
  context: AssistantScanContext,
  language: AssistantLanguage,
): ScanAmbiguousAssistantResponse {
  const riskLevel = inferRiskLevel(context);
  const mode = inferAssistantMode(context);
  const { primary, secondary, classification } = getPrimaryEvidenceSet(context);
  const primaryLabels = getEvidenceIngredientLabels(primary).slice(0, 3);
  const primaryMentions = buildMentionExamples(primaryLabels, language);
  const primaryExamples = buildQuotedLabelList(primaryLabels, language);
  const focusedCriteriaLabels = getCriterionLabelsForEvidence(primary);
  const assistantCriteria = buildCriteriaPhrase(context, focusedCriteriaLabels, language, "assistant");
  const secondaryLabels = getEvidenceIngredientLabels(secondary).slice(0, 2);
  const secondaryMentions = buildMentionExamples(secondaryLabels, language);

  const ambiguityReasons = dedupeStrings(
    primary
      .slice(0, 3)
      .map((item) => item.reason),
  );
  const summaryData: FallbackEvidenceSummary = {
    primaryExamples,
    primaryMentions,
    secondaryMentions,
    assistantCriteria,
    classification,
  };
  const allergenSummary = buildAllergenSummary(language, summaryData);
  const ambiguousSummary = buildAmbiguousSummary(language, summaryData);
  const allergenCheckpoints = buildAllergenCheckpoints(language, summaryData);
  const ambiguousCheckpoints = buildAmbiguousCheckpoints(language, summaryData);

  return {
    mode,
    analysis_summary: mode === "allergen" ? allergenSummary : ambiguousSummary,
    ambiguity_reasons: buildFallbackAmbiguityReasons(language, mode, summaryData, ambiguityReasons),
    checkpoints: mode === "allergen" ? allergenCheckpoints : ambiguousCheckpoints,
    store_phrases: buildFallbackPhrases(context, language, mode),
    risk_level: riskLevel,
    disclaimer: buildFallbackDisclaimer(language),
  };
}

export function buildFallbackAdditionalCards(
  context: AssistantScanContext,
  language: AssistantLanguage,
  existingResponse: ScanAmbiguousAssistantResponse,
) {
  const additions = buildFallbackAdditionalPhrases(context, language, existingResponse.mode);
  const merged = mergeStorePhrases(existingResponse.store_phrases, additions, 6);

  return merged.slice(existingResponse.store_phrases.length);
}

export function buildForcedRegenerationFallbackResponse(
  context: AssistantScanContext,
  language: AssistantLanguage,
): ScanAmbiguousAssistantResponse {
  const base = buildFallbackResponse(context, language);
  const mode = inferAssistantMode(context);
  const { primary } = getPrimaryEvidenceSet(context);
  const primaryLabels = getEvidenceIngredientLabels(primary).slice(0, 3);
  const primaryMentions = buildMentionExamples(primaryLabels, language);
  const focusedCriteriaLabels = getCriterionLabelsForEvidence(primary);
  const assistantCriteria = buildCriteriaPhrase(context, focusedCriteriaLabels, language, "assistant");
  const userNeed = buildUserNeedSentence(context, focusedCriteriaLabels, language);
  const focusedKind = getCriterionKindForLabels(context, focusedCriteriaLabels);

  if (mode === "allergen") {
    if (language === "fr") {
      return {
        ...base,
        analysis_summary: primaryMentions
          ? `Lecture alternative : ${primaryMentions} ressort clairement comme point bloquant pour ${assistantCriteria}. Mieux vaut demander directement une option plus fiable.`
          : `Lecture alternative : un élément détecté ressort comme bloquant pour ${assistantCriteria}. Mieux vaut demander directement une alternative plus sûre.`,
        checkpoints: dedupeStrings([
          `Demander un produit de remplacement plus sûr pour ${assistantCriteria}.`,
          "Faire montrer l'étiquette complète pour identifier clairement l'élément bloquant.",
          "Si l'information reste floue, ne pas essayer de valider ce produit et passer à une option plus simple.",
        ]),
        store_phrases: [
          {
            title: "Trouver une alternative",
            user_language: `${userNeed} Pouvez-vous me montrer un produit similaire mais plus sûr ?`,
            japanese: "私の食事条件に合う、より安全な似た商品を見せていただけますか。",
            romaji: "Watashi no shokuji joken ni au, yori anzen na nita shohin o misete itadakemasu ka.",
          },
          {
            title: "Montrer l'etiquette complete",
            user_language: `Pouvez-vous me montrer l'étiquette complète pour voir ce qui pose problème pour ${assistantCriteria} ?`,
            japanese: "問題になる原材料を確認したいので、原材料表示を全部見せていただけますか。",
            romaji: "Mondai ni naru genzairyo o kakunin shitai node, genzairyo hyoji o zenbu misete itadakemasu ka.",
          },
          {
            title: "Confirmer les traces",
            user_language: focusedKind === "profile"
              ? `Je cherche une option plus clairement compatible avec ${assistantCriteria}. Pouvez-vous vérifier cela ?`
              : `Je cherche une option plus sûre pour ${assistantCriteria}, sans risque de traces. Pouvez-vous vérifier cela ?`,
            japanese: "このアレルゲンや微量混入の心配がないか確認していただけますか。",
            romaji: "Kono arerugen ya biryo konnyu no shinpai ga nai ka kakunin shite itadakemasu ka.",
          },
        ],
      };
    }

    return {
      ...base,
      analysis_summary: primaryMentions
        ? `Alternative reading: ${primaryMentions} stands out as the blocking signal for ${assistantCriteria}. The safer move is to ask for another product right away.`
        : `Alternative reading: a detected element stands out as incompatible with ${assistantCriteria}. The safer move is to ask for another product right away.`,
      checkpoints: dedupeStrings([
        `Ask for a replacement that stays safer for ${assistantCriteria}.`,
        "Ask to see the full label so the blocking ingredient is clearly identified.",
        "If the answer stays vague, do not try to validate this product and move to a simpler option.",
      ]),
      store_phrases: [
        {
          title: "Ask for a safer alternative",
          user_language: `${userNeed} Could you show me a similar product that is safer?`,
          japanese: "私の食事条件に合う、より安全な似た商品を見せていただけますか。",
          romaji: "Watashi no shokuji joken ni au, yori anzen na nita shohin o misete itadakemasu ka.",
        },
        {
          title: "Show the full label",
          user_language: `Could you show me the full label so I can see what is a problem for ${assistantCriteria}?`,
          japanese: "問題になる原材料を確認したいので、原材料表示を全部見せていただけますか。",
          romaji: "Mondai ni naru genzairyo o kakunin shitai node, genzairyo hyoji o zenbu misete itadakemasu ka.",
        },
        {
          title: "Confirm trace risk",
          user_language: focusedKind === "profile"
            ? `I need an option that is more clearly compatible with ${assistantCriteria}. Could you check that for me?`
            : `I need a safer option for ${assistantCriteria}, without trace risk. Could you check that for me?`,
          japanese: "このアレルゲンや微量混入の心配がないか確認していただけますか。",
          romaji: "Kono arerugen ya biryo konnyu no shinpai ga nai ka kakunin shite itadakemasu ka.",
        },
      ],
    };
  }

  if (language === "fr") {
    return {
      ...base,
      analysis_summary: primaryMentions
        ? `Lecture alternative : ${primaryMentions} reste le point le plus incertain. Le plus utile est de faire préciser sa composition exacte avant d'acheter.`
        : "Lecture alternative : certains additifs ou assaisonnements restent trop flous. Le plus utile est de demander un détail précis avant d'acheter.",
      checkpoints: dedupeStrings([
        primaryLabels.length > 0
          ? `Faire préciser exactement ce que recouvre ${joinHumanList(primaryLabels, language)}.`
          : "Faire préciser les additifs, agents épaississants ou assaisonnements encore trop vagues.",
        "Vérifier s'il existe un risque de traces ou une fabrication sur la même ligne qu'un allergène concerné.",
        "Si le doute reste entier, demander un produit plus simple ou mieux détaillé.",
      ]),
      store_phrases: [
        {
          title: "Demander le detail exact",
          user_language: "Pouvez-vous préciser exactement quel ingrédient, additif ou assaisonnement est utilisé ici ?",
          japanese: "ここで使われている原材料、添加物、または調味料の詳細を教えていただけますか。",
          romaji: "Koko de tsukawarete iru genzairyo, tenkabutsu, matawa chomiryo no shosai o oshiete itadakemasu ka.",
        },
        {
          title: "Verifier la fabrication",
          user_language: "Pouvez-vous vérifier s'il existe un risque de traces ou de contamination croisée sur la même ligne ?",
          japanese: "同じラインでアレルゲンを扱っているか、または微量混入の可能性があるか確認していただけますか。",
          romaji: "Onaji rain de arerugen o atsukatte iru ka, matawa biryo konnyu no kanosei ga aru ka kakunin shite itadakemasu ka.",
        },
        {
          title: "Chercher une option plus simple",
          user_language: "Avez-vous une version plus simple ou un produit mieux détaillé pour vérifier plus facilement ?",
          japanese: "もっとシンプルな商品や、原材料が詳しく分かる商品はありますか。",
          romaji: "Motto shinpuru na shohin ya, genzairyo ga kuwashiku wakaru shohin wa arimasu ka.",
        },
      ],
      disclaimer: "Cette nouvelle formulation aide a relancer la verification, mais elle ne remplace toujours pas une confirmation humaine. Si le doute persiste, n'achetez pas le produit.",
    };
  }

  return {
    ...base,
    analysis_summary: primaryMentions
      ? `Alternative reading: ${primaryMentions} remains the most uncertain point. The most useful next step is to ask for the exact composition before buying.`
      : "Alternative reading: some additives or seasonings remain too vague. The most useful next step is to ask for precise details before buying.",
    checkpoints: dedupeStrings([
      primaryLabels.length > 0
        ? `Ask exactly what ${joinHumanList(primaryLabels, language)} refers to in this product.`
        : "Ask for precise details about the additives, thickeners or seasonings that remain vague.",
      "Check whether there is any trace risk or shared-line contamination with a relevant allergen.",
      "If the doubt stays unresolved, ask for a simpler or better documented product.",
    ]),
    store_phrases: [
      {
        title: "Ask for the exact detail",
        user_language: "Could you tell me exactly which ingredient, additive or seasoning is used here?",
        japanese: "ここで使われている原材料、添加物、または調味料の詳細を教えていただけますか。",
        romaji: "Koko de tsukawarete iru genzairyo, tenkabutsu, matawa chomiryo no shosai o oshiete itadakemasu ka.",
      },
      {
        title: "Check the production line",
        user_language: "Could you check whether there is any trace risk or cross-contact on the same line?",
        japanese: "同じラインでアレルゲンを扱っているか、または微量混入の可能性があるか確認していただけますか。",
        romaji: "Onaji rain de arerugen o atsukatte iru ka, matawa biryo konnyu no kanosei ga aru ka kakunin shite itadakemasu ka.",
      },
      {
        title: "Look for a simpler option",
        user_language: "Do you have a simpler version or a product with a clearer ingredient label?",
        japanese: "もっとシンプルな商品や、原材料が詳しく分かる商品はありますか。",
        romaji: "Motto shinpuru na shohin ya, genzairyo ga kuwashiku wakaru shohin wa arimasu ka.",
      },
    ],
    disclaimer: "This refreshed wording helps you restart the verification, but it still does not replace human confirmation. If the doubt remains, do not buy the product.",
  };
}

export function buildDistinctForcedAssistantFallback(
  context: AssistantScanContext,
  language: AssistantLanguage,
  previousResponse: ScanAmbiguousAssistantResponse | null | undefined,
) {
  const refreshedFallback = buildForcedRegenerationFallbackResponse(context, language);
  if (areAssistantResponsesMeaningfullyDifferent(previousResponse, refreshedFallback)) {
    return refreshedFallback;
  }

  const defaultFallback = buildFallbackResponse(context, language);
  if (areAssistantResponsesMeaningfullyDifferent(previousResponse, defaultFallback)) {
    return defaultFallback;
  }

  return refreshedFallback;
}
