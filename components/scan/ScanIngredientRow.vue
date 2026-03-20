<script setup lang="ts">
import { PhCaretDown, PhCaretRight } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

type IngStatus = 'ok' | 'ambiguous' | 'contains_allergen'

interface IngredientNode {
  id?: string
  main_text_jp: string
  main_text_fr: string
  has_sub_ingredients: boolean
  sub_ingredients?: IngredientNode[]
  status?: IngStatus
  ambiguous_reason?: string
}

const props = defineProps<{
  ingredient: IngredientNode
  depth: number
  nodeKey: string
  expandedSet: Set<string>
  onToggle: (key: string) => void
}>()

const isExpanded = computed(() => props.expandedSet.has(props.nodeKey))
const hasChildren = computed(() => props.ingredient.has_sub_ingredients && (props.ingredient.sub_ingredients?.length ?? 0) > 0)

function badgeConfig(status?: IngStatus) {
  switch (status) {
    case 'ok': return { label: t('scan.scan.ingredient.status_ok'), bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
    case 'contains_allergen': return { label: t('scan.scan.ingredient.status_allergen'), bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' }
    case 'ambiguous': return { label: t('scan.scan.ingredient.status_ambiguous'), bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' }
    default: return { label: t('scan.scan.ingredient.status_ok'), bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
  }
}

const badge = computed(() => badgeConfig(props.ingredient.status))
const rowToneClass = computed(() => {
  switch (props.ingredient.status) {
    case 'contains_allergen':
      return 'scan-ingredient-row--allergen'
    case 'ambiguous':
      return 'scan-ingredient-row--ambiguous'
    default:
      return ''
  }
})

const indentPx = computed(() => `${props.depth * 16}px`)
const leftBorderColor = computed(() => {
  const s = props.ingredient.status
  if (s === 'contains_allergen') return '#9333ea'
  if (s === 'ambiguous') return '#d97706'
  return 'hsl(var(--border))'
})
</script>

<template>
  <div>
    <!-- Row -->
    <div
      class="scan-ingredient-row flex items-center gap-3 px-4 py-2.5 transition-colors border-b border-border/40 last:border-b-0"
      :class="[
        rowToneClass,
        { 'cursor-pointer hover:bg-muted/30 active:bg-muted/50': hasChildren },
      ]"
      :style="{ paddingLeft: `calc(1rem + ${indentPx})` }"
      @click="hasChildren ? onToggle(nodeKey) : undefined"
    >
      <!-- Depth indicator -->
      <span
        v-if="depth > 0"
        class="shrink-0 w-0.5 self-stretch"
        :style="{ background: leftBorderColor, marginLeft: '-4px', marginRight: '4px', borderRadius: '1px' }"
      />

      <div class="flex-1 min-w-0">
        <p
          class="scan-ingredient-row__jp font-bold leading-tight"
          :class="[
            depth === 0 ? 'text-sm text-foreground' : 'text-[13px] text-foreground/80',
            {
              'scan-ingredient-row__jp--allergen': ingredient.status === 'contains_allergen',
              'scan-ingredient-row__jp--ambiguous': ingredient.status === 'ambiguous',
            },
          ]"
        >
          {{ ingredient.main_text_jp }}
        </p>
        <p class="scan-ingredient-row__fr text-xs text-muted-foreground mt-0.5">{{ ingredient.main_text_fr }}</p>
        <p
          v-if="ingredient.ambiguous_reason && ingredient.status !== 'ok'"
          class="scan-ingredient-row__reason text-[11px] italic mt-0.5"
          :style="{ color: ingredient.status === 'contains_allergen' ? '#9333ea' : ingredient.status === 'ambiguous' ? '#d97706' : '#ef4444' }"
        >
          {{ ingredient.ambiguous_reason }}
        </p>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <span
          :class="[badge.bg, badge.text, badge.border]"
          class="scan-ingredient-row__badge text-[10px] font-bold px-2 py-0.5 border"
          style="border-radius: var(--bold-radius-sm);"
        >
          {{ badge.label }}
        </span>
        <PhCaretDown v-if="hasChildren && isExpanded" :size="13" class="text-muted-foreground" />
        <PhCaretRight v-else-if="hasChildren" :size="13" class="text-muted-foreground" />
      </div>
    </div>

    <!-- Children (recursive) -->
    <Transition name="sub-expand">
      <div v-if="hasChildren && isExpanded">
        <ScanIngredientRow
          v-for="(child, ci) in ingredient.sub_ingredients"
          :key="child.id || `${nodeKey}-${ci}`"
          :ingredient="child"
          :depth="depth + 1"
          :node-key="`${nodeKey}-${ci}`"
          :expanded-set="expandedSet"
          :on-toggle="onToggle"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scan-ingredient-row--allergen {
  background: #faf5ff;
  box-shadow: inset 4px 0 0 #9333ea;
}

.scan-ingredient-row--ambiguous {
  background: #fffbeb;
  box-shadow: inset 4px 0 0 #d97706;
}

.scan-ingredient-row--allergen:hover {
  background: #f3e8ff;
}

.scan-ingredient-row--ambiguous:hover {
  background: #fef3c7;
}

.scan-ingredient-row__jp--allergen {
  color: #6b21a8 !important;
  font-weight: 900;
}

.scan-ingredient-row__jp--ambiguous {
  color: #b45309 !important;
  font-weight: 900;
}

.sub-expand-enter-active,
.sub-expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.sub-expand-enter-from,
.sub-expand-leave-to {
  max-height: 0;
  opacity: 0;
}
.sub-expand-enter-to,
.sub-expand-leave-from {
  max-height: 2000px;
  opacity: 1;
}
</style>
