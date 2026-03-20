import { describe, expect, it } from 'vitest'
import { getScanStatusConfig, getScanStatusCircleConfig, getStatusEmojiFilterClass } from '~/utils/scan'

describe('scan status visuals', () => {
  it('utilise la couleur primary pour un scan conforme', () => {
    expect(getScanStatusConfig('ok')).toMatchObject({
      color: 'text-primary',
      bg: 'bg-primary/10',
      ring: 'ring-primary/30',
    })
    expect(getStatusEmojiFilterClass('ok')).toBe('')
  })

  it('conserve les teintes d alerte pour allergene et ambigu', () => {
    expect(getStatusEmojiFilterClass('contains_allergen')).toBe('emoji-status-allergen')
    expect(getStatusEmojiFilterClass('ambiguous')).toBe('emoji-status-ambiguous')
  })

  it('associe un cercle dashboard colore au resultat', () => {
    expect(getScanStatusCircleConfig('ok')).toMatchObject({
      bg: 'bg-primary/15',
      ring: 'ring-primary/40',
    })
    expect(getScanStatusCircleConfig('contains_allergen')).toMatchObject({
      bg: 'bg-red-100',
      ring: 'ring-red-300',
    })
    expect(getScanStatusCircleConfig('ambiguous')).toMatchObject({
      bg: 'bg-amber-100',
      ring: 'ring-amber-300',
    })
  })
})
