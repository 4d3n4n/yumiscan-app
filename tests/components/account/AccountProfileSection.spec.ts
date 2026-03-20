import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AccountProfileSection from '../../../components/account/AccountProfileSection.vue'

const {
  updateUserMock,
  verifySupabasePasswordMock,
} = vi.hoisted(() => {
  const updateUserMock = vi.fn()
  const verifySupabasePasswordMock = vi.fn()

  return {
    updateUserMock,
    verifySupabasePasswordMock,
  }
})

vi.mock('../../../utils/supabase-auth', () => ({
  verifySupabasePassword: verifySupabasePasswordMock,
}))

const stubIcon = { template: '<span class="icon-stub"></span>' }

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'account.profile.default_user_name': 'User',
        'account.profile.member_free': 'FREE MEMBER',
        'account.profile.member_premium': 'PREMIUM MEMBER',
        'account.profile.lvl_scanner': `LVL ${params?.level ?? '1'} SCANNER`,
        'account.profile.email': 'Email',
        'account.profile.email_warning': 'Warning',
        'account.profile.new_email': 'New email',
        'account.profile.current_password': 'Current password',
        'account.profile.btn_cancel': 'Cancel',
        'account.profile.btn_change_email': 'Change email',
        'account.profile.btn_sending': 'Sending...',
        'account.profile.err_wrong_password_email': 'Incorrect password.',
        'account.profile.msg_email_success': `A confirmation email has been sent to ${params?.email ?? 'email'}.`,
        'account.profile.lbl_password': 'Password',
        'account.profile.old_password': 'Old password',
        'account.profile.new_password': 'New password',
        'account.profile.confirm_password': 'Confirm password',
        'account.profile.password_valid': 'Valid password',
        'account.profile.btn_save': 'Save',
        'account.profile.btn_saving': 'Saving...',
        'account.profile.err_wrong_old_password': 'The old password is incorrect.',
        'account.profile.msg_password_success': 'Password changed successfully',
      }

      return translations[key] ?? key
    },
  }),
}))

describe('AccountProfileSection', () => {
  beforeEach(() => {
    updateUserMock.mockReset()
    verifySupabasePasswordMock.mockReset()

    updateUserMock.mockResolvedValue({ error: null })
    verifySupabasePasswordMock.mockResolvedValue(true)

    vi.stubGlobal('useSupabase', () => ({
      auth: {
        updateUser: updateUserMock,
      },
    }))

    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        supabaseUrl: 'https://example.supabase.co',
        supabaseKey: 'anon-key',
      },
    }))
    vi.stubGlobal('useLocalePath', () => (path: string) => path)
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('verifie le mot de passe avant le changement d email et relache le loading', async () => {
    const wrapper = mount(AccountProfileSection, {
      props: {
        profile: { first_name: 'Adenan', last_name: 'Khachnane' },
        email: 'old@example.com',
      },
      global: {
        stubs: {
          PhPencilSimple: stubIcon,
          PhCheck: stubIcon,
          PhX: stubIcon,
          PhSpinnerGap: stubIcon,
          PhEye: stubIcon,
          PhEyeSlash: stubIcon,
          PhKey: stubIcon,
          PhCrown: stubIcon,
          PhEnvelope: stubIcon,
        },
      },
    })

    const emailCard = wrapper.findAll('.bold-card--static')[1]
    await emailCard.find('button').trigger('click')
    const inputs = emailCard.findAll('input')
    await inputs[0].setValue('new@example.com')
    await inputs[1].setValue('current-password')
    await emailCard.find('form').trigger('submit')
    await flushPromises()

    expect(verifySupabasePasswordMock).toHaveBeenCalledWith({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'anon-key',
      email: 'old@example.com',
      password: 'current-password',
    })
    expect(updateUserMock).toHaveBeenCalled()
    expect(updateUserMock.mock.calls[0]?.[0]).toEqual({ email: 'new@example.com' })
    expect(updateUserMock.mock.calls[0]?.[1]).toMatchObject({
      emailRedirectTo: expect.stringContaining('/auth/confirm'),
    })
    expect(wrapper.text()).toContain('A confirmation email has been sent to new@example.com.')
    expect(wrapper.text()).not.toContain('Sending...')
  })

  it('verifie le mot de passe avant le changement de mot de passe', async () => {
    const wrapper = mount(AccountProfileSection, {
      props: {
        profile: { first_name: 'Adenan', last_name: 'Khachnane' },
        email: 'old@example.com',
      },
      global: {
        stubs: {
          PhPencilSimple: stubIcon,
          PhCheck: stubIcon,
          PhX: stubIcon,
          PhSpinnerGap: stubIcon,
          PhEye: stubIcon,
          PhEyeSlash: stubIcon,
          PhKey: stubIcon,
          PhCrown: stubIcon,
          PhEnvelope: stubIcon,
        },
      },
    })

    const passwordCard = wrapper.findAll('.bold-card--static')[2]
    await passwordCard.find('button').trigger('click')
    const inputs = passwordCard.findAll('input')
    await inputs[0].setValue('old-pass')
    await inputs[1].setValue('Password123!')
    await inputs[2].setValue('Password123!')
    await passwordCard.find('form').trigger('submit')
    await flushPromises()

    expect(verifySupabasePasswordMock).toHaveBeenCalledWith({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'anon-key',
      email: 'old@example.com',
      password: 'old-pass',
    })
    expect(updateUserMock).toHaveBeenCalledWith({ password: 'Password123!' })
    expect(wrapper.text()).toContain('Password changed successfully')
  })
})
