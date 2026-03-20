import { ASSISTANT_CACHE_VERSION } from "../_shared/scan-ai-assistant.ts";
import {
  DEFAULT_ASSISTANT_TTS_VOICE,
  reconcileAssistantTtsCacheForLanguage,
} from "../_shared/scan-assistant-tts-cache.ts";

import type {
  ScanAssistantCacheEntry,
  ScanAssistantCachePayload,
  ScanAmbiguousAssistantResponse,
} from "../_shared/scan-ai-assistant.ts";

import { PersistedAssistantResponseSchema } from "./schema.ts";
import type {
  AssistantLanguage,
  AssistantScanContext,
  AssistantServiceClient,
} from "./types.ts";
import {
  asRecord,
  asString,
  fnv1aHash,
  stableSerialize,
} from "./helpers.ts";

export function computeAssistantSourceSignature(context: AssistantScanContext) {
  return `${ASSISTANT_CACHE_VERSION}:${fnv1aHash(stableSerialize({
    productStatus: context.productStatus,
    certifiedRawText: context.certifiedRawText,
    detectedLanguage: context.detectedLanguage,
    selectedAllergenIds: [...context.selectedAllergenIds].sort((left, right) => left.localeCompare(right)),
    selectedCriteria: context.selectedCriteria,
    evidenceMatrix: context.evidenceMatrix,
  }))}`;
}

export function readAssistantCacheEntry(
  cacheValue: unknown,
  language: AssistantLanguage,
  sourceSignature: string,
): ScanAmbiguousAssistantResponse | null {
  const cacheRecord = asRecord(cacheValue);
  const entries = asRecord(cacheRecord?.entries);
  const entryRecord = asRecord(entries?.[language]);
  if (!entryRecord) return null;

  const version = typeof entryRecord.version === "number" ? entryRecord.version : 0;
  const entrySignature = asString(entryRecord.source_signature);
  if (version !== ASSISTANT_CACHE_VERSION || entrySignature !== sourceSignature) {
    return null;
  }

  const response = PersistedAssistantResponseSchema.safeParse(entryRecord.response);
  return response.success ? response.data : null;
}

function buildAssistantCachePayload(
  existingCache: unknown,
  language: AssistantLanguage,
  sourceSignature: string,
  response: ScanAmbiguousAssistantResponse,
): ScanAssistantCachePayload {
  const existingRecord = asRecord(existingCache);
  const existingEntriesRecord = asRecord(existingRecord?.entries);
  const entries: Partial<Record<AssistantLanguage, ScanAssistantCacheEntry>> = {};

  for (const cacheLanguage of ["fr", "en"] as const) {
    const entryRecord = asRecord(existingEntriesRecord?.[cacheLanguage]);
    const parsedResponse = PersistedAssistantResponseSchema.safeParse(entryRecord?.response);
    const version = typeof entryRecord?.version === "number" ? entryRecord.version : 0;
    const source_signature = asString(entryRecord?.source_signature);
    const generated_at = asString(entryRecord?.generated_at);

    if (!parsedResponse.success || version !== ASSISTANT_CACHE_VERSION || !source_signature || !generated_at) {
      continue;
    }

    entries[cacheLanguage] = {
      version,
      source_signature,
      generated_at,
      response: parsedResponse.data,
    };
  }

  entries[language] = {
    version: ASSISTANT_CACHE_VERSION,
    source_signature: sourceSignature,
    generated_at: new Date().toISOString(),
    response,
  };

  return {
    version: ASSISTANT_CACHE_VERSION,
    entries,
  };
}

export async function persistAssistantCache(
  serviceClient: AssistantServiceClient,
  context: AssistantScanContext,
  language: AssistantLanguage,
  sourceSignature: string,
  response: ScanAmbiguousAssistantResponse,
) {
  const nextCache = buildAssistantCachePayload(
    context.assistantCacheJson,
    language,
    sourceSignature,
    response,
  );

  const { nextCache: nextTtsCache, removedPaths } = await reconcileAssistantTtsCacheForLanguage(
    context.assistantTtsCacheJson,
    language,
    response.store_phrases.map((phrase) => phrase.japanese),
    DEFAULT_ASSISTANT_TTS_VOICE,
  );

  const { error } = await serviceClient
    .from("scans")
    .update({
      assistant_cache_json: nextCache,
      assistant_tts_cache_json: nextTtsCache,
    })
    .eq("id", context.scanId);

  if (error) {
    throw new Error(error.message || "Failed to persist assistant cache");
  }

  if (removedPaths.length > 0) {
    const { error: storageError } = await serviceClient.storage
      .from("assistant-audio")
      .remove(removedPaths);

    if (storageError) {
      console.warn(
        "[scan-ambiguous-assistant] stale TTS cleanup skipped:",
        storageError.message,
      );
    }
  }
}
