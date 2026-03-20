import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('hash anchor recovery', () => {
  it('redirige les anciens liens #pricing vers /pricing et garde le retry generique pour les autres ancres', () => {
    const source = readFileSync(resolve(rootDir, 'plugins/02-hash-anchor-recovery.client.ts'), 'utf8')
    const helper = readFileSync(resolve(rootDir, 'utils/hash-scroll.ts'), 'utf8')

    expect(source).toContain("nuxtApp.hook('page:finish'")
    expect(source).toContain('const currentRoute = router.currentRoute.value')
    expect(source).toContain("if (hash === '#pricing' && normalizePath(currentRoute.path) === '/')")
    expect(source).toContain("void router.replace(localePath('/pricing'))")
    expect(source).toContain('requestAnimationFrame')
    expect(source).toContain("import { scrollToHashTarget } from '~/utils/hash-scroll'")
    expect(source).toContain('void scrollToHashTarget(hash)')
    expect(helper).toContain("function getHashScrollBehavior()")
    expect(helper).toContain('window.scrollTo({ top: nextTop, behavior })')
    expect(helper).toContain('target.dataset.scrollOffset')
    expect(helper).not.toContain("hash === '#pricing'")
  })
})
