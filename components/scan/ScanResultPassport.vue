<script setup lang="ts">
import type { ScanResult, AllergeneScanResult } from '~/utils/types'
import { EMOJI_MAP, STATUS_EMOJIS } from '~/utils/emojis'
import scanStyles from '~/assets/css/food-scan.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  halalResult: ScanResult
  allergenResult: AllergeneScanResult | null
}>()

const statusKey = computed(() => {
  const status = props.halalResult.product_status
  if ((props.allergenResult?.detected?.length ?? 0) > 0) return 'contains_allergen'
  if (status === 'ambiguous') return 'ambiguous'
  if (status === 'contains_allergen') return 'contains_allergen'
  return 'ok'
})

const cfg = computed(() => {
  const s = statusKey.value
  if (s === 'ok') return { borderColor: 'border-emerald-700', textColor: 'text-emerald-800', label: t('scan.scan.passport.status_ok') }
  if (s === 'contains_allergen') return { borderColor: 'border-purple-700', textColor: 'text-purple-800', label: t('scan.scan.passport.status_allergen') }
  if (s === 'ambiguous') return { borderColor: 'border-amber-700', textColor: 'text-amber-800', label: t('scan.scan.passport.status_ambiguous') }
  return { borderColor: 'border-red-800', textColor: 'text-red-900', label: t('scan.scan.passport.status_refused') }
})

const ambiguous = computed(() => props.halalResult.ambiguous_ingredients ?? [])
const allergens = computed(() => props.halalResult.allergens_ingredients ?? [])
const ok = computed(() => props.halalResult.ok_ingredients ?? [])
const hasAttention = computed(() => allergens.value.length > 0 || ambiguous.value.length > 0)
</script>

<template>
  <div class="relative rounded-3xl shadow-[0_0_40px_rgba(147,51,234,0.2)] overflow-hidden my-8 mx-16 border-2 border-primary/20 backdrop-blur-2xl bg-[#ffffff]/60">
    <div :class="scanStyles.animatedGradient" />
    <div :class="scanStyles.digitalGrid" />

    <div class="relative z-10 p-5 flex justify-between items-center bg-white/50 backdrop-blur-md border-b border-white/40">
      <span class="font-mono text-xs text-gray-500">YUMISCAN</span>
      <span :class="['font-mono text-xs font-bold flex items-center gap-1.5', cfg.textColor]">
        <img :src="EMOJI_MAP[STATUS_EMOJIS[statusKey]]" :alt="cfg.label" class="w-5 h-5 object-contain shrink-0" />
        {{ cfg.label }}
      </span>
    </div>

    <div class="p-6 relative pt-8 z-10">
      <div class="pt-8 relative z-0">
        <h2 class="text-lg font-bold text-gray-800 mb-6 font-mono">{{ t('scan.scan.passport.section_analysis') }}</h2>

        <div v-if="hasAttention" class="mb-6">
          <h3 class="font-mono text-xs text-red-600 mb-2 border-b border-red-200 pb-1 inline-block">{{ t('scan.scan.passport.section_alert') }}</h3>
          <div class="flex flex-row gap-2 items-stretch w-full flex-wrap">
            <ScanIngredientTree v-for="(ing, i) in allergens" :key="'alg-' + i" :ingredient="ing" status="contains_allergen" :index="i" />
            <ScanIngredientTree v-for="(ing, i) in ambiguous" :key="'amb-' + i" :ingredient="ing" status="ambiguous" :index="i" />
          </div>
        </div>

        <div v-if="ok.length > 0">
          <h3 class="font-mono text-xs text-gray-400 mb-2 border-b border-gray-200 pb-1 inline-block">{{ t('scan.scan.passport.section_safe') }}</h3>
          <div class="flex flex-row gap-2 items-stretch w-full flex-wrap">
            <ScanIngredientTree v-for="(ing, i) in ok" :key="'ok-' + i" :ingredient="ing" status="ok" :index="i" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
