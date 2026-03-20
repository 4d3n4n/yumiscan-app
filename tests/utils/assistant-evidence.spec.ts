import { describe, expect, it } from 'vitest'

import {
  buildAssistantEvidenceMatrix,
  type AssistantSelectedCriterion,
  type ScanIngredientWithReason,
} from '../../supabase/functions/_shared/assistant-evidence'

function buildCriteria(criteria: Array<{
  label: string
  kind: 'allergen' | 'profile'
  aliases?: string[]
}>): AssistantSelectedCriterion[] {
  return criteria.map((criterion) => ({
    ...criterion,
    aliases: criterion.aliases ?? [criterion.label],
  }))
}

function ingredient(raw: string, normalized: string, reason: string): ScanIngredientWithReason {
  return { raw, normalized, reason }
}

describe('assistant-evidence', () => {
  it('rattache un direct blocker au bon allergène sans le mélanger avec un profil alimentaire', () => {
    const matrix = buildAssistantEvidenceMatrix({
      selectedCriteria: buildCriteria([
        { label: 'Soja', kind: 'allergen', aliases: ['Soja', 'Soy'] },
        { label: 'Halal', kind: 'profile', aliases: ['Halal'] },
      ]),
      allergenIngredients: [
        ingredient('豆腐', 'soja', 'Family: Soy'),
      ],
      ambiguousIngredients: [],
    })

    expect(matrix.direct_blockers).toHaveLength(1)
    expect(matrix.direct_blockers[0]).toMatchObject({
      ingredient_label: 'soja',
      classification: 'direct_blocker',
      criterion_labels: ['Soja'],
      criterion_kind: 'allergen',
      scope: 'one',
    })
  })

  it('rattache un direct blocker au bon profil alimentaire', () => {
    const matrix = buildAssistantEvidenceMatrix({
      selectedCriteria: buildCriteria([
        { label: 'Halal', kind: 'profile', aliases: ['Halal'] },
      ]),
      allergenIngredients: [
        ingredient('豚肉', 'porc', 'Famille: Halal'),
      ],
      ambiguousIngredients: [],
    })

    expect(matrix.direct_blockers[0]).toMatchObject({
      ingredient_label: 'porc',
      criterion_labels: ['Halal'],
      criterion_kind: 'profile',
      scope: 'one',
    })
  })

  it('traite une ambiguïté sans attribution claire comme globale sur toute la sélection', () => {
    const matrix = buildAssistantEvidenceMatrix({
      selectedCriteria: buildCriteria([
        { label: 'Soja', kind: 'allergen', aliases: ['Soja', 'Soy'] },
        { label: 'Halal', kind: 'profile', aliases: ['Halal'] },
      ]),
      allergenIngredients: [],
      ambiguousIngredients: [
        ingredient('ソース', 'sauce', 'Composition insuffisamment détaillée'),
      ],
    })

    expect(matrix.ambiguous_scoped).toHaveLength(0)
    expect(matrix.ambiguous_global).toHaveLength(1)
    expect(matrix.ambiguous_global[0]).toMatchObject({
      ingredient_label: 'sauce',
      classification: 'ambiguous_global',
      criterion_labels: ['Soja', 'Halal'],
      scope: 'all_selected',
    })
  })

  it('conserve un blocker certain puis une ambiguïté secondaire sans perdre la portée', () => {
    const matrix = buildAssistantEvidenceMatrix({
      selectedCriteria: buildCriteria([
        { label: 'Soja', kind: 'allergen', aliases: ['Soja', 'Soy'] },
        { label: 'Halal', kind: 'profile', aliases: ['Halal'] },
      ]),
      allergenIngredients: [
        ingredient('豆腐', 'soja', 'Family: Soy'),
      ],
      ambiguousIngredients: [
        ingredient('ソース', 'sauce', 'Composition insuffisamment détaillée'),
      ],
    })

    expect(matrix.direct_blockers[0].criterion_labels).toEqual(['Soja'])
    expect(matrix.ambiguous_global[0].criterion_labels).toEqual(['Soja', 'Halal'])
  })

  it('reconnaît une ambiguïté scoped sur plusieurs allergènes sans l’étendre à Halal', () => {
    const matrix = buildAssistantEvidenceMatrix({
      selectedCriteria: buildCriteria([
        { label: 'Lait', kind: 'allergen', aliases: ['Lait', 'Milk'] },
        { label: 'Oeuf', kind: 'allergen', aliases: ['Oeuf', 'Œuf', 'Egg', 'Eggs'] },
        { label: 'Halal', kind: 'profile', aliases: ['Halal'] },
      ]),
      allergenIngredients: [],
      ambiguousIngredients: [
        ingredient('クリームソース', 'sauce crémeuse', 'May concern Milk or Eggs'),
      ],
    })

    expect(matrix.ambiguous_scoped).toHaveLength(1)
    expect(matrix.ambiguous_scoped[0]).toMatchObject({
      ingredient_label: 'sauce crémeuse',
      classification: 'ambiguous_scoped',
      criterion_labels: ['Lait', 'Oeuf'],
      criterion_kind: 'allergen',
      scope: 'many',
    })
    expect(matrix.ambiguous_scoped[0].criterion_labels).not.toContain('Halal')
  })
})
