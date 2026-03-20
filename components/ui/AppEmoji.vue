<script setup lang="ts">
import type { EmojiId } from '~/utils/emojis'
import { getEmojiPath } from '~/utils/emojis'

const props = withDefaults(
  defineProps<{
    /** Clé emoji (ex: APP_EMOJI.emptyScan ou EmojiId) */
    name: string
    /** Taille en px */
    size?: number
    /** Forcer la variante claire (mode sombre) */
    dark?: boolean
    /** Classe CSS pour filtre (ex: teinter en primary/destructive) */
    filterClass?: string
  }>(),
  { size: 64, dark: undefined, filterClass: '' }
)

const { isDark } = useDarkMode()
const path = computed(() =>
  getEmojiPath(props.name as EmojiId, props.dark ?? isDark.value)
)
</script>

<template>
  <img
    :src="path"
    :alt="name"
    :width="size"
    :height="size"
    class="object-contain shrink-0 select-none"
    :class="filterClass"
    loading="eager"
  />
</template>
