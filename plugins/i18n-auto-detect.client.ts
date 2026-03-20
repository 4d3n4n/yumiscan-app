import type { LocationQueryRaw, RouteLocationRaw, RouteParamsRawGeneric, Router } from 'vue-router'
import { detectPreferredLocale, hasExplicitLocalePrefix, type SupportedLocale } from '~/utils/locale-detection'

function buildLocalizedRouteTarget(
  route: {
    name?: string | symbol | null
    path: string
    params: Record<string, unknown>
    query: Record<string, unknown>
    hash: string
  },
  targetLocale: SupportedLocale,
): RouteLocationRaw {
  if (typeof route.name === 'string') {
    const localizedName = route.name.replace(/___[a-z]{2}$/i, `___${targetLocale}`)
    if (localizedName !== route.name) {
      return {
        name: localizedName,
        params: route.params as RouteParamsRawGeneric,
        query: route.query as LocationQueryRaw,
        hash: route.hash,
      }
    }
  }

  if (targetLocale === 'en') {
    return {
      path: route.path === '/' ? '/en' : `/en${route.path}`,
      query: route.query as LocationQueryRaw,
      hash: route.hash,
    }
  }

  return {
    path: route.path.replace(/^\/en(?=\/|$)/, '') || '/',
    query: route.query as LocationQueryRaw,
    hash: route.hash,
  }
}

export default defineNuxtPlugin(async (nuxtApp) => {
  const router = nuxtApp.$router as Router
  const route = router.currentRoute.value
  const localeCookie = useCookie<SupportedLocale | null>('i18n_redirected')
  const supportedLocales: SupportedLocale[] = ['fr', 'en']
  const prefixedLocales = supportedLocales.filter((code) => code !== 'fr')

  if (localeCookie.value) {
    return
  }

  if (hasExplicitLocalePrefix(route.path, prefixedLocales)) {
    localeCookie.value = 'en'
    return
  }

  const detectedLocale = detectPreferredLocale(
    typeof navigator !== 'undefined' ? navigator.languages : undefined,
    'fr',
  )

  localeCookie.value = detectedLocale

  if (detectedLocale === 'fr') {
    return
  }

  await router.replace(buildLocalizedRouteTarget(route, detectedLocale))
})
