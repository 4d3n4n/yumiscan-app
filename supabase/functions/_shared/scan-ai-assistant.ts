export const ASSISTANT_CACHE_VERSION = 2

export type ScanAssistantRiskLevel =
  | 'probably_ok'
  | 'check_required'
  | 'avoid_if_uncertain'

export type ScanAssistantMode =
  | 'ambiguous'
  | 'allergen'

export type ScanAssistantStorePhrase = {
  title: string
  user_language: string
  japanese: string
  romaji: string
}

export type ScanAssistantTtsRequest = {
  scan_id: string
  phrase_index: number
  language?: 'fr' | 'en'
}

export type ScanAssistantTtsResponse = {
  audio_url: string
  voice: string
  cache_hit: boolean
}

export type ScanAmbiguousAssistantRequest = {
  scan_id: string
  language?: 'fr' | 'en'
  force?: boolean
  append_cards?: boolean
}

export type ScanAmbiguousAssistantResponse = {
  mode: ScanAssistantMode
  analysis_summary: string
  ambiguity_reasons: string[]
  checkpoints: string[]
  store_phrases: ScanAssistantStorePhrase[]
  risk_level: ScanAssistantRiskLevel
  disclaimer: string
}

export type ScanAssistantCacheEntry = {
  version: number
  source_signature: string
  generated_at: string
  response: ScanAmbiguousAssistantResponse
}

export type ScanAssistantCachePayload = {
  version: number
  entries: Partial<Record<'fr' | 'en', ScanAssistantCacheEntry>>
}
