import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('signup security flow', () => {
  it('la page signup utilise Supabase Auth directement, sans endpoint public service_role', () => {
    const signupPage = readFileSync(resolve(rootDir, 'pages/signup.vue'), 'utf8')

    expect(signupPage).toContain("definePageMeta({ middleware: ['guest'] })")
    expect(signupPage).toContain('supabase.auth.signUp(')
    expect(signupPage).not.toContain('/functions/v1/auth-signup')
    expect(signupPage).toContain('buildSignupMetadata({')
    expect(signupPage).toContain("new URL(localePath('/login'), appUrl).toString()")
    expect(signupPage).toContain('requiresEmailConfirmation.value = !signUpData.session')
  })

  it('l ancien endpoint public ne cree plus de compte via auth.admin.createUser', () => {
    const deprecatedEndpoint = readFileSync(resolve(rootDir, 'supabase/functions/auth-signup/index.ts'), 'utf8')

    expect(deprecatedEndpoint).not.toContain('auth.admin.createUser')
    expect(deprecatedEndpoint).toContain('Deprecated endpoint')
  })

  it('le schema cree un profil depuis auth.users via un trigger dedie', () => {
    const schema = readFileSync(resolve(rootDir, 'supabase/migrations/20250226000000_schema.sql'), 'utf8')

    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.create_profile_from_auth_user()')
    expect(schema).toContain('CREATE TRIGGER trigger_create_profile_from_auth_user')
  })
})
