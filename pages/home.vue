<script setup lang="ts">
import AuthGuardModal from '~/components/auth/AuthGuardModal.vue'
import { blogArticles } from '~/data/blog'
import { useI18n } from 'vue-i18n'

definePageMeta({ path: '/' })

const { user } = useAuth()
const { openScan } = useScanFlow()
const route = useRoute()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const showAuthModal = ref(false)

const handleScan = () => {
  if (!user.value) { showAuthModal.value = true; return }
  openScan()
}

const { t } = useI18n()

const siteUrl = ((config.public.appUrl as string) || 'https://yumiscan.com').replace(/\/$/, '')
const currentUrl = computed(() => `${siteUrl}${route.path}`)

useHead({
  title: computed(() => t('home.seo.title')),
  meta: [
    { name: 'description', content: computed(() => t('home.seo.description')) },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: currentUrl },
    { property: 'og:title', content: computed(() => t('home.seo.title')) },
    { property: 'og:description', content: computed(() => t('home.seo.description')) },
    { property: 'og:image', content: siteUrl + '/og-image.png' },
    { property: 'og:locale', content: computed(() => t('home.seo.og_locale')) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:url', content: currentUrl },
    { name: 'twitter:title', content: computed(() => t('home.seo.title')) },
    { name: 'twitter:description', content: computed(() => t('home.seo.description')) },
    { name: 'twitter:image', content: siteUrl + '/og-image.png' },
  ],
  link: [
    { rel: 'canonical', href: currentUrl },
  ],
  script: [
    {
      type: 'application/ld+json',
      textContent: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: 'YumiScan',
            url: siteUrl,
            description: t('home.seo.json_ld.website_desc'),
          },
          {
            '@type': 'SoftwareApplication',
            name: 'YumiScan',
            applicationCategory: 'HealthApplication',
            operatingSystem: 'Web',
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.4',
              ratingCount: '7'
            },
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'EUR',
              description: t('home.pricing.intro_spans.0'),
            },
            description: t('home.seo.description'),
          },
          {
            '@type': 'ItemList',
            name: t('home.seo.json_ld.item_list_name'),
            description: t('home.seo.json_ld.item_list_desc'),
            itemListElement: blogArticles.slice(0, 3).map((a, i) => {
              const articlePath = localePath(`/blog/${a.slug}`)

              return {
                '@type': 'ListItem',
                position: i + 1,
                url: `${siteUrl}${articlePath}`,
                name: t(`blog.articles.${a.slug}.title`),
              }
            }),
          },
          {
            '@type': 'FAQPage',
            mainEntity: Array.from({ length: 11 }).map((_, i) => ({
              '@type': 'Question',
              name: t(`home.seo.json_ld.faq_q${i + 1}`),
              acceptedAnswer: {
                '@type': 'Answer',
                text: t(`home.seo.json_ld.faq_a${i + 1}`)
              }
            })),
          },
        ],
      })),
    },
  ],
})
</script>

<template>
  <div class="min-h-screen flex flex-col pt-0 pb-24 md:pt-20 md:pb-safe bg-background">
    <main id="main-content" class="flex-1 container mx-auto px-4 pt-0 pb-8 md:py-8 max-w-lg relative">
      <div class="space-y-14">
        <HomeIntro @scan="handleScan" />
        <HomeHowItWorks />
        <HomeMarquee />
        <HomeFeatures />
        <HomeReviews />
        <HomePricing />
        <HomeBlogSection />
        <HomeFaq />
        <AppFooter />
      </div>
    </main>

    <AuthGuardModal :open="showAuthModal" :redirect-to="localePath('/')" @close="showAuthModal = false" />
  </div>
</template>
