import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import AccountCreditsSection from '../../../components/account/AccountCreditsSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'account.credits.title': 'Scan Credits',
        'account.credits.lbl_free': 'free',
        'account.credits.lbl_low_credits': 'Only',
        'account.credits.lbl_scan_remaining_suffix': 'scan(s) remaining',
        'account.credits.lbl_no_scans': 'No more scans available',
        'account.credits.desc_empty': 'Recharge now to continue scanning.',
        'account.credits.desc_low': 'Recharge soon so you won\'t be interrupted.',
        'account.credits.desc_daily': 'Includes 1 free scan (valid today).',
        'account.credits.desc_ok': 'Scans ready to use.',
        'account.credits.btn_recharge': 'Recharge my credits',
        'account.credits.btn_buy': 'Buy credits',
      }

      return translations[key] ?? key
    },
  }),
}))

const stubNuxtLink = {
  name: 'NuxtLink',
  props: ['to'],
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
}

describe('AccountCreditsSection', () => {
  function stubNuxtAutoImports() {
    vi.stubGlobal('useLocalePath', () => (path: string) => (path === '/' ? '/en' : `/en${path}`))
    vi.stubGlobal('computed', computed)
  }

  it('sépare le compteur restant du texte et pointe vers la route locale pricing', () => {
    stubNuxtAutoImports()

    const wrapper = mount(AccountCreditsSection, {
      props: {
        freeScansCount: 3,
        freeScansUsed: 3,
        paidScansUsed: 97,
        paidCreditsPurchased: 100,
        dailyCreditAvailable: true,
      },
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    const summary = wrapper.find('p.text-xs.font-black')
    expect(summary.text()).toContain('Only')
    expect(summary.find('strong').text()).toBe('4')
    expect(summary.text()).toContain('scan(s) remaining')

    const cta = wrapper.find('a[href="/en/pricing"]')
    expect(cta.exists()).toBe(true)
    expect(cta.text()).toContain('Recharge my credits')
    expect(wrapper.find('a button').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('utilise aussi une route locale pour le CTA standard', () => {
    stubNuxtAutoImports()

    const wrapper = mount(AccountCreditsSection, {
      props: {
        freeScansCount: 3,
        freeScansUsed: 0,
        paidScansUsed: 0,
        paidCreditsPurchased: 100,
        dailyCreditAvailable: false,
      },
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    const cta = wrapper.find('a[href="/en/pricing"]')
    expect(cta.exists()).toBe(true)
    expect(cta.text()).toContain('Buy credits')
    vi.unstubAllGlobals()
  })
})
