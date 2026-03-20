<script setup lang="ts">
import SmartScanSignupCta from '~/components/marketing/SmartScanSignupCta.vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const route = useRoute()

const siteUrl = ((config.public.appUrl as string) || 'https://yumiscan.com').replace(/\/$/, '')
const canonicalUrl = computed(() => `${siteUrl}${route.path}`)

useHead({
  title: computed(() => t('about.meta_title')),
  meta: [
    { name: 'description', content: computed(() => t('about.meta_description')) },
    { property: 'og:title', content: computed(() => t('about.meta_title')) },
    { property: 'og:description', content: computed(() => t('about.meta_description')) },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:locale', content: computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US')) },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: computed(() => t('about.meta_title')) },
    { name: 'twitter:description', content: computed(() => t('about.meta_description')) },
  ],
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
})

const audienceKeys = ['1', '2', '3', '4'] as const
const principlesKeys = ['1', '2', '3', '4'] as const
</script>

<template>
  <div class="min-h-screen flex flex-col pt-0 pb-24 md:pt-20 md:pb-safe bg-background">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 md:py-10 max-w-3xl">
      <NuxtLink
        :to="localePath('/')"
        class="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
      >
        ← {{ t('blog.index.back_home') }}
      </NuxtLink>

      <section class="bold-card--static p-6 md:p-8 mb-6" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-primary mb-3">{{ t('about.hero_badge') }}</p>
        <h1 class="text-3xl md:text-4xl font-black font-heading tracking-tight text-foreground mb-4">{{ t('about.title') }}</h1>
        <p class="text-base md:text-lg text-muted-foreground font-medium leading-relaxed mb-4">{{ t('about.subtitle') }}</p>
        <p class="text-sm md:text-base text-foreground/90 font-medium leading-relaxed">{{ t('about.hero_intro') }}</p>
      </section>

      <section class="space-y-6">
        <div class="bold-card--static p-5 md:p-6" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <h2 class="text-xl font-black font-heading tracking-tight mb-3">{{ t('about.story_title') }}</h2>
          <div class="space-y-3 text-sm md:text-base text-muted-foreground font-medium leading-relaxed">
            <p>{{ t('about.story_p1') }}</p>
            <p>{{ t('about.story_p2') }}</p>
            <p>{{ t('about.story_p3') }}</p>
          </div>
        </div>

        <div class="bold-card--static p-5 md:p-6" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <h2 class="text-xl font-black font-heading tracking-tight mb-3">{{ t('about.mission_title') }}</h2>
          <div class="space-y-3 text-sm md:text-base text-muted-foreground font-medium leading-relaxed">
            <p>{{ t('about.mission_p1') }}</p>
            <p>{{ t('about.mission_p2') }}</p>
          </div>
        </div>

        <div class="bold-card--static p-5 md:p-6" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <h2 class="text-xl font-black font-heading tracking-tight mb-3">{{ t('about.founder_title') }}</h2>
          <div class="space-y-3 text-sm md:text-base text-muted-foreground font-medium leading-relaxed">
            <p>{{ t('about.founder_p1') }}</p>
            <p>{{ t('about.founder_p2') }}</p>
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="bold-card--static p-5 md:p-6" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
            <h2 class="text-lg font-black font-heading tracking-tight mb-3">{{ t('about.audience_title') }}</h2>
            <ul class="space-y-2 text-sm text-muted-foreground font-medium leading-relaxed">
              <li v-for="key in audienceKeys" :key="key">• {{ t(`about.audience_items.${key}`) }}</li>
            </ul>
          </div>

          <div class="bold-card--static p-5 md:p-6" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
            <h2 class="text-lg font-black font-heading tracking-tight mb-3">{{ t('about.principles_title') }}</h2>
            <ul class="space-y-2 text-sm text-muted-foreground font-medium leading-relaxed">
              <li v-for="key in principlesKeys" :key="key">• {{ t(`about.principles_items.${key}`) }}</li>
            </ul>
          </div>
        </div>

        <div class="bold-card--static p-5 md:p-6" style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
          <h2 class="text-lg font-black font-heading tracking-tight mb-3">{{ t('about.reassurance_title') }}</h2>
          <p class="text-sm md:text-base text-muted-foreground font-medium leading-relaxed">{{ t('about.reassurance_p1') }}</p>
        </div>

        <SmartScanSignupCta translation-base="about.cta" />
      </section>

      <AppFooter />
    </main>
  </div>
</template>
