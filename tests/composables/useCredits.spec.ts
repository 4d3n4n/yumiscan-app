import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('useCredits', () => {
  it('derive toujours les credits achetes depuis user_purchases et ne depend plus d un watcher one-shot', () => {
    const source = readFileSync(resolve(rootDir, 'composables/useCredits.ts'), 'utf8')

    expect(source).toContain(".from('user_purchases')")
    expect(source).toContain('const CREDITS_CACHE_TTL_MS = 30_000')
    expect(source).toContain('let creditsLastFetchedUserId: string | null = null')
    expect(source).toContain('watch(')
    expect(source).not.toContain('creditsWatcherBound')
  })
})
