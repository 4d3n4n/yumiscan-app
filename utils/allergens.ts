import type { AllergenCatalogRow } from '~/utils/types'

export function getLocalizedAllergenName(
  allergen: Pick<AllergenCatalogRow, 'name' | 'name_en'>,
  locale: string,
): string {
  if (locale === 'en' && allergen.name_en?.trim()) {
    return allergen.name_en.trim()
  }

  return allergen.name
}

export function sortAllergensByLocale<T extends Pick<AllergenCatalogRow, 'name' | 'name_en'>>(
  allergens: T[],
  locale: string,
): T[] {
  const language = locale === 'en' ? 'en' : 'fr'

  return [...allergens].sort((left, right) =>
    getLocalizedAllergenName(left, locale).localeCompare(
      getLocalizedAllergenName(right, locale),
      language,
      { sensitivity: 'base' },
    ),
  )
}
