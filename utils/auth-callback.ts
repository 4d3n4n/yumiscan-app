type SupportedAuthCallbackType =
  | 'recovery'
  | 'email_change'
  | 'email_change_current'
  | 'signup'
  | 'magiclink'
  | 'invite'

type ParsedAuthCallback = {
  code: string | null
  tokenHash: string | null
  type: string | null
  error: string | null
  errorDescription: string | null
  errorCode: string | null
  confirmationUrl: string | null
}

function mergeParamsInto(base: URLSearchParams, extra: URLSearchParams) {
  for (const [key, value] of extra.entries()) {
    if (!base.has(key)) {
      base.set(key, value)
    }
  }
}

function parseConfirmationUrl(rawValue: string | null): URLSearchParams | null {
  if (!rawValue) return null

  try {
    return new URL(rawValue).searchParams
  } catch {
    const query = rawValue.includes('?')
      ? rawValue.slice(rawValue.indexOf('?') + 1)
      : rawValue
    const params = new URLSearchParams(query)
    return Array.from(params.keys()).length > 0 ? params : null
  }
}

export function parseAuthCallbackParams(options: {
  hash?: string
  search?: string
}): ParsedAuthCallback {
  const params = new URLSearchParams(options.search ?? '')
  const hashParams = new URLSearchParams((options.hash ?? '').replace(/^#/, ''))

  mergeParamsInto(params, hashParams)

  const confirmationUrl = params.get('confirmation_url')
  const confirmationParams = parseConfirmationUrl(confirmationUrl)
  if (confirmationParams) {
    mergeParamsInto(params, confirmationParams)
  }

  if (!params.get('token_hash')) {
    const token = params.get('token')
    if (token) {
      params.set('token_hash', token)
    }
  }

  return {
    code: params.get('code'),
    tokenHash: params.get('token_hash'),
    type: params.get('type'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
    errorCode: params.get('error_code'),
    confirmationUrl,
  }
}

export function isSupportedAuthCallbackType(type: string | null): type is SupportedAuthCallbackType {
  return type === 'recovery'
    || type === 'email_change'
    || type === 'email_change_current'
    || type === 'signup'
    || type === 'magiclink'
    || type === 'invite'
}
