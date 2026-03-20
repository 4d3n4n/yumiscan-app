import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('account deletion storage cleanup', () => {
  it('supprime les images de scans referencees avant de supprimer le compte', () => {
    const helper = readFileSync(resolve(rootDir, 'supabase/functions/_shared/account-delete.ts'), 'utf8')
    const selfServiceFn = readFileSync(resolve(rootDir, 'supabase/functions/user-account-delete/index.ts'), 'utf8')
    const adminFn = readFileSync(resolve(rootDir, 'supabase/functions/admin-delete-user/index.ts'), 'utf8')

    expect(helper).toContain('.select("image_storage_path")')
    expect(helper).toContain('.from("scan-images").remove(paths)')
    expect(helper).toContain('removeStorageFilesUnderPrefix')
    expect(helper).toContain('"assistant-audio", userId')
    expect(helper).toContain('.from("scans")')
    expect(helper).toContain('.delete()')
    expect(helper).toContain('deleteAccountDataOrThrow')
    expect(selfServiceFn).toContain('deleteAccountDataOrThrow')
    expect(adminFn).toContain('deleteAccountDataOrThrow')
  })
})
