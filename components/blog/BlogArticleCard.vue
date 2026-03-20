<script setup lang="ts">
import type { BlogArticle } from '~/data/blog'
import { PhClock } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  article: BlogArticle
}>()
</script>

<template>
  <NuxtLink
    :to="$localePath(`/blog/${article.slug}`)"
    class="bold-card group flex flex-col overflow-hidden transition-all duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--bold-color)]"
  >
    <div class="relative aspect-[16/10] w-full overflow-hidden bg-muted">
      <img
        :src="article.image"
        :alt="t(`blog.articles.${article.slug}.title`)"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div
        v-if="article.tags.length"
        class="absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 p-2.5 md:p-3 bg-gradient-to-t from-black/70 to-transparent"
      >
        <span
          v-for="tagKey in article.tags.slice(0, 4)"
          :key="tagKey"
          class="bold-pill bold-pill--outline text-[10px] md:text-[11px] px-2 py-0.5 border-white/40 text-white bg-white/10 backdrop-blur-sm"
        >
          {{ t(`blog.articles.${article.slug}.tags.${tagKey}`) }}
        </span>
      </div>
    </div>
    <div class="flex flex-1 flex-col p-4">
      <h3 class="font-bold font-heading text-foreground line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
        {{ t(`blog.articles.${article.slug}.title`) }}
      </h3>
      <p class="text-sm text-muted-foreground line-clamp-2 flex-1 mb-3">
        {{ t(`blog.articles.${article.slug}.excerpt`) }}
      </p>
      <div class="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <PhClock :size="14" weight="regular" />
        <span>{{ article.readTime }} {{ t('common.time.min_short') }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
