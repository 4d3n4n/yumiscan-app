/**
 * Tests i18n : configuration des routes localisées (SEO FR/EN).
 * Vérifie que les pages custom ont bien un chemin FR et EN et que langDir évite le doublon i18n/i18n.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('i18n — routes localisées', () => {
  const configPath = join(process.cwd(), 'nuxt.config.ts')
  const configRaw = readFileSync(configPath, 'utf-8')

  it('langDir est "locales" (résolution vers i18n/locales, pas i18n/i18n/locales)', () => {
    const langDirMatch = configRaw.match(/langDir:\s*['"]([^'"]+)['"]/)
    expect(langDirMatch, 'langDir doit être défini dans nuxt.config').toBeTruthy()
    expect(langDirMatch![1]).toBe('locales')
  })

  it('customRoutes pages ont un chemin FR et EN pour chaque page', () => {
    expect(configRaw).toContain('pages:')
    expect(configRaw).toContain('customRoutes')
    const expectedPages = [
      { name: 'confidentialite', en: '/privacy', fr: '/confidentialite' },
      { name: 'mentions-legales', en: '/legal', fr: '/mentions-legales' },
      { name: 'avertissement-sante', en: '/health-warning', fr: '/avertissement-sante' },
      { name: 'a-propos', en: '/about-us', fr: '/a-propos' },
      { name: 'cgv', en: '/terms-of-sale', fr: '/cgv' },
    ]
    for (const page of expectedPages) {
      expect(configRaw).toContain(`'${page.name}'`)
      expect(configRaw).toContain(page.en)
      expect(configRaw).toContain(page.fr)
    }
  })

  it('stratégie est prefix_except_default (FR sans préfixe, EN avec /en/)', () => {
    expect(configRaw).toContain("strategy: 'prefix_except_default'")
    expect(configRaw).toContain("defaultLocale: 'fr'")
  })

  it('charge aussi les fichiers pricing et ne redirige plus /pricing vers la home hashée', () => {
    expect(configRaw).toContain("'fr/pricing.json'")
    expect(configRaw).toContain("'en/pricing.json'")
    expect(configRaw).not.toContain("'/pricing': { redirect: '/#pricing' }")
  })
})
