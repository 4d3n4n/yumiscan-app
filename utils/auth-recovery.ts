/**
 * Détection du mode « réinitialisation mot de passe » (lien email) et flag sessionStorage.
 * Utilisé par la page login et le plugin 00-auth-recovery.
 */
export const AUTH_RECOVERY_KEY = 'auth_recovery'

export function shouldShowRecoveryForm(options: {
  hash?: string
  search?: string
  getStorageItem?: (key: string) => string | null
}): boolean {
  const hash = options.hash ?? ''
  const search = options.search ?? ''
  if (hash.includes('type=recovery') || search.includes('type=recovery')) return true
  try {
    return options.getStorageItem?.(AUTH_RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

export function setRecoveryFlagIfNeeded(options: {
  hash?: string
  search?: string
  setStorageItem?: (key: string, value: string) => void
}): void {
  const hash = options.hash ?? ''
  const search = options.search ?? ''
  if (!hash.includes('type=recovery') && !search.includes('type=recovery')) return
  try {
    options.setStorageItem?.(AUTH_RECOVERY_KEY, '1')
  } catch {
    // sessionStorage indisponible (privé, etc.)
  }
}
