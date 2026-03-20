import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clientInit = vi.fn()
const serverInit = vi.fn()

vi.mock('@sentry/nuxt', () => ({
  init: clientInit,
}))

vi.mock('@sentry/node', () => ({
  init: serverInit,
}))

vi.mock('~/utils/sentry-expected-errors', () => ({
  isExpectedError: () => false,
}))

describe('sentry config gating', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    clientInit.mockReset()
    serverInit.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('n’initialise pas Sentry côté client hors production', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        sentry: {
          dsn: 'https://example@sentry.io/1',
          environment: 'development',
          forceEnable: false,
        },
      },
    }))

    await import('../../sentry.client.config')

    expect(clientInit).not.toHaveBeenCalled()
  })

  it('initialise Sentry côté client en production', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        sentry: {
          dsn: 'https://example@sentry.io/1',
          environment: 'production',
          forceEnable: false,
        },
      },
    }))

    await import('../../sentry.client.config')

    expect(clientInit).toHaveBeenCalledOnce()
    expect(clientInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://example@sentry.io/1',
      environment: 'production',
    }))
  })

  it('initialise Sentry côté client avec override manuel', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        sentry: {
          dsn: 'https://example@sentry.io/1',
          environment: 'development',
          forceEnable: true,
        },
      },
    }))

    await import('../../sentry.client.config')

    expect(clientInit).toHaveBeenCalledOnce()
    expect(clientInit).toHaveBeenCalledWith(expect.objectContaining({
      environment: 'development',
    }))
  })

  it('n’initialise pas Sentry côté server hors production', async () => {
    vi.stubEnv('NUXT_PUBLIC_SENTRY_DSN', 'https://example@sentry.io/1')
    vi.stubEnv('NUXT_PUBLIC_SENTRY_ENVIRONMENT', 'development')
    vi.stubEnv('SENTRY_FORCE_ENABLE', 'false')

    await import('../../sentry.server.config')

    expect(serverInit).not.toHaveBeenCalled()
  })

  it('initialise Sentry côté server en production', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://example@sentry.io/2')
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production')
    vi.stubEnv('SENTRY_FORCE_ENABLE', 'false')

    await import('../../sentry.server.config')

    expect(serverInit).toHaveBeenCalledOnce()
    expect(serverInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://example@sentry.io/2',
      environment: 'production',
    }))
  })

  it('initialise Sentry côté server avec override manuel', async () => {
    vi.stubEnv('NUXT_PUBLIC_SENTRY_DSN', 'https://example@sentry.io/3')
    vi.stubEnv('NUXT_PUBLIC_SENTRY_ENVIRONMENT', 'development')
    vi.stubEnv('SENTRY_FORCE_ENABLE', 'true')

    await import('../../sentry.server.config')

    expect(serverInit).toHaveBeenCalledOnce()
    expect(serverInit).toHaveBeenCalledWith(expect.objectContaining({
      environment: 'development',
    }))
  })
})
