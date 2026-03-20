import { init } from '@sentry/node'
import { resolveSentryReporting } from '~/utils/sentry-reporting'
import { isExpectedError } from '~/utils/sentry-expected-errors'

const reporting = resolveSentryReporting({
  dsn: process.env.SENTRY_DSN ?? process.env.NUXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT,
  forceEnable: process.env.SENTRY_FORCE_ENABLE,
})

if (reporting.enabled) {
  init({
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

/** Tags dérivés de la route. Ne s’applique qu’aux erreurs Nuxt (SSR). Le back en Edge Functions n’est pas vu ici. */
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
