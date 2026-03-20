import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('router options', () => {
  it('gere les ancres de facon generique sans logique speciale pricing', () => {
    const source = readFileSync(resolve(rootDir, 'app/router.options.ts'), 'utf8')

    expect(source).toContain('scrollBehavior(')
    expect(source).toContain('const samePageHashNavigation = normalizePath(to.path) === normalizePath(from.path)')
    expect(source).toContain("behavior: samePageHashNavigation ? 'smooth' as const : 'auto' as const")
    expect(source).not.toContain('document.querySelector(hash)')
    expect(source).not.toContain("if (to.hash === '#pricing') {")
    expect(source).toContain('return { left: 0, top: 0 }')
  })
})
