import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('maintenance mode', () => {
  it('uses a global middleware backed by app_config with admin bypass', () => {
    const middleware = readFileSync(resolve(rootDir, 'middleware/maintenance.global.ts'), 'utf8')

    expect(middleware).toContain("eq('key', 'maintenance_mode_enabled')")
    expect(middleware).toContain('const MAINTENANCE_CACHE_TTL_MS = 30_000')
    expect(middleware).toContain('const MAINTENANCE_QUERY_TIMEOUT_MS = 1_200')
    expect(middleware).toContain('.abortSignal(controller.signal)')
    expect(middleware).toContain("resolveAuthenticatedSession(supabase)")
    expect(middleware).toContain(".from('user_profiles')")
    expect(middleware).toContain("data?.is_admin === true")
    expect(middleware).toContain('let maintenanceRefreshInFlight: Promise<boolean> | null = null')
    expect(middleware).toContain('await refreshMaintenanceCache(false)')
    expect(middleware).toContain('if (!hasCachedValue) {')
    expect(middleware).toContain('await refreshMaintenanceCache(true)')
    expect(middleware).toContain("navigateTo(localeMaintenancePath(to.path))")
  })

  it('exposes a maintenance page and admin setting toggle', () => {
    const page = readFileSync(resolve(rootDir, 'pages/maintenance.vue'), 'utf8')
    const settings = readFileSync(resolve(rootDir, 'pages/app/admin/settings.vue'), 'utf8')

    expect(page).toContain("t('common.maintenance.title')")
    expect(page).toContain("localePath('/login')")
    expect(page).toContain('setInterval(() => {')
    expect(page).toContain('}, 3_000)')
    expect(settings).toContain('maintenance_mode_enabled')
    expect(settings).toContain('Activer la maintenance globale')
    expect(settings).toContain("useState<{ enabled: boolean; fetchedAt: number }>('maintenance-mode-cache'")
  })
})
