import { computed, ref } from 'vue'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import AccountDangerSection from '../../../components/account/AccountDangerSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.errors.unauthorized': 'Unauthorized',
        'common.errors.generic': 'Generic error',
        'common.password.show': 'Show password',
        'common.password.hide': 'Hide password',
        'account.danger_zone.msg_error_delete': 'Delete failed',
        'account.danger_zone.msg_error_export': 'Export failed',
        'account.danger_zone.msg_download_success': 'Export ready',
        'account.danger_zone.btn_download': 'Download my data',
        'account.danger_zone.btn_delete_req': 'Delete my account',
        'account.danger_zone.warning_title': 'Danger zone',
        'account.danger_zone.warning_desc': 'This action is irreversible.',
        'account.danger_zone.lbl_current_password': 'Current password',
        'account.danger_zone.placeholder_current_password': 'Current password',
        'account.danger_zone.btn_cancel': 'Cancel',
        'account.danger_zone.btn_delete_confirm': 'Delete definitely',
        'account.danger_zone.btn_logout': 'Log out',
        'account.danger_zone.consent_toggle_disable': 'Disable',
        'account.danger_zone.consent_toggle_enable': 'Enable',
      }

      return translations[key] ?? key
    },
  }),
}))

vi.mock('~/utils/emojis', () => ({
  APP_EMOJI: {
    success: 'success',
    loginError: 'loginError',
    destructiveWarning: 'destructiveWarning',
  },
}))

vi.mock('~/utils/supabase-auth', () => ({
  getAuthenticatedHeaders: vi.fn(async () => ({
    Authorization: 'Bearer token',
    'Content-Type': 'application/json',
    apikey: 'anon-key',
  })),
  safeSignOut: vi.fn(async () => undefined),
}))

const navigateToMock = vi.fn()

const stubNuxtLink = {
  name: 'NuxtLink',
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

const stubAppEmoji = {
  name: 'AppEmoji',
  template: '<span class="emoji-stub"></span>',
}

const stubIcon = {
  template: '<span class="icon-stub"></span>',
}

describe('AccountDangerSection', () => {
  beforeEach(() => {
    navigateToMock.mockReset()
    vi.stubGlobal('useLocalePath', () => (path: string) => `/en${path === '/' ? '' : path}`)
    vi.stubGlobal('useSupabase', () => ({
      auth: {
        signOut: vi.fn(async () => ({ error: null })),
      },
    }))
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        supabaseKey: 'anon-key',
        supabaseUrl: 'https://example.supabase.co/',
      },
    }))
    vi.stubGlobal('navigateTo', navigateToMock)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('URL', URL)
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('supprime le compte, deconnecte l utilisateur et redirige vers la home localisee', async () => {
    const wrapper = mount(AccountDangerSection, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
          AppEmoji: stubAppEmoji,
          PhSignOut: stubIcon,
          PhDownloadSimple: stubIcon,
          PhSpinnerGap: stubIcon,
          PhUserMinus: stubIcon,
        },
      },
    })

    await wrapper.findAll('button')[1].trigger('click')
    await wrapper.get('#delete-password-input').setValue('current-password')
    const buttons = wrapper.findAll('button')
    await buttons[3].trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/user-account-delete',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ current_password: 'current-password' }),
      }),
    )
    expect(navigateToMock).toHaveBeenCalledWith('/en')
  })
})
