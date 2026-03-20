import { describe, expect, it } from 'vitest'
import { detectPreferredLocale, hasExplicitLocalePrefix } from '../../utils/locale-detection'

describe('locale detection utils', () => {
  it('préfère english quand le navigateur est en anglais', () => {
    expect(detectPreferredLocale(['en-GB', 'fr-FR'])).toBe('en')
  })

  it('retombe sur français par défaut', () => {
    expect(detectPreferredLocale(['de-DE'])).toBe('fr')
    expect(detectPreferredLocale(undefined)).toBe('fr')
  })

  it('détecte les routes avec préfixe de locale explicite', () => {
    expect(hasExplicitLocalePrefix('/en/app/account', ['en'])).toBe(true)
    expect(hasExplicitLocalePrefix('/blog', ['en'])).toBe(false)
  })
})
