<script setup lang="ts">
import { getArticleBySlug } from '~/data/blog'
import BlogSignupCta from '~/components/blog/BlogSignupCta.vue'
import AppFooter from '~/components/AppFooter.vue'
import { useI18n } from 'vue-i18n'
const { t, tm, rt, locale } = useI18n()
const route = useRoute()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const slug = route.params.slug as string
const article = getArticleBySlug(slug)

if (!article) {
  throw createError({ statusCode: 404, message: t('blog.article_not_found') })
}

const siteUrl = ((config.public.appUrl as string) || 'https://yumiscan.com').replace(/\/$/, '')
const articleUrl = computed(() => `${siteUrl}${route.path}`)
const articleImage = article.image.startsWith('http') ? article.image : siteUrl + article.image
const title = computed(() => `${t(`blog.articles.${slug}.metaTitle`)} — YumiScan`)
const description = computed(() => t(`blog.articles.${slug}.metaDescription`))

useHead({
  title: computed(() => title.value),
  meta: [
    { name: 'description', content: computed(() => description.value) },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: articleUrl },
    { property: 'og:title', content: computed(() => title.value) },
    { property: 'og:description', content: computed(() => description.value) },
    { property: 'og:image', content: articleImage },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'article:published_time', content: article.date },
    { property: 'article:author', content: 'YumiScan' },
    { property: 'og:locale', content: computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US')) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: computed(() => title.value) },
    { name: 'twitter:description', content: computed(() => description.value) },
    { name: 'twitter:image', content: articleImage },
  ],
  link: [
    { rel: 'canonical', href: articleUrl },
  ],
  script: [
    {
      type: 'application/ld+json',
      textContent: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: t(`blog.articles.${slug}.title`),
        description: description.value,
        image: articleImage,
        datePublished: article.date,
        dateModified: article.date,
        author: { '@type': 'Organization', name: 'YumiScan', url: siteUrl },
        publisher: {
          '@type': 'Organization',
          name: 'YumiScan',
          url: siteUrl,
          logo: { '@type': 'ImageObject', url: siteUrl + '/og-image.png' },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl.value },
      })),
    },
    {
      type: 'application/ld+json',
      textContent: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('common.nav.home'), item: `${siteUrl}${localePath('/')}` },
          { '@type': 'ListItem', position: 2, name: t('blog.index.title'), item: `${siteUrl}${localePath('/blog')}` },
          { '@type': 'ListItem', position: 3, name: t(`blog.articles.${slug}.title`), item: articleUrl.value },
        ],
      })),
    },
  ],
})

const H2_PREFIX = '## '
const resolveTranslationEntry = (entry: unknown): string => rt(entry as Parameters<typeof rt>[0])

const getOrderedParagraphs = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(resolveTranslationEntry)
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => {
        const leftIndex = Number.parseInt(left.replace(/\D+/g, ''), 10)
        const rightIndex = Number.parseInt(right.replace(/\D+/g, ''), 10)
        return leftIndex - rightIndex
      })
      .map(([, entry]) => resolveTranslationEntry(entry))
  }
  return []
}

const bodyBlocks = computed(() => {
  return getOrderedParagraphs(tm(`blog.articles.${slug}.body`)).map((rawContent) => {
    const isH2 = rawContent.startsWith(H2_PREFIX)
    return {
      type: isH2 ? ('h2' as const) : ('p' as const),
      content: isH2 ? rawContent.slice(H2_PREFIX.length).trim() : rawContent,
    }
  })
})
</script>

<template>
  <div class="min-h-screen flex flex-col pt-0 pb-24 md:pt-20 md:pb-safe bg-background">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 md:py-10 max-w-2xl">
      <NuxtLink
        :to="$localePath('/blog')"
        class="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
      >
        ← {{ t('blog.index.back_blog') }}
      </NuxtLink>

      <article>
        <div class="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--bold-radius)] mb-6" style="border: 2px solid var(--bold-border-color); box-shadow: var(--bold-shadow-sm);">
          <img
            :src="article.image"
            :alt="t(`blog.articles.${slug}.title`)"
            class="h-full w-full object-cover"
            width="1200"
            height="630"
            fetchpriority="high"
          />
        </div>

        <h1 class="text-2xl md:text-3xl font-black font-heading tracking-tight mb-4">
          {{ t(`blog.articles.${slug}.title`) }}
        </h1>

        <div class="flex items-center gap-3 text-sm text-muted-foreground font-medium mb-6">
          <time :datetime="article.date">
            {{ new Date(article.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) }}
          </time>
          <span>·</span>
          <span>{{ article.readTime }} {{ t('common.time.min_read') }}</span>
        </div>

        <div class="prose-blog space-y-4 text-foreground font-medium leading-relaxed">
          <template v-for="(block, i) in bodyBlocks" :key="i">
            <h2 v-if="block.type === 'h2'" class="blog-h2">
              {{ block.content }}
            </h2>
            <p v-else class="text-[0.9375rem]">
              {{ block.content }}
            </p>
          </template>
        </div>

        <BlogSignupCta />
      </article>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.blog-h2 {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.35;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--foreground);
  font-family: var(--font-heading, inherit);
  letter-spacing: -0.02em;
}
.blog-h2:first-child {
  margin-top: 0;
}
</style>
