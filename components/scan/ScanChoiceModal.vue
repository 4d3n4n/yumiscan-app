<script setup lang="ts">
import { PhImages, PhCamera } from '@phosphor-icons/vue'
import { EMOJI_MAP, APP_EMOJI } from '~/utils/emojis'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{ open: boolean; noCredits?: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  library: []
  camera: []
  'go-to-pricing': []
}>()
</script>

<template>
  <UiDialog :open="props.open" @update:open="emit('update:open', $event)">
    <UiDialogContent class="sm:max-w-md p-0 overflow-hidden overflow-y-auto max-h-[95vh]">
      <div class=" sm:p-8 flex flex-col gap-6">
        <div class="text-center sm:text-left">
          <h2 class="text-xl font-extrabold font-heading tracking-tight">{{ t('scan.scan.choice.title') }}</h2>
          <p class="text-sm text-muted-foreground font-medium mt-1">{{ t('scan.scan.choice.subtitle') }}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            :disabled="noCredits"
            @click="!noCredits && emit('camera')"
            :class="[
              'bold-card scan-choice-card group flex flex-col items-center justify-center gap-3 p-6 h-40 transition-colors',
              noCredits ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            ]"
          >
            <div
              class="scan-choice-card__icon scan-choice-card__icon--primary w-14 h-14 flex items-center justify-center bg-primary/10 text-primary transition-colors"
              style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius);"
            >
              <PhCamera :size="28" weight="duotone" />
            </div>
            <span class="font-bold font-heading text-foreground">{{ t('scan.scan.choice.btn_camera') }}</span>
          </button>

          <button
            type="button"
            :disabled="noCredits"
            @click="!noCredits && emit('library')"
            :class="[
              'bold-card scan-choice-card group flex flex-col items-center justify-center gap-3 p-6 h-40 transition-colors',
              noCredits ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            ]"
          >
            <div
              class="scan-choice-card__icon scan-choice-card__icon--accent w-14 h-14 flex items-center justify-center bg-accent/10 text-accent transition-colors"
              style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius);"
            >
              <PhImages :size="28" weight="duotone" />
            </div>
            <span class="font-bold font-heading text-foreground">{{ t('scan.scan.choice.btn_gallery') }}</span>
          </button>
        </div>

        <!-- Message + CTA quand plus de crédits -->
        <div
          v-if="noCredits"
          class="rounded-lg p-4 space-y-3 text-center pb-6"
          style="border: 2px solid hsl(var(--primary) / 0.4); background: hsl(var(--primary) / 0.06);"
        >
          <div class="flex justify-center">
            <img
              :src="EMOJI_MAP[APP_EMOJI.noCredits]"
              alt=""
              width="64"
              height="64"
              class="w-16 h-16 object-contain select-none"
            />
          </div>
          <p class="text-sm font-bold font-heading text-foreground">
            {{ t('scan.scan.choice.no_credits_title') }}
          </p>
          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ t('scan.scan.choice.no_credits_desc') }}
          </p>
          <div class="flex flex-col gap-2 pt-1">
            <button
              type="button"
              class="bold-btn bold-btn--primary bold-btn--pill w-full"
              @click="emit('go-to-pricing')"
            >
              {{ t('scan.scan.choice.btn_recharge') }}
            </button>
          </div>
        </div>

        <button
          type="button"
          @click="emit('update:open', false)"
          class="w-full py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors pt-0 sm:pt-3"
        >
          {{ t('scan.scan.choice.btn_cancel') }}
        </button>
      </div>
    </UiDialogContent>
  </UiDialog>
</template>

<style scoped>
/* 13.1 — Hover limité aux appareils avec pointeur (évite sticky hover sur mobile) */
@media (hover: hover) {
  .scan-choice-card:hover .scan-choice-card__icon--primary {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }
  .scan-choice-card:hover .scan-choice-card__icon--accent {
    background: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
  }
}

/* 13.2 — Sur tactile : feedback au tap (état enfoncé pendant le touch) */
@media (hover: none) {
  .scan-choice-card:active .scan-choice-card__icon--primary {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }
  .scan-choice-card:active .scan-choice-card__icon--accent {
    background: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
  }
}
</style>
