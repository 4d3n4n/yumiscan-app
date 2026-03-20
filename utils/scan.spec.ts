import { describe, it, expect } from 'vitest'
import {
  getScanAlertCount,
  getScanAllergenIngredients,
  getScanAmbiguousIngredients,
  getScanIngredientCount,
  getScanIngredientTree,
  getScanProcessedIngredientCount,
  getScanStatusConfig,
  getStatusEmojiFilterClass,
  parseResultJson,
} from './scan'

describe('parseResultJson', () => {
  it('retourne null pour null ou undefined', () => {
    expect(parseResultJson(null)).toBe(null)
    expect(parseResultJson(undefined)).toBe(null)
  })

  it('parse une chaîne JSON et retourne l’objet', () => {
    const obj = { product_status: 'ok', debug: { phase7: {} } }
    expect(parseResultJson(JSON.stringify(obj))).toEqual(obj)
  })

  it('retourne l’objet tel quel si ce n’est pas une chaîne', () => {
    const obj = { foo: 'bar' }
    expect(parseResultJson(obj)).toBe(obj)
  })

  it('retourne null si la chaîne est du JSON invalide', () => {
    expect(parseResultJson('not json')).toBe(null)
    expect(parseResultJson('')).toBe(null)
  })
})

describe('scan result helpers', () => {
  it('préfère ingredient_tree top-level et fallback sur le legacy debug.phase7', () => {
    expect(getScanIngredientTree({
      ingredient_tree: [{ main_text_fr: 'Farine', main_text_jp: '小麦粉', has_sub_ingredients: false, sub_ingredients: [] }],
      debug: {
        phase7: {
          ingredient_tree: [{ main_text_fr: 'Legacy', main_text_jp: '旧', has_sub_ingredients: false, sub_ingredients: [] }],
        },
      },
    })).toHaveLength(1)

    expect(getScanIngredientTree({
      debug: {
        phase7: {
          ingredient_tree: [{ main_text_fr: 'Legacy', main_text_jp: '旧', has_sub_ingredients: false, sub_ingredients: [] }],
        },
      },
    })).toHaveLength(1)
  })

  it('lit les ingrédients top-level front-safe pour allergènes et ambiguïtés', () => {
    const result = {
      ok_ingredients: [{ raw: 'riz', normalized: 'riz' }],
      ambiguous_ingredients: [{ raw: 'arôme', normalized: 'arome', reason: 'Vague' }],
      allergens_ingredients: [{ raw: 'lait', normalized: 'lait', reason: 'Famille: lait' }],
    }

    expect(getScanAllergenIngredients(result)).toEqual(result.allergens_ingredients)
    expect(getScanAmbiguousIngredients(result)).toEqual(result.ambiguous_ingredients)
    expect(getScanProcessedIngredientCount(result)).toBe(3)
    expect(getScanAlertCount(result)).toBe(2)
  })

  it('fallback sur le legacy phase2 pour les anciens scans', () => {
    const legacy = {
      debug: {
        phase2: {
          ambiguous: [{ raw: 'sauce', normalized: 'sauce', reason: 'Incomplet' }],
          allergens: [{ raw: 'œuf', normalized: 'oeuf', reason: 'Famille: oeuf' }],
        },
      },
    }

    expect(getScanAmbiguousIngredients(legacy)).toHaveLength(1)
    expect(getScanAllergenIngredients(legacy)).toHaveLength(1)
    expect(getScanAlertCount(legacy)).toBe(2)
  })

  it('utilise meta.batch_progress pour le comptage progressif quand le tree final est absent', () => {
    const progressive = {
      ok_ingredients: [{ raw: 'riz', normalized: 'riz' }],
      meta: {
        batch_progress: {
          completed_batches: 1,
          total_batches: 4,
          completed_items: 8,
          total_items: 27,
        },
      },
    }

    expect(getScanProcessedIngredientCount(progressive)).toBe(8)
    expect(getScanIngredientCount(progressive)).toBe(27)
  })
})

describe('getScanStatusConfig', () => {
  it('retourne la config CONFORME pour ok', () => {
    const cfg = getScanStatusConfig('ok')
    expect(cfg.label).toBe('CONFORME')
    expect(cfg.description).toContain('Aucun ingrédient')
    expect(cfg.color).toContain('primary')
  })

  it('retourne la config ALLERGÈNE pour contains_allergen', () => {
    const cfg = getScanStatusConfig('contains_allergen')
    expect(cfg.label).toBe('ALLERGÈNE DÉTECTÉ')
    expect(cfg.color).toContain('red')
  })

  it('retourne la config DOUTEUX pour ambiguous', () => {
    const cfg = getScanStatusConfig('ambiguous')
    expect(cfg.label).toBe('DOUTEUX')
    expect(cfg.color).toContain('amber')
  })

  it('retourne la config INCONNU pour un statut inconnu ou default', () => {
    const cfg = getScanStatusConfig('unknown')
    expect(cfg.label).toBe('INCONNU')
    expect(cfg.description).toBe('')
    expect(cfg.color).toContain('gray')
  })

  it('retourne toujours label, description, color, bg, ring', () => {
    const statuses = ['ok', 'ambiguous', 'contains_allergen', 'other'] as const
    for (const s of statuses) {
      const cfg = getScanStatusConfig(s)
      expect(cfg).toHaveProperty('label')
      expect(cfg).toHaveProperty('description')
      expect(cfg).toHaveProperty('color')
      expect(cfg).toHaveProperty('bg')
      expect(cfg).toHaveProperty('ring')
    }
  })
})

describe('getStatusEmojiFilterClass', () => {
  it('laisse le statut ok sans filtre', () => {
    expect(getStatusEmojiFilterClass('ok')).toBe('')
  })

  it('teinte les statuts d alerte et d ambiguite', () => {
    expect(getStatusEmojiFilterClass('contains_allergen')).toBe('emoji-status-allergen')
    expect(getStatusEmojiFilterClass('ambiguous')).toBe('emoji-status-ambiguous')
  })
})
