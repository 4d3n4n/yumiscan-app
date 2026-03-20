const DEV_SW_RESET_MARKER = 'dev-sw-reset:v1'

export default defineNuxtPlugin(async () => {
  if (import.meta.server || !import.meta.dev) return
  if (!('serviceWorker' in navigator) || !('caches' in globalThis)) return
  if (sessionStorage.getItem(DEV_SW_RESET_MARKER) === 'done') return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(registration => registration.unregister()))

    const cacheKeys = await caches.keys()
    await Promise.all(
      cacheKeys
        .filter(key => /workbox|precache|runtime|assets-chunks|public-images|app-manifest/i.test(key))
        .map(key => caches.delete(key)),
    )
  } catch {
    // Ignore dev-only service worker cleanup failures.
  } finally {
    sessionStorage.setItem(DEV_SW_RESET_MARKER, 'done')
  }
})
