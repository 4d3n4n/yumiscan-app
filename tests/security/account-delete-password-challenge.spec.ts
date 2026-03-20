import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('account delete password challenge', () => {
  it('demande un mot de passe courant cote front avant suppression', () => {
    const component = readFileSync(resolve(rootDir, 'components/account/AccountDangerSection.vue'), 'utf8')

    expect(component).toContain('deletePassword')
    expect(component).toContain("current_password: deletePassword.value")
    expect(component).toContain('autocomplete="current-password"')
    expect(component).not.toContain('deleteConfirmText')
    expect(component).toContain(":filter-class=\"feedbackMessage.type === 'error' ? 'emoji-error' : ''\"")
    expect(component).toContain('filter-class="emoji-error"')
  })

  it('reverifie le mot de passe cote edge function avant suppression', () => {
    const fn = readFileSync(resolve(rootDir, 'supabase/functions/user-account-delete/index.ts'), 'utf8')
    const sharedAuth = readFileSync(resolve(rootDir, 'supabase/functions/_shared/auth.ts'), 'utf8')

    expect(fn).toContain('current_password')
    expect(fn).toContain('verifyUserPassword')
    expect(fn).toContain('Le mot de passe actuel est incorrect.')
    expect(sharedAuth).toContain('export async function verifyUserPassword(')
    expect(sharedAuth).toContain('/auth/v1/token?grant_type=password')
  })
})
