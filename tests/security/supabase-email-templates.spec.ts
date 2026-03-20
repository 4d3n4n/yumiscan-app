import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('supabase email templates', () => {
  it('configure des templates versionnes dans supabase/config.toml', () => {
    const config = readFileSync(resolve(rootDir, 'supabase/config.toml'), 'utf8')

    expect(config).toContain('additional_redirect_urls = [')
    expect(config).toContain('http://localhost:3000/login')
    expect(config).toContain('http://localhost:3000/auth/confirm')
    expect(config).toContain('https://yumiscan.com/login')
    expect(config).toContain('https://yumiscan.com/auth/confirm')
    expect(config).toContain('[auth.email.template.confirmation]')
    expect(config).toContain('./supabase/templates/confirmation.html')
    expect(config).toContain('[auth.email.template.recovery]')
    expect(config).toContain('./supabase/templates/recovery.html')
    expect(config).toContain('[auth.email.template.email_change]')
    expect(config).toContain('./supabase/templates/email-change.html')
    expect(config).toContain('[auth.email.template.magic_link]')
    expect(config).toContain('./supabase/templates/magic-link.html')
    expect(config).toContain('[auth.email.template.invite]')
    expect(config).toContain('./supabase/templates/invite.html')
  })

  it('fournit les fichiers HTML et les placeholders Supabase requis', () => {
    const templates = [
      { file: 'confirmation.html', placeholder: '{{ .ConfirmationURL }}' },
      { file: 'recovery.html', placeholder: '{{ .ConfirmationURL }}' },
      { file: 'magic-link.html', placeholder: '{{ .ConfirmationURL }}' },
      { file: 'invite.html', placeholder: '{{ .ConfirmationURL }}' },
    ]

    for (const template of templates) {
      const filePath = resolve(rootDir, 'supabase/templates', template.file)
      expect(existsSync(filePath)).toBe(true)

      const content = readFileSync(filePath, 'utf8')
      expect(content).toContain(template.placeholder)
      expect(content).toContain('YumiScan')
    }

    const confirmationContent = readFileSync(resolve(rootDir, 'supabase/templates/confirmation.html'), 'utf8')
    expect(confirmationContent).toContain('<title>Activez votre compte YumiScan</title>')

    const emailChangeContent = readFileSync(resolve(rootDir, 'supabase/templates/email-change.html'), 'utf8')
    expect(emailChangeContent).toContain('{{ .NewEmail }}')
    expect(emailChangeContent).toContain('{{ .RedirectTo }}?confirmation_url={{ .ConfirmationURL }}')
    expect(emailChangeContent).toContain('{{ .ConfirmationURL }}')
  })
})
