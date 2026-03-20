export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const { consent } = useCookieConsent()

  const loaded = { ga: false, meta: false, tiktok: false }

  function injectScript(id: string, src: string) {
    if (document.getElementById(id)) return
    const s = document.createElement('script')
    s.id = id
    s.async = true
    s.src = src
    document.head.appendChild(s)
  }

  function removeScript(id: string) {
    document.getElementById(id)?.remove()
  }

  function loadGA(measurementId: string) {
    if (loaded.ga || !measurementId) return
    injectScript('ga-gtag', `https://www.googletagmanager.com/gtag/js?id=${measurementId}`)
    window.dataLayer = window.dataLayer || []
    function gtag(...args: any[]) { window.dataLayer.push(args) }
    gtag('js', new Date())
    gtag('config', measurementId, { anonymize_ip: true })
    loaded.ga = true
  }

  function loadMetaPixel(pixelId: string) {
    if (loaded.meta || !pixelId) return
    /* eslint-disable */
    ;(function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }
      if (!f._fbq) f._fbq = n
      n.push = n; n.loaded = !0; n.version = '2.0'
      n.queue = []
      t = b.createElement(e); t.async = !0; t.src = v
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    /* eslint-enable */
    window.fbq('init', pixelId)
    window.fbq('track', 'PageView')
    loaded.meta = true
  }

  function loadTikTokPixel(pixelId: string) {
    if (loaded.tiktok || !pixelId) return
    /* eslint-disable */
    ;(function (w: any, d: any, t: string) {
      w.TiktokAnalyticsObject = t
      const ttq = w[t] = w[t] || []
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie']
      ttq.setAndDefer = function (t: any, e: string) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i])
      ttq.instance = function (t: string) {
        const e = ttq._i[t] || []
        for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n])
        return e
      }
      ttq.load = function (e: string, n?: any) {
        const i = 'https://analytics.tiktok.com/i18n/pixel/events.js'
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i; ttq._t = ttq._t || {}; ttq._t[e] = +new Date()
        ttq._o = ttq._o || {}; ttq._o[e] = n || {}
        const o = d.createElement('script'); o.type = 'text/javascript'; o.async = true; o.src = i + '?sdkid=' + e + '&lib=' + t
        const a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(o, a)
      }
      ttq.load(pixelId)
      ttq.page()
    })(window, document, 'ttq')
    /* eslint-enable */
    loaded.tiktok = true
  }

  watch(consent, (val) => {
    if (!val) return

    const gaId = config.public.gaId as string
    const metaPixelId = config.public.metaPixelId as string
    const tiktokPixelId = config.public.tiktokPixelId as string

    if (val.analytics) {
      loadGA(gaId)
    } else {
      removeScript('ga-gtag')
      loaded.ga = false
    }

    if (val.ads) {
      loadMetaPixel(metaPixelId)
      loadTikTokPixel(tiktokPixelId)
    } else {
      loaded.meta = false
      loaded.tiktok = false
    }
  }, { immediate: true })
})

declare global {
  interface Window {
    dataLayer: any[]
    fbq: (...args: any[]) => void
    _fbq: any
    TiktokAnalyticsObject: string
    ttq: any
  }
}
