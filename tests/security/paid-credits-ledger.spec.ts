import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('paid credits ledger', () => {
  it('derive les credits front depuis user_purchases plutot que user_profiles', () => {
    const composable = readFileSync(resolve(rootDir, 'composables/useCredits.ts'), 'utf8')

    expect(composable).toContain(".from('user_purchases')")
    expect(composable).toContain('paidCreditsPurchased')
    expect(composable).not.toContain('paid_credits_balance')
  })

  it('verifie les credits de scan backend depuis le ledger d achats', () => {
    const authShared = readFileSync(resolve(rootDir, 'supabase/functions/_shared/auth.ts'), 'utf8')
    const helper = readFileSync(resolve(rootDir, 'supabase/functions/_shared/purchased-credits.ts'), 'utf8')

    expect(authShared).toContain('getPurchasedCreditsTotal')
    expect(authShared).not.toContain('paid_credits_balance')
    expect(helper).toContain('.from("user_purchases")')
    expect(helper).toContain('getPaidCreditsRemaining')
  })

  it('exporte les credits payants derives depuis les achats figes', () => {
    const exportFunction = readFileSync(resolve(rootDir, 'supabase/functions/user-data-export/index.ts'), 'utf8')

    expect(exportFunction).toContain('paid_credits_purchased')
    expect(exportFunction).toContain('paid_credits_remaining')
    expect(exportFunction).not.toContain('paid_credits_balance')
  })
})
