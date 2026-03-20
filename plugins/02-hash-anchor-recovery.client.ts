import { scrollToHashTarget } from '~/utils/hash-scroll'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  const router = useRouter()
  const localePath = useLocalePath()

  function normalizePath(path?: string) {
    return path?.replace(/^\/(?:en|fr)(?=\/|$)/, '') || '/'
  }

  nuxtApp.hook('page:finish', () => {
    const currentRoute = router.currentRoute.value
    const hash = currentRoute.hash
    if (!hash) return

    if (hash === '#pricing' && normalizePath(currentRoute.path) === '/') {
      void router.replace(localePath('/pricing'))
      return
    }

    requestAnimationFrame(() => {
      void scrollToHashTarget(hash)
    })
  })
})
