import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('AdminSubNav', () => {
  it('prechauffe les routes soeurs du back-office au montage', () => {
    const source = readFileSync(resolve(rootDir, 'components/app/AdminSubNav.vue'), 'utf8')

    expect(source).toContain("localePath('/app/admin')")
    expect(source).toContain("localePath('/app/admin/users')")
    expect(source).toContain("localePath('/app/admin/settings')")
    expect(source).toContain('await preloadRouteComponents(path)')
  })
})
