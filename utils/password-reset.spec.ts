import { describe, it, expect } from 'vitest'
import { buildRedirectTo } from './password-reset'

describe('buildRedirectTo', () => {
  it('utilise appUrl et enleve le slash final', () => {
    expect(buildRedirectTo({ appUrl: 'https://yumiscan.com' })).toBe(
      'https://yumiscan.com/login'
    )
    expect(buildRedirectTo({ appUrl: 'https://yumiscan.com/' })).toBe(
      'https://yumiscan.com/login'
    )
  })

  it('n introduit pas de double slash meme si appUrl a un slash final', () => {
    const url = buildRedirectTo({ appUrl: 'https://example.com/' })
    expect(url).toBe('https://example.com/login')
    expect(url).not.toContain('//login')
  })

  it('ajoute le query redirect si fourni', () => {
    expect(
      buildRedirectTo({
        appUrl: 'https://example.com',
        redirectQuery: '/app/dashboard',
      })
    ).toBe('https://example.com/login?redirect=%2Fapp%2Fdashboard')
  })

  it('utilise windowOrigin si appUrl est vide', () => {
    expect(
      buildRedirectTo({
        appUrl: '',
        windowOrigin: 'https://prod.example.com',
      })
    ).toBe('https://prod.example.com/login')
  })

  it('utilise fallbackOrigin si appUrl et windowOrigin sont vides', () => {
    expect(
      buildRedirectTo({
        appUrl: '',
        windowOrigin: null,
        fallbackOrigin: 'https://yumiscan.com',
      })
    ).toBe('https://yumiscan.com/login')
  })

  it('fallback par defaut a yumiscan.com si tout est vide', () => {
    expect(buildRedirectTo({})).toBe('https://yumiscan.com/login')
  })
})
