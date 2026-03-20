import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('pricing page', () => {
  it('utilise la route dediee avec une source pricing canonique et une FAQ achat', () => {
    const page = readFileSync(resolve(rootDir, 'pages/pricing.vue'), 'utf8')
    const fr = readFileSync(resolve(rootDir, 'i18n/locales/fr/pricing.json'), 'utf8')
    const en = readFileSync(resolve(rootDir, 'i18n/locales/en/pricing.json'), 'utf8')

    expect(page).toContain("definePageMeta({ path: '/pricing' })")
    expect(page).toContain('<HomePricing :show-payment-summary="false" />')
    expect(page).toContain('<PaymentMethodsMarquee />')
    expect(page).toContain('<HomeFaq />')
    expect(page).toContain("t('pricing_page.payments.title')")
    expect(fr).toContain('"pricing_page"')
    expect(fr).toContain('"cards"')
    expect(en).toContain('"pricing_page"')
    expect(en).toContain('"cards"')
  })
})
