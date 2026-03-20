import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('scan recovery flow', () => {
  it('persiste un scan actif apres la creation du scan_id', () => {
    const overlay = readFileSync(resolve(rootDir, 'components/scan/ScanOverlay.vue'), 'utf8')
    const recovery = readFileSync(resolve(rootDir, 'composables/useActiveScanRecovery.ts'), 'utf8')

    expect(overlay).toContain('setActiveScanRecovery(result.scan_id)')
    expect(recovery).toContain("const ACTIVE_SCAN_RECOVERY_KEY = 'active_scan_recovery'")
    expect(recovery).toContain('ACTIVE_SCAN_RECOVERY_TTL_MS = 15 * 60 * 1000')
    expect(recovery).toContain('autoResumed')
    expect(recovery).toContain('controlledExit')
  })

  it('reprend automatiquement un scan en cours seulement depuis les pages app qui en ont besoin', () => {
    const home = readFileSync(resolve(rootDir, 'pages/home.vue'), 'utf8')
    const dashboard = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')
    const account = readFileSync(resolve(rootDir, 'pages/app/account.vue'), 'utf8')
    const recovery = readFileSync(resolve(rootDir, 'composables/useActiveScanRecovery.ts'), 'utf8')

    expect(home).not.toContain("maybeResumePendingScan('home')")
    expect(dashboard).toContain("maybeResumePendingScan('dashboard')")
    expect(account).not.toContain("maybeResumePendingScan('account')")
    expect(recovery).toContain(".select('id, processing_status')")
    expect(recovery).toContain("await router.replace(localePath(`/app/scan/${current.scanId}`))")
  })

  it('nettoie ou bloque la reprise auto quand la navigation depuis le scan est volontaire', () => {
    const scanPage = readFileSync(resolve(rootDir, 'pages/app/scan/[id].vue'), 'utf8')
    const navigation = readFileSync(resolve(rootDir, 'components/app/AppNavigation.vue'), 'utf8')

    expect(scanPage).toContain('touchActiveScanRecovery(currentScanId)')
    expect(scanPage).toContain('clearActiveScanRecovery(currentScanId)')
    expect(scanPage).toContain('markControlledScanExit(scanId.value)')
    expect(navigation).toContain('markControlledScanExit()')
  })
})
