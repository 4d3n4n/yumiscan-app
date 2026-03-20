import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('security ownership controls', () => {
  it('formalise un ownership minimal des zones sensibles via CODEOWNERS', () => {
    const codeowners = readFileSync(resolve(rootDir, 'CODEOWNERS'), 'utf8')

    expect(codeowners).toContain('* @4d3n4n')
    expect(codeowners).toContain('/supabase/functions/ @4d3n4n')
    expect(codeowners).toContain('/supabase/migrations/ @4d3n4n')
    expect(codeowners).toContain('/utils/security-headers.ts @4d3n4n')
    expect(codeowners).toContain('/composables/useAuth.ts @4d3n4n')
  })
})
