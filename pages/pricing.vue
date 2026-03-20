<script setup lang="ts">
import { PhCards, PhShieldCheck, PhSparkle } from '@phosphor-icons/vue'
import PaymentMethodsMarquee from '~/components/pricing/PaymentMethodsMarquee.vue'
import homeSections from '~/assets/css/home-sections.module.css'
import { useI18n } from 'vue-i18n'

definePageMeta({ path: '/pricing' })

const { t } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()

const siteUrl = ((config.public.appUrl as string) || 'https://yumiscan.com').replace(/\/$/, '')
const currentUrl = computed(() => `${siteUrl}${route.path}`)

useHead({
  title: computed(() => t('pricing_page.seo.title')),
  meta: [
    { name: 'description', content: computed(() => t('pricing_page.seo.description')) },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: currentUrl },
    { property: 'og:title', content: computed(() => t('pricing_page.seo.title')) },
    { property: 'og:description', content: computed(() => t('pricing_page.seo.description')) },
    { property: 'og:image', content: siteUrl + '/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:url', content: currentUrl },
    { name: 'twitter:title', content: computed(() => t('pricing_page.seo.title')) },
    { name: 'twitter:description', content: computed(() => t('pricing_page.seo.description')) },
    { name: 'twitter:image', content: siteUrl + '/og-image.png' },
  ],
  link: [
    { rel: 'canonical', href: currentUrl },
  ],
})
</script>

<template>
  <div class="min-h-screen flex flex-col pt-0 pb-24 md:pt-20 md:pb-safe mt-6 bg-background">
    <main id="main-content" class="flex-1 container mx-auto px-4 pt-0 pb-8 md:py-8 max-w-lg relative">
      <div class="space-y-14">
        <section class="bold-card--static p-5 md:p-6">
          <p class="text-[0.75rem] font-black uppercase tracking-[0.14em] text-primary mb-3">
            {{ t('pricing_page.hero.eyebrow') }}
          </p>
          <h1 class="font-heading text-[2rem] leading-[0.95] font-black tracking-tight text-foreground">
            {{ t('pricing_page.hero.title') }}
          </h1>
          <p class="text-sm md:text-[0.95rem] leading-relaxed text-muted-foreground font-medium mt-3 max-w-[34rem]">
            {{ t('pricing_page.hero.description') }}
          </p>

          <div class="flex flex-wrap gap-2 mt-5">
            <span class="bold-pill bold-pill--primary">
              <PhSparkle :size="10" weight="fill" />
              <span>{{ t('pricing_page.hero.pill_1') }}</span>
            </span>
            <span class="bold-pill bold-pill--outline">
              <PhShieldCheck :size="10" weight="fill" />
              <span>{{ t('pricing_page.hero.pill_2') }}</span>
            </span>
            <span class="bold-pill bold-pill--muted">
              <PhCards :size="10" weight="fill" />
              <span>{{ t('pricing_page.hero.pill_3') }}</span>
            </span>
          </div>
        </section>

        <HomePricing :show-payment-summary="false" />

        <section class="bold-card--static p-5 md:p-6">
          <h2 :class="homeSections.sectionTitle">{{ t('pricing_page.payments.title') }}</h2>
          <p class="text-sm leading-relaxed text-muted-foreground font-medium -mt-2 mb-5">
            {{ t('pricing_page.payments.description') }}
          </p>

          <PaymentMethodsMarquee />

          <p class="text-xs font-semibold text-muted-foreground mt-4">
            {{ t('pricing_page.payments.note') }}
          </p>
        </section>

        <HomeFaq />
        <AppFooter />
      </div>
    </main>
  </div>
</template>
