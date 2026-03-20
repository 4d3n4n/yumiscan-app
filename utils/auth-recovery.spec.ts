import { describe, it, expect, vi } from 'vitest'
import {
  AUTH_RECOVERY_KEY,
  shouldShowRecoveryForm,
  setRecoveryFlagIfNeeded,
} from './auth-recovery'

describe('shouldShowRecoveryForm', () => {
  it('retourne true si type=recovery est dans le hash', () => {
    expect(
      shouldShowRecoveryForm({ hash: '#access_token=xxx&type=recovery&refresh_token=yyy' })
    ).toBe(true)
    expect(shouldShowRecoveryForm({ hash: '#type=recovery' })).toBe(true)
  })

  it('retourne true si type=recovery est dans la query', () => {
    expect(
      shouldShowRecoveryForm({ search: '?token=abc&type=recovery' })
    ).toBe(true)
  })

  it('retourne true si le flag est en sessionStorage', () => {
    const getItem = vi.fn((key: string) => (key === AUTH_RECOVERY_KEY ? '1' : null))
    expect(shouldShowRecoveryForm({ getStorageItem: getItem })).toBe(true)
  })

  it('retourne false si ni URL ni storage n’indiquent recovery', () => {
    expect(shouldShowRecoveryForm({ hash: '', search: '' })).toBe(false)
    expect(
      shouldShowRecoveryForm({ getStorageItem: () => null })
    ).toBe(false)
    expect(
      shouldShowRecoveryForm({ getStorageItem: () => '0' })
    ).toBe(false)
  })

  it('retourne false si getStorageItem lance', () => {
    const getItem = vi.fn(() => {
      throw new Error('sessionStorage unavailable')
    })
    expect(shouldShowRecoveryForm({ getStorageItem: getItem })).toBe(false)
  })
})

describe('setRecoveryFlagIfNeeded', () => {
  it('écrit le flag en storage quand type=recovery est dans le hash', () => {
    const setItem = vi.fn()
    setRecoveryFlagIfNeeded({
      hash: '#type=recovery&access_token=xxx',
      setStorageItem: setItem,
    })
    expect(setItem).toHaveBeenCalledWith(AUTH_RECOVERY_KEY, '1')
  })

  it('écrit le flag quand type=recovery est dans la query', () => {
    const setItem = vi.fn()
    setRecoveryFlagIfNeeded({
      search: '?type=recovery',
      setStorageItem: setItem,
    })
    expect(setItem).toHaveBeenCalledWith(AUTH_RECOVERY_KEY, '1')
  })

  it('n’écrit rien si type=recovery est absent', () => {
    const setItem = vi.fn()
    setRecoveryFlagIfNeeded({
      hash: '#other=value',
      search: '',
      setStorageItem: setItem,
    })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('ne lance pas si setStorageItem lance', () => {
    const setItem = vi.fn(() => {
      throw new Error('sessionStorage full')
    })
    expect(() =>
      setRecoveryFlagIfNeeded({
        hash: '#type=recovery',
        setStorageItem: setItem,
      })
    ).not.toThrow()
  })
})
