export interface SentryReportingInput {
  dsn?: string | null
  environment?: string | null
  forceEnable?: boolean | string | null
}

export interface SentryReportingState {
  dsn?: string
  environment?: string
  hasDsn: boolean
  forceEnable: boolean
  isProduction: boolean
  enabled: boolean
}

function normalizeString(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function isSentryForceEnabled(value?: boolean | string | null): boolean {
  return value === true || value === 'true'
}

function isSentryProductionEnvironment(environment?: string | null): boolean {
  return normalizeString(environment) === 'production'
}

export function resolveSentryReporting(input: SentryReportingInput): SentryReportingState {
  const dsn = normalizeString(input.dsn)
  const environment = normalizeString(input.environment)
  const hasDsn = Boolean(dsn)
  const forceEnable = isSentryForceEnabled(input.forceEnable)
  const isProduction = isSentryProductionEnvironment(environment)

  return {
    dsn,
    environment,
    hasDsn,
    forceEnable,
    isProduction,
    enabled: hasDsn && (isProduction || forceEnable),
  }
}

export function getSentryDisabledMessage(state: SentryReportingState): string {
  if (!state.hasDsn) {
    return 'Pipeline Sentry désactivé: aucun DSN n’est configuré.'
  }

  if (!state.isProduction && !state.forceEnable) {
    return 'Pipeline Sentry désactivé hors production. Définissez SENTRY_FORCE_ENABLE=true pour un test manuel temporaire.'
  }

  return 'Pipeline Sentry désactivé.'
}
