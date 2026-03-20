import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('home pricing SSR stability', () => {
  it('uses a shared pricing loader with SSR prefetch and without hydration gate', () => {
    const component = readFileSync(resolve(rootDir, 'components/home/HomePricing.vue'), 'utf8')
    const composable = readFileSync(resolve(rootDir, 'composables/usePricingOffersPublic.ts'), 'utf8')

    expect(component).toContain('usePricingOffersPublic()')
    expect(composable).toContain('onServerPrefetch')
    expect(composable).toContain(".from('pricing_offers')")
    expect(component).not.toContain('const hydrationReady = ref(false)')
    expect(component).not.toContain('isPricingHydrationPending')
  })
})
