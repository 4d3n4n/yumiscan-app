function isAuthenticationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  return message.includes('401')
    || message.includes('unauthorized')
    || message.includes('not authenticated')
    || message.includes('jwt')
    || message.includes('token')
}

export function retryQueryExceptAuth(failureCount: number, error: unknown): boolean {
  if (isAuthenticationError(error)) {
    return false
  }

  return failureCount < 2
}
