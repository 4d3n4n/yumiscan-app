import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf-8')
}

describe('public legal and informational pages', () => {
  it('does not expose public mailto contact links on the targeted public pages', () => {
    const files = [
      'pages/cgu.vue',
      'pages/confidentialite.vue',
      'pages/mentions-legales.vue',
      'pages/cgv.vue',
      'components/AppFooter.vue',
      'i18n/locales/fr/legal.json',
      'i18n/locales/en/legal.json',
    ]

    for (const file of files) {
      const raw = read(file)
      expect(raw).not.toContain('mailto:contact@')
      expect(raw).not.toContain("contact{'@'}yumiscan.com")
      expect(raw).not.toContain('contact@yumiscan.com')
      expect(raw).not.toContain('contact@yumiscan.app')
    }
  })

  it('does not keep the duplicate publication director punctuation bug', () => {
    expect(read('pages/mentions-legales.vue')).not.toContain('Directeur de la publication : :')
  })

  it('keeps protected app routes out of llms public files', () => {
    for (const file of ['public/llms.txt', 'public/llms-full.txt']) {
      const raw = read(file)
      expect(raw).not.toContain('/app/')
      expect(raw).toContain('/a-propos')
      expect(raw).toContain('/cgv')
    }
  })
})
