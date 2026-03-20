import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppNavigation from '../../../components/app/AppNavigation.vue'

const { getAuthenticatedSessionMock } = vi.hoisted(() => ({
  getAuthenticatedSessionMock: vi.fn(),
}))

vi.mock('~/assets/css/navigation.module.css', () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}))

vi.mock('~/utils/supabase-auth', () => ({
  getAuthenticatedSession: getAuthenticatedSessionMock,
}))

vi.mock('~/components/auth/AuthGuardModal.vue', () => ({
  default: {
    name: 'AuthGuardModal',
    props: ['open', 'redirectTo'],
    template: '<div class="auth-guard-modal" :data-open="String(open)" :data-redirect="redirectTo" />',
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

const navigateToMock = vi.fn()
const routerPush = vi.fn()
const routerReplace = vi.fn()
const signOutMock = vi.fn()
const authUser = ref<null | { id: string }>(null)
const authInitialized = ref(true)
const authLoading = ref(false)
const authStatus = ref<'authenticated' | 'unauthenticated' | 'unknown'>('unauthenticated')
const isAdminRef = ref(false)
const getSessionMock = vi.fn()
const preloadRouteComponentsMock = vi.fn()
const fetchPricingOffersMock = vi.fn()

const route = reactive({
  path: '/en/blog',
  query: {} as Record<string, unknown>,
  hash: '',
  name: 'blog',
})

const stubNuxtLink = {
  name: 'NuxtLink',
  props: ['to'],
  template: '<a :href="to" :class="$attrs.class"><slot /></a>',
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../../..')

describe('AppNavigation', () => {
  beforeEach(() => {
    vi.resetModules()
    navigateToMock.mockReset()
    routerReplace.mockReset()
    signOutMock.mockReset()

    route.path = '/en/blog'
    route.query = {}
    route.hash = ''
    route.name = 'blog'
    authUser.value = null
    authInitialized.value = true
    authLoading.value = false
    authStatus.value = 'unauthenticated'
    isAdminRef.value = false
    getSessionMock.mockReset()
    getSessionMock.mockResolvedValue({ data: { session: null } })
    getAuthenticatedSessionMock.mockReset()
    getAuthenticatedSessionMock.mockResolvedValue(null)
    routerPush.mockReset()
    preloadRouteComponentsMock.mockReset()
    fetchPricingOffersMock.mockReset()

    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('onMounted', onMounted)
    vi.stubGlobal('onUnmounted', onUnmounted)
    vi.stubGlobal('nextTick', nextTick)
    vi.stubGlobal('useRoute', () => route)
    vi.stubGlobal('useRouter', () => ({ replace: routerReplace, push: routerPush }))
    vi.stubGlobal('useLocalePath', () => (path: string) => (path === '/' ? '/en' : `/en${path}`))
    vi.stubGlobal('useSupabase', () => ({ auth: { getSession: getSessionMock } }))
    vi.stubGlobal('useAuth', () => ({
      user: authUser,
      signOut: signOutMock,
      initialized: authInitialized,
      loading: authLoading,
      authStatus,
    }))
    vi.stubGlobal('useAdmin', () => ({ isAdmin: isAdminRef }))
    vi.stubGlobal('useCredits', () => ({ hasDailyCredit: ref(false), isLowCredits: ref(false) }))
    vi.stubGlobal('usePricingOffersPublic', () => ({ fetchPricingOffers: fetchPricingOffersMock }))
    vi.stubGlobal('useActiveScanRecovery', () => ({ markControlledScanExit: vi.fn() }))
    vi.stubGlobal('useDarkMode', () => ({ isDark: ref(false), toggle: vi.fn(), init: vi.fn() }))
    vi.stubGlobal('navigateTo', navigateToMock)
    vi.stubGlobal('preloadRouteComponents', preloadRouteComponentsMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ouvre la modale auth avec une redirection localisée vers le dashboard', async () => {
    const wrapper = mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')

    const modal = wrapper.find('.auth-guard-modal')
    expect(modal.attributes('data-open')).toBe('true')
    expect(modal.attributes('data-redirect')).toBe('/en/app/dashboard')
  }, 10000)

  it('utilise seulement la session locale au clic si l auth globale n est pas encore prête', async () => {
    authInitialized.value = false
    authLoading.value = true
    authStatus.value = 'unknown'
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    })
    getAuthenticatedSessionMock.mockResolvedValue({ user: { id: 'user-1' } })

    const wrapper = mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    expect(getAuthenticatedSessionMock).toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith('/en/app/dashboard')
  })

  it('n attend pas de lecture locale si un user hydratait deja l auth', async () => {
    authInitialized.value = true
    authLoading.value = false
    authStatus.value = 'unknown'
    authUser.value = { id: 'user-1' }

    const wrapper = mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')

    expect(getSessionMock).not.toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith('/en/app/dashboard')
  })

  it('redirige vers la page pricing localisée', async () => {
    const wrapper = mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    const pricingButton = wrapper.findAll('button')[0]
    await pricingButton.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/en/pricing')
  })

  it('redirige aussi vers la page pricing depuis la home', async () => {
    route.path = '/en'
    route.name = 'home'
    route.hash = ''

    const wrapper = mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    const pricingButton = wrapper.findAll('button')[0]
    await pricingButton.trigger('click')
    await nextTick()

    expect(routerPush).toHaveBeenCalledWith('/en/pricing')
  })

  it('prechauffe la page pricing quand la navigation est montee sur une route app', async () => {
    route.path = '/en/app/dashboard'
    route.name = 'app-dashboard'

    mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    await nextTick()

    expect(preloadRouteComponentsMock).toHaveBeenCalledWith('/en/pricing')
    expect(fetchPricingOffersMock).toHaveBeenCalled()
  })

  it('prechauffe aussi les offres pricing quand on est deja dans l espace app', async () => {
    route.path = '/en/app/account'
    route.name = 'app-account'

    mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    await nextTick()

    expect(fetchPricingOffersMock).toHaveBeenCalled()
  })

  it('prechauffe la route admin pour les comptes admin meme depuis les pages publiques', async () => {
    isAdminRef.value = true
    route.path = '/en'
    route.name = 'home'

    mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    await nextTick()

    expect(preloadRouteComponentsMock).toHaveBeenCalledWith('/en/app/admin')
    expect(preloadRouteComponentsMock).toHaveBeenCalledWith('/en/app/admin/users')
    expect(preloadRouteComponentsMock).toHaveBeenCalledWith('/en/app/admin/settings')
  })

  it('consomme le query auth=1 et nettoie l’URL locale', async () => {
    route.path = '/en'
    route.query = { auth: '1', redirect: '/en/app/dashboard' }
    route.name = 'home'

    const wrapper = mount(AppNavigation, {
      global: {
        stubs: {
          NuxtLink: stubNuxtLink,
        },
      },
    })

    await nextTick()

    const modal = wrapper.find('.auth-guard-modal')
    expect(modal.attributes('data-open')).toBe('true')
    expect(modal.attributes('data-redirect')).toBe('/en/app/dashboard')
    expect(routerReplace).toHaveBeenCalledWith({ path: '/en', query: {} })
  })

  it('stabilise l etat actif home pendant l hydration quand le hash pricing n existe pas cote SSR', () => {
    const source = readFileSync(resolve(rootDir, 'components/app/AppNavigation.vue'), 'utf8')

    expect(source).toContain("const pricingPath = computed(() => localePath('/pricing'))")
    expect(source).toContain('const isHomeActive = computed(() => route.path === homePath.value)')
    expect(source).toContain('const isPricingActive = computed(() => route.path === pricingPath.value)')
    expect(source).toContain('await router.push(pricingPath.value)')
    expect(source).toContain("if (href === '/') return isHomeActive.value")
  })
})
