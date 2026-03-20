import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SmartScanSignupCta from '../../../components/marketing/SmartScanSignupCta.vue'

const openScanMock = vi.fn()
const translations: Record<string, string> = {
  'blog.signup_cta.guest.badge': 'Passez a l action',
  'blog.signup_cta.guest.title': 'Titre guest',
  'blog.signup_cta.guest.description': 'Desc guest',
  'blog.signup_cta.guest.button': 'Creer mon compte',
  'blog.signup_cta.user.badge': 'Scanner avec IA',
  'blog.signup_cta.user.title': 'Titre user',
  'blog.signup_cta.user.description': 'Desc user',
  'blog.signup_cta.user.button': 'Scanner avec IA',
}

const stubNuxtLink = {
  name: 'NuxtLink',
  props: ['to'],
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
}

const stubScanCtaButton = {
  name: 'ScanCtaButton',
  props: ['label', 'fullWidth', 'class'],
  emits: ['click'],
  template: '<button class="scan-cta" @click="$emit(\'click\')">{{ label }}</button>',
}

describe('SmartScanSignupCta', () => {
  beforeEach(() => {
    openScanMock.mockReset()
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useI18n', () => ({
      t: (key: string) => translations[key] ?? key,
    }))
    vi.stubGlobal('useLocalePath', () => (path: string) => `/fr${path}`)
    vi.stubGlobal('useScanFlow', () => ({ openScan: openScanMock }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche un lien signup pour un visiteur non connecte', () => {
    vi.stubGlobal('useAuth', () => ({ user: ref(null) }))

    const wrapper = mount(SmartScanSignupCta, {
      props: { translationBase: 'blog.signup_cta' },
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
          ScanCtaButton: stubScanCtaButton,
        },
      },
    })

    expect(wrapper.find('a').attributes('href')).toBe('/fr/signup')
    expect(wrapper.text()).toContain('Creer mon compte')
  })

  it('ouvre le scanner pour un utilisateur connecte', async () => {
    vi.stubGlobal('useAuth', () => ({ user: ref({ id: 'user-1' }) }))

    const wrapper = mount(SmartScanSignupCta, {
      props: { translationBase: 'blog.signup_cta' },
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
          ScanCtaButton: stubScanCtaButton,
        },
      },
    })

    await wrapper.find('.scan-cta').trigger('click')

    expect(openScanMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Scanner avec IA')
  })
})
