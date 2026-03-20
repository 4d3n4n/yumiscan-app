function normalizePath(path: string) {
  return path.replace(/^\/(?:en|fr)(?=\/|$)/, '') || '/'
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

function isAppShellPath(path: string) {
  const normalizedPath = normalizePath(path)
  return normalizedPath === '/app' || normalizedPath.startsWith('/app/')
}

function shouldReduceTransition(fromPath: string, toPath: string) {
  return isAppShellPath(fromPath) !== isAppShellPath(toPath)
}

export default defineNuxtPlugin(() => {
  const router = useRouter()

  const applyTransition = (path: string, fromPath?: string) => {
    if (fromPath && shouldReduceTransition(fromPath, path)) {
      return {
        name: 'page-reduced',
        mode: 'default' as const,
      }
    }

    return {
      name: getPageTransitionName(path),
      mode: 'default' as const,
    }
  }

  router.beforeResolve((to, from) => {
    to.meta.pageTransition = applyTransition(to.path, from.path)
  })

  router.currentRoute.value.meta.pageTransition = applyTransition(router.currentRoute.value.path)
})
