<script setup lang="ts">
import { PhUser, PhSignOut, PhHouse, PhScan, PhCreditCard, PhSun, PhMoon, PhShieldCheck } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
import navStyles from '~/assets/css/navigation.module.css'
import AuthGuardModal from '~/components/auth/AuthGuardModal.vue'
import { getAuthenticatedSession } from '~/utils/supabase-auth'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const localePath = useLocalePath()
const homePath = computed(() => localePath('/'))
const pricingPath = computed(() => localePath('/pricing'))
const adminPath = computed(() => localePath('/app/admin'))
const adminUsersPath = computed(() => localePath('/app/admin/users'))
const adminSettingsPath = computed(() => localePath('/app/admin/settings'))
const { user, signOut, initialized, loading: authLoading, authStatus } = useAuth()
const supabase = useSupabase()
const { isAdmin } = useAdmin()
const { hasDailyCredit, isLowCredits } = useCredits()
const { fetchPricingOffers } = usePricingOffersPublic({ immediate: false, ssr: false })
const { markControlledScanExit } = useActiveScanRecovery()
const { isDark, toggle: toggleTheme, init: initTheme } = useDarkMode()
const isScrolled = ref(false)
const showAuthModal = ref(false)
const authModalRedirect = ref('')
const navigationPending = ref(false)
const isScanPage = computed(() => route.name ? String(route.name).includes('app-scan-id') : false)
const isHomeActive = computed(() => route.path === homePath.value)
const isPricingActive = computed(() => route.path === pricingPath.value)
const warmedPaths = new Set<string>()

function normalizePath(path: string) {
  return path.replace(/^\/(?:en|fr)(?=\/|$)/, '') || '/'
}

function warmAdminRoutes() {
  for (const path of [adminPath.value, adminUsersPath.value, adminSettingsPath.value]) {
    void warmRoute(path)
  }
}

async function warmRoute(path: string) {
  if (typeof window === 'undefined' || typeof preloadRouteComponents !== 'function') return
  if (warmedPaths.has(path)) return

  warmedPaths.add(path)

  try {
    await preloadRouteComponents(path)
  } catch {
    warmedPaths.delete(path)
    // Best-effort warmup only.
  }
}

