import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('native page view transitions', () => {
  it('active la View Transitions API avec un fallback de fin de page', () => {
    const source = readFileSync(resolve(rootDir, 'plugins/03-view-transitions.client.ts'), 'utf8')

    expect(source).toContain('document.startViewTransition')
    expect(source).toContain('shouldDisableViewTransitions')
    expect(source).toContain("window.matchMedia('(display-mode: standalone)')")
    expect(source).toContain("nuxtApp.hook('page:finish', resetPendingFinish)")
    expect(source).toContain("html.classList.add(VIEW_TRANSITION_CLASS)")
    expect(source).toContain('PAGE_FINISH_TIMEOUT_MS = 1400')
  })

  it('coupe les transitions CSS concurrentes et definit des animations natives', () => {
    const source = readFileSync(resolve(rootDir, 'assets/css/globals.css'), 'utf8')

    expect(source).toContain('html.view-transitions-enabled .page-public-enter-active')
    expect(source).toContain("::view-transition-old(root)")
    expect(source).toContain("@keyframes vt-app-new")
    expect(source).toContain("html[data-route-transition='push-app']::view-transition-new(root)")
  })
})
