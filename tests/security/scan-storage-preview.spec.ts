import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('scan storage preview pipeline', () => {
  it('génère une preview WebP côté front et la transmet au backend', () => {
    const overlay = readFileSync(resolve(rootDir, 'components/scan/ScanOverlay.vue'), 'utf8')
    const edgeFunctions = readFileSync(resolve(rootDir, 'composables/useEdgeFunctions.ts'), 'utf8')

    expect(overlay).toContain('compressImageForStorage')
    expect(overlay).toContain('imageStoragePreviewBase64')
    expect(edgeFunctions).toContain('imageStoragePreviewBase64?: string')
  })

  it('stocke la preview scan avec une extension cohérente avec le mime réel', () => {
    const schema = readFileSync(resolve(rootDir, 'supabase/functions/food-scan-analyze/validation/schemas.ts'), 'utf8')
    const functionSource = readFileSync(resolve(rootDir, 'supabase/functions/food-scan-analyze/index.ts'), 'utf8')

    expect(schema).toContain('imageStoragePreviewBase64')
    expect(functionSource).toContain('imageStoragePreview ?? imageForPhase05Original')
    expect(functionSource).toContain('mimeStoragePreview ?? mimeForPhase05Original')
    expect(functionSource).toContain('storageExtensionFromMimeType')
  })
})
