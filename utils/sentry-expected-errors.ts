/**
 * Erreurs qu’on ne souhaite pas envoyer à Sentry (4xx attendus, validation, auth).
 * Utilisé dans beforeSend (client + server) pour filtrer le bruit.
 */

const EXPECTED_STATUS_CODES = new Set([400, 401, 403, 404, 422])

const EXPECTED_MESSAGE_PATTERNS = [
  /invalid.*(login|credentials|password|email)/i,
  /email.*not.*found/i,
  /user.*not.*found/i,
  /validation/i,
  /unauthorized/i,
  /forbidden/i,
  /not found/i,
  /page.*introuvable/i,
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
  if (typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number') {
    return (err as { statusCode: number }).statusCode
  }
  if (typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return (err as { status: number }).status
  }
  return undefined
}

/**
 * Retourne true si l’erreur est "attendue" (4xx, validation, auth) et ne doit pas être envoyée à Sentry.
 */
export function isExpectedError(err: unknown): boolean {
  const statusCode = getStatusCode(err)
  if (statusCode !== undefined && EXPECTED_STATUS_CODES.has(statusCode)) {
    return true
  }
  const message = getMessage(err)
  if (EXPECTED_MESSAGE_PATTERNS.some((re) => re.test(message))) {
    return true
  }
  return false
}
