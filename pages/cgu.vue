<script setup lang="ts">
import { PhArrowLeft } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { data: companyConfig } = await useCompanyConfig()

useHead({
  title: computed(() => `${t('legal.cgu.title')} - YumiScan`),
})

const lastUpdate = computed(() =>
  new Intl.DateTimeFormat(locale.value === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date('2026-02-24T00:00:00Z'))
)
const cguVersion = 'v1.0'
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
        <h1 class="text-2xl font-black font-heading tracking-tight mb-2">{{ t('legal.cgu.title') }}</h1>
        <p class="text-xs text-muted-foreground font-medium">
          {{ t('legal.cgu.version', { version: cguVersion, date: lastUpdate }) }}
        </p>
      </div>

      <div class="space-y-8 text-sm text-muted-foreground leading-relaxed">

        <!-- Préambule -->
        <section>
          <div class="bold-card--static p-4 mb-6" style="border-left: 3px solid hsl(var(--primary));">
            <p class="text-foreground font-semibold text-sm">
              {{ t('legal.cgu.warning') }}
            </p>
          </div>
        </section>

        <!-- Art. 1 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art1_title') }}</h2>
          <p>
            {{ t('legal.cgu.art1_p1') }}
          </p>
          <p class="mt-3">
            <i18n-t keypath="legal.cgu.art1_p2" scope="global">
              <template #assistance>
                <strong class="text-foreground">{{ t('legal.cgu.art1_p2_strong') }}</strong>
              </template>
            </i18n-t>
          </p>
        </section>

        <!-- Art. 2 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art2_title') }}</h2>
          <p>{{ t('legal.cgu.art2_p1') }}</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.cgu.art2_l1') }}</li>
            <li>{{ t('legal.cgu.art2_l2') }}</li>
            <li>{{ t('legal.cgu.art2_l3') }}</li>
            <li>{{ t('legal.cgu.art2_l4') }}</li>
          </ul>
          <p class="mt-3">
            {{ t('legal.cgu.art2_p2') }}
          </p>
          <p class="mt-3">
            {{ t('legal.cgu.art2_p3') }}
          </p>
        </section>

        <!-- Art. 3 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art3_title') }}</h2>
          <p>{{ t('legal.cgu.art3_p1') }}</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.cgu.art3_l1') }}</li>
            <li>{{ t('legal.cgu.art3_l2') }}</li>
            <li>{{ t('legal.cgu.art3_l3') }}</li>
            <li>{{ t('legal.cgu.art3_l4') }}</li>
          </ul>
          <p class="mt-3 font-medium text-foreground">{{ t('legal.cgu.art3_p2') }}</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.cgu.art3_l5') }}</li>
            <li>{{ t('legal.cgu.art3_l6') }}</li>
            <li>{{ t('legal.cgu.art3_l7') }}</li>
            <li>{{ t('legal.cgu.art3_l8') }}</li>
            <li>{{ t('legal.cgu.art3_l9') }}</li>
          </ul>
        </section>

        <!-- Art. 4 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art4_title') }}</h2>
          <p>
            {{ t('legal.cgu.art4_p1') }}
          </p>
          <p class="mt-3 font-medium text-foreground">{{ t('legal.cgu.art4_p2') }}</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>
              <i18n-t keypath="legal.cgu.art4_l1" scope="global">
                <template #not_guaranteed>
                  <strong class="text-foreground">{{ t('legal.cgu.art4_l1_strong') }}</strong>
                </template>
              </i18n-t>
            </li>
            <li>{{ t('legal.cgu.art4_l2') }}</li>
            <li>{{ t('legal.cgu.art4_l3') }}</li>
            <li>{{ t('legal.cgu.art4_l4') }}</li>
            <li>
              <i18n-t keypath="legal.cgu.art4_l5" scope="global">
                <template #only_tool>
                  <strong class="text-foreground">{{ t('legal.cgu.art4_l5_strong') }}</strong>
                </template>
              </i18n-t>
            </li>
          </ul>
        </section>

        <!-- Art. 5 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art5_title') }}</h2>
          <p>
            {{ t('legal.cgu.art5_p1') }}
          </p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.cgu.art5_l1') }}</li>
            <li>{{ t('legal.cgu.art5_l2') }}</li>
            <li>{{ t('legal.cgu.art5_l3') }}</li>
            <li>{{ t('legal.cgu.art5_l4') }}</li>
            <li>{{ t('legal.cgu.art5_l5') }}</li>
            <li>{{ t('legal.cgu.art5_l6') }}</li>
          </ul>
          <p class="mt-3">
            <i18n-t keypath="legal.cgu.art5_p2" scope="global">
              <template #responsible>
                <strong class="text-foreground">{{ t('legal.cgu.art5_p2_strong') }}</strong>
              </template>
            </i18n-t>
          </p>
          <p class="mt-3">
            {{ t('legal.cgu.art5_p3') }}
          </p>
        </section>

        <!-- Art. 6 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art6_title') }}</h2>
          <p>{{ t('legal.cgu.art6_p1') }}</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.cgu.art6_l1') }}</li>
            <li>{{ t('legal.cgu.art6_l2') }}</li>
            <li>{{ t('legal.cgu.art6_l3') }}</li>
            <li>{{ t('legal.cgu.art6_l4') }}</li>
            <li>{{ t('legal.cgu.art6_l5') }}</li>
            <li>{{ t('legal.cgu.art6_l6') }}</li>
          </ul>
        </section>

        <!-- Art. 7 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art7_title') }}</h2>
          <p>
            {{ t('legal.cgu.art7_p1') }}
          </p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.cgu.art7_l1') }}</li>
            <li>{{ t('legal.cgu.art7_l2') }}</li>
            <li>
              <i18n-t keypath="legal.cgu.art7_l3" scope="global">
                <template #false_negatives>
                  <strong class="text-foreground">{{ t('legal.cgu.art7_l3_strong_neg') }}</strong>
                </template>
                <template #false_positives>
                  <strong class="text-foreground">{{ t('legal.cgu.art7_l3_strong_pos') }}</strong>
                </template>
              </i18n-t>
            </li>
            <li>{{ t('legal.cgu.art7_l4') }}</li>
            <li>{{ t('legal.cgu.art7_l5') }}</li>
          </ul>
        </section>

        <!-- Art. 8 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art8_title') }}</h2>
          <p>
            {{ t('legal.cgu.art8_p1') }}
          </p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>
              <i18n-t keypath="legal.cgu.art8_p1_l1" scope="global">
                <template #launch>
                  <strong class="text-foreground">{{ t('legal.cgu.art8_p1_l1_strong') }}</strong>
                </template>
              </i18n-t>
            </li>
            <li>
              <i18n-t keypath="legal.cgu.art8_p1_l2" scope="global">
                <template #no_refund>
                  <strong class="text-foreground">{{ t('legal.cgu.art8_p1_l2_strong') }}</strong>
                </template>
              </i18n-t>
            </li>
            <li>{{ t('legal.cgu.art8_l3') }}</li>
            <li>
              <i18n-t keypath="legal.cgu.art8_p1_l4" scope="global">
                <template #contactPage>
                  <NuxtLink :to="localePath(contactPath)" class="text-primary underline">{{ t('common.footer.links.contact') }}</NuxtLink>
                </template>
              </i18n-t>
            </li>
            <li>{{ t('legal.cgu.art8_l5') }}</li>
          </ul>
          <p class="mt-3">
            {{ t('legal.cgu.art8_p2') }}
          </p>
        </section>

        <!-- Art. 9 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art9_title') }}</h2>
          <p>
            {{ t('legal.cgu.art9_p1') }}
          </p>
          <p class="mt-3">
            {{ t('legal.cgu.art9_p2') }}
          </p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>{{ t('legal.cgu.art9_l1') }}</li>
            <li>{{ t('legal.cgu.art9_l2') }}</li>
            <li>{{ t('legal.cgu.art9_l3') }}</li>
            <li>{{ t('legal.cgu.art9_l4') }}</li>
            <li>{{ t('legal.cgu.art9_l5') }}</li>
          </ul>
        </section>

        <!-- Art. 10 -->
        <section>
          <h2 class="text-base font-bold text-foreground mb-3">{{ t('legal.cgu.art10_title') }}</h2>
          <p>
            <i18n-t keypath="legal.cgu.art10_p1" scope="global">
              <template #contactPage>
                <NuxtLink :to="localePath(contactPath)" class="text-primary underline">{{ t('common.footer.links.contact') }}</NuxtLink>
              </template>
            </i18n-t>
          </p>
          <p class="mt-3">
            {{ t('legal.cgu.art10_p2') }}
          </p>
          <p class="mt-3">
            {{ t('legal.cgu.art10_p3') }}
          </p>
        </section>

        <p class="text-xs text-muted-foreground border-t border-border pt-4">
          {{ t('legal.cgu.footer', { version: cguVersion, date: lastUpdate }) }}
        </p>
      </div>

      <AppFooter />
    </main>
  </div>
</template>
