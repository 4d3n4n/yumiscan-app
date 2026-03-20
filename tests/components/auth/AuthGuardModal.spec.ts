import { computed, nextTick, reactive, watch } from 'vue'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthGuardModal from '../../../components/auth/AuthGuardModal.vue'

vi.mock('~/utils/emojis', () => ({
  APP_EMOJI: {
    login: 'login',
  },
  EMOJI_MAP: {
    login: '/emoji-login.png',
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.guard.title': 'Login required',
        'auth.guard.description': 'Please log in to continue.',
        'auth.guard.create_account': 'Create account',
        'common.cancel': 'Cancel',
      }

      return translations[key] ?? key
    },
  }),
}))

const routerPush = vi.fn()
const navigateToMock = vi.fn()
const routeState = reactive({ fullPath: '/en' })

const stubAuthLoginForm = {
  name: 'AuthLoginForm',
  props: ['redirectTo'],
  emits: ['success', 'forgotPassword'],
  template: `
    <div>
      <span class="redirect-target">{{ redirectTo }}</span>
      <button class="login-success" @click="$emit('success', redirectTo)">success</button>
      <button class="forgot-password" @click="$emit('forgotPassword')">forgot</button>
    </div>
  `,
}

describe('AuthGuardModal', () => {
  beforeEach(() => {
    vi.resetModules()
    routerPush.mockReset()
    navigateToMock.mockReset()
    vi.stubGlobal('useLocalePath', () => (path: string) => (path === '/' ? '/en' : `/en${path}`))
    vi.stubGlobal('useRouter', () => ({ push: routerPush }))
    vi.stubGlobal('useRoute', () => routeState)
    vi.stubGlobal('navigateTo', navigateToMock)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('watch', watch)
    routeState.fullPath = '/en'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('injecte une redirection localisée par défaut vers le dashboard', async () => {
    const wrapper = mount(AuthGuardModal, {
      props: { open: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          AuthLoginForm: stubAuthLoginForm,
        },
      },
    })

    expect(wrapper.find('.redirect-target').text()).toBe('/en/app/dashboard')
  }, 10000)

  it('redirige vers signup avec un redirect localisé encodé', async () => {
    const wrapper = mount(AuthGuardModal, {
      props: { open: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          AuthLoginForm: stubAuthLoginForm,
        },
      },
    })

    await wrapper.find('button.bold-btn').trigger('click')

    expect(navigateToMock).toHaveBeenCalledWith('/en/signup?redirect=%2Fen%2Fapp%2Fdashboard')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('ferme la modale et pousse la route reçue au succès du login', async () => {
    const wrapper = mount(AuthGuardModal, {
      props: { open: true, redirectTo: '/en/app/account' },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          AuthLoginForm: stubAuthLoginForm,
        },
      },
    })

    await wrapper.find('.login-success').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/en/app/account')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('ferme la modale sur changement de route', async () => {
    const wrapper = mount(AuthGuardModal, {
      props: { open: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
          AuthLoginForm: stubAuthLoginForm,
        },
      },
    })

    routeState.fullPath = '/en/forgot-password?redirect=%2Fen'
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
