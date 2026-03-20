import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('supabase client scope', () => {
  it('uses a singleton only in the browser and recreates a client on the server', () => {
    const source = readFileSync(resolve(rootDir, 'composables/useSupabase.ts'), 'utf8')

    expect(source).toContain('if (import.meta.client && supabaseInstance)')
    expect(source).toContain('if (import.meta.client) {')
    expect(source).toContain('supabaseInstance = client')
    expect(source).toContain('persistSession: import.meta.client')
    expect(source).toContain('autoRefreshToken: import.meta.client')
    expect(source).toContain('detectSessionInUrl: import.meta.client')
  })
})
