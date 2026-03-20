<script setup lang="ts">
import { PhArrowLeft } from '@phosphor-icons/vue'
import { companyField } from '~/utils/company-config'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { data: companyConfig } = await useCompanyConfig()

useHead({
  title: computed(() => t('legal.privacy.meta_title')),
})

const lastUpdate = computed(() =>
  new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date('2026-02-24T00:00:00Z'))
)

const dataCardKeys = [
  'data_account',
  'data_preferences',
  'data_images',
  'data_results',
  'data_payment',
  'data_consent',
] as const

const providerItems = [
  { key: 'provider_supabase', url: 'https://supabase.com/privacy' },
  { key: 'provider_google', url: 'https://policies.google.com/privacy' },
  { key: 'provider_stripe', url: 'https://stripe.com/privacy' },
  { key: 'provider_vercel', url: 'https://vercel.com/legal/privacy-policy' },
] as const

const cookieItems = [
  { titleKey: 'cookie_necessary', descKey: 'cookie_necessary_desc' },
  { titleKey: 'cookie_analytics', descKey: 'cookie_analytics_desc' },
  { titleKey: 'cookie_ads', descKey: 'cookie_ads_desc' },
] as const

const rightItems = [
  { titleKey: 'right_access', descKey: 'right_access_desc' },
  { titleKey: 'right_rectification', descKey: 'right_rectification_desc' },
  { titleKey: 'right_erasure', descKey: 'right_erasure_desc' },
  { titleKey: 'right_restriction', descKey: 'right_restriction_desc' },
  { titleKey: 'right_portability', descKey: 'right_portability_desc' },
  { titleKey: 'right_objection', descKey: 'right_objection_desc' },
  { titleKey: 'right_withdraw', descKey: 'right_withdraw_desc' },
] as const

const companyName = computed(() => companyField(companyConfig.value.company_name) ?? 'YumiScan')
const companyCountry = computed(() => companyField(companyConfig.value.company_country))
const contactPath = computed(() => companyConfig.value.contact_page_path || '/contact')
</script>

