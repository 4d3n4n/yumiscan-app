import * as Sentry from '@sentry/nuxt'
import { resolveSentryReporting } from '~/utils/sentry-reporting'
import { isExpectedError } from '~/utils/sentry-expected-errors'

const config = useRuntimeConfig()
const reporting = resolveSentryReporting({
  dsn: config.public.sentry?.dsn as string | undefined,
  environment: config.public.sentry?.environment as string | undefined,
  forceEnable: config.public.sentry?.forceEnable as boolean | undefined,
})

if (reporting.enabled) {
  Sentry.init({
    dsn: reporting.dsn,
    environment: reporting.environment,
    tracesSampleRate: 0,
    beforeSend(event, hint) {
      const err = hint.originalException
      if (isExpectedError(err)) return null
      setTagsFromRoute(event)
      return event
    },
  })
}

/** Tags dérivés de la route. Ne s’applique qu’aux erreurs capturées par Nuxt (client/SSR). Les Edge Functions Supabase sont un autre runtime → pas taguées ici (ajouter Sentry dans l’Edge Function + tag area: back si besoin). */
function setTagsFromRoute(event: { request?: { url?: string }; tags?: Record<string, unknown> }) {
  const url = event.request?.url
  if (!url) return
  try {
    const path = new URL(url, 'http://x').pathname
    const tags = { ...event.tags } as Record<string, string>
    tags.area = 'front'
    tags.route = path.slice(0, 100)
    event.tags = tags
  } catch {
    /* URL invalide : on ne modifie pas les tags */
  }
}
