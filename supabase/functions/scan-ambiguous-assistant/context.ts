import {
  type AssistantSelectedCriterion,
  buildAssistantEvidenceMatrix,
} from "../_shared/assistant-evidence.ts";
import {
  DEFAULT_ASSISTANT_AI_MODEL,
  getAppConfigMap,
  getAppConfigString,
} from "../_shared/app-config.ts";

import type {
  AssistantDbClient,
  AssistantLanguage,
  AssistantScanContext,
} from "./types.ts";
import {
  asArray,
  asRecord,
  asString,
  buildSelectedCriteria,
  dedupeStrings,
  getIngredientWithReasonList,
  localizeAllergenName,
  parseResultJson,
  splitSelectedCriteria,
} from "./helpers.ts";

export function getDefaultAssistantAiModel() {
  return Deno.env.get("ASSISTANT_AI_MODEL")?.trim()
    || Deno.env.get("GEMINI_MODEL")?.trim()
    || DEFAULT_ASSISTANT_AI_MODEL;
}

export async function getAssistantAiModel(serviceClient: AssistantDbClient) {
  try {
    const appConfigMap = await getAppConfigMap(serviceClient, ["assistant_ai_model"]);
    return getAppConfigString(appConfigMap, "assistant_ai_model", getDefaultAssistantAiModel());
  } catch (error) {
    console.warn(
      "[scan-ambiguous-assistant] app_config fallback used:",
      error instanceof Error ? error.message : String(error),
    );
    return getDefaultAssistantAiModel();
  }
}

export async function loadScanContext(
  serviceClient: AssistantDbClient,
  userId: string,
  scanId: string,
  language: AssistantLanguage,
): Promise<AssistantScanContext | null> {
  const { data: scanRow, error: scanError } = await serviceClient
    .from("scans")
    .select("id, user_id, product_status, result_json, certified_raw_text, selected_allergen_ids, assistant_cache_json, assistant_tts_cache_json")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (scanError) {
    throw new Error(scanError.message || "Failed to load scan");
  }

  if (!scanRow) {
    return null;
  }

  const resultJson = parseResultJson(scanRow.result_json);
  const meta = asRecord(resultJson?.meta);
  const detectedLanguage = asString(meta?.detected_language) || "ja";
  const ambiguousIngredients = getIngredientWithReasonList(resultJson, "ambiguous_ingredients");
  const allergenIngredients = getIngredientWithReasonList(resultJson, "allergens_ingredients");

  const allergenIds = asArray<string>(scanRow.selected_allergen_ids);
  let selectedAllergens: string[] = [];
  let selectedCriteria: AssistantSelectedCriterion[] = [];

  if (allergenIds.length > 0) {
    const { data: allergenRows, error: allergenError } = await serviceClient
      .from("allergens")
      .select("id, name, name_en")
      .in("id", allergenIds);

    if (allergenError) {
      throw new Error(allergenError.message || "Failed to load allergens");
    }

    selectedAllergens = dedupeStrings(
      (allergenRows ?? [])
        .map((row: { name?: string | null; name_en?: string | null }) => localizeAllergenName(row, language)),
    );
    selectedCriteria = buildSelectedCriteria(allergenRows ?? [], language);
  }

  const { selectedProfileLabels, selectedAllergenLabels } = splitSelectedCriteria(selectedAllergens);
  const evidenceMatrix = buildAssistantEvidenceMatrix({
    selectedCriteria,
    ambiguousIngredients,
    allergenIngredients,
  });

  return {
    scanId: asString(scanRow.id) || scanId,
    productStatus: asString(scanRow.product_status) || "ok",
    certifiedRawText: asString(scanRow.certified_raw_text) || null,
    detectedLanguage,
    selectedAllergenIds: allergenIds,
    selectedAllergens,
    selectedCriteria,
    selectedProfileLabels,
    selectedAllergenLabels,
    ambiguousIngredients,
    allergenIngredients,
    evidenceMatrix,
    assistantCacheJson: scanRow.assistant_cache_json ?? null,
    assistantTtsCacheJson: scanRow.assistant_tts_cache_json ?? null,
  };
}
