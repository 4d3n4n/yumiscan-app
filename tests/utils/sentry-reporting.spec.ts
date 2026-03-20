import { describe, expect, it } from 'vitest'
import { getSentryDisabledMessage, resolveSentryReporting } from '../../utils/sentry-reporting'

describe('sentry reporting', () => {
  it('désactive le reporting hors production même avec un DSN', () => {
    const state = resolveSentryReporting({
      dsn: 'https://example@sentry.io/1',
      environment: 'development',
    })

    expect(state.hasDsn).toBe(true)
    expect(state.enabled).toBe(false)
    expect(getSentryDisabledMessage(state)).toContain('hors production')
  })

  it('active le reporting en production avec un DSN', () => {
    const state = resolveSentryReporting({
      dsn: 'https://example@sentry.io/1',
      environment: 'production',
    })

    expect(state.isProduction).toBe(true)
    expect(state.enabled).toBe(true)
  })

  it('autorise un override manuel hors production', () => {
    const state = resolveSentryReporting({
      dsn: 'https://example@sentry.io/1',
      environment: 'development',
      forceEnable: 'true',
    })

    expect(state.forceEnable).toBe(true)
    expect(state.enabled).toBe(true)
  })

  it('reste désactivé sans DSN même avec override', () => {
    const state = resolveSentryReporting({
      environment: 'production',
      forceEnable: true,
    })

    expect(state.hasDsn).toBe(false)
    expect(state.enabled).toBe(false)
    expect(getSentryDisabledMessage(state)).toContain('aucun DSN')
  })
})
