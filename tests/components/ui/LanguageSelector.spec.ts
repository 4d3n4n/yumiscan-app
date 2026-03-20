import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

import LanguageSelector from '../../../components/ui/LanguageSelector.vue'

const locale = ref<'fr' | 'en'>('fr')
const locales = ref([{ code: 'fr' }, { code: 'en' }])
const routerPush = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale,
    locales,
  }),
}))

describe('LanguageSelector', () => {
  beforeEach(() => {
    locale.value = 'fr'
    routerPush.mockReset()
    vi.stubGlobal('useSwitchLocalePath', () => (code: string) => (code === 'en' ? '/en/app/account' : '/app/account'))
    vi.stubGlobal('useRouter', () => ({ push: routerPush }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('affiche un controle minimal avec les locales disponibles et pousse la locale cible', async () => {
    const wrapper = mount(LanguageSelector, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })

    const buttons = wrapper.findAll('button')

    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toBe('FR')
    expect(buttons[1].text()).toBe('EN')
    expect(buttons[0].classes()).toContain('language-switch__option--active')

    await buttons[1].trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/en/app/account')
  })
})
