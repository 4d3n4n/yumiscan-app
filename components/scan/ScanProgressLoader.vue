<script setup lang="ts">
import { PhScan } from '@phosphor-icons/vue'
import { LOADING_HINTS, LOADING_HINT_EMOJI_PATHS } from '~/data/loading-hints'
import scanStyles from '~/assets/css/food-scan.module.css'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const getLoadingMessages = () => [
  t('scan.scan.progress.step_verify'),
  t('scan.scan.progress.step_process'),
  t('scan.scan.progress.step_extract'),
  t('scan.scan.progress.step_analyze'),
  t('scan.scan.progress.step_finalize'),
]

const getHintTitle = (hintKey: string) => t(`scan.scan.progress.hints.${hintKey}.title`)
const getHintDescription = (hintKey: string) => t(`scan.scan.progress.hints.${hintKey}.description`)

defineProps<{ currentStepIndex: number }>()

const hintIndex = ref(0)

let interval: ReturnType<typeof setInterval>
onMounted(() => {
  interval = setInterval(() => {
    hintIndex.value = (hintIndex.value + 1) % LOADING_HINTS.length
  }, 8000)
})
onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 overflow-hidden bg-background/95 backdrop-blur-xl">
    <div class="absolute inset-0 z-0 pointer-events-none bg-dots-bold" />

    <div class="relative z-10 w-full max-w-sm flex flex-col items-center gap-10">
      <!-- Scan icon -->
      <div class="flex flex-col items-center gap-6">
        <div
          class="w-28 h-28 flex items-center justify-center bg-card relative"
          style="border: 3px solid var(--bold-border-color); border-radius: var(--bold-radius-xl); box-shadow: var(--bold-shadow-lg);"
        >
          <PhScan class="relative z-10 w-12 h-12 text-primary animate-subtle-pulse" />
        </div>

        <div class="h-8 flex items-center justify-center">
          <Transition name="fade" mode="out-in">
            <span
              :key="getLoadingMessages()[Math.min(currentStepIndex, getLoadingMessages().length - 1)]"
              class="text-lg font-extrabold font-heading text-gradient-primary tracking-wide text-center"
            >
              {{ getLoadingMessages()[Math.min(currentStepIndex, getLoadingMessages().length - 1)] }}
            </span>
          </Transition>
        </div>
      </div>

      <!-- Hint card -->
      <div class="w-full relative min-h-[150px]">
        <Transition name="fade" mode="out-in">
          <div
            :key="hintIndex"
            class="bold-card--static relative p-6 pb-7 overflow-hidden"
          >
            <div class="flex items-center gap-5">
              <span class="w-16 h-16 flex items-center justify-center select-none shrink-0 overflow-hidden" style="border-radius: var(--bold-radius);">
                <img
                  v-if="LOADING_HINT_EMOJI_PATHS[LOADING_HINTS[hintIndex].emoji]"
                  :src="LOADING_HINT_EMOJI_PATHS[LOADING_HINTS[hintIndex].emoji]"
                  :alt="LOADING_HINTS[hintIndex].emoji"
                  class="w-full h-full object-contain"
                  width="64"
                  height="64"
                />
                <span v-else class="text-5xl">{{ LOADING_HINTS[hintIndex].emoji }}</span>
              </span>
              <div class="flex-1 space-y-1.5">
                <h3 class="text-sm font-extrabold font-heading text-foreground leading-tight">
                  {{ getHintTitle(LOADING_HINTS[hintIndex].key) }}
                </h3>
                <p class="text-xs text-muted-foreground leading-relaxed font-medium">
                  {{ getHintDescription(LOADING_HINTS[hintIndex].key) }}
                </p>
              </div>
            </div>
            <!-- Ligne de temps (8s par hint) -->
            <div
              class="hint-timeline-track absolute bottom-0 left-0 right-0 h-1 bg-muted/50"
              style="border-radius: 0 0 var(--bold-radius) var(--bold-radius);"
            >
              <div
                :key="hintIndex"
                class="hint-timeline-fill h-full bg-primary"
                style="border-radius: 0 0 0 var(--bold-radius);"
              />
            </div>
          </div>
        </Transition>
      </div>

      <p class="text-[10px] text-muted-foreground/60 text-center animate-subtle-pulse tracking-widest uppercase font-bold">
        {{ t('scan.scan.progress.lbl_decoding') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 300ms, transform 300ms; }
.fade-enter-from { opacity: 0; transform: translateY(8px); }
.fade-leave-to { opacity: 0; transform: translateY(-8px); }

.hint-timeline-track {
  overflow: hidden;
}
.hint-timeline-fill {
  width: 0%;
  animation: hint-timeline-fill 8s linear forwards;
}
@keyframes hint-timeline-fill {
  from { width: 0%; }
  to { width: 100%; }
}
</style>
