import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('auth callback service worker cleanup', () => {
  it('préserve le SW courant et ne désenregistre que les registrations legacy sur auth/confirm', () => {
    const plugin = readFileSync(resolve(rootDir, 'plugins/00-legacy-sw-cleanup.client.ts'), 'utf8')

    expect(plugin).toContain("const LEGACY_SW_CLEANUP_MARKER = 'legacy-sw-cleanup:v2'")
    expect(plugin).toContain("const CURRENT_SW_PATH = '/sw.js'")
    expect(plugin).toContain("pathname === '/auth/confirm' || pathname === '/en/auth/confirm'")
    expect(plugin).toContain('navigator.serviceWorker.getRegistrations()')
    expect(plugin).toContain('if (scriptUrl === currentSwUrl)')
    expect(plugin).toContain('await currentRegistration.update()')
    expect(plugin).toContain('registration.unregister()')
    expect(plugin).toContain('caches.keys()')
    expect(plugin).toContain('window.location.replace(url.toString())')
  })
})
