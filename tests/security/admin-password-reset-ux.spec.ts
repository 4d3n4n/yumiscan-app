import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('admin password reset UX', () => {
  it('n essaie plus de copier un lien de reset pour envoyer le mail admin', () => {
    const page = readFileSync(resolve(rootDir, 'pages/app/admin/users/index.vue'), 'utf8')

    expect(page).not.toContain('navigator.clipboard.writeText(res.link)')
    expect(page).toContain("setFeedback(res.message ?? 'Email de réinitialisation envoyé à l’utilisateur.')")
    expect(page).toContain("throw new Error('Le presse-papier n est pas disponible sur cet appareil.')")
    expect(page).toContain("setFeedback('Impossible de copier l’email sur cet appareil.', 'error')")
  })
})
