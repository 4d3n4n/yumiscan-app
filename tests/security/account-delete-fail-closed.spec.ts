import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('account deletion fail-closed', () => {
  it('interrompt la suppression si un nettoyage intermediaire echoue', () => {
    const helper = readFileSync(resolve(rootDir, 'supabase/functions/_shared/account-delete.ts'), 'utf8')

    expect(helper).toContain('if (scansError)')
    expect(helper).toContain('if (storageError)')
    expect(helper).toContain('if (scansDeleteError)')
    expect(helper).toContain('if (profileDeleteError)')
    expect(helper).toContain('if (authDeleteError)')
    expect(helper).toContain("throw new Error(\"Impossible de supprimer les images du compte.\")")
    expect(helper).toContain("throw new Error(\"Impossible de supprimer les scans du compte.\")")
    expect(helper).toContain("throw new Error(\"Impossible de supprimer le profil utilisateur.\")")
  })
})
