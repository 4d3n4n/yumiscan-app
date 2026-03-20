function normalizePath(path?: string) {
  return path?.replace(/^\/(?:en|fr)(?=\/|$)/, '') || '/'
}

export default {
  scrollBehavior(
    to: { hash?: string; path?: string },
    from: { hash?: string; path?: string },
    savedPosition: { left: number; top: number } | null,
  ) {
    if (savedPosition) {
      return savedPosition
    }

    if (to.hash) {
      const samePageHashNavigation = normalizePath(to.path) === normalizePath(from.path)
      return {
        el: to.hash,
        top: 0,
        behavior: samePageHashNavigation ? 'smooth' as const : 'auto' as const,
      }
    }

    return { left: 0, top: 0 }
  },
}
