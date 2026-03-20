const VIEW_TRANSITION_CLASS = 'view-transitions-enabled'
const PAGE_FINISH_TIMEOUT_MS = 1400

function normalizePath(path: string) {
  return path.replace(/^\/(?:en|fr)(?=\/|$)/, '') || '/'
}

function isAppShellPath(path: string) {
  const normalizedPath = normalizePath(path)
  return normalizedPath === '/app' || normalizedPath.startsWith('/app/')
}

function getPageTransitionName(path: string) {
  const normalizedPath = normalizePath(path)

  if (normalizedPath.startsWith('/app/admin')) return 'page-reduced'
  if (normalizedPath.startsWith('/auth/confirm')) return 'page-reduced'
  if (normalizedPath.startsWith('/forgot-password')) return 'page-reduced'
  if (normalizedPath.startsWith('/app/scan/')) return 'page-reduced'
  if (normalizedPath.startsWith('/app/')) return 'page-app'
  if (normalizedPath.startsWith('/login') || normalizedPath.startsWith('/signup')) return 'page-soft'
  return 'page-public'
}

function getViewTransitionKind(toPath: string, fromPath: string) {
  const enteringApp = isAppShellPath(toPath)
  const leavingApp = isAppShellPath(fromPath)

  if (enteringApp && !leavingApp) return 'push-app'
  if (!enteringApp && leavingApp) return 'pop-public'

  return getPageTransitionName(toPath)
}

function shouldDisableViewTransitions() {
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

  return isIOS || isStandalone
}

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server || typeof document.startViewTransition !== 'function') return

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (prefersReducedMotion.matches || shouldDisableViewTransitions()) return

  const html = document.documentElement
  const router = useRouter()
  let resolvePendingFinish: (() => void) | null = null
  let pendingFinishTimer: number | null = null

  const resetPendingFinish = () => {
    if (pendingFinishTimer !== null) {
      window.clearTimeout(pendingFinishTimer)
      pendingFinishTimer = null
    }

    if (resolvePendingFinish) {
      const resolve = resolvePendingFinish
      resolvePendingFinish = null
      resolve()
    }

    html.removeAttribute('data-route-transition')
  }

  const waitForPageFinish = () => new Promise<void>((resolve) => {
    resolvePendingFinish = () => {
      if (pendingFinishTimer !== null) {
        window.clearTimeout(pendingFinishTimer)
        pendingFinishTimer = null
      }

      resolvePendingFinish = null
      resolve()
    }

    pendingFinishTimer = window.setTimeout(() => {
      if (resolvePendingFinish) {
        const finish = resolvePendingFinish
        resolvePendingFinish = null
        pendingFinishTimer = null
        finish()
      }
    }, PAGE_FINISH_TIMEOUT_MS)
  })

  html.classList.add(VIEW_TRANSITION_CLASS)

  prefersReducedMotion.addEventListener?.('change', (event) => {
    if (event.matches) {
      resetPendingFinish()
      html.classList.remove(VIEW_TRANSITION_CLASS)
      return
    }

    html.classList.add(VIEW_TRANSITION_CLASS)
  })

  nuxtApp.hook('page:finish', resetPendingFinish)
  router.onError(resetPendingFinish)
  router.afterEach((_to, _from, failure) => {
    if (failure) resetPendingFinish()
  })

  router.beforeResolve((to, from) => {
    if (
      prefersReducedMotion.matches
      || to.fullPath === from.fullPath
      || normalizePath(to.path) === normalizePath(from.path)
    ) {
      resetPendingFinish()
      return
    }

    resetPendingFinish()
    html.dataset.routeTransition = getViewTransitionKind(to.path, from.path)
    const pageFinishPromise = waitForPageFinish()

    return new Promise<void>((resolveNavigation) => {
      try {
        document.startViewTransition(async () => {
          resolveNavigation()
          await pageFinishPromise
        }).finished.finally(() => {
          if (!resolvePendingFinish) {
            html.removeAttribute('data-route-transition')
          }
        })
      } catch {
        resetPendingFinish()
        resolveNavigation()
      }
    })
  })
})
