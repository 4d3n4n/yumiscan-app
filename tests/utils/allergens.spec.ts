import { describe, expect, it } from 'vitest'
import { getLocalizedAllergenName, sortAllergensByLocale } from '../../utils/allergens'

describe('allergens utils', () => {
  it('retourne le nom anglais quand il existe et que la locale est en', () => {
    expect(getLocalizedAllergenName({ name: 'Œufs', name_en: 'Eggs' }, 'en')).toBe('Eggs')
    expect(getLocalizedAllergenName({ name: 'Œufs', name_en: 'Eggs' }, 'fr')).toBe('Œufs')
  })

  it('retombe sur le nom FR si name_en est absent', () => {
    expect(getLocalizedAllergenName({ name: 'Soja', name_en: null }, 'en')).toBe('Soja')
  })

  it('trie le catalogue selon la langue affichée', () => {
    const allergens = [
      { id: '1', name: 'Œufs', name_en: 'Eggs' },
      { id: '2', name: 'Amandes', name_en: 'Almonds' },
      { id: '3', name: 'Soja', name_en: 'Soy' },
    ]

    expect(sortAllergensByLocale(allergens, 'fr').map((item) => item.name)).toEqual([
      'Amandes',
      'Œufs',
      'Soja',
    ])

    expect(sortAllergensByLocale(allergens, 'en').map((item) => item.name_en)).toEqual([
      'Almonds',
      'Eggs',
      'Soy',
    ])
  })
})
