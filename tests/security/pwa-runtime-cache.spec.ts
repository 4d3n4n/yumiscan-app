import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('pwa runtime cache hardening', () => {
  it('configure un runtime caching sélectif et garde les parcours sensibles hors cache durable', () => {
    const config = readFileSync(resolve(rootDir, 'nuxt.config.ts'), 'utf8')

    expect(config).toContain('runtimeCaching')
    expect(config).toContain("cacheName: 'assets-chunks'")
    expect(config).toContain('navigateFallback: null')
    expect(config).toContain("handler: 'StaleWhileRevalidate'")
    expect(config).not.toContain("cacheName: 'public-documents'")
  })

  it('rafraichit la registration service worker une fois apres le montage sans bloquer les retours d onglet', () => {
    const plugin = readFileSync(resolve(rootDir, 'plugins/01-pwa-sw-refresh.client.ts'), 'utf8')

    expect(plugin).toContain('runWhenBrowserIsIdle')
    expect(plugin).toContain('navigator.serviceWorker.getRegistration()')
    expect(plugin).toContain('registration?.update()')
    expect(plugin).not.toContain("document.addEventListener('visibilitychange'")
    expect(plugin).not.toContain("window.addEventListener('pageshow'")
  })

  it('désactive les anciens service workers en dev local pour garder une navigation stable pendant les tests', () => {
    const plugin = readFileSync(resolve(rootDir, 'plugins/00-dev-sw-reset.client.ts'), 'utf8')

    expect(plugin).toContain('if (import.meta.server || !import.meta.dev) return')
    expect(plugin).toContain('navigator.serviceWorker.getRegistrations()')
    expect(plugin).toContain('registration.unregister()')
    expect(plugin).toContain("sessionStorage.setItem(DEV_SW_RESET_MARKER, 'done')")
  })
})
