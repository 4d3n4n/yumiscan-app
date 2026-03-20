/**
 * Tests du composant AppButton (bouton / lien unifié back-office).
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppButton from '../../../components/app/AppButton.vue'

const stubNuxtLink = {
  name: 'NuxtLink',
  props: ['to'],
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
}

describe('AppButton', () => {
  it('rend un lien (a) avec href quand to est fourni', () => {
    const wrapper = mount(AppButton, {
      props: { to: '/app/admin' },
      slots: { default: 'Retour admin' },
      global: { stubs: { NuxtLink: stubNuxtLink } },
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/app/admin')
    expect(link.text()).toBe('Retour admin')
  })

  it('rend un button quand to nest pas fourni', () => {
    const wrapper = mount(AppButton, {
      slots: { default: 'Cliquer' },
      global: { stubs: { NuxtLink: stubNuxtLink } },
    })
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Cliquer')
  })

  it('émet click au clic sur le bouton (sans to)', async () => {
    const wrapper = mount(AppButton, {
      slots: { default: 'Action' },
      global: { stubs: { NuxtLink: stubNuxtLink } },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('applique les classes variant et size par défaut (primary, md)', () => {
    const wrapper = mount(AppButton, {
      slots: { default: 'Texte' },
      global: { stubs: { NuxtLink: stubNuxtLink } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('bold-btn')
    expect(btn.classes()).toContain('bold-btn--primary')
    expect(btn.classes()).toContain('bold-btn--md')
  })

  it('applique variant secondary et pill quand fournis', () => {
    const wrapper = mount(AppButton, {
      props: { variant: 'secondary', pill: true },
      slots: { default: 'Pill' },
      global: { stubs: { NuxtLink: stubNuxtLink } },
    })
    const btn = wrapper.find('button')
    expect(btn.classes()).toContain('bold-btn--secondary')
    expect(btn.classes()).toContain('bold-btn--pill')
  })

  it('désactive le bouton quand disabled=true', () => {
    const wrapper = mount(AppButton, {
      props: { disabled: true },
      slots: { default: 'Disabled' },
      global: { stubs: { NuxtLink: stubNuxtLink } },
    })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
