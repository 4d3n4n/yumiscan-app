import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPhase15Prompt, buildPhase2Prompt } from '../../supabase/functions/food-scan-analyze/ai/prompts'
import { sanitizePhase2Output } from '../../supabase/functions/food-scan-analyze/classification/phase2_sanitizer'
import { matchAllergenBlacklist } from '../../supabase/functions/food-scan-analyze/mapping/allergen'

describe('food-scan i18n', () => {
  it('demande une traduction anglaise dans le prompt Phase 1.5', () => {
    const prompt = buildPhase15Prompt(['小麦粉'], 'en')

    expect(prompt).toContain('Japanese → English translator')
    expect(prompt).toContain('its CONTENT MUST be in English')
    expect(prompt).toContain('"normalized_fr": "wheat flour (made domestically)"')
  })

  it('demande des reasons en anglais dans le prompt Phase 2', () => {
    const prompt = buildPhase2Prompt(
      [{ raw: '豚肉', normalized_fr: 'pork' }],
      ['Halal'],
      'en',
    )

    expect(prompt).toContain('Write every "normalized" and "reason" field in English')
    expect(prompt).toContain('reason: "Family: Halal"')
  })

  it('localise le préfixe de reason pour le mapping déterministe', () => {
    const result = matchAllergenBlacklist(
      [{ raw: '豆腐', normalized_fr: 'tofu' }],
      [{ allergenName: 'Soy', ingredients: ['soy', 'tofu', '豆腐'] }],
      { reasonPrefix: 'Family' },
    )

    expect(result.allergens_ingredients).toEqual([
      {
        raw: '豆腐',
        normalized: 'tofu',
        reason: 'Family: Soy',
      },
    ])
  })

  it('court-circuite Phase 2 en ok quand aucun critère n est sélectionné', () => {
    const phase2Source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/food-scan-analyze/ai/phase2.ts'),
      'utf8',
    )
    const pipelineSource = readFileSync(
      resolve(process.cwd(), 'supabase/functions/food-scan-analyze/index.ts'),
      'utf8',
    )

    expect(phase2Source).toContain('if (allergenKeywords.length === 0) {')
    expect(phase2Source).toContain('return buildFallbackOutput(unmapped);')
    expect(pipelineSource).toContain('if (unmapped.length > 0 && allergenNames.length > 0) {')
    expect(pipelineSource).toContain('} else if (unmapped.length > 0) {')
    expect(pipelineSource).toContain('phase2Result.ok_ingredients = unmapped.map((item) => ({')
  })

  it('rejette les rattachements allergènes incohérents du modèle et ne garde que les matches déterministes', () => {
    const sanitized = sanitizePhase2Output(
      [
        { raw: '一部に小麦', normalized_fr: 'une partie de blé' },
        { raw: '卵', normalized_fr: 'œuf' },
        { raw: 'ごま', normalized_fr: 'sésame' },
        { raw: '大豆を含む', normalized_fr: 'contient du soja' },
      ],
      {
        ok_ingredients: [],
        not_ok_ingredients: [],
        ambiguous_ingredients: [],
        allergens_ingredients: [
          { raw: '一部に小麦', normalized: 'une partie de blé', reason: 'Famille: Soja' },
          { raw: '卵', normalized: 'œuf', reason: 'Famille: Halal' },
          { raw: 'ごま', normalized: 'sésame', reason: 'Famille: Soja' },
          { raw: '大豆を含む', normalized: 'contient du soja', reason: 'Famille: Soja' },
        ],
      },
      [
        { allergenName: 'Soja', ingredients: ['soja', '大豆', '醤油', '味噌'] },
        { allergenName: 'Halal', ingredients: ['porc', '豚肉', 'alcool', '酒精'] },
      ],
      'fr',
    )

    expect(sanitized.allergens_ingredients).toEqual([
      {
        raw: '大豆を含む',
        normalized: 'contient du soja',
        reason: 'Famille: Soja',
      },
    ])
    expect(sanitized.ok_ingredients).toEqual([
      { raw: '一部に小麦', normalized: 'une partie de blé' },
      { raw: '卵', normalized: 'œuf' },
      { raw: 'ごま', normalized: 'sésame' },
    ])
  })

  it('corrige la reason si le modèle choisit le mauvais critère mais que le match déterministe en trouve un bon', () => {
    const sanitized = sanitizePhase2Output(
      [{ raw: '卵', normalized_fr: 'œuf' }],
      {
        ok_ingredients: [],
        not_ok_ingredients: [],
        ambiguous_ingredients: [],
        allergens_ingredients: [
          { raw: '卵', normalized: 'œuf', reason: 'Famille: Halal' },
        ],
      },
      [
        { allergenName: 'Œufs', ingredients: ['œuf', '卵', '玉子'] },
        { allergenName: 'Halal', ingredients: ['porc', '豚肉', 'alcool', '酒精'] },
      ],
      'fr',
    )

    expect(sanitized.allergens_ingredients).toEqual([
      {
        raw: '卵',
        normalized: 'œuf',
        reason: 'Famille: Œufs',
      },
    ])
  })
})
