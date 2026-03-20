import {
  ASSISTANT_CACHE_VERSION,
  type ScanAmbiguousAssistantResponse,
  type ScanAssistantCacheEntry,
  type ScanAssistantCachePayload,
} from '../supabase/functions/_shared/scan-ai-assistant'

export { ASSISTANT_CACHE_VERSION } from '../supabase/functions/_shared/scan-ai-assistant'
export type {
  ScanAmbiguousAssistantRequest,
  ScanAmbiguousAssistantResponse,
  ScanAssistantTtsRequest,
  ScanAssistantTtsResponse,
} from '../supabase/functions/_shared/scan-ai-assistant'

type AssistantLanguage = 'fr' | 'en'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return strings.length === value.length ? strings : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isAssistantResponse(value: unknown): value is ScanAmbiguousAssistantResponse {
  const record = asRecord(value)
  if (!record) return false

  const storePhrases = Array.isArray(record.store_phrases) ? record.store_phrases : null

  return Boolean(
    (record.mode === 'ambiguous' || record.mode === 'allergen')
    && typeof record.analysis_summary === 'string'
    && record.analysis_summary.trim()
    && asStringArray(record.ambiguity_reasons)?.length
    && asStringArray(record.checkpoints)?.length
    && (record.risk_level === 'probably_ok'
      || record.risk_level === 'check_required'
      || record.risk_level === 'avoid_if_uncertain')
    && typeof record.disclaimer === 'string'
    && record.disclaimer.trim()
    && storePhrases?.length
    && storePhrases.every((phrase) => {
      const phraseRecord = asRecord(phrase)
      return Boolean(
        phraseRecord
        && typeof phraseRecord.title === 'string'
        && phraseRecord.title.trim()
        && typeof phraseRecord.user_language === 'string'
        && phraseRecord.user_language.trim()
        && typeof phraseRecord.japanese === 'string'
        && phraseRecord.japanese.trim()
        && typeof phraseRecord.romaji === 'string'
        && phraseRecord.romaji.trim()
      )
    })
  )
}

export function readCachedScanAssistant(
  cacheValue: unknown,
  language: AssistantLanguage,
): ScanAmbiguousAssistantResponse | null {
  const cacheRecord = asRecord(cacheValue)
  const cacheVersion = asNumber(cacheRecord?.version)
  if (cacheVersion !== ASSISTANT_CACHE_VERSION) return null

  const entriesRecord = asRecord(cacheRecord?.entries)
  const languageEntry = asRecord(entriesRecord?.[language])
  const entryVersion = asNumber(languageEntry?.version)
  const sourceSignature = typeof languageEntry?.source_signature === 'string'
    ? languageEntry.source_signature.trim()
    : ''
  const generatedAt = typeof languageEntry?.generated_at === 'string'
    ? languageEntry.generated_at.trim()
    : ''
  const response = languageEntry?.response

  if (
    entryVersion !== ASSISTANT_CACHE_VERSION
    || !sourceSignature
    || !generatedAt
  ) {
    return null
  }

  return isAssistantResponse(response) ? response : null
}

export function mergeCachedScanAssistant(
  cacheValue: unknown,
  language: AssistantLanguage,
  response: ScanAmbiguousAssistantResponse,
) : ScanAssistantCachePayload {
  const cacheRecord = asRecord(cacheValue)
  const entriesRecord = asRecord(cacheRecord?.entries)
  const nextEntries: ScanAssistantCachePayload['entries'] = entriesRecord
    ? { ...entriesRecord as ScanAssistantCachePayload['entries'] }
    : {}
  const previousLanguageEntry = asRecord(nextEntries[language])

  nextEntries[language] = {
    ...((previousLanguageEntry ?? {}) as Partial<ScanAssistantCacheEntry>),
    version: ASSISTANT_CACHE_VERSION,
    source_signature: typeof previousLanguageEntry?.source_signature === 'string'
      ? previousLanguageEntry.source_signature
      : 'front-local',
    generated_at: new Date().toISOString(),
    response,
  }

  return {
    ...(cacheRecord ?? {}),
    version: ASSISTANT_CACHE_VERSION,
    entries: nextEntries,
  }
}
