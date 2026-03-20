/**
 * Helper Sentry pour Edge Functions (Deno).
 * Envoie à Sentry (et donc Discord) uniquement les erreurs **non attendues** :
 * - 4xx (400, 401, 403, 404, 422), validation, image invalide, scan refusé, etc. → ignorées.
 *
 * Usage :
 *   import { captureError } from '../_shared/sentry.ts'
 *   try { ... } catch (e) {
 *     await captureError(e, { function: 'ma-fonction' })
 *     return new Response(...)
 *   }
 *
 * Secret : SENTRY_DSN ou NUXT_PUBLIC_SENTRY_DSN (fallback pratique si seul le DSN Nuxt est défini).
 * @see https://supabase.com/docs/guides/functions/examples/sentry-monitoring
 */
// @ts-expect-error module Deno
import * as Sentry from 'https://deno.land/x/sentry/index.mjs'
import { getSentryDisabledMessage, resolveSentryReporting } from '../../../utils/sentry-reporting.ts'

const SENTRY_SETTINGS = resolveSentryReporting({
  dsn: Deno.env.get('SENTRY_DSN') ?? Deno.env.get('NUXT_PUBLIC_SENTRY_DSN'),
  environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? Deno.env.get('NUXT_PUBLIC_SENTRY_ENVIRONMENT'),
  forceEnable: Deno.env.get('SENTRY_FORCE_ENABLE'),
})
let initialized = false

const EXPECTED_STATUS_CODES = new Set([400, 401, 403, 404, 422])

const EXPECTED_MESSAGE_PATTERNS = [
  /invalid.*(login|credentials|password|email)/i,
  /validation/i,
  /unauthorized|forbidden|not found/i,
  /image.*invalid|invalid.*image|bad.*image|image.*quality|quality.*too low/i,
  /scan.*(failed|refused|invalid|error)|(failed|refused|invalid).*scan/i,
  /no.*(text|ingredient).*found|unable.*to.*(read|parse)/i,
]

function getMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  if (typeof err === 'string') return err
  return ''
}

function getStatusCode(err: unknown): number | undefined {
  const o = err && typeof err === 'object' ? err as Record<string, unknown> : null
  if (o && typeof o.statusCode === 'number') return o.statusCode
  if (o && typeof o.status === 'number') return o.status
  return undefined
}

/** True si l’erreur est attendue (validation, 4xx, image/scan) → on ne l’envoie pas à Sentry. */
function isExpectedError(err: unknown): boolean {
  const status = getStatusCode(err)
  if (status !== undefined && EXPECTED_STATUS_CODES.has(status)) return true
  const msg = getMessage(err)
  return EXPECTED_MESSAGE_PATTERNS.some((re) => re.test(msg))
}

function init() {
  if (initialized || !SENTRY_SETTINGS.enabled || !SENTRY_SETTINGS.dsn) return
  Sentry.init({
    dsn: SENTRY_SETTINGS.dsn,
    environment: SENTRY_SETTINGS.environment,
    defaultIntegrations: false,
    tracesSampleRate: 0,
  })
  Sentry.setTag('area', 'back')
  initialized = true
}

export function isSentryConfigured(): boolean {
  return SENTRY_SETTINGS.hasDsn
}

export function isSentryReportingEnabled(): boolean {
  return SENTRY_SETTINGS.enabled
}

export function getSentryDisabledReason(): string {
  return getSentryDisabledMessage(SENTRY_SETTINGS)
}

/** Envoie l’erreur à Sentry (et Discord) seulement si elle n’est pas "attendue" (validation, 4xx, image/scan). */
export async function captureError(error: unknown, extra?: Record<string, string>): Promise<boolean> {
  if (!SENTRY_SETTINGS.enabled || isExpectedError(error)) return false
  init()
  Sentry.withScope((scope: { setExtra: (k: string, v: string) => void; setTag: (k: string, v: string) => void }) => {
    scope.setTag('area', 'back')
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        scope.setExtra(k, v)
        if (k === 'function') scope.setTag('function', v)
      })
    }
    Sentry.captureException(error)
  })
  await Sentry.flush(2000)
  return true
}