<template>
  <div class="min-h-screen flex flex-col pt-0 pb-24 md:pt-20 md:pb-safe bg-background">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 max-w-2xl">
      <NuxtLink
        :to="localePath('/')"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground font-medium hover:text-foreground mb-6 transition-colors"
      >
        <PhArrowLeft :size="16" weight="bold" />
        {{ t('blog.index.back_home') }}
      </NuxtLink>

      <div class="mb-8">
        <h1 class="text-2xl font-black font-heading tracking-tight mb-2">{{ t('legal.privacy.title') }}</h1>
        <p class="text-xs text-muted-foreground font-medium">{{ t('legal.privacy.subtitle', { date: lastUpdate }) }}</p>
      </div>

      <div class="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art1_title') }}</h2>
          <div class="bold-card--static p-4 space-y-1">
            <p><strong class="text-foreground">{{ t('legal.privacy.entity') }}</strong> {{ companyName }}</p>
            <p v-if="companyCountry"><strong class="text-foreground">{{ t('legal.privacy.country') }}</strong> {{ companyCountry }}</p>
            <p><strong class="text-foreground">{{ t('legal.privacy.contact') }}</strong> <NuxtLink :to="localePath(contactPath)" class="text-primary underline">{{ t('common.footer.links.contact') }}</NuxtLink></p>
          </div>
          <p class="mt-3">{{ t('legal.privacy.art1_p1') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art2_title') }}</h2>
          <p class="mb-3">{{ t('legal.privacy.art2_p1') }}</p>
          <div class="space-y-3">
            <div
              v-for="cardKey in dataCardKeys"
              :key="cardKey"
              class="bold-card--static p-4"
            >
              <p class="font-semibold text-foreground text-sm mb-2">{{ t(`legal.privacy.${cardKey}.title`) }}</p>
              <ul class="space-y-1 text-xs">
                <li><strong class="text-foreground">{{ t('legal.privacy.data_account.data') }}</strong> {{ t(`legal.privacy.${cardKey}.data_val`) }}</li>
                <li><strong class="text-foreground">{{ t('legal.privacy.data_account.purpose') }}</strong> {{ t(`legal.privacy.${cardKey}.purpose_val`) }}</li>
                <li><strong class="text-foreground">{{ t('legal.privacy.data_account.legal_basis') }}</strong> {{ t(`legal.privacy.${cardKey}.legal_basis_val`) }}</li>
                <li><strong class="text-foreground">{{ t('legal.privacy.data_account.retention') }}</strong> {{ t(`legal.privacy.${cardKey}.retention_val`) }}</li>
                <li v-if="cardKey === 'data_images'"><strong class="text-foreground">{{ t('legal.privacy.data_images.access') }}</strong> {{ t('legal.privacy.data_images.access_val') }}</li>
                <li v-if="cardKey === 'data_payment'"><strong class="text-foreground">{{ t('legal.privacy.data_payment.note') }}</strong> {{ t('legal.privacy.data_payment.note_val') }}</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art3_title') }}</h2>
          <p class="mb-3">{{ t('legal.privacy.art3_p1') }}</p>
          <div class="space-y-3">
            <div
              v-for="provider in providerItems"
              :key="provider.key"
              class="bold-card--static p-4"
            >
              <p class="font-semibold text-foreground text-xs mb-1">{{ t(`legal.privacy.${provider.key}`) }}</p>
              <p class="text-xs">
                {{ t(`legal.privacy.${provider.key}_desc`) }}
                <a :href="provider.url" target="_blank" rel="noopener noreferrer" class="text-primary underline ml-1">
                  {{ provider.url.replace(/^https?:\/\//, '') }}
                </a>
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art4_title') }}</h2>
          <p>{{ t('legal.privacy.art4_p1') }}</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.privacy.art4_l1') }}</li>
            <li>{{ t('legal.privacy.art4_l2') }}</li>
          </ul>
          <p class="mt-3">{{ t('legal.privacy.art4_p2') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art5_title') }}</h2>
          <p>{{ t('legal.privacy.art5_p1') }}</p>
          <div class="mt-3 space-y-2">
            <div
              v-for="cookie in cookieItems"
              :key="cookie.titleKey"
              class="bold-card--static p-3"
            >
              <p class="font-semibold text-foreground text-xs">{{ t(`legal.privacy.${cookie.titleKey}`) }}</p>
              <p class="text-xs mt-1">{{ t(`legal.privacy.${cookie.descKey}`) }}</p>
            </div>
          </div>
          <p class="mt-3">{{ t('legal.privacy.art5_p2') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art6_title') }}</h2>
          <p>{{ t('legal.privacy.art6_p1') }}</p>
          <ul class="mt-3 space-y-2">
            <li
              v-for="right in rightItems"
              :key="right.titleKey"
              class="flex items-start gap-2"
            >
              <span class="text-primary font-bold mt-0.5 shrink-0">→</span>
              <span><strong class="text-foreground">{{ t(`legal.privacy.${right.titleKey}`) }}</strong>{{ t(`legal.privacy.${right.descKey}`) }}</span>
            </li>
          </ul>
          <p class="mt-4">{{ t('legal.privacy.art6_p2') }}</p>
          <p class="mt-3">{{ t('legal.privacy.art6_p3') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art7_title') }}</h2>
          <p>{{ t('legal.privacy.art7_p1') }}</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.privacy.art7_l1') }}</li>
            <li>{{ t('legal.privacy.art7_l2') }}</li>
            <li>{{ t('legal.privacy.art7_l3') }}</li>
            <li>{{ t('legal.privacy.art7_l4') }}</li>
            <li>{{ t('legal.privacy.art7_l5') }}</li>
          </ul>
          <p class="mt-3">{{ t('legal.privacy.art7_p2') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.privacy.art8_title') }}</h2>
          <p>{{ t('legal.privacy.art8_p1') }}</p>
        </section>

        <p class="text-xs text-muted-foreground border-t border-border pt-4">
          {{ t('legal.privacy.footer', { date: lastUpdate }) }}
        </p>
      </div>

      <AppFooter />
    </main>
  </div>
</template>
