import { describe, expect, it } from 'vitest'

import {
  isSupportedAuthCallbackType,
  parseAuthCallbackParams,
} from '../../utils/auth-callback'

describe('parseAuthCallbackParams', () => {
  it('fusionne query et hash en priorisant la query', () => {
    const parsed = parseAuthCallbackParams({
      search: '?type=email_change&code=abc',
      hash: '#token_hash=xyz&type=recovery',
    })

    expect(parsed.code).toBe('abc')
    expect(parsed.tokenHash).toBe('xyz')
    expect(parsed.type).toBe('email_change')
  })

  it('recupere les erreurs du callback', () => {
    const parsed = parseAuthCallbackParams({
      search: '?error=access_denied&error_code=otp_expired&error_description=expired',
    })

    expect(parsed.error).toBe('access_denied')
    expect(parsed.errorCode).toBe('otp_expired')
    expect(parsed.errorDescription).toBe('expired')
  })

  it('extracte les parametres depuis confirmation_url et remonte le token "token" comme token_hash', () => {
    const parsed = parseAuthCallbackParams({
      search: '?confirmation_url=https%3A%2F%2Fproject.supabase.co%2Fauth%2Fv1%2Fverify%3Ftoken%3Dabc123%26type%3Demail_change_current%26redirect_to%3Dhttps%253A%252F%252Fyumiscan.com%252Fauth%252Fconfirm',
    })

    expect(parsed.confirmationUrl).toContain('/auth/v1/verify')
    expect(parsed.tokenHash).toBe('abc123')
    expect(parsed.type).toBe('email_change_current')
  })
})

describe('isSupportedAuthCallbackType', () => {
  it('accepte les types auth geres', () => {
    expect(isSupportedAuthCallbackType('email_change')).toBe(true)
    expect(isSupportedAuthCallbackType('email_change_current')).toBe(true)
    expect(isSupportedAuthCallbackType('recovery')).toBe(true)
  })

  it('rejette les types inconnus', () => {
    expect(isSupportedAuthCallbackType('unknown')).toBe(false)
    expect(isSupportedAuthCallbackType(null)).toBe(false)
  })
})
