import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('credits sync resilience', () => {
  it('n infere pas a tort une absence de credits si le refresh client echoue', () => {
    const composable = readFileSync(resolve(rootDir, 'composables/useCredits.ts'), 'utf8')

    expect(composable).toContain('const creditsSyncError = ref<string | null>(null)')
    expect(composable).toContain('if (creditsSyncError.value) return true')
    expect(composable).toContain('if (creditsSyncError.value) return false')
    expect(composable).toContain('const creditsReliable = computed(() => !creditsLoading.value && !creditsSyncError.value && !!creditsData.value)')
  })

  it('bloque le mode no-credits seulement quand le snapshot credits est fiable', () => {
    const scanOverlay = readFileSync(resolve(rootDir, 'components/scan/ScanOverlay.vue'), 'utf8')

    expect(scanOverlay).toContain('const { hasCredits, creditsUserId, creditsReliable } = useCredits()')
    expect(scanOverlay).toContain('const noCredits = computed(() => !!creditsUserId.value && creditsReliable.value && !hasCredits.value)')
    expect(scanOverlay).toContain('if (creditsReliable.value && !hasCredits.value)')
  })
})
