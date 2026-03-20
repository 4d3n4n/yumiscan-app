import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('admin pricing cache sync', () => {
  it('resynchronise le cache public pricing après un save backoffice', () => {
    const settings = readFileSync(resolve(rootDir, 'pages/app/admin/settings.vue'), 'utf8')
    const composable = readFileSync(resolve(rootDir, 'composables/usePricingOffersPublic.ts'), 'utf8')

    expect(settings).toContain('usePricingOffersPublic({ immediate: false, ssr: false })')
    expect(settings).toContain('setPublicPricingOffers(next)')
    expect(composable).toContain('function setPricingOffers(nextOffers: PricingOffer[])')
  })
})
