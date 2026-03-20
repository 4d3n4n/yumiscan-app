import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('daily credit refresh', () => {
  it('resynchronise les credits quand un scan se finalise dans le dashboard', () => {
    const dashboard = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')
    const invalidation = readFileSync(resolve(rootDir, 'composables/useAppDataInvalidation.ts'), 'utf8')
    const overlay = readFileSync(resolve(rootDir, 'components/scan/ScanOverlay.vue'), 'utf8')

    expect(dashboard).toContain('const { hasDailyCredit, refreshCredits } = useCredits()')
    expect(dashboard).toContain("const { invalidateAppData } = useAppDataInvalidation()")
    expect(dashboard).toContain('previous.processing_status === \'processing\'')
    expect(dashboard).toContain("scan.credit_consumed_type === 'daily'")
    expect(dashboard).toContain("void invalidateAppData('scan_finished'")
    expect(dashboard).toContain("void invalidateAppData('scan_failed'")
    expect(dashboard).toContain('void refreshCredits()')
    expect(invalidation).toContain("case 'scan_started':")
    expect(invalidation).toContain('insertOptimisticScan(payload.scanId)')
    expect(invalidation).toContain("refetchType: 'none'")
    expect(invalidation).toContain("['user-profile']")
    expect(invalidation).toContain("case 'scan_finished':")
    expect(invalidation).toContain('await refreshCredits()')
    expect(overlay).toContain("await invalidateAppData('scan_started', { scanId: result.scan_id })")
  })

  it('resynchronise aussi les credits depuis le detail scan a la vraie finalisation', () => {
    const scanPage = readFileSync(resolve(rootDir, 'pages/app/scan/[id].vue'), 'utf8')

    expect(scanPage).toContain("const { invalidateAppData } = useAppDataInvalidation()")
    expect(scanPage).toContain("await invalidateAppData(status === 'failed' ? 'scan_failed' : 'scan_finished'")
  })

  it('aligne le calcul du jour du daily credit et la clé du banner dashboard sur le jour serveur', () => {
    const credits = readFileSync(resolve(rootDir, 'composables/useCredits.ts'), 'utf8')
    const dashboard = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')

    expect(credits).toContain("import { getServerDayKey } from '~/utils/server-day'")
    expect(credits).toContain('const today = getServerDayKey()')
    expect(dashboard).toContain("import { getServerDayKey } from '~/utils/server-day'")
    expect(dashboard).toContain("daily-credit-banner-dismissed-until:${userId ?? 'guest'}:${getServerDayKey()}`")
  })
})
