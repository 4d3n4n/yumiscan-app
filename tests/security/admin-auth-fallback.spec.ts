import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('admin local auth fallback', () => {
  it('n utilise plus auth.admin.listUsers pour la liste admin', () => {
    const file = readFileSync(resolve(rootDir, 'supabase/functions/admin-users-list/index.ts'), 'utf8')
    expect(file).not.toContain('auth.admin.listUsers')
    expect(file).toContain('rpc("admin_list_users"')
    expect(file).toContain('rpc("admin_count_users"')
  })

  it('utilise un fallback local pour la réinitialisation de mot de passe admin', () => {
    const file = readFileSync(resolve(rootDir, 'supabase/functions/admin-send-password-reset/index.ts'), 'utf8')
    expect(file).toContain('/auth/v1/recover')
    expect(file).toContain('admin_get_user_email')
    expect(file).not.toContain('auth.admin.generateLink')
    expect(file).toContain("Email de réinitialisation envoyé à l'utilisateur.")
  })

  it('supprime le compte auth via RPC DB au lieu de auth.admin.deleteUser', () => {
    const file = readFileSync(resolve(rootDir, 'supabase/functions/admin-delete-user/index.ts'), 'utf8')
    const helper = readFileSync(resolve(rootDir, 'supabase/functions/_shared/account-delete.ts'), 'utf8')
    expect(file).not.toContain('auth.admin.deleteUser')
    expect(helper).toContain('admin_delete_auth_user')
  })

  it('consolide aussi les RPC admin dans le schema SQL principal', () => {
    const schema = readFileSync(resolve(rootDir, 'supabase/migrations/20250226000000_schema.sql'), 'utf8')
    const refreshMigration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260308110000_admin_rpc_schema_cache_refresh.sql'),
      'utf8',
    )

    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.admin_list_users(')
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.admin_count_users(')
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.admin_get_user_email(')
    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.admin_delete_auth_user(')
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.admin_delete_auth_user(uuid) TO service_role;')
    expect(refreshMigration).toContain('CREATE OR REPLACE FUNCTION public.admin_list_users(')
    expect(refreshMigration).toContain('CREATE OR REPLACE FUNCTION public.admin_count_users(')
    expect(refreshMigration).toContain("NOTIFY pgrst, 'reload schema';")
  })
})
