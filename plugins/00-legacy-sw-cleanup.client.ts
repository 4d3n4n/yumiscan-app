const LEGACY_SW_CLEANUP_MARKER = 'legacy-sw-cleanup:v2'
const LEGACY_SW_RELOAD_MARKER = 'legacy-sw-cleanup:reloaded'
const CURRENT_SW_PATH = '/sw.js'

function isAuthConfirmPath(pathname: string) {
  return pathname === '/auth/confirm' || pathname === '/en/auth/confirm'
}

function isAuthConfirmRecoveryCandidate(url: URL) {
  if (!isAuthConfirmPath(url.pathname)) return false

  const hasCallbackToken = url.searchParams.has('code')
    || url.searchParams.has('token_hash')
    || url.hash.includes('token_hash=')
    || url.hash.includes('code=')
    || url.searchParams.has('type')

  const isKnownMissingTokenError = url.searchParams.get('status') === 'error'
    && (url.searchParams.get('message') ?? '').includes('Missing auth callback token')

  return hasCallbackToken || isKnownMissingTokenError
}

function getCanonicalCurrentSwUrl() {
  return new URL(CURRENT_SW_PATH, globalThis.window.location.origin).toString()
}

function resolveRegistrationScriptUrl(registration: ServiceWorkerRegistration) {
  return registration.active?.scriptURL
    ?? registration.waiting?.scriptURL
    ?? registration.installing?.scriptURL
    ?? ''
}

type ServiceWorkerCleanupResult = {
  removedLegacy: boolean
  refreshedCurrent: boolean
}

async function cleanupLegacyServiceWorkers(): Promise<ServiceWorkerCleanupResult> {
  if (!('serviceWorker' in navigator) || !('caches' in globalThis)) {
    return { removedLegacy: false, refreshedCurrent: false }
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  if (registrations.length === 0) {
    return { removedLegacy: false, refreshedCurrent: false }
  }

  const currentSwUrl = getCanonicalCurrentSwUrl()
  let removedLegacy = false
  let currentRegistration: ServiceWorkerRegistration | null = null

  for (const registration of registrations) {
    const scriptUrl = resolveRegistrationScriptUrl(registration)
    const isWorkboxLike = scriptUrl.includes('/sw.js') || scriptUrl.includes('workbox')
    if (!isWorkboxLike) continue

    if (scriptUrl === currentSwUrl) {
      currentRegistration = registration
      continue
    }

    removedLegacy = (await registration.unregister()) || removedLegacy
  }

  if (removedLegacy) {
    const cacheKeys = await caches.keys()
    await Promise.all(cacheKeys
      .filter(key => /workbox|precache|runtime/i.test(key))
      .map(key => caches.delete(key)))

    return { removedLegacy: true, refreshedCurrent: false }
  }

  if (currentRegistration) {
    try {
      await currentRegistration.update()
      return { removedLegacy: false, refreshedCurrent: true }
    } catch {
      return { removedLegacy: false, refreshedCurrent: false }
    }
  }

  return { removedLegacy: false, refreshedCurrent: false }
}

export default defineNuxtPlugin(async () => {
  if (import.meta.server) return
  if (!('serviceWorker' in navigator)) return

  const url = new URL(globalThis.window.location.href)
  if (!isAuthConfirmRecoveryCandidate(url)) return

  if (sessionStorage.getItem(LEGACY_SW_CLEANUP_MARKER) === 'done') return

  const cleanupResult = await cleanupLegacyServiceWorkers()
  sessionStorage.setItem(LEGACY_SW_CLEANUP_MARKER, 'done')

  if (!cleanupResult.removedLegacy && !cleanupResult.refreshedCurrent) return
  if (sessionStorage.getItem(LEGACY_SW_RELOAD_MARKER) === '1') return

  sessionStorage.setItem(LEGACY_SW_RELOAD_MARKER, '1')
  globalThis.window.location.replace(url.toString())
})
