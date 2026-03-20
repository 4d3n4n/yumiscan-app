<script setup lang="ts">
import { PhArrowLeft } from '@phosphor-icons/vue'
import { blogArticles } from '~/data/blog'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const config = useRuntimeConfig()

const siteUrl = ((config.public.appUrl as string) || 'https://yumiscan.com').replace(/\/$/, '')
const title = computed(() => `${t('blog.title')} — YumiScan`)
const description = computed(() => t('blog.index.subtitle'))
const currentUrl = computed(() => `${siteUrl}${route.path}`)

useHead({
  title: computed(() => title.value),
  meta: [
    { name: 'description', content: computed(() => description.value) },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: currentUrl },
    { property: 'og:title', content: computed(() => title.value) },
    { property: 'og:description', content: computed(() => description.value) },
    { property: 'og:image', content: siteUrl + '/og-image.png' },
    { property: 'og:locale', content: computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US')) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: computed(() => title.value) },
    { name: 'twitter:description', content: computed(() => description.value) },
  ],
  link: [
    { rel: 'canonical', href: currentUrl },
  ],
  script: [
    {
      type: 'application/ld+json',
      textContent: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: title.value,
        description: description.value,
        url: currentUrl.value,
        publisher: { '@type': 'Organization', name: 'YumiScan', url: siteUrl },
        blogPost: blogArticles.map((a) => ({
          '@type': 'BlogPosting',
          headline: t(`blog.articles.${a.slug}.title`),
          url: `${siteUrl}${localePath(`/blog/${a.slug}`)}`,
          datePublished: a.date,
          description: t(`blog.articles.${a.slug}.excerpt`),
        })),
      })),
    },
  ],
})
</script>

<template>
  <div class="min-h-screen flex flex-col pt-0 pb-24 md:pt-20 md:pb-safe bg-background">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 md:py-10 max-w-4xl">
      <NuxtLink
        :to="localePath('/')"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground font-medium hover:text-foreground mb-6 transition-colors"
      >
        <PhArrowLeft :size="16" weight="bold" />
        {{ t('blog.index.back_home') }}
      </NuxtLink>

      <h1 class="text-2xl md:text-3xl font-black font-heading tracking-tight mb-2">
        {{ t('blog.index.title') }}
      </h1>
      <p class="text-muted-foreground font-medium mb-8">
        {{ t('blog.index.subtitle') }}
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <BlogArticleCard
          v-for="article in blogArticles"
          :key="article.slug"
          :article="article"
        />
      </div>

      <AppFooter />
    </main>
  </div>
</template>
