/**
 * Règles mot de passe (normes type RGPD / bonnes pratiques) :
 * - Minimum 12 caractères
 * - Au moins une majuscule
 * - Au moins une minuscule
 * - Au moins un chiffre
 * - Au moins un caractère spécial
 * Utilisé à la création de compte (signup) et au changement de mot de passe (compte).
 */

export const PASSWORD_MIN_LENGTH = 12

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/

export type PasswordValidationResult = {
  valid: boolean
  errors: string[]
}

/**
 * Valide un mot de passe selon les règles ci-dessus.
 * Retourne { valid: true, errors: [] } si OK, sinon la liste des critères manquants.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push('12 caractères minimum')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('1 minuscule')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('1 majuscule')
  }
  if (!/\d/.test(password)) {
    errors.push('1 chiffre')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('1 caractère spécial')
  }
  return {
    valid: errors.length === 0,
    errors,
  }
}
