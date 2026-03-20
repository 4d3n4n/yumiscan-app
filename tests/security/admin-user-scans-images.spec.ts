import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('admin user scans signed images', () => {
  it('génère une signed URL côté Edge Function admin avec la service role', () => {
    const fn = readFileSync(resolve(rootDir, 'supabase/functions/admin-user-scans/index.ts'), 'utf8')

    expect(fn).toContain('.storage')
    expect(fn).toContain('.from("scan-images")')
    expect(fn).toContain('.createSignedUrl(')
    expect(fn).toContain('signed_image_url')
  })

  it('affiche la miniature signée côté page admin scans user', () => {
    const page = readFileSync(resolve(rootDir, 'pages/app/admin/users/[userId].vue'), 'utf8')

    expect(page).toContain('v-if="scan.signed_image_url"')
    expect(page).toContain(':src="scan.signed_image_url"')
  })
})
