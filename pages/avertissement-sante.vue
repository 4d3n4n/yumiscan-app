<script setup lang="ts">
import { PhWarning, PhShieldSlash, PhFirstAid, PhCheckCircle, PhArrowLeft } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

useHead({
  title: computed(() => `${t('legal.warning.title')} — YumiScan`),
  meta: [{ name: 'robots', content: 'noindex' }],
})
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

      <div class="mb-6">
        <h1 class="text-2xl font-black font-heading tracking-tight mb-1">{{ t('legal.warning.title') }}</h1>
        <p class="text-xs text-muted-foreground font-medium">{{ t('legal.warning.subtitle') }}</p>
      </div>

      <!-- Bloc d'alerte principal -->
      <div
        class="p-5 rounded-xl mb-8 flex gap-4"
        style="background: hsl(var(--destructive) / 0.08); border: 2px solid hsl(var(--destructive) / 0.35);"
      >
        <PhWarning class="h-7 w-7 shrink-0 mt-0.5" style="color: hsl(var(--destructive));" weight="fill" />
        <div class="space-y-2">
          <p class="font-bold text-foreground">{{ t('legal.warning.alert_title') }}</p>
          <p class="text-sm text-muted-foreground leading-relaxed">
            {{ t('legal.warning.alert_p1') }}
          </p>
        </div>
      </div>

      <div class="space-y-6 text-sm text-muted-foreground leading-relaxed">

        <!-- Section 1 : Limites techniques -->
        <section class="bold-card--static p-5">
          <div class="flex items-center gap-2 mb-3">
            <PhShieldSlash class="h-5 w-5 text-primary" weight="duotone" />
            <h2 class="text-base font-bold text-foreground">{{ t('legal.warning.sections.limits_title') }}</h2>
          </div>
          <ul class="space-y-2">
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">•</span>
              <span>{{ t('legal.warning.sections.limits_l1') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">•</span>
              <span>{{ t('legal.warning.sections.limits_l2') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">•</span>
              <span>{{ t('legal.warning.sections.limits_l3') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">•</span>
              <span>{{ t('legal.warning.sections.limits_l4') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">•</span>
              <span>{{ t('legal.warning.sections.limits_l5') }}</span>
            </li>
          </ul>
        </section>

        <!-- Section 2 : Allergies graves -->
        <section class="bold-card--static p-5">
          <div class="flex items-center gap-2 mb-3">
            <PhFirstAid class="h-5 w-5 text-primary" weight="duotone" />
            <h2 class="text-base font-bold text-foreground">{{ t('legal.warning.sections.severe_title') }}</h2>
          </div>
          <div
            class="p-4 rounded-lg mb-3"
            style="background: hsl(var(--destructive) / 0.06); border: 1.5px solid hsl(var(--destructive) / 0.25);"
          >
            <p class="font-semibold text-foreground text-sm">
              {{ t('legal.warning.sections.severe_p1') }}
            </p>
          </div>
          <ul class="space-y-2">
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">→</span>
              <span>{{ t('legal.warning.sections.severe_l1') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">→</span>
              <span>{{ t('legal.warning.sections.severe_l2') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">→</span>
              <span>{{ t('legal.warning.sections.severe_l3') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-destructive font-bold mt-0.5">→</span>
              <span>{{ t('legal.warning.sections.severe_l4') }}</span>
            </li>
          </ul>
        </section>

        <!-- Section 3 : Responsabilité utilisateur -->
        <section class="bold-card--static p-5">
          <div class="flex items-center gap-2 mb-3">
            <PhCheckCircle class="h-5 w-5 text-primary" weight="duotone" />
            <h2 class="text-base font-bold text-foreground">{{ t('legal.warning.sections.responsibility_title') }}</h2>
          </div>
          <p>
            {{ t('legal.warning.sections.responsibility_p1') }}
          </p>
          <ul class="mt-3 space-y-2">
            <li class="flex items-start gap-2">
              <span class="text-primary font-bold mt-0.5">✓</span>
              <span>{{ t('legal.warning.sections.responsibility_l1') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary font-bold mt-0.5">✓</span>
              <span>{{ t('legal.warning.sections.responsibility_l2') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary font-bold mt-0.5">✓</span>
              <span>{{ t('legal.warning.sections.responsibility_l3') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary font-bold mt-0.5">✓</span>
              <span>{{ t('legal.warning.sections.responsibility_l4') }}</span>
            </li>
          </ul>
        </section>

        <!-- Recommandations finales -->
        <section
          class="p-4 rounded-xl"
          style="background: hsl(var(--primary) / 0.06); border: 1.5px solid hsl(var(--primary) / 0.25);"
        >
          <p class="font-semibold text-foreground text-sm mb-2">{{ t('legal.warning.recs_title') }}</p>
          <ul class="space-y-1.5 text-sm">
            <li>• {{ t('legal.warning.recs_l1') }}</li>
            <li>• {{ t('legal.warning.recs_l2') }}</li>
            <li>• {{ t('legal.warning.recs_l3') }}</li>
            <li>• {{ t('legal.warning.recs_l4') }}</li>
          </ul>
        </section>

        <p class="text-xs text-muted-foreground border-t border-border pt-4">
          {{ t('legal.warning.footer') }}
        </p>
      </div>

      <AppFooter />
    </main>
  </div>
</template>
