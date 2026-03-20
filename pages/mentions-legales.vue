<script setup lang="ts">
import { PhArrowLeft } from '@phosphor-icons/vue'
import { companyField } from '~/utils/company-config'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const localePath = useLocalePath()
const { data: companyConfig } = await useCompanyConfig()

useHead({
  title: computed(() => `${t('legal.mentions.title')} - YumiScan`),
})

const companyName = computed(() => companyField(companyConfig.value.company_name) ?? 'YumiScan')
const legalEntityName = computed(() => companyField(companyConfig.value.legal_entity_name))
const companyAddress = computed(() => companyField(companyConfig.value.company_address))
const companyCountry = computed(() => companyField(companyConfig.value.company_country))
const publicationDirector = computed(() => companyField(companyConfig.value.publication_director))
const companySiret = computed(() => companyField(companyConfig.value.company_siret))
const vatNumber = computed(() => companyField(companyConfig.value.vat_number))
const contactPath = computed(() => companyConfig.value.contact_page_path || '/contact')
</script>

<template>
  <div class="min-h-screen flex flex-col pt-0 pb-24 md:pt-20 md:pb-safe bg-background">
    <main id="main-content" class="flex-1 container mx-auto px-4 py-8 max-w-2xl">
      <NuxtLink
        :to="$localePath('/')"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground font-medium hover:text-foreground mb-6 transition-colors"
      >
        <PhArrowLeft :size="16" weight="bold" />
        {{ t('blog.index.back_home') }}
      </NuxtLink>

      <div class="mb-8">
        <h1 class="text-2xl font-black font-heading tracking-tight mb-2">{{ t('legal.mentions.title') }}</h1>
        <p class="text-xs text-muted-foreground font-medium">{{ t('legal.mentions.subtitle') }}</p>
      </div>

      <div class="space-y-8 text-sm text-muted-foreground leading-relaxed">

        <!-- Éditeur -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.mentions.art1_title') }}</h2>
          <div class="bold-card--static p-4 space-y-1">
            <p><strong class="text-foreground">{{ t('legal.mentions.commercial_name_label') }} :</strong> {{ companyName }}</p>
            <p v-if="legalEntityName"><strong class="text-foreground">{{ t('legal.mentions.legal_entity_label') }} :</strong> {{ legalEntityName }}</p>
            <p><strong class="text-foreground">{{ t('legal.mentions.nature_label') }} :</strong> {{ t('legal.mentions.nature_p1') }}</p>
            <p v-if="companyCountry"><strong class="text-foreground">{{ t('legal.mentions.country_label') }} :</strong> {{ companyCountry }}</p>
            <p v-if="companyAddress"><strong class="text-foreground">{{ t('legal.mentions.address_label') }} :</strong> {{ companyAddress }}</p>
            <p v-if="companySiret"><strong class="text-foreground">SIRET :</strong> {{ companySiret }}</p>
            <p v-if="vatNumber"><strong class="text-foreground">TVA :</strong> {{ vatNumber }}</p>
            <p v-if="publicationDirector"><strong class="text-foreground">{{ t('legal.mentions.publication_director_label') }} :</strong> {{ publicationDirector }}</p>
            <p>
              <strong class="text-foreground">{{ t('legal.mentions.contact_label') }} :</strong>
              <NuxtLink :to="localePath(contactPath)" class="text-primary underline ml-1">{{ t('common.footer.links.contact') }}</NuxtLink>
            </p>
          </div>
        </section>

        <!-- Hébergement -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.mentions.art2_title') }}</h2>
          <div class="space-y-3">
            <div class="bold-card--static p-4 space-y-1">
              <p class="font-semibold text-foreground text-sm">{{ t('legal.mentions.cards.frontend_title') }}</p>
              <p><strong class="text-foreground">{{ t('legal.mentions.company_label') }} :</strong> Vercel Inc.</p>
              <p><strong class="text-foreground">{{ t('legal.mentions.address_label') }} :</strong> 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</p>
              <p><strong class="text-foreground">{{ t('legal.mentions.site_label') }} :</strong> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" class="text-primary underline">vercel.com</a></p>
            </div>
            <div class="bold-card--static p-4 space-y-1">
              <p class="font-semibold text-foreground text-sm">{{ t('legal.mentions.cards.backend_title') }}</p>
              <p><strong class="text-foreground">{{ t('legal.mentions.company_label') }} :</strong> Supabase Inc.</p>
              <p><strong class="text-foreground">{{ t('legal.mentions.address_label') }} :</strong> 970 Toa Payoh North #07-04, Singapore 318992</p>
              <p><strong class="text-foreground">{{ t('legal.mentions.site_label') }} :</strong> <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" class="text-primary underline">supabase.com</a></p>
              <p class="text-xs mt-1">{{ t('legal.mentions.cards.backend_p1') }}</p>
            </div>
          </div>
        </section>

        <!-- Propriété intellectuelle -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.mentions.art3_title') }}</h2>
          <p>
            {{ t('legal.mentions.art3_p1') }}
          </p>
          <p class="mt-3">
            {{ t('legal.mentions.art3_p2') }}
          </p>
        </section>

        <!-- Données personnelles -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.mentions.art4_title') }}</h2>
          <p>
            {{ t('legal.mentions.art4_p1') }} <NuxtLink :to="$localePath('/confidentialite')" class="text-primary underline">{{ t('legal.mentions.art4_link_label') }}</NuxtLink> {{ t('legal.mentions.art4_p2') }}
          </p>
          <p class="mt-3">
            {{ t('legal.mentions.art4_p3') }}
          </p>
          <p class="mt-3">
            {{ t('legal.mentions.art4_p3') }}
          </p>
          <p class="mt-3">
            {{ t('legal.mentions.art4_p4') }} <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" class="text-primary underline">cnil.fr</a>.
          </p>
        </section>

        <!-- Limitation de responsabilité -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.mentions.art5_title') }}</h2>
          <p>
            {{ t('legal.mentions.art5_p1') }}
          </p>
          <p class="mt-3">
            {{ t('legal.mentions.art5_p2') }}
          </p>
          <p class="mt-3">
            <strong class="text-foreground">{{ t('legal.mentions.art5_warning_title') }}</strong>
          </p>
        </section>

        <!-- Liens hypertextes -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.mentions.art6_title') }}</h2>
          <p>
            {{ t('legal.mentions.art6_p1') }}
          </p>
        </section>

        <!-- Droit applicable -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.mentions.art7_title') }}</h2>
          <p>
            {{ t('legal.mentions.art7_p1') }}
          </p>
        </section>

        <p class="text-xs text-muted-foreground border-t border-border pt-4">
          {{ t('legal.mentions.footer') }}
        </p>
      </div>

      <AppFooter />
    </main>
  </div>
</template>
