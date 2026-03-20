import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('foreground resume ux', () => {
  it('dedoublonne les refreshs foreground et garde les vues protegees visibles quand un cache existe deja', () => {
    const gate = readFileSync(resolve(rootDir, 'composables/useForegroundRefreshGate.ts'), 'utf8')
    const dashboard = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')
    const account = readFileSync(resolve(rootDir, 'pages/app/account.vue'), 'utf8')
    const homePricing = readFileSync(resolve(rootDir, 'components/home/HomePricing.vue'), 'utf8')
    const scanDetail = readFileSync(resolve(rootDir, 'pages/app/scan/[id].vue'), 'utf8')

    expect(gate).toContain('export function useForegroundRefreshGate')
    expect(gate).toContain('if ((now - lastRunAt.value) < cooldownMs)')

    expect(dashboard).toContain('const showDashboardInitialLoading = computed(() =>')
    expect(dashboard).toContain('const showDashboardLoggedOutState = computed(() =>')
    expect(dashboard).toContain("window.addEventListener('pageshow', handleVisibilityRefresh, { passive: true })")
    expect(dashboard).toContain("if (!shouldRunDashboardForegroundRefresh()) return")
    expect(dashboard).not.toContain("void refreshDashboardScans({ allowRetry: true })\n  }\n\n  if (import.meta.client) {")

    expect(account).toContain('const showAccountInitialLoading = computed(() =>')
    expect(account).toContain('const showAccountLoggedOutState = computed(() =>')
    expect(account).toContain('if (shouldRunAccountForegroundRefresh()) {')
    expect(account).toContain('if (!shouldRunAccountForegroundRefresh()) return')

    expect(scanDetail).toContain('const showInitialScanLoading = computed(() => isLoading.value && !scan.value)')
    expect(scanDetail).toContain('v-if="showInitialScanLoading"')

    expect(homePricing).toContain('useForegroundRefreshGate(PRICING_FOREGROUND_REFRESH_COOLDOWN_MS)')
    expect(homePricing).not.toContain('if (pricingOffers.value.length > 0) {')
  })
})
