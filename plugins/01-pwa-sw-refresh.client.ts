function runWhenBrowserIsIdle(task: () => void) {
  if (typeof window === 'undefined') return

  type IdleCapableWindow = Window &
    typeof globalThis & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    }

  const browserWindow = window as IdleCapableWindow

  if (typeof browserWindow.requestIdleCallback === 'function') {
    browserWindow.requestIdleCallback(() => task(), { timeout: 1500 })
    return
  }

  setTimeout(task, 250)
}

async function refreshServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update()
  } catch {
    // Ignore background update failures: this is only a resilience hint.
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server || !('serviceWorker' in navigator)) return

  nuxtApp.hook('app:mounted', () => {
    runWhenBrowserIsIdle(() => {
      void refreshServiceWorkerRegistration()
    })
  })
})
