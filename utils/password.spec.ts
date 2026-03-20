import { describe, it, expect } from 'vitest'
import { validatePassword, PASSWORD_MIN_LENGTH, PASSWORD_REGEX } from './password'

describe('validatePassword', () => {
  it('accepte un mot de passe valide (12 car., maj, min, chiffre, spécial)', () => {
    const result = validatePassword('MonMotDePasse1!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('refuse si moins de 12 caractères', () => {
    const result = validatePassword('Court1!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('12 caractères minimum')
  })

  it('refuse sans minuscule', () => {
    const result = validatePassword('MOTDEPASSE123!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('1 minuscule')
  })

  it('refuse sans majuscule', () => {
    const result = validatePassword('motdepasse123!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('1 majuscule')
  })

  it('refuse sans chiffre', () => {
    const result = validatePassword('MonMotDePasse!')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('1 chiffre')
  })

  it('refuse sans caractère spécial', () => {
    const result = validatePassword('MonMotDePasse123')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('1 caractère spécial')
  })

  it('retourne plusieurs erreurs si plusieurs critères manquants', () => {
    const result = validatePassword('court')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('password constants', () => {
  it('PASSWORD_MIN_LENGTH vaut 12', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12)
  })

  it('PASSWORD_REGEX valide un mot de passe conforme', () => {
    expect(PASSWORD_REGEX.test('MonMotDePasse1!')).toBe(true)
    expect(PASSWORD_REGEX.test('Abcdefgh1234@')).toBe(true)
  })

  it('PASSWORD_REGEX refuse un mot de passe trop court', () => {
    expect(PASSWORD_REGEX.test('Court1!')).toBe(false)
  })
})
