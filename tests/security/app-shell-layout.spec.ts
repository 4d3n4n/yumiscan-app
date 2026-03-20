import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('app shell layout stabilization', () => {
  it('monte la navigation une seule fois dans le layout par défaut', () => {
    const defaultLayout = readFileSync(resolve(rootDir, 'layouts/default.vue'), 'utf8')
    const minimalLayout = readFileSync(resolve(rootDir, 'layouts/minimal.vue'), 'utf8')
    const homePage = readFileSync(resolve(rootDir, 'pages/home.vue'), 'utf8')
    const dashboardPage = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')
    const forgotPasswordPage = readFileSync(resolve(rootDir, 'pages/forgot-password.vue'), 'utf8')

    expect(defaultLayout).toContain('<AppNavigation />')
    expect(minimalLayout).not.toContain('<AppNavigation />')
    expect(homePage).not.toContain('<AppNavigation />')
    expect(dashboardPage).not.toContain('<AppNavigation />')
    expect(forgotPasswordPage).not.toContain('<AppNavigation />')
    expect(forgotPasswordPage).toContain("definePageMeta({ middleware: ['guest'] })")
  })
})
