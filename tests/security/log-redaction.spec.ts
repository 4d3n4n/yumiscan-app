import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('log redaction', () => {
  it('ne loggue pas de fragment de bearer token dans entitlements', () => {
    const file = readFileSync(resolve(rootDir, 'supabase/functions/entitlements/index.ts'), 'utf8')

    expect(file).not.toContain('authHeaderStart')
    expect(file).not.toContain('authHeaderLength')
    expect(file).not.toContain('substring(0, 30)')
  })
})