onMounted(() => {
  initTheme()
  const handleScroll = () => { isScrolled.value = window.scrollY > 20 }
  window.addEventListener('scroll', handleScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', handleScroll))
})

watch(
  () => ({ path: route.path, auth: route.query.auth, redirect: route.query.redirect }),
  async (curr) => {
    if (curr.path === homePath.value && curr.auth === '1' && typeof curr.redirect === 'string') {
      authModalRedirect.value = curr.redirect
      showAuthModal.value = true
      await router.replace({ path: homePath.value, query: {} })
    }
  },
  { immediate: true }
)

watch(
  () => route.path,
  (path) => {
    const normalizedPath = normalizePath(path)
    if (normalizedPath === '/app' || normalizedPath.startsWith('/app/')) {
      void warmRoute(pricingPath.value)
      void fetchPricingOffers()
    }
  },
  { immediate: true },
)

watch(
  () => [isAdmin.value, route.path] as const,
  ([isAdminUser, path]) => {
    if (!isAdminUser) return

    const normalizedPath = normalizePath(path)
    if (normalizedPath.startsWith('/app/admin')) return

    warmAdminRoutes()
  },
  { immediate: true },
)

const isActive = (href: string) => {
  const localizedPath = localePath(href)
  if (href === '/') return isHomeActive.value
  if (href === '/app/dashboard') {
    return route.path.startsWith(localePath('/app/dashboard')) || isScanPage.value
  }
  if (href === '/app/admin') return route.path.startsWith(localePath('/app/admin'))
  return route.path.startsWith(localizedPath)
}

const handleSignOut = async () => {
  if (isScanPage.value) {
    markControlledScanExit()
  }
  await signOut()
}

function buildAuthRedirect(path: string) {
  return localePath(path)
}

function openAuthPrompt(path: string) {
  const authRedirect = buildAuthRedirect(path)
  const isOnAuthPage = route.path === localePath('/login') || route.path === localePath('/forgot-password')

  if (isOnAuthPage) {
    void navigateTo(localePath('/') + '?auth=1&redirect=' + encodeURIComponent(authRedirect))
    return
  }

  authModalRedirect.value = authRedirect
  showAuthModal.value = true
}

async function runSingleNavigation(task: () => Promise<void>) {
  if (navigationPending.value) return

  navigationPending.value = true
  try {
    await task()
  } finally {
    navigationPending.value = false
  }
}

const guardRoute = async (path: string) => {
  await runSingleNavigation(async () => {
    if (isScanPage.value) {
      markControlledScanExit()
    }

    const localizedPath = localePath(path)

    if (user.value || authStatus.value === 'authenticated') {
      await router.push(localizedPath)
      return
    }

    if (authStatus.value === 'unauthenticated' || (initialized.value && !authLoading.value && !user.value)) {
      openAuthPrompt(path)
      return
    }

    const session = await getAuthenticatedSession(supabase)
    if (session?.user) {
      await router.push(localizedPath)
      return
    }

    openAuthPrompt(path)
  })
}

const handlePricing = () => {
  void runSingleNavigation(async () => {
    if (isScanPage.value) {
      markControlledScanExit()
    }

    void warmRoute(pricingPath.value)
    void fetchPricingOffers()
    if (route.path === pricingPath.value) {
      return
    }

    await router.push(pricingPath.value)
  })
}

const handleHomeNavigation = () => {
  if (isScanPage.value) {
    markControlledScanExit()
  }
}

const handleAdminNavigation = () => {
  if (isScanPage.value) {
    markControlledScanExit()
  }

  warmAdminRoutes()
}
</script>

<template>
  <div :class="navStyles.headerContainer">
    <div :class="navStyles.mobileBackdrop" aria-hidden="true" />
    <div :class="navStyles.headerContent">
      <header :class="[navStyles.header, isScrolled ? navStyles.scrolled : '']">
        <div :class="navStyles.section2Container">
          <div :class="navStyles.section2">
            <NuxtLink
              :to="localePath('/')"
              active-class=""
              exact-active-class=""
              :class="[navStyles.circularButton, isActive('/') ? navStyles.circularButtonActive : '']"
              :aria-label="t('common.nav.home')"
              @click="handleHomeNavigation"
            >
              <div v-if="isActive('/')" :class="navStyles.iconPill" />
              <PhHouse :class="navStyles.circularButtonIcon" :weight="isActive('/') ? 'fill' : 'regular'" />
            </NuxtLink>

            <button
              :class="[navStyles.circularButton, isPricingActive ? navStyles.circularButtonActive : '']"
              :aria-label="t('common.nav.pricing')"
              @click="handlePricing"
            >
              <div v-if="isPricingActive" :class="navStyles.iconPill" />
              <PhCreditCard :class="navStyles.circularButtonIcon" :weight="isPricingActive ? 'fill' : 'regular'" />
            </button>

            <button
              :class="[navStyles.circularButton, isActive('/app/dashboard') ? navStyles.circularButtonActive : '']"
              :aria-label="t('common.nav.scans')"
              @click="guardRoute('/app/dashboard')"
            >
              <div v-if="isActive('/app/dashboard')" :class="navStyles.iconPill" />
              <PhScan :class="navStyles.circularButtonIcon" :weight="isActive('/app/dashboard') ? 'fill' : 'regular'" />
              <span
                v-if="user && hasDailyCredit && !isActive('/app/dashboard')"
                class="absolute -top-0.5 -right-0.5 z-20 flex items-center justify-center w-4 h-4 text-[10px] font-black text-white rounded-full"
                style="background: hsl(var(--primary)); border: 1.5px solid hsl(var(--card));"
              >1</span>
            </button>

            <button
              :class="[navStyles.circularButton, isActive('/app/account') ? navStyles.circularButtonActive : '']"
              :aria-label="t('common.nav.account')"
              @click="guardRoute('/app/account')"
            >
              <div v-if="isActive('/app/account')" :class="navStyles.iconPill" />
              <PhUser :class="navStyles.circularButtonIcon" :weight="isActive('/app/account') ? 'fill' : 'regular'" />
              <span
                v-if="user && isLowCredits && !isActive('/app/account')"
                class="absolute -top-0.5 -right-0.5 z-20 flex items-center justify-center w-4 h-4 text-[10px] font-black text-white rounded-full"
                style="background: hsl(38 95% 45%); border: 1.5px solid hsl(var(--card));"
              >!</span>
            </button>

            <NuxtLink
              v-if="isAdmin"
              :to="localePath('/app/admin')"
              :class="[navStyles.circularButton, isActive('/app/admin') ? navStyles.circularButtonActive : '']"
              :aria-label="t('common.nav.admin')"
              @click="handleAdminNavigation"
            >
              <div v-if="isActive('/app/admin')" :class="navStyles.iconPill" />
              <PhShieldCheck :class="navStyles.circularButtonIcon" :weight="isActive('/app/admin') ? 'fill' : 'regular'" />
            </NuxtLink>

            <button v-if="user" :aria-label="t('common.nav.signout')" :class="navStyles.circularButton" @click="handleSignOut">
              <PhSignOut :class="navStyles.circularButtonIcon" weight="regular" />
            </button>
            <button
              :class="navStyles.themeToggle"
              :aria-label="isDark ? t('common.nav.light_mode') : t('common.nav.dark_mode')"
              @click="toggleTheme"
            >
              <PhSun v-if="isDark" :class="navStyles.themeToggleIcon" weight="bold" />
              <PhMoon v-else :class="navStyles.themeToggleIcon" weight="bold" />
            </button>
          </div>
        </div>
      </header>
    </div>
  </div>

  <AuthGuardModal
    :open="showAuthModal"
    :redirect-to="authModalRedirect"
    @close="showAuthModal = false"
  />
</template>
