import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('edge auth hardening', () => {
  it('n accepte plus de fallback auth implicite dans _shared/auth.ts', () => {
    const authHelper = readFileSync(resolve(rootDir, 'supabase/functions/_shared/auth.ts'), 'utf8')

    expect(authHelper).not.toContain('SUPABASE_AUTH_TOKEN')
    expect(authHelper).not.toContain('x-authorization')
    expect(authHelper).not.toContain('Invalid token structure')
    expect(authHelper).not.toContain('atob(')
    expect(authHelper).toContain('Deno.env.get("PUBLISHABLE_KEY")')
    expect(authHelper).toContain('Deno.env.get("SECRET_KEY")')
    expect(authHelper).toContain('const supabaseAnonKey')
    expect(authHelper).toContain('authClient.auth.getUser(token)')
    expect(authHelper).toContain('const serviceClient = createClient')
  })

  it('documente l exception locale: verify_jwt desactive au gateway mais auth applicative obligatoire', () => {
    const config = readFileSync(resolve(rootDir, 'supabase/config.toml'), 'utf8')

    expect(config).toContain('gateway Functions rejette actuellement les JWT utilisateur asymetriques')
    expect(config).toContain('[functions.food-scan-analyze]\nverify_jwt = false')
    expect(config).toContain('[functions.user-data-export]\nverify_jwt = false')
    expect(config).toContain('[functions.user-account-delete]\nverify_jwt = false')
    expect(config).toContain('[functions.entitlements]\nverify_jwt = false')
    expect(config).toContain('[functions.stripe-checkout]\nverify_jwt = false')
    expect(config).toContain('[functions.stripe-finalize-checkout]\nverify_jwt = false')
    expect(config).toContain('[functions.stripe-order-history]\nverify_jwt = false')
    expect(config).toContain('[functions.scan-delete]\nverify_jwt = false')
    expect(config).toContain('[functions.scan-ambiguous-assistant]\nverify_jwt = false')
    expect(config).toContain('[functions.scan-assistant-tts]\nverify_jwt = false')
    expect(config).toContain('[functions.admin-kpi]\nverify_jwt = false')
    expect(config).toContain('[functions.admin-users-list]\nverify_jwt = false')
    expect(config).toContain('[functions.admin-send-password-reset]\nverify_jwt = false')
    expect(config).toContain('[functions.admin-delete-user]\nverify_jwt = false')
    expect(config).toContain('[functions.admin-user-scans]\nverify_jwt = false')
  })
})
