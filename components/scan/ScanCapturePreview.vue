<script setup lang="ts">
import { PhArrowLeft, PhCamera, PhInfo, PhImages, PhSparkle, PhMagicWand } from '@phosphor-icons/vue'
import type { AllergenCatalogRow } from '~/utils/types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  imageUrl: string
  source: 'library' | 'camera'
  scanning: boolean
  allergensCatalog: AllergenCatalogRow[]
  allergensLoading: boolean
  selectedAllergenIds: Set<string>
}>()

const emit = defineEmits<{
  back: []
  retake: []
  changeImage: []
  scanWithAI: []
  toggle: [allergenId: string]
}>()

const showAllergens = ref(false)
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black flex flex-col text-white">

    <!-- Top bar -->
    <div class="relative z-10 flex items-center justify-between px-4 py-3" style="padding-top: max(env(safe-area-inset-top), 12px);">
      <button
        class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 active:bg-white/20 transition-colors"
        @click="emit('back')"
        :aria-label="t('scan.scan.preview.btn_back')"
      >
        <PhArrowLeft :size="20" weight="bold" />
      </button>
      <span class="text-sm font-black font-heading tracking-wider uppercase">{{ t('scan.scan.preview.title') }}</span>
      <button
        class="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 active:bg-white/20 transition-colors"
        @click="emit('retake')"
        :aria-label="t('scan.scan.preview.btn_retake')"
        :title="t('scan.scan.preview.btn_retake')"
      >
        <PhCamera :size="18" weight="bold" />
      </button>
    </div>

    <!-- Zone scrollable : prévisualisation + barre du bas (bouton "Scanner avec l'IA" visible au scroll sur mobile) -->
    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative z-10">
      <div class="flex flex-col items-center px-6 gap-5 py-4 min-h-full">

        <!-- Instruction top -->
        <div
          class="px-5 py-2 text-sm font-bold tracking-wide shrink-0"
          style="background: hsl(var(--primary)); border-radius: var(--bold-radius-pill); color: white;"
        >
          {{ t('scan.scan.preview.instruction_badge') }}
        </div>

        <!-- Image frame with corner brackets -->
        <div class="relative w-full max-w-sm aspect-[4/5] shrink-0">
          <!-- Corner brackets (purple) -->
          <div class="absolute inset-0 pointer-events-none z-10">
            <div class="absolute -top-1 -left-1 w-10 h-10 border-l-[3px] border-t-[3px] rounded-tl-md" style="border-color: hsl(var(--primary));" />
            <div class="absolute -top-1 -right-1 w-10 h-10 border-r-[3px] border-t-[3px] rounded-tr-md" style="border-color: hsl(var(--primary));" />
            <div class="absolute -bottom-1 -left-1 w-10 h-10 border-l-[3px] border-b-[3px] rounded-bl-md" style="border-color: hsl(var(--primary));" />
            <div class="absolute -bottom-1 -right-1 w-10 h-10 border-r-[3px] border-b-[3px] rounded-br-md" style="border-color: hsl(var(--primary));" />
          </div>
          <!-- Outer glow -->
          <div
            class="absolute -inset-3 pointer-events-none opacity-30"
            style="border: 2px solid hsl(var(--primary)); border-radius: 12px; filter: blur(8px);"
          />
          <!-- Image -->
          <img
            :src="imageUrl"
            :alt="t('scan.scan.detail.product_scanned')"
            class="w-full h-full object-contain rounded-md bg-black/40"
          />
        </div>

        <!-- Instructions bottom -->
        <div class="text-center space-y-2 max-w-xs shrink-0">
          <p class="text-white/90 font-semibold text-sm leading-snug">
            <i18n-t keypath="scan.scan.preview.instruction_text" scope="global">
              <template #br>
                <br>
              </template>
            </i18n-t>
          </p>
          <p class="flex items-center justify-center gap-1.5 text-white/50 text-xs font-medium uppercase tracking-wider">
            <PhInfo :size="14" weight="bold" />
            {{ t('scan.scan.preview.instruction_subtext') }}
          </p>
        </div>

        <!-- Bottom bar (dans le scroll pour rester accessible) -->
        <div class="w-full px-0 pb-4 pt-2 space-y-3 shrink-0" style="padding-bottom: max(env(safe-area-inset-bottom), 16px);">
          <!-- Allergen summary -->
          <button
            class="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors"
            style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.15); border-radius: var(--bold-radius);"
            @click="showAllergens = !showAllergens"
          >
            <span class="text-xs font-bold text-white/80">
              {{ selectedAllergenIds.size > 0 ? t('scan.scan.preview.allergen_count', { count: selectedAllergenIds.size }) : t('scan.scan.preview.no_allergens') }}
            </span>
            <span class="text-[10px] font-bold uppercase tracking-wider text-primary">
              {{ showAllergens ? t('scan.scan.preview.btn_close') : t('scan.scan.preview.btn_edit') }}
            </span>
          </button>

          <!-- Action row: Gallery - Scan button - Help -->
          <div class="flex items-end justify-between">
            <button
              class="flex flex-col items-center gap-1 px-3 py-1"
              @click="emit('changeImage')"
            >
              <div
                class="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 border border-white/20"
              >
                <PhImages :size="20" weight="bold" class="text-white/80" />
              </div>
              <span class="text-[10px] font-bold text-white/60 uppercase tracking-wider">{{ t('scan.scan.preview.btn_gallery') }}</span>
            </button>

            <button
              class="ai-scan-btn"
              :class="{ 'ai-scan-btn--active': !scanning }"
              :disabled="scanning"
              @click="emit('scanWithAI')"
            >
              <span class="ai-scan-btn__glow" />
              <span class="ai-scan-btn__content">
                <span v-if="scanning" class="flex items-center gap-2">
                  <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span class="font-extrabold text-sm uppercase tracking-wider">{{ t('scan.scan.preview.btn_analyzing') }}</span>
                </span>
                <span v-else class="flex items-center gap-2">
                  <span class="relative">
                    <PhMagicWand :size="20" weight="bold" />
                    <PhSparkle class="w-2.5 h-2.5 absolute -top-1 -right-2 text-yellow-300 animate-subtle-pulse" weight="fill" />
                  </span>
                  <span class="font-extrabold text-sm uppercase tracking-wider">{{ t('scan.scan.preview.btn_scan_ai') }}</span>
                </span>
              </span>
            </button>

            <button
              class="flex flex-col items-center gap-1 px-3 py-1"
              @click="showAllergens = !showAllergens"
            >
              <div
                class="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 border border-white/20"
              >
                <PhSparkle :size="20" weight="bold" class="text-primary" />
              </div>
              <span class="text-[10px] font-bold text-white/60 uppercase tracking-wider">{{ t('scan.scan.preview.btn_criteria') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Allergen panel (slide up) -->
    <Transition name="slide-up">
      <div v-if="showAllergens" class="absolute inset-x-0 bottom-0 z-30 bg-background text-foreground max-h-[60vh] overflow-y-auto" style="border-radius: var(--bold-radius) var(--bold-radius) 0 0; border: 2px solid var(--bold-border-color); border-bottom: none;">
        <div class="p-5 space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-black font-heading uppercase tracking-tight">{{ t('scan.scan.preview.title_allergens') }}</span>
            <button
              class="text-xs font-bold text-primary underline"
              @click="showAllergens = false"
            >
              {{ t('scan.scan.preview.btn_close') }}
            </button>
          </div>
          <AccountAllergensSection
            :all-allergens="allergensCatalog"
            :user-allergens="selectedAllergenIds"
            :is-loading="allergensLoading"
            @toggle="(id: string) => emit('toggle', id)"
          />
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.ai-scan-btn {
  position: relative;
  overflow: hidden;
  padding: 0.85rem 1.8rem;
  border-radius: 9999px;
  border: 2.5px solid hsl(var(--primary));
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85));
  color: white;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
  box-shadow:
    0 4px 20px hsl(var(--primary) / 0.35),
    0 0 0 0 hsl(var(--primary) / 0);
}
.ai-scan-btn:active {
  transform: scale(0.97);
}
.ai-scan-btn--active {
  animation: ai-btn-pulse 2.5s ease-in-out infinite;
}
.ai-scan-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.ai-scan-btn__glow {
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    hsl(var(--primary) / 0.6),
    transparent 40%,
    transparent 60%,
    hsl(var(--primary) / 0.4)
  );
  filter: blur(12px);
  opacity: 0.7;
  pointer-events: none;
}
.ai-scan-btn__content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes ai-btn-pulse {
  0%, 100% { box-shadow: 0 4px 20px hsl(var(--primary) / 0.35), 0 0 0 0 hsl(var(--primary) / 0.3); }
  50% { box-shadow: 0 4px 28px hsl(var(--primary) / 0.5), 0 0 0 8px hsl(var(--primary) / 0); }
}
</style>
