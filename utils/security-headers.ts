export interface SecurityHeadersOptions {
  isDev: boolean
  supabaseUrl?: string
  sentryDsn?: string
}

function normalizeOrigin(value?: string): string | null {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

export function getSentryIngestOrigin(dsn?: string): string | null {
  if (!dsn) return null

  try {
    return new URL(dsn).origin
  } catch {
    return null
  }
}

function buildConnectSources({ isDev, supabaseUrl, sentryDsn }: SecurityHeadersOptions): string[] {
  const supabaseOrigin = normalizeOrigin(supabaseUrl)
  const sentryIngestOrigin = getSentryIngestOrigin(sentryDsn)

  const productionSources = unique([
    "'self'",
    supabaseOrigin,
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.stripe.com',
    'https://r.stripe.com',
    'https://m.stripe.network',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://connect.facebook.net',
    'https://www.facebook.com',
    'https://analytics.tiktok.com',
    'https://business-api.tiktok.com',
    sentryIngestOrigin,
  ])

  if (!isDev) {
    return productionSources
  }

  return unique([
    ...productionSources,
    'http://localhost:3000',
    'ws://localhost:3000',
    'http://127.0.0.1:3000',
    'ws://127.0.0.1:3000',
    'http://localhost:54321',
    'ws://localhost:54321',
    'http://127.0.0.1:54321',
    'ws://127.0.0.1:54321',
  ])
}

function buildImageSources({ isDev, supabaseUrl }: SecurityHeadersOptions): string[] {
  const supabaseOrigin = normalizeOrigin(supabaseUrl)

  const productionSources = unique([
    "'self'",
    'data:',
    'blob:',
    'https:',
    supabaseOrigin,
  ])

  if (!isDev) {
    return productionSources
  }

  return unique([
    ...productionSources,
    'http://localhost:54321',
    'http://127.0.0.1:54321',
  ])
}

function buildMediaSources({ isDev, supabaseUrl }: SecurityHeadersOptions): string[] {
  const supabaseOrigin = normalizeOrigin(supabaseUrl)

  const productionSources = unique([
    "'self'",
    'blob:',
    'data:',
    supabaseOrigin,
  ])

  if (!isDev) {
    return productionSources
  }

  return unique([
    ...productionSources,
    'http://localhost:54321',
    'http://127.0.0.1:54321',
  ])
}

export function buildContentSecurityPolicy(options: SecurityHeadersOptions): string {
  const connectSources = buildConnectSources(options)
  const imageSources = buildImageSources(options)
  const mediaSources = buildMediaSources(options)

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com",
    `img-src ${imageSources.join(' ')}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Nuxt injecte encore du bootstrap/payload inline cote client (window.__NUXT__ / config).
    // Sans nonce/hash unifies, retirer unsafe-inline casse le montage de l'app.
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com",
    `connect-src ${connectSources.join(' ')}`,
    "frame-src 'self' https://checkout.stripe.com https://js.stripe.com https://hooks.stripe.com https://form.tally.so https://tally.so",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `media-src ${mediaSources.join(' ')}`,
  ]

  return directives.join('; ')
}

export function buildSecurityHeaders(options: SecurityHeadersOptions): Record<string, string> {
  return {
    'Content-Security-Policy': buildContentSecurityPolicy(options),
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(self)',
  }
}
