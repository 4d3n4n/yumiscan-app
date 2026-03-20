<script setup lang="ts">
import { PhArrowLeft } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const localePath = useLocalePath()

const TALLY_EMBED_URL =
  'https://tally.so/embed/PdA6gx?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1&formEventsForwarding=1'

useHead({
  title: computed(() => t('common.contact.title')),
  meta: [
    { name: 'description', content: computed(() => t('common.contact.description')) },
  ],
})
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

      <div class="mb-6">
        <h1 class="text-2xl font-black font-heading tracking-tight mb-2">{{ t('common.contact.heading') }}</h1>
        <p class="text-sm text-muted-foreground font-medium">
          {{ t('common.contact.subheading') }}
        </p>
      </div>

      <div
        class="w-full overflow-hidden rounded-[var(--bold-radius)] min-h-[400px]"
        style="border: 2px solid var(--bold-border-color); box-shadow: var(--bold-shadow-sm);"
      >
        <iframe
          :src="TALLY_EMBED_URL"
          loading="lazy"
          width="100%"
          height="400"
          frameborder="0"
          marginheight="0"
          marginwidth="0"
          :title="t('common.contact.form_title')"
          class="min-h-[400px] w-full"
        />
      </div>

      <AppFooter />
    </main>
  </div>
</template>
