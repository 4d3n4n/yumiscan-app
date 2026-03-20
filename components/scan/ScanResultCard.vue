<script setup lang="ts">
import { PhSparkle, PhScan } from '@phosphor-icons/vue'
import type { ScanResult, AllergeneScanResult } from '~/utils/types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  halalResult: ScanResult | null
  allergenResult: AllergeneScanResult | null
}>()

const emit = defineEmits<{ rescan: [] }>()
</script>

<template>
  <div v-if="halalResult" class="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end pointer-events-none">
    <div class="scan-card w-full max-h-[90vh] flex flex-col pointer-events-auto pb-safe overflow-hidden bg-transparent">
      <div class="w-12 h-1.5 bg-gray-200/60 rounded-full mx-auto my-3 shrink-0" />

      <UiScrollArea class="flex-1 px-0 pb-20">
        <ScanResultPassport :halal-result="halalResult" :allergen-result="allergenResult" />
      </UiScrollArea>

      <div class="absolute bottom-0 inset-x-0 z-50">
        <div class="relative h-44 w-full flex flex-col justify-end">
          <div class="absolute inset-0" style="backdrop-filter: blur(22px); background: rgba(255,255,255,0.08); mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 55%); -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 55%)" />
          <div class="absolute inset-0" style="background: linear-gradient(to top, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%); pointer-events: none" />
          <div class="relative z-10 p-6 pb-8 pointer-events-auto flex items-center justify-center">
            <UiScanButton class="w-fit shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90 text-white border-0" @click="emit('rescan')">
              <span class="relative mr-2">
                <PhScan :size="18" />
                <PhSparkle class="w-2 h-2 absolute -top-1 -right-1.5 text-yellow-300 animate-subtle-pulse" weight="fill" />
              </span>
              {{ t('scan.scan.result.btn_rescan') }}
            </UiScanButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
