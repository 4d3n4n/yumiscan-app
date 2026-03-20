import { describe, expect, it } from 'vitest'

import { buildContentSecurityPolicy, buildSecurityHeaders, getSentryIngestOrigin } from '~/utils/security-headers'

describe('security headers', () => {
  it('genere une CSP de production avec des domaines explicites', () => {
    const csp = buildContentSecurityPolicy({
      isDev: false,
      supabaseUrl: 'https://example-project.supabase.co',
      sentryDsn: 'https://95a8143fde41b28eebf3a1b5cc31ff77@o4510965894479872.ingest.de.sentry.io/4510966046982224',
    })

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain('https://js.stripe.com')
    expect(csp).toContain('https://www.googletagmanager.com')
    expect(csp).toContain('https://connect.facebook.net')
    expect(csp).toContain('https://analytics.tiktok.com')
    expect(csp).toContain('https://form.tally.so')
    expect(csp).toContain('https://example-project.supabase.co')
    expect(csp).toContain('https://*.supabase.co')
    expect(csp).toContain('https://o4510965894479872.ingest.de.sentry.io')
    expect(csp).toContain("media-src 'self' blob: data: https://example-project.supabase.co")
    expect(csp).not.toContain('connect-src \'self\' https: http: ws: wss:')
    expect(csp).not.toContain(' http: ')
    expect(csp).not.toContain(' ws: ')
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com")
  })

  it('garde uniquement les exceptions locales en dev', () => {
    const csp = buildContentSecurityPolicy({
      isDev: true,
      supabaseUrl: 'http://127.0.0.1:54321',
    })

    expect(csp).toContain('http://localhost:3000')
    expect(csp).toContain('ws://localhost:3000')
    expect(csp).toContain('http://127.0.0.1:54321')
    expect(csp).toContain('ws://127.0.0.1:54321')
    expect(csp).toContain("img-src 'self' data: blob: https: http://127.0.0.1:54321")
    expect(csp).toContain("media-src 'self' blob: data: http://127.0.0.1:54321 http://localhost:54321")
  })

  it('expose les headers de securite attendus', () => {
    const headers = buildSecurityHeaders({
      isDev: false,
      supabaseUrl: 'https://example-project.supabase.co',
      sentryDsn: 'https://95a8143fde41b28eebf3a1b5cc31ff77@o4510965894479872.ingest.de.sentry.io/4510966046982224',
    })

    expect(headers['Content-Security-Policy']).toBeTruthy()
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Permissions-Policy']).toContain('camera=(self)')
  })

  it('derive correctement l origine d ingest Sentry depuis le DSN prod', () => {
    expect(
      getSentryIngestOrigin('https://95a8143fde41b28eebf3a1b5cc31ff77@o4510965894479872.ingest.de.sentry.io/4510966046982224'),
    ).toBe('https://o4510965894479872.ingest.de.sentry.io')
  })
})
