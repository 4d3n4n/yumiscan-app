export type SupportedLocale = 'fr' | 'en'

export function detectPreferredLocale(
  browserLanguages: readonly string[] | undefined,
  fallbackLocale: SupportedLocale = 'fr',
): SupportedLocale {
  const languages = browserLanguages?.filter(Boolean) ?? []

  for (const language of languages) {
    const normalized = language.toLowerCase()
    if (normalized.startsWith('en')) return 'en'
    if (normalized.startsWith('fr')) return 'fr'
  }

  return fallbackLocale
}

export function hasExplicitLocalePrefix(path: string, localeCodes: readonly string[]): boolean {
  return localeCodes.some((code) => path === `/${code}` || path.startsWith(`/${code}/`))
}
