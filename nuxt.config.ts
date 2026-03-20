import { createRequire } from 'node:module'
import { buildSecurityHeaders } from './utils/security-headers'

const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version?: string }
const isDev = process.env.NODE_ENV === 'development'
const publicAppUrl = (process.env.SITE_URL ?? 'https://yumiscan.com').replace(/\/$/, '')
const sentryBuildAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim() ?? ''
const sentryBuildOrg = process.env.SENTRY_ORG?.trim() ?? ''
const sentryBuildProject = process.env.SENTRY_PROJECT?.trim() ?? ''
const hasSentrySourceMapsUploadConfig = Boolean(
  sentryBuildAuthToken && sentryBuildOrg && sentryBuildProject,
)
const sentryModuleConfig = isDev
  ? {}
  : {
      sentry: {
        enabled: true,
        authToken: hasSentrySourceMapsUploadConfig ? sentryBuildAuthToken : undefined,
        org: hasSentrySourceMapsUploadConfig ? sentryBuildOrg : undefined,
        project: hasSentrySourceMapsUploadConfig ? sentryBuildProject : undefined,
        telemetry: false,
        sourcemaps: {
          // Only enable release/source map upload when the full build-time config is present.
          disable: !hasSentrySourceMapsUploadConfig,
        },
      },
    }
const securityHeaders = buildSecurityHeaders({
  isDev,
  supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  sentryDsn: process.env.NUXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
})

export default defineNuxtConfig({
  ssr: true,

  experimental: {
    appManifest: false,
  },

  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/google-fonts',
    '@vite-pwa/nuxt',
    // Keep local dev stable: Sentry server auto-injection is handled only outside `nuxt dev`.
    ...(isDev ? [] : ['@sentry/nuxt/module']),
    '@nuxtjs/sitemap',
    '@nuxtjs/i18n',
  ],

  i18n: {
    langDir: 'locales',
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    customRoutes: 'config',
    pages: {
      'a-propos': {
        en: '/about-us',
        fr: '/a-propos'
      },
      'cgv': {
        en: '/terms-of-sale',
        fr: '/cgv'
      },
      'confidentialite': {
        en: '/privacy',
        fr: '/confidentialite'
      },
      'mentions-legales': {
        en: '/legal',
        fr: '/mentions-legales'
      },
      'avertissement-sante': {
        en: '/health-warning',
        fr: '/avertissement-sante'
      }
    },
    locales: [
      {
        code: 'fr',
        iso: 'fr-FR',
        name: 'Français',
        files: [
          'fr/common.json',
          'fr/home.json',
          'fr/pricing.json',
          'fr/onboarding.json',
          'fr/auth.json',
          'fr/scan.json',
          'fr/account.json',
          'fr/legal.json',
          'fr/blog.json',
          'fr/about.json'
        ]
      },
      {
        code: 'en',
        iso: 'en-US',
        name: 'English',
        files: [
          'en/common.json',
          'en/home.json',
          'en/pricing.json',
          'en/onboarding.json',
          'en/auth.json',
          'en/scan.json',
          'en/account.json',
          'en/legal.json',
          'en/blog.json',
          'en/about.json'
        ]
      }
    ],
  },

  site: {
    url: publicAppUrl,
    name: 'YumiScan',
  },

  app: {
    pageTransition: {
      name: 'page-public',
      mode: 'default',
    },
    layoutTransition: {
      name: 'layout-soft',
      mode: 'default',
    },
    head: {
      title: 'YumiScan — Scannez les étiquettes japonaises et détectez vos allergènes',
      htmlAttrs: { lang: 'fr' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'theme-color', content: '#7c3aed' },
        {
          name: 'description',
          content: "YumiScan détecte les allergènes dans vos produits grâce à l'IA. Scannez les étiquettes japonaises, identifiez gluten, soja, œufs et plus. 3 scans gratuits à l'inscription.",
        },
        { name: 'robots', content: 'index, follow' },
        { name: 'author', content: 'YumiScan' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'fr_FR' },
        { property: 'og:site_name', content: 'YumiScan' },
        { property: 'og:title', content: 'YumiScan — Scannez les étiquettes japonaises et détectez vos allergènes' },
        { property: 'og:description', content: "Scannez les étiquettes japonaises, l'IA détecte vos allergènes en quelques secondes. Gluten, soja, œufs, crustacés et plus." },
        { property: 'og:image', content: `${publicAppUrl}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:url', content: `${publicAppUrl}/` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'YumiScan — Scannez les étiquettes japonaises et détectez vos allergènes' },
        { name: 'twitter:description', content: "Scannez les étiquettes japonaises, l'IA détecte vos allergènes en quelques secondes." },
        { name: 'twitter:image', content: `${publicAppUrl}/og-image.png` },
      ],
      link: [
        { rel: 'icon', href: '/images/logos/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/images/logos/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/images/logos/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/images/logos/apple-touch-icon.png' },
      ],
    },
  },

  googleFonts: {
    families: {
      Manrope: [400, 500, 600, 700, 800, 900],
      'Space+Grotesk': [400, 500, 600, 700],
    },
    display: 'swap',
  },

  css: [
    '~/assets/css/globals.css',
    '~/assets/css/scan-theme.css',
  ],

  pwa: {
    registerType: 'autoUpdate',
    workbox: {
      navigateFallback: null,
      runtimeCaching: [
        {
          urlPattern: /\/_nuxt\/.*\.(?:js|css)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'assets-chunks',
            expiration: {
              maxEntries: 96,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
        {
          urlPattern: /\/images\/.+\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'public-images',
            expiration: {
              maxEntries: 120,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
        {
          urlPattern: /\/(?:manifest\.webmanifest|favicon\.ico)$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'app-manifest',
            expiration: {
              maxEntries: 24,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'google-fonts-stylesheets',
            expiration: {
              maxEntries: 8,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-webfonts',
            cacheableResponse: {
              statuses: [0, 200],
            },
            expiration: {
              maxEntries: 16,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
          },
        },
      ],
    },
    manifest: {
      name: 'YumiScan',
      short_name: 'YumiScan',
      description: "Détectez les allergènes dans vos produits grâce à l'IA",
      theme_color: '#7c3aed',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: '/images/logos/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/images/logos/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/images/logos/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      /** Version de l'app (package.json), visible dans le footer en prod. */
      appVersion: pkg?.version ?? process.env.npm_package_version ?? '0.0.0',
      supabaseUrl: '',
      supabaseKey: '',
      /** URL de l’app (ex. https://yumiscan.com en prod). Même valeur que SITE_URL : réinit mot de passe + Stripe. */
      appUrl: publicAppUrl,
      stripePublishableKey: '',
      gaId: '',
      metaPixelId: '',
      tiktokPixelId: '',
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN ?? '',
        environment: process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT ?? '',
        forceEnable: process.env.SENTRY_FORCE_ENABLE === 'true',
      },
    },
  },

  routeRules: {
    '/**': { headers: securityHeaders },
    '/app/food-scan': { redirect: '/' },
    '/app/**': { ssr: false },
    // Page de test Sentry : en prod, rediriger vers la home (optionnel)
    // '/example-error': { redirect: '/' },
  },

  compatibilityDate: '2025-01-01',

  ...sentryModuleConfig,
})
