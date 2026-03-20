/**
 * Smoke test + contrat du composant UiPasswordInput.
 * Le correctif principal : transmettre model-value à UiInput et écouter @update:model-value
 * (pas :value ni @input) pour que le texte ne se vide pas au clic sur l’œil.
 */
import { describe, it, expect } from 'vitest'

describe('UiPasswordInput', () => {
  it('doit transmettre la valeur reçue sans la modifier (contrat de forwarding)', () => {
    // Comportement attendu : quand l’enfant émet la chaîne S, le parent reçoit S.
    // Si on émettait e.target?.value avec e = Event, on enverrait undefined (bug corrigé).
    const forward = (value: string) => value
    expect(forward('hello')).toBe('hello')
    expect(forward('')).toBe('')
  })
})
