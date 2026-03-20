import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('purchase ledger retention after account deletion', () => {
  it('preserve user_purchases via dedicated migration instead of cascade deletion', () => {
    const migration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260312173000_preserve_user_purchases_after_account_delete.sql'),
      'utf8',
    )

    expect(migration).toContain('DROP CONSTRAINT IF EXISTS user_purchases_user_id_fkey')
    expect(migration).toContain('Historical auth.users identifier')
  })

  it('n efface plus user_purchases dans la suppression admin', () => {
    const adminDelete = readFileSync(resolve(rootDir, 'supabase/functions/admin-delete-user/index.ts'), 'utf8')

    expect(adminDelete).not.toContain('.from("user_purchases").delete()')
  })
})
