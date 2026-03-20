import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('scan image signing guards', () => {
  it('évite de retenter indéfiniment les paths storage manquants dans le dashboard', () => {
    const page = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')

    expect(page).toContain('const failedSignedPaths = ref(new Set<string>())')
    expect(page).toContain("!failedSignedPaths.value.has(r.image_storage_path)")
    expect(page).toContain('nextFailures.add(path)')
  })

  it('évite de retenter indéfiniment les paths storage manquants dans le détail scan', () => {
    const page = readFileSync(resolve(rootDir, 'pages/app/scan/[id].vue'), 'utf8')

    expect(page).toContain('const failedSignedPaths = ref(new Set<string>())')
    expect(page).toContain('failedSignedPaths.value.has(imagePath)')
    expect(page).toContain('nextFailures.add(imagePath)')
  })
})
