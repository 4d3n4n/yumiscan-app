import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('query cache auth boundary', () => {
  it('purge les queries utilisateur persistées quand la session change ou est absente', () => {
    const plugin = readFileSync(resolve(rootDir, 'plugins/zz-query-auth-boundary.client.ts'), 'utf8')

    expect(plugin).toContain("['credits']")
    expect(plugin).toContain("['user-profile']")
    expect(plugin).toContain("['user-scans']")
    expect(plugin).toContain('getSessionSnapshot')
    expect(plugin).toContain('if (!currentUserId) {')
    expect(plugin).toContain('clearUserScopedQueries()')
    expect(plugin).toContain('if (currentUserId !== nextUserId)')
  })

  it('branche une persistance sélective avec sanitation avant écriture', () => {
    const plugin = readFileSync(resolve(rootDir, 'plugins/vue-query.ts'), 'utf8')

    expect(plugin).toContain('sanitizePersistedQueryData')
    expect(plugin).toContain('restorePersistedQueries')
    expect(plugin).toContain('buildPersistedSnapshot')
    expect(plugin).toContain('writePersistedSnapshot')
    expect(plugin).toContain('revalidateRestoredQueries')
    expect(plugin).toContain('ownerUserId')
    expect(plugin).toContain("const PERSISTED_QUERY_SNAPSHOT_VERSION = 3")
    expect(plugin).toContain("if (policy.scope === 'user' && query.ownerUserId !== currentUserId)")
  })
})
