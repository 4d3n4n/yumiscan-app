import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('dashboard delete UI sync', () => {
  it('retire le scan du cache user-scans immédiatement après suppression', () => {
    const file = readFileSync(resolve(rootDir, 'composables/useAppDataInvalidation.ts'), 'utf8')

    expect(file).toContain("case 'scan_deleted'")
    expect(file).toContain("queryClient.setQueryData<UserScansCacheRow[]>(['user-scans']")
    expect(file).toContain(".filter(scan => scan.id !== payload.scanId)")
  })
})
