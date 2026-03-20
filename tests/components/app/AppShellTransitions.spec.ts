import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('app shell page transitions', () => {
  it('branche explicitement la transition NuxtPage sur la meta de route', () => {
    const source = readFileSync(resolve(rootDir, 'app.vue'), 'utf8')

    expect(source).toContain('const pageTransition = computed(() => resolvePageTransition(route.meta.pageTransition))')
    expect(source).toContain('<NuxtPage :transition="pageTransition" />')
    expect(source).toContain("name: 'page-public'")
    expect(source).toContain("mode: 'default'")
  })

  it('réduit la transition quand on traverse public <-> app pour eviter le flash blanc', () => {
    const source = readFileSync(resolve(rootDir, 'plugins/page-transitions.client.ts'), 'utf8')

    expect(source).toContain('function shouldReduceTransition(fromPath: string, toPath: string)')
    expect(source).toContain('return isAppShellPath(fromPath) !== isAppShellPath(toPath)')
    expect(source).toContain("name: 'page-reduced'")
  })
})
