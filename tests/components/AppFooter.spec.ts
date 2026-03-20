import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('AppFooter', () => {
  it('affiche le rappel visuel Stripe dans le footer', () => {
    const footer = readFileSync(resolve(rootDir, 'components/AppFooter.vue'), 'utf8')

    expect(footer).toContain('/images/payment/stripe.webp')
    expect(footer).toContain('alt="Stripe"')
  })
})
