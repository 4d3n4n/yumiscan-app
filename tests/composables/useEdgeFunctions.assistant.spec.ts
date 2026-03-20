import { describe, expect, it } from 'vitest'

import {
  ASSISTANT_CACHE_VERSION,
  mergeCachedScanAssistant,
  readCachedScanAssistant,
} from '../../utils/scan-ai-assistant'
import type {
  ScanAmbiguousAssistantResponse,
  ScanAssistantTtsResponse,
} from '../../utils/scan-ai-assistant'

describe('useEdgeFunctions (assistant)', () => {
  it('accepte une réponse Assistant IA valide (contrat)', () => {
    const sample: ScanAmbiguousAssistantResponse = {
      mode: 'ambiguous',
      analysis_summary: 'Le doute principal vient d un ingrédient générique qui doit être vérifié.',
      ambiguity_reasons: [
        'Le terme reste trop vague pour confirmer l absence de l allergène.',
      ],
      checkpoints: [
        'Vérifier la composition exacte auprès du magasin.',
        'Demander s il existe un risque de traces.',
      ],
      store_phrases: [
        {
          title: 'Question ingrédient',
          user_language: 'Pouvez-vous vérifier si ce produit contient cet allergène ?',
          japanese: 'この商品にこのアレルゲンが含まれているか確認していただけますか。',
          romaji: 'Kono shohin ni kono arerugen ga fukumarete iru ka kakunin shite itadakemasu ka.',
        },
      ],
      risk_level: 'check_required',
      disclaimer: 'En cas de doute persistant, évitez le produit.',
    }

    expect(sample.store_phrases[0].japanese).toContain('確認')
    expect(sample.risk_level).toBe('check_required')
  })

  it('accepte une réponse TTS Assistant IA valide (contrat)', () => {
    const sample: ScanAssistantTtsResponse = {
      audio_url: 'https://project.supabase.co/storage/v1/object/sign/assistant-audio/a/b/c.mp3',
      voice: 'ja-JP-Wavenet-B',
      cache_hit: true,
    }

    expect(sample.audio_url).toContain('assistant-audio')
    expect(sample.voice).toContain('Wavenet')
    expect(sample.cache_hit).toBe(true)
  })

  it('met a jour localement le cache assistant apres regeneration', () => {
    const response: ScanAmbiguousAssistantResponse = {
      mode: 'allergen',
      analysis_summary: 'Une nouvelle formulation plus actionnable est disponible.',
      ambiguity_reasons: ['Un ingredient bloquant a ete detecte.'],
      checkpoints: ['Demander une alternative plus sure.'],
      store_phrases: [
        {
          title: 'Trouver une alternative',
          user_language: 'Pouvez-vous me montrer un produit plus sur ?',
          japanese: 'より安全な商品を見せていただけますか。',
          romaji: 'Yori anzen na shohin o misete itadakemasu ka.',
        },
      ],
      risk_level: 'avoid_if_uncertain',
      disclaimer: 'En cas de doute persistant, n achetez pas le produit.',
    }

    const nextCache = mergeCachedScanAssistant(null, 'fr', response)

    expect(readCachedScanAssistant(nextCache, 'fr')).toEqual(response)
    expect(nextCache.version).toBe(ASSISTANT_CACHE_VERSION)
    expect(nextCache.entries.fr?.version).toBe(ASSISTANT_CACHE_VERSION)
  })

  it('refuse un cache front avec une version obsolète', () => {
    const staleCache = {
      version: ASSISTANT_CACHE_VERSION - 1,
      entries: {
        fr: {
          version: ASSISTANT_CACHE_VERSION - 1,
          source_signature: 'old-signature',
          generated_at: new Date().toISOString(),
          response: {
            mode: 'ambiguous',
            analysis_summary: 'Texte',
            ambiguity_reasons: ['Raison'],
            checkpoints: ['Checkpoint'],
            store_phrases: [{
              title: 'Titre',
              user_language: 'Phrase',
              japanese: '日本語です',
              romaji: 'Nihongo desu.',
            }],
            risk_level: 'check_required',
            disclaimer: 'Prudence',
          },
        },
      },
    }

    expect(readCachedScanAssistant(staleCache, 'fr')).toBeNull()
  })

  it('refuse un cache front sans source_signature', () => {
    const invalidCache = {
      version: ASSISTANT_CACHE_VERSION,
      entries: {
        fr: {
          version: ASSISTANT_CACHE_VERSION,
          generated_at: new Date().toISOString(),
          response: {
            mode: 'ambiguous',
            analysis_summary: 'Texte',
            ambiguity_reasons: ['Raison'],
            checkpoints: ['Checkpoint'],
            store_phrases: [{
              title: 'Titre',
              user_language: 'Phrase',
              japanese: '日本語です',
              romaji: 'Nihongo desu.',
            }],
            risk_level: 'check_required',
            disclaimer: 'Prudence',
          },
        },
      },
    }

    expect(readCachedScanAssistant(invalidCache, 'fr')).toBeNull()
  })
})
