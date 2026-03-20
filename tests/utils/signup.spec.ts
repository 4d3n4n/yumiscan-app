import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSignupMetadata } from '~/utils/signup'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('buildSignupMetadata', () => {
  it('normalise les champs et limite les preferences a 5 valeurs uniques', () => {
    const metadata = buildSignupMetadata({
      firstName: '  Aden  ',
      lastName: '  Khachnane  ',
      preferences: [' gluten ', 'soja', 'soja', '', 'oeufs', 'lait', 'sesame', 'poisson'],
      acceptedCguAt: '2026-03-07T12:00:00.000Z',
      acceptedHealthDisclaimer: true,
    })

    expect(metadata).toEqual({
      first_name: 'Aden',
      last_name: 'Khachnane',
      preferences: ['gluten', 'soja', 'oeufs', 'lait', 'sesame'],
      accepted_cgu_version: 'v1.0',
      accepted_cgu_at: '2026-03-07T12:00:00.000Z',
      accepted_health_disclaimer: true,
    })
  })

  it('conserve des noms vides si la validation amont echoue, sans fallback implicite', () => {
    const metadata = buildSignupMetadata({
      firstName: '   ',
      lastName: '',
      preferences: [],
      acceptedCguAt: '2026-03-07T12:00:00.000Z',
      acceptedHealthDisclaimer: true,
    })

    expect(metadata.first_name).toBe('')
    expect(metadata.last_name).toBe('')
    expect(metadata.preferences).toEqual([])
  })

  it('initialise useI18n avant useHead sur la page signup', () => {
    const signupPage = readFileSync(resolve(rootDir, 'pages/signup.vue'), 'utf8')

    expect(signupPage.indexOf("const { t, locale } = useI18n()")).toBeLessThan(
      signupPage.indexOf('useHead({'),
    )
  })
})
