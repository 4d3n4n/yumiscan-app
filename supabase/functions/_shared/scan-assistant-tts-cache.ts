export const ASSISTANT_TTS_CACHE_VERSION = 1;
export const DEFAULT_ASSISTANT_TTS_VOICE = "ja-JP-Wavenet-B";
export const ASSISTANT_TTS_AUDIO_CONTENT_TYPE = "audio/mpeg";
export const ASSISTANT_TTS_CACHE_KEY_VERSION = "v1";

export type AssistantLanguage = "fr" | "en";

export type AssistantTtsCacheEntry = {
  voice: string;
  text_hash: string;
  storage_path: string;
  generated_at: string;
  content_type: string;
};

export type AssistantTtsCachePayload = {
  version: number;
  entries: Partial<Record<AssistantLanguage, Record<string, AssistantTtsCacheEntry>>>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseEntry(value: unknown): AssistantTtsCacheEntry | null {
  const record = asRecord(value);
  if (!record) return null;

  const voice = asString(record.voice);
  const text_hash = asString(record.text_hash);
  const storage_path = asString(record.storage_path);
  const generated_at = asString(record.generated_at);
  const content_type = asString(record.content_type);

  if (!voice || !text_hash || !storage_path || !generated_at || !content_type) {
    return null;
  }

  return {
    voice,
    text_hash,
    storage_path,
    generated_at,
    content_type,
  };
}

export function readAssistantTtsCacheEntry(
  cache: unknown,
  language: AssistantLanguage,
  phraseIndex: number,
): AssistantTtsCacheEntry | null {
  const cacheRecord = asRecord(cache);
  if (!cacheRecord) return null;

  const version = typeof cacheRecord?.version === "number" ? cacheRecord.version : 0;
  if (version !== ASSISTANT_TTS_CACHE_VERSION) return null;

  const entriesRecord = asRecord(cacheRecord.entries);
  const languageEntries = asRecord(entriesRecord?.[language]);
  if (!languageEntries) return null;

  return parseEntry(languageEntries[String(phraseIndex)]);
}

export function buildAssistantTtsCachePayload(
  existingCache: unknown,
  language: AssistantLanguage,
  phraseIndex: number,
  nextEntry: AssistantTtsCacheEntry,
): AssistantTtsCachePayload {
  const existingRecord = asRecord(existingCache);
  const existingEntries = asRecord(existingRecord?.entries);
  const entries: Partial<Record<AssistantLanguage, Record<string, AssistantTtsCacheEntry>>> = {};

  for (const cacheLanguage of ["fr", "en"] as const) {
    const languageRecord = asRecord(existingEntries?.[cacheLanguage]);
    if (!languageRecord) continue;

    const nextLanguageEntries: Record<string, AssistantTtsCacheEntry> = {};
    for (const [entryKey, entryValue] of Object.entries(languageRecord)) {
      const parsedEntry = parseEntry(entryValue);
      if (parsedEntry) {
        nextLanguageEntries[entryKey] = parsedEntry;
      }
    }

    if (Object.keys(nextLanguageEntries).length > 0) {
      entries[cacheLanguage] = nextLanguageEntries;
    }
  }

  const languageEntries = {
    ...(entries[language] ?? {}),
    [String(phraseIndex)]: nextEntry,
  };

  entries[language] = languageEntries;

  return {
    version: ASSISTANT_TTS_CACHE_VERSION,
    entries,
  };
}

export function listAssistantTtsStoragePaths(cache: unknown): string[] {
  const cacheRecord = asRecord(cache);
  if (!cacheRecord) return [];

  const version = typeof cacheRecord?.version === "number" ? cacheRecord.version : 0;
  if (version !== ASSISTANT_TTS_CACHE_VERSION) return [];

  const entriesRecord = asRecord(cacheRecord.entries);
  if (!entriesRecord) return [];

  const paths = new Set<string>();

  for (const cacheLanguage of ["fr", "en"] as const) {
    const languageEntries = asRecord(entriesRecord[cacheLanguage]);
    if (!languageEntries) continue;

    for (const entry of Object.values(languageEntries)) {
      const parsedEntry = parseEntry(entry);
      if (parsedEntry) {
        paths.add(parsedEntry.storage_path);
      }
    }
  }

  return Array.from(paths);
}

export async function reconcileAssistantTtsCacheForLanguage(
  existingCache: unknown,
  language: AssistantLanguage,
  japanesePhrases: string[],
  voice: string,
): Promise<{ nextCache: AssistantTtsCachePayload | null; removedPaths: string[] }> {
  const existingRecord = asRecord(existingCache);
  const existingEntries = asRecord(existingRecord?.entries);
  const nextEntries: Partial<Record<AssistantLanguage, Record<string, AssistantTtsCacheEntry>>> = {};
  const removedPaths = new Set<string>();
  const expectedHashes = new Map<string, string>();

  for (const [index, phrase] of japanesePhrases.entries()) {
    expectedHashes.set(
      String(index),
      await computeAssistantTtsTextHash(phrase, voice),
    );
  }

  for (const cacheLanguage of ["fr", "en"] as const) {
    const languageRecord = asRecord(existingEntries?.[cacheLanguage]);
    if (!languageRecord) continue;

    const nextLanguageEntries: Record<string, AssistantTtsCacheEntry> = {};
    for (const [entryKey, entryValue] of Object.entries(languageRecord)) {
      const parsedEntry = parseEntry(entryValue);
      if (!parsedEntry) continue;

      if (cacheLanguage !== language) {
        nextLanguageEntries[entryKey] = parsedEntry;
        continue;
      }

      const expectedHash = expectedHashes.get(entryKey);
      const shouldKeep = Boolean(
        expectedHash &&
        parsedEntry.voice === voice &&
        parsedEntry.text_hash === expectedHash &&
        parsedEntry.content_type === ASSISTANT_TTS_AUDIO_CONTENT_TYPE,
      );

      if (shouldKeep) {
        nextLanguageEntries[entryKey] = parsedEntry;
        continue;
      }

      removedPaths.add(parsedEntry.storage_path);
    }

    if (Object.keys(nextLanguageEntries).length > 0) {
      nextEntries[cacheLanguage] = nextLanguageEntries;
    }
  }

  return {
    nextCache: Object.keys(nextEntries).length > 0
      ? {
        version: ASSISTANT_TTS_CACHE_VERSION,
        entries: nextEntries,
      }
      : null,
    removedPaths: Array.from(removedPaths),
  };
}

export async function computeAssistantTtsTextHash(
  japaneseText: string,
  voice: string,
): Promise<string> {
  const payload = `${ASSISTANT_TTS_CACHE_KEY_VERSION}:${voice}:${japaneseText.trim()}`;
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildAssistantTtsStoragePath(params: {
  userId: string;
  scanId: string;
  language: AssistantLanguage;
  phraseIndex: number;
  voice: string;
  textHash: string;
}): string {
  return [
    params.userId,
    params.scanId,
    params.language,
    `phrase-${params.phraseIndex}`,
    params.voice,
    `${params.textHash}.mp3`,
  ].join("/");
}
