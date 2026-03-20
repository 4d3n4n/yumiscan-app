import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('sentry test error auth hardening', () => {
  it('exige un controle admin backend sur la fonction de test', () => {
    const file = readFileSync(resolve(rootDir, 'supabase/functions/sentry-test-error/index.ts'), 'utf8')

    expect(file).toContain("import { requireAdmin } from '../_shared/admin.ts'")
    expect(file).toContain('await requireAdmin(req)')
    expect(file).not.toContain('sans auth')
  })

  it('appelle la fonction avec un vrai bearer utilisateur depuis la page admin', () => {
    const file = readFileSync(resolve(rootDir, 'pages/example-error.vue'), 'utf8')

    expect(file).toContain("import { getAuthenticatedHeaders } from '~/utils/supabase-auth'")
    expect(file).toContain('const supabase = useSupabase()')
    expect(file).toContain('const headers = await getAuthenticatedHeaders(supabase, config.public.supabaseKey)')
    expect(file).not.toContain('headers.Authorization = `Bearer ${key}`')
  })
})
