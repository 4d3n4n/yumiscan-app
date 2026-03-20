import { getAuthUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

import { computeAssistantSourceSignature, persistAssistantCache, readAssistantCacheEntry } from "./cache.ts";
import { getAssistantAiModel, loadScanContext } from "./context.ts";
import { buildDistinctForcedAssistantFallback, buildFallbackAdditionalCards, buildFallbackResponse } from "./fallbacks.ts";
import { callGeminiAdditionalCards, callGeminiAssistant } from "./gemini.ts";
import { areAssistantResponsesMeaningfullyDifferent, mergeStorePhrases } from "./helpers.ts";
import { RequestSchema, z } from "./schema.ts";
import {
  MAX_ASSISTANT_CARD_COUNT,
  type AssistantLanguage,
  type AssistantServiceClient,
} from "./types.ts";

import type {
  ScanAmbiguousAssistantResponse,
  ScanAssistantStorePhrase,
} from "../_shared/scan-ai-assistant.ts";

function jsonResponse(cors: HeadersInit, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...cors, "Content-Type": "application/json" },
    status,
  });
}

function isAssistantUnavailable(scanContext: NonNullable<Awaited<ReturnType<typeof loadScanContext>>>) {
  return (
    scanContext.productStatus !== "ambiguous"
    && scanContext.productStatus !== "contains_allergen"
    && scanContext.ambiguousIngredients.length === 0
    && scanContext.allergenIngredients.length === 0
  );
}

async function resolveAdditionalCards(
  scanContext: NonNullable<Awaited<ReturnType<typeof loadScanContext>>>,
  language: AssistantLanguage,
  assistantAiModel: string,
  sourceSignature: string,
  latestResponse: ScanAmbiguousAssistantResponse,
  serviceClient: AssistantServiceClient,
) {
  const remainingSlots = Math.max(0, MAX_ASSISTANT_CARD_COUNT - latestResponse.store_phrases.length);
  if (remainingSlots === 0) {
    return latestResponse;
  }

  let additionalPhrases: ScanAssistantStorePhrase[] = [];

  try {
    additionalPhrases = await callGeminiAdditionalCards(
      scanContext,
      language,
      assistantAiModel,
      latestResponse,
      remainingSlots,
    );
  } catch (error) {
    console.warn(
      "[scan-ambiguous-assistant] Additional cards fallback used:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const fallbackAdditionalPhrases = buildFallbackAdditionalCards(scanContext, language, latestResponse);
  const mergedStorePhrases = mergeStorePhrases(
    latestResponse.store_phrases,
    additionalPhrases.length > 0 ? additionalPhrases : fallbackAdditionalPhrases,
    MAX_ASSISTANT_CARD_COUNT,
  );
  const completedStorePhrases = mergedStorePhrases.length < MAX_ASSISTANT_CARD_COUNT
    ? mergeStorePhrases(mergedStorePhrases, fallbackAdditionalPhrases, MAX_ASSISTANT_CARD_COUNT)
    : mergedStorePhrases;

  const assistantResponse = {
    ...latestResponse,
    store_phrases: completedStorePhrases,
  };

  await persistAssistantCache(
    serviceClient,
    scanContext,
    language,
    sourceSignature,
    assistantResponse,
  );

  return assistantResponse;
}

async function resolveAssistantContent(
  scanContext: NonNullable<Awaited<ReturnType<typeof loadScanContext>>>,
  language: AssistantLanguage,
  assistantAiModel: string,
  latestResponse: ScanAmbiguousAssistantResponse | null,
  force: boolean,
) {
  const previousResponse = force ? latestResponse : null;

  try {
    let assistantResponse = await callGeminiAssistant(scanContext, language, assistantAiModel, {
      forceRegeneration: force,
      previousResponse,
      regenerationAttempt: force ? 1 : undefined,
    });

    if (
      force
      && previousResponse
      && !areAssistantResponsesMeaningfullyDifferent(previousResponse, assistantResponse)
    ) {
      assistantResponse = await callGeminiAssistant(scanContext, language, assistantAiModel, {
        forceRegeneration: true,
        previousResponse,
        regenerationAttempt: 2,
      });
    }

    if (
      force
      && previousResponse
      && !areAssistantResponsesMeaningfullyDifferent(previousResponse, assistantResponse)
    ) {
      console.warn(
        "[scan-ambiguous-assistant] Regeneration remained too close to the cached answer; using refreshed fallback phrasing.",
      );
      return buildDistinctForcedAssistantFallback(scanContext, language, previousResponse);
    }

    return assistantResponse;
  } catch (error) {
    console.warn(
      "[scan-ambiguous-assistant] Gemini fallback used:",
      error instanceof Error ? error.message : String(error),
    );
    if (force) {
      return buildDistinctForcedAssistantFallback(scanContext, language, previousResponse);
    }

    return buildFallbackResponse(scanContext, language);
  }
}

function getErrorStatus(message: string) {
  if (message.includes("Forbidden")) {
    return 403;
  }

  if (message.includes("token") || message.includes("auth")) {
    return 401;
  }

  return 500;
}

async function handlePostRequest(req: Request, cors: HeadersInit) {
  const { user, supabase: serviceClient } = await getAuthUser(req);
  const payload = RequestSchema.parse(await req.json().catch(() => ({})));
  const language = payload.language ?? "fr";
  const assistantAiModel = await getAssistantAiModel(serviceClient);

  if (payload.force && payload.append_cards) {
    return jsonResponse(cors, { error: "force and append_cards cannot be used together" }, 400);
  }

  const scanContext = await loadScanContext(serviceClient, user.id, payload.scan_id, language);
  if (!scanContext) {
    return jsonResponse(cors, { error: "Scan not found" }, 404);
  }

  if (isAssistantUnavailable(scanContext)) {
    return jsonResponse(cors, { error: "Assistant unavailable for this scan" }, 400);
  }

  const sourceSignature = computeAssistantSourceSignature(scanContext);
  const latestResponse = readAssistantCacheEntry(
    scanContext.assistantCacheJson,
    language,
    sourceSignature,
  );

  if (payload.append_cards) {
    if (!latestResponse) {
      return jsonResponse(cors, { error: "Assistant cache not found for this language" }, 409);
    }

    const assistantResponse = await resolveAdditionalCards(
      scanContext,
      language,
      assistantAiModel,
      sourceSignature,
      latestResponse,
      serviceClient,
    );

    return jsonResponse(cors, assistantResponse);
  }

  if (!payload.force && latestResponse) {
    return jsonResponse(cors, latestResponse);
  }

  const assistantResponse = await resolveAssistantContent(
    scanContext,
    language,
    assistantAiModel,
    latestResponse,
    payload.force ?? false,
  );

  await persistAssistantCache(
    serviceClient,
    scanContext,
    language,
    sourceSignature,
    assistantResponse,
  );

  return jsonResponse(cors, assistantResponse);
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse(cors, { error: "Method not allowed" }, 405);
  }

  try {
    return await handlePostRequest(req, cors);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonResponse(cors, { error: "Invalid request payload" }, 400);
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    return jsonResponse(cors, { error: message }, getErrorStatus(message));
  }
});
