<script setup lang="ts">
import { PhCaretDown, PhCaretRight } from '@phosphor-icons/vue'
import type { IngredientPair, IngredientWithReason, ParsedIngredient } from '~/utils/types'
import scanStyles from '~/assets/css/food-scan.module.css'

type IngStatus = 'ok' | 'ambiguous' | 'contains_allergen'

const props = defineProps<{
  ingredient: IngredientPair | IngredientWithReason
  status: IngStatus
  index: number
}>()

const expanded = ref(false)

const parsed = computed(() => props.ingredient.parsed)
const reason = computed(() => (props.ingredient as IngredientWithReason).reason)
const hasChildren = computed(() => parsed.value?.has_sub_ingredients && parsed.value.sub_ingredients?.length > 0)

const frText = computed(() => props.ingredient.normalized || parsed.value?.main_text_fr || props.ingredient.raw)
const jpText = computed(() => parsed.value?.main_text_jp || props.ingredient.raw)

function glowClass(s: IngStatus) {
  return s === 'ok' ? 'glass-glow--ok' : s === 'ambiguous' ? 'glass-glow--ambiguous' : 'glass-glow--allergen'
}
function dotClass(s: IngStatus) {
  return s === 'ok' ? 'status-dot--ok' : s === 'ambiguous' ? 'status-dot--ambiguous' : 'status-dot--allergen'
}
function jpTextClass(s: IngStatus) {
  return s === 'ok' ? scanStyles.jpTextOk : s === 'ambiguous' ? scanStyles.jpTextWarning : scanStyles.jpTextAllergen
}
</script>

<template>
  <div class="ingredient-tree mt-0 h-auto">
    <div
      :class="['glass-card min-w-32 flex items-start justify-start', glowClass(status), hasChildren ? 'cursor-pointer active:scale-[0.98]' : '', status === 'ok' ? 'h-fit' : 'h-24']"
      @click="hasChildren ? expanded = !expanded : undefined"
    >
      <div class="flex flex-col items-start justify-center gap-2 w-full">
        <div class="flex min-w-0 flex-row items-center justify-between w-full gap-2">
          <p class="font-semibold text-gray-900 text-sm leading-tight truncate">{{ frText }}</p>
          <div :class="['status-dot', dotClass(status)]" />
        </div>
        <div class="flex items-center gap-2">
          <p :class="['text-[11px] text-gray-400 mt-0.5 truncate', scanStyles.jpText, jpTextClass(status)]">{{ jpText }}</p>
          <span v-if="hasChildren" :class="[scanStyles.arrow, jpTextClass(status)]">
            <PhCaretDown v-if="expanded" :size="14" />
            <PhCaretRight v-else :size="14" />
          </span>
        </div>
      </div>
      <p v-if="reason && status !== 'ok'" class="text-[11px] mt-2 italic leading-relaxed" :style="{ color: status === 'contains_allergen' ? 'var(--scan-status-allergen)' : status === 'ambiguous' ? 'var(--scan-status-ambiguous)' : 'var(--scan-status-not-ok)' }">
        {{ reason }}
      </p>
    </div>
  </div>
</template>
