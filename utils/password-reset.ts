/**
 * Construction de l’URL de redirection pour « mot de passe oublié ».
 * Sans slash final sur baseUrl pour éviter redirect_to avec double slash (ex. ...yumiscan.com//login).
 */
export function buildRedirectTo(options: {
  appUrl?: string
  windowOrigin?: string | null
  fallbackOrigin?: string
  redirectQuery?: string
}): string {
  const baseUrl = (
    (options.appUrl ?? '')?.trim() ||
    options.windowOrigin ||
    options.fallbackOrigin ||
    'https://yumiscan.com'
  ).replace(/\/$/, '')
  const query = options.redirectQuery
    ? `?redirect=${encodeURIComponent(options.redirectQuery)}`
    : ''
  return `${baseUrl}/login${query}`
}
