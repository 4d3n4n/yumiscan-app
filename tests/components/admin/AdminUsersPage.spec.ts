import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('admin users page delete modal flow', () => {
  it('ferme explicitement le modal après une suppression réussie', () => {
    const page = readFileSync(resolve(rootDir, 'pages/app/admin/users/index.vue'), 'utf8')

    expect(page).toContain('function closeDeleteConfirmAfterSuccess()')
    expect(page).toContain('deleteTarget.value = null')
    expect(page).toContain('closeDeleteConfirmAfterSuccess()')
  })
})
