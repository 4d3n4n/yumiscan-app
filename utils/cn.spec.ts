import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('fusionne plusieurs classes', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('ignore les valeurs falsy', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b')
  })

  it('fusionne les conflits Tailwind (twMerge) : dernière gagne', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('accepte des tableaux', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })

  it('accepte des objets conditionnels', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })
})
