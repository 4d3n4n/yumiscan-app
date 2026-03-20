<script setup lang="ts">
import { PhArrowLeft } from '@phosphor-icons/vue'
import { companyField } from '~/utils/company-config'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const config = useRuntimeConfig()
const route = useRoute()
const { data: companyConfig } = await useCompanyConfig()

const siteUrl = ((config.public.appUrl as string) || 'https://yumiscan.com').replace(/\/$/, '')
const canonicalUrl = computed(() => `${siteUrl}${route.path}`)
const contactPath = computed(() => companyConfig.value.contact_page_path || '/contact')

useHead({
  title: computed(() => t('terms.meta_title')),
  meta: [
    { name: 'description', content: computed(() => t('terms.meta_description')) },
    { property: 'og:title', content: computed(() => t('terms.meta_title')) },
    { property: 'og:description', content: computed(() => t('terms.meta_description')) },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:locale', content: computed(() => (locale.value === 'fr' ? 'fr_FR' : 'en_US')) },
  ],
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
})

const companyName = computed(() => companyField(companyConfig.value.company_name) ?? 'YumiScan')
const legalEntityName = computed(() => companyField(companyConfig.value.legal_entity_name))
const companyAddress = computed(() => companyField(companyConfig.value.company_address))
const companyCountry = computed(() => companyField(companyConfig.value.company_country))
const companySiret = computed(() => companyField(companyConfig.value.company_siret))
const publicationDirector = computed(() => companyField(companyConfig.value.publication_director))
const vatNumber = computed(() => companyField(companyConfig.value.vat_number))
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
        <h1 class="text-2xl font-black font-heading tracking-tight mb-2">{{ t('terms.title') }}</h1>
        <p class="text-sm text-muted-foreground font-medium">{{ t('terms.subtitle') }}</p>
      </div>

      <div class="space-y-8 text-sm text-muted-foreground leading-relaxed">
        <section>
          <div class="bold-card--static p-4" style="border-left: 3px solid hsl(var(--primary));">
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-primary mb-2">{{ t('terms.intro_badge') }}</p>
            <p class="text-foreground font-semibold text-sm">{{ t('terms.intro_notice') }}</p>
          </div>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.company_title') }}</h2>
          <div class="bold-card--static p-4 space-y-1">
            <p><strong class="text-foreground">{{ t('terms.company_name_label') }} :</strong> {{ companyName }}</p>
            <p v-if="legalEntityName"><strong class="text-foreground">{{ t('terms.legal_entity_label') }} :</strong> {{ legalEntityName }}</p>
            <p v-if="companyAddress"><strong class="text-foreground">{{ t('terms.address_label') }} :</strong> {{ companyAddress }}</p>
            <p v-if="companyCountry"><strong class="text-foreground">{{ t('terms.country_label') }} :</strong> {{ companyCountry }}</p>
            <p v-if="companySiret"><strong class="text-foreground">{{ t('terms.siret_label') }} :</strong> {{ companySiret }}</p>
            <p v-if="vatNumber"><strong class="text-foreground">{{ t('terms.vat_label') }} :</strong> {{ vatNumber }}</p>
            <p v-if="publicationDirector"><strong class="text-foreground">{{ t('terms.publication_director_label') }} :</strong> {{ publicationDirector }}</p>
            <p>
              <strong class="text-foreground">{{ t('terms.contact_label') }} :</strong>
              <NuxtLink :to="localePath(contactPath)" class="text-primary underline ml-1">
                {{ t('common.footer.links.contact') }}
              </NuxtLink>
            </p>
          </div>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.credit_offer_title') }}</h2>
          <p>{{ t('terms.credit_offer_p1') }}</p>
          <p class="mt-3">{{ t('terms.credit_offer_p2') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.payment_title') }}</h2>
          <p>{{ t('terms.payment_p1') }}</p>
          <p class="mt-3">{{ t('terms.payment_p2') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.credits_title') }}</h2>
          <p>{{ t('terms.credits_p1') }}</p>
          <p class="mt-3">{{ t('terms.credits_p2') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.refund_title') }}</h2>
          <p>{{ t('terms.refund_p1') }}</p>
          <p class="mt-3">{{ t('terms.refund_p2') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.liability_title') }}</h2>
          <p>{{ t('terms.liability_p1') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.support_title') }}</h2>
          <p>{{ t('terms.support_p1') }}</p>
        </section>

        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('terms.law_title') }}</h2>
          <p>{{ t('terms.law_p1') }}</p>
        </section>

        <p class="text-xs text-muted-foreground border-t border-border pt-4">
          {{ t('terms.footer') }}
        </p>
      </div>

      <AppFooter />
    </main>
  </div>
</template>
