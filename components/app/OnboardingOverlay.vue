<script setup lang="ts">
import type { Component } from 'vue'
import { PhArrowRight, PhArrowLeft, PhX, PhShareNetwork, PhDotsThreeVertical, PhDownloadSimple, PhScan, PhGift, PhDeviceMobile, PhPlusSquare } from '@phosphor-icons/vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isVisible, currentStep, totalSteps, platform, nextStep, prevStep, skip } = useOnboarding()

const direction = ref<'next' | 'prev'>('next')
const touchStartX = ref<number | null>(null)
const SWIPE_THRESHOLD_PX = 56

function goNext() {
  direction.value = 'next'
  nextStep()
}

function goPrev() {
  direction.value = 'prev'
  prevStep()
}

const transitionName = computed(() =>
  direction.value === 'next' ? 'slide-left' : 'slide-right'
)

type EmojiSlide = {
  kind: 'emoji'
  emoji: string
  title: string
  description: string
  icon: Component | null
  pill: string | null
}

type ImageSlide = {
  kind: 'image'
  title: string
  description: string
  imageSrc: string
  altText: string
  imagePosition: string
  callouts: [string, string]
  checklist: [string, string, string]
}

type InstallSlide = {
  kind: 'install'
}

type AssistantSlide = {
  kind: 'assistant'
  title: string
  description: string
  previewTitle: string
  previewSummary: string
  userLabel: string
  userText: string
  japaneseLabel: string
  japaneseText: string
  romajiLabel: string
  romajiText: string
}

type OnboardingSlide = EmojiSlide | ImageSlide | AssistantSlide | InstallSlide

const slides = computed<OnboardingSlide[]>(() => [
  {
    kind: 'emoji',
    emoji: 'hi',
    title: t('onboarding.slides.slide_1.title'),
    description: t('onboarding.slides.slide_1.desc'),
    icon: null,
    pill: null,
  },
  {
    kind: 'emoji',
    emoji: 'geek',
    title: t('onboarding.slides.slide_2.title'),
    description: t('onboarding.slides.slide_2.desc'),
    icon: PhScan,
    pill: t('onboarding.slides.slide_2.pill'),
  },
  {
    kind: 'emoji',
    emoji: 'happy',
    title: t('onboarding.slides.slide_3.title'),
    description: t('onboarding.slides.slide_3.desc'),
    icon: PhGift,
    pill: t('onboarding.slides.slide_3.pill'),
  },
  {
    kind: 'image',
    title: t('onboarding.slides.scan_frame.title'),
    description: t('onboarding.slides.scan_frame.desc'),
    imageSrc: '/images/demo_onboarding.webp',
    altText: t('onboarding.slides.scan_frame.image_alt'),
    imagePosition: 'center top',
    callouts: [
      t('onboarding.slides.scan_frame.callout_top'),
      t('onboarding.slides.scan_frame.callout_bottom'),
    ],
    checklist: [
      t('onboarding.slides.scan_frame.tip_1'),
      t('onboarding.slides.scan_frame.tip_2'),
      t('onboarding.slides.scan_frame.tip_3'),
    ],
  },
  {
    kind: 'image',
    title: t('onboarding.slides.scan_quality.title'),
    description: t('onboarding.slides.scan_quality.desc'),
    imageSrc: '/images/demo_onboarding.webp',
    altText: t('onboarding.slides.scan_quality.image_alt'),
    imagePosition: 'center 34%',
    callouts: [
      t('onboarding.slides.scan_quality.callout_top'),
      t('onboarding.slides.scan_quality.callout_bottom'),
    ],
    checklist: [
      t('onboarding.slides.scan_quality.tip_1'),
      t('onboarding.slides.scan_quality.tip_2'),
      t('onboarding.slides.scan_quality.tip_3'),
    ],
  },
  {
    kind: 'assistant',
    title: t('onboarding.slides.assistant.title'),
    description: t('onboarding.slides.assistant.desc'),
    previewTitle: t('onboarding.slides.assistant.preview_title'),
    previewSummary: t('onboarding.slides.assistant.preview_summary'),
    userLabel: t('onboarding.slides.assistant.user_label'),
    userText: t('onboarding.slides.assistant.user_text'),
    japaneseLabel: t('onboarding.slides.assistant.japanese_label'),
    japaneseText: t('onboarding.slides.assistant.japanese_text'),
    romajiLabel: t('onboarding.slides.assistant.romaji_label'),
    romajiText: t('onboarding.slides.assistant.romaji_text'),
  },
  {
    kind: 'install',
  },
])

const activeSlide = computed(() => slides.value[currentStep.value] ?? slides.value[0])
const activeEmojiSlide = computed(() => activeSlide.value.kind === 'emoji' ? activeSlide.value : null)
const activeImageSlide = computed(() => activeSlide.value.kind === 'image' ? activeSlide.value : null)
const activeAssistantSlide = computed(() => activeSlide.value.kind === 'assistant' ? activeSlide.value : null)
const activeImageChecklist = computed(() => activeImageSlide.value ? activeImageSlide.value.checklist.slice(0, 2) : [])
const activeImageCallout = computed(() => activeImageSlide.value?.callouts[0] ?? '')

function sanitizeAltText(value?: string) {
  return value
    ?.replaceAll(/\bimage\b/gi, '')
    .replaceAll(/\s{2,}/g, ' ')
    .trim() ?? ''
}

const activeDemoAltText = computed(() => sanitizeAltText(activeImageSlide.value?.altText))
const isLastStep = computed(() => currentStep.value === totalSteps - 1)
const isMobileOnboarding = computed(() => platform.value !== 'desktop')
const showMobileFinalCta = computed(() => isMobileOnboarding.value && isLastStep.value)
const showDesktopFooterNav = computed(() => !isMobileOnboarding.value)

function resetTouchTracking() {
  touchStartX.value = null
}

function handleTouchStart(event: TouchEvent) {
  if (!isMobileOnboarding.value || event.touches.length !== 1) return
  touchStartX.value = event.touches[0]?.clientX ?? null
}

function handleTouchEnd(event: TouchEvent) {
  if (!isMobileOnboarding.value || touchStartX.value === null) return

  const endX = event.changedTouches[0]?.clientX ?? touchStartX.value
  const deltaX = endX - touchStartX.value
  resetTouchTracking()

  if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return

  if (deltaX < 0) {
    goNext()
    return
  }

  goPrev()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="onboarding-overlay">
      <div
        v-if="isVisible"
        class="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
        style="background: hsl(var(--background));"
      >
        <div class="ob-top-scrim" aria-hidden="true" />
        <div class="ob-top-fade" aria-hidden="true" />

        <!-- AI SaaS fullscreen wave background -->
        <div class="ob-bg" aria-hidden="true">
          <svg class="ob-wave-svg ob-wave-svg--1" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,200 C150,100 350,300 500,200 C650,100 800,280 900,180 L900,600 L0,600 Z" />
          </svg>
          <svg class="ob-wave-svg ob-wave-svg--2" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,300 C200,180 400,400 600,280 C750,190 850,350 900,280 L900,600 L0,600 Z" />
          </svg>
          <svg class="ob-wave-svg ob-wave-svg--3" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,150 C100,280 300,100 500,250 C700,400 820,200 900,300 L900,600 L0,600 Z" />
          </svg>
          <!-- Noise grain -->
          <div class="ob-noise" />
        </div>

        <!-- Corner accent glows -->
        <div class="ob-corner ob-corner--tl" aria-hidden="true" />
        <div class="ob-corner ob-corner--tr" aria-hidden="true" />
        <div class="ob-corner ob-corner--bl" aria-hidden="true" />
        <div class="ob-corner ob-corner--br" aria-hidden="true" />

        <!-- Skip button -->
        <button
          class="absolute top-4 right-4 z-10 flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-muted-foreground rounded-full transition-colors hover:bg-white/20 dark:hover:bg-white/10"
          style="border: 1.5px solid hsl(var(--foreground) / 0.15); border-radius: var(--bold-radius-pill); backdrop-filter: blur(8px);"
          @click="skip()"
        >
          <PhX :size="12" weight="bold" />
          {{ t('onboarding.skip') }}
        </button>

        <!-- Slide content -->
        <div
          class="relative z-[1] flex-1 flex items-center justify-center w-full px-6 max-w-md"
          @touchstart.passive="handleTouchStart"
          @touchend.passive="handleTouchEnd"
          @touchcancel="resetTouchTracking"
        >
          <Transition :name="transitionName" mode="out-in">
            <div
              v-if="activeEmojiSlide"
              :key="`emoji-${currentStep}`"
              class="flex flex-col items-center text-center space-y-5 w-full"
            >
              <div class="onboarding-emoji-bounce">
                <AppEmoji :name="activeEmojiSlide.emoji" :size="96" />
              </div>

              <div
                v-if="activeEmojiSlide.icon"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary"
                style="background: hsl(var(--primary) / 0.1); border: 1.5px solid hsl(var(--primary) / 0.25); border-radius: var(--bold-radius-pill);"
              >
                <component :is="activeEmojiSlide.icon" :size="13" weight="fill" />
                <span>{{ activeEmojiSlide.pill }}</span>
              </div>

              <div class="ob-text-card w-full">
                <h2 class="text-xl font-black font-heading tracking-tight leading-tight">
                  {{ activeEmojiSlide.title }}
                </h2>
                <p class="text-sm text-muted-foreground font-medium leading-relaxed mt-2">
                  {{ activeEmojiSlide.description }}
                </p>
              </div>
            </div>

            <div
              v-else-if="activeImageSlide"
              :key="`image-${currentStep}`"
              class="flex flex-col items-center text-center space-y-3.5 w-full"
            >
              <div class="ob-media-card">
                <div class="ob-media-shell">
                  <div class="ob-media-kicker">
                    {{ activeImageCallout }}
                  </div>
                  <img
                    :src="activeImageSlide.imageSrc"
                    :alt="activeDemoAltText"
                    class="ob-demo-image"
                    :style="{ objectPosition: activeImageSlide.imagePosition }"
                    width="704"
                    height="960"
                    loading="eager"
                    decoding="async"
                  >
                </div>
              </div>

              <div class="ob-text-card ob-text-card--scan w-full">
                <h2 class="text-xl font-black font-heading tracking-tight leading-tight">
                  {{ activeImageSlide.title }}
                </h2>
                <p class="text-sm text-muted-foreground font-medium leading-relaxed mt-2">
                  {{ activeImageSlide.description }}
                </p>
              </div>

              <div class="grid grid-cols-1 gap-2 w-full">
                <div
                  v-for="(point, index) in activeImageChecklist"
                  :key="point"
                  class="ob-check-card"
                >
                  <span class="ob-check-index">{{ index + 1 }}</span>
                  <p class="text-sm font-semibold text-foreground leading-snug">
                    {{ point }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-else-if="activeAssistantSlide"
              :key="`assistant-${currentStep}`"
              class="flex flex-col items-center text-center space-y-3.5 w-full"
            >
              <div class="ob-assistant-preview">
                <div class="ob-assistant-preview__top">
                  <div class="text-left min-w-0">
                    <p class="ob-assistant-preview__title">
                      {{ activeAssistantSlide.previewTitle }}
                    </p>
                    <p class="ob-assistant-preview__summary">
                      {{ activeAssistantSlide.previewSummary }}
                    </p>
                  </div>
                </div>

                <div class="ob-assistant-phrase">
                  <p class="ob-assistant-phrase__label">{{ activeAssistantSlide.userLabel }}</p>
                  <p class="ob-assistant-phrase__text">{{ activeAssistantSlide.userText }}</p>
                </div>

                <div class="ob-assistant-phrase ob-assistant-phrase--japanese">
                  <p class="ob-assistant-phrase__label">{{ activeAssistantSlide.japaneseLabel }}</p>
                  <p class="ob-assistant-phrase__text ob-assistant-phrase__text--japanese">{{ activeAssistantSlide.japaneseText }}</p>
                </div>

                <div class="ob-assistant-phrase ob-assistant-phrase--romaji">
                  <p class="ob-assistant-phrase__label">{{ activeAssistantSlide.romajiLabel }}</p>
                  <p class="ob-assistant-phrase__text ob-assistant-phrase__text--romaji">{{ activeAssistantSlide.romajiText }}</p>
                </div>
              </div>

              <div class="ob-text-card ob-text-card--scan w-full">
                <h2 class="text-xl font-black font-heading tracking-tight leading-tight">
                  {{ activeAssistantSlide.title }}
                </h2>
                <p class="text-sm text-muted-foreground font-medium leading-relaxed mt-2">
                  {{ activeAssistantSlide.description }}
                </p>
              </div>
            </div>

            <div
              v-else
              key="install"
              class="flex flex-col items-center text-center space-y-5"
            >
              <div class="onboarding-emoji-bounce relative">
                <div
                  class="w-24 h-24 rounded-2xl flex items-center justify-center"
                  style="
                    background: linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.12));
                    border: 2.5px solid var(--bold-border-color);
                    box-shadow: var(--bold-shadow);
                  "
                >
                  <PhDeviceMobile :size="48" weight="duotone" class="text-primary" />
                </div>
              </div>

              <h2 class="text-xl font-black font-heading tracking-tight leading-tight">
                <i18n-t keypath="onboarding.slides.slide_4.title" scope="global">
                  <template #mobile>
                    <span class="text-primary italic">{{ t('onboarding.slides.slide_4.mobile_label') }}</span>
                  </template>
                </i18n-t>
              </h2>

              <div class="ob-text-card w-full">
                <p class="text-sm text-muted-foreground font-medium leading-relaxed">
                  {{ t('onboarding.slides.slide_4.desc') }}
                </p>
              </div>

              <div
                class="w-full max-w-xs space-y-2.5 text-left"
                style="background: hsl(var(--card)); border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm); padding: 1rem;"
              >
                <template v-if="platform === 'ios'">
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary));"
                    >1</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      {{ t('onboarding.slides.slide_4.ios.step_1') }} <PhShareNetwork :size="13" weight="bold" class="inline -mt-0.5" /> <strong>{{ t('onboarding.slides.slide_4.ios.step_1_strong') }}</strong> {{ t('onboarding.slides.slide_4.ios.step_1_end') }}
                    </p>
                  </div>
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary));"
                    >2</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      {{ t('onboarding.slides.slide_4.ios.step_2') }} <PhPlusSquare :size="13" weight="bold" class="inline -mt-0.5" /> <strong>{{ t('onboarding.slides.slide_4.ios.step_2_strong') }}</strong>
                    </p>
                  </div>
                </template>

                <template v-else-if="platform === 'ios-other'">
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(40 96% 84%); color: hsl(26 92% 18%);"
                    >!</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      <i18n-t keypath="onboarding.slides.slide_4.ios_other.warning" scope="global">
                        <template #safari>
                          <strong class="text-foreground">{{ t('onboarding.slides.slide_4.ios_other.safari_label') }}</strong>
                        </template>
                      </i18n-t>
                    </p>
                  </div>
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary));"
                    >1</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      {{ t('onboarding.slides.slide_4.ios_other.step_1') }} <PhShareNetwork :size="13" weight="bold" class="inline -mt-0.5" /> <strong>{{ t('onboarding.slides.slide_4.ios_other.step_1_strong') }}</strong>
                    </p>
                  </div>
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary));"
                    >2</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      {{ t('onboarding.slides.slide_4.ios_other.step_2') }} <PhPlusSquare :size="13" weight="bold" class="inline -mt-0.5" /> <strong>{{ t('onboarding.slides.slide_4.ios_other.step_2_strong') }}</strong>
                    </p>
                  </div>
                </template>

                <template v-else-if="platform === 'android'">
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary));"
                    >1</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      {{ t('onboarding.slides.slide_4.android.step_1') }} <PhDotsThreeVertical :size="13" weight="bold" class="inline -mt-0.5" /> {{ t('onboarding.slides.slide_4.android.step_1_end') }}
                    </p>
                  </div>
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary));"
                    >2</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      {{ t('onboarding.slides.slide_4.android.step_2') }} <strong>{{ t('onboarding.slides.slide_4.android.step_2_strong') }}</strong>
                    </p>
                  </div>
                </template>

                <template v-else>
                  <div class="flex items-start gap-2.5">
                    <div
                      class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                      style="background: hsl(var(--primary) / 0.12); color: hsl(var(--primary));"
                    >1</div>
                    <p class="text-xs font-medium text-foreground pt-1">
                      {{ t('onboarding.slides.slide_4.desktop.step_1') }} <PhDownloadSimple :size="13" weight="bold" class="inline -mt-0.5" /> <strong>{{ t('onboarding.slides.slide_4.desktop.step_1_strong') }}</strong> {{ t('onboarding.slides.slide_4.desktop.step_1_end') }}
                    </p>
                  </div>
                </template>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Bottom controls -->
        <div class="relative z-[1] pb-10 pt-4 px-6 w-full max-w-sm space-y-4">
          <!-- Progress dots -->
          <div class="flex items-center justify-center gap-2">
            <div
              v-for="i in totalSteps"
              :key="i"
              class="h-2 rounded-full transition-all duration-300"
              :class="i - 1 === currentStep ? 'w-6' : 'w-2'"
              :style="i - 1 === currentStep
                ? 'background: hsl(var(--primary));'
                : i - 1 < currentStep
                  ? 'background: hsl(var(--primary) / 0.4);'
                  : 'background: hsl(var(--muted-foreground) / 0.25);'
              "
            />
          </div>

          <!-- Buttons -->
          <div v-if="showDesktopFooterNav" class="flex items-center gap-3">
            <button
              v-if="currentStep > 0"
              class="bold-btn bold-btn--ghost bold-btn--pill bold-btn--sm flex items-center gap-1"
              @click="goPrev()"
            >
              <PhArrowLeft :size="14" weight="bold" />
              {{ t('onboarding.btn_prev') }}
            </button>
            <div v-else />

            <button
              class="bold-btn bold-btn--primary bold-btn--pill bold-btn--sm flex-1 flex items-center justify-center gap-1.5"
              @click="goNext()"
            >
              <template v-if="isLastStep">
                {{ t('onboarding.btn_start') }}
              </template>
              <template v-else>
                {{ t('onboarding.btn_next') }}
                <PhArrowRight :size="14" weight="bold" />
              </template>
            </button>
          </div>

          <div v-else-if="showMobileFinalCta" class="flex items-center">
            <button
              class="bold-btn bold-btn--primary bold-btn--pill bold-btn--sm flex-1 flex items-center justify-center gap-1.5"
              @click="goNext()"
            >
              {{ t('onboarding.btn_start') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Overlay enter/leave */
.onboarding-overlay-enter-active {
  transition: opacity 0.4s ease;
}
.onboarding-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.onboarding-overlay-enter-from,
.onboarding-overlay-leave-to {
  opacity: 0;
}

/* Slide transitions */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-left-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* Emoji bounce on enter */
.onboarding-emoji-bounce {
  animation: onboarding-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes onboarding-bounce {
  0% {
    transform: scale(0.3) translateY(20px);
    opacity: 0;
  }
  60% {
    transform: scale(1.08) translateY(-4px);
    opacity: 1;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

/* ── AI SaaS Fullscreen Wave Background ── */
.ob-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.ob-top-fade {
  position: absolute;
  inset: 0 0 auto 0;
  height: 34%;
  background: linear-gradient(180deg, hsl(0 0% 100% / 1) 0%, hsl(0 0% 100% / 0.94) 16%, hsl(0 0% 100% / 0.72) 42%, hsl(0 0% 100% / 0) 100%);
  pointer-events: none;
  z-index: 0;
}

.ob-top-scrim {
  position: absolute;
  inset: 0 0 auto 0;
  height: 22%;
  background: linear-gradient(180deg, hsl(0 0% 100% / 1) 0%, hsla(0, 0%, 100%, 0.839) 38%, hsl(0 0% 100% / 0.88) 68%, hsl(0 0% 100% / 0) 100%);
  pointer-events: none;
  z-index: 0;
}

/* Each wave is an oversized, blurred, slowly drifting SVG blob */
.ob-wave-svg {
  position: absolute;
  width: 140%;
  height: 140%;
  filter: blur(70px);
  opacity: 0.34;
  will-change: transform;
}

/* Wave 1 — indigo/violet, bottom-left */
.ob-wave-svg--1 {
  bottom: -20%;
  left: -40%;
  fill: hsl(260 80% 65% / 0.42);
  animation: ob-drift-1 12s ease-in-out infinite;
}

/* Wave 2 — fuchsia/pink, bottom-right */
.ob-wave-svg--2 {
  bottom: -40%;
  right: -30%;
  fill: hsl(290 70% 60% / 0.28);
  animation: ob-drift-2 15s ease-in-out infinite;
}

/* Wave 3 — amber/gold, bottom-center */
.ob-wave-svg--3 {
  bottom: -30%;
  left: 10%;
  width: 130%;
  height: 130%;
  fill: hsl(38 95% 58% / 0.16);
  animation: ob-drift-3 18s ease-in-out infinite;
}

/* Tilt + translate + scale — give it a living, breathing feel */
@keyframes ob-drift-1 {
  0%   { transform: translate(0,    0)    scale(1)    skewX(0deg)  skewY(0deg)  rotate(0deg); }
  25%  { transform: translate(40px, 30px) scale(1.04) skewX(3deg)  skewY(1deg)  rotate(2deg); }
  50%  { transform: translate(20px, 55px) scale(1.02) skewX(-2deg) skewY(-1deg) rotate(-1deg); }
  75%  { transform: translate(-20px,25px) scale(0.97) skewX(1deg)  skewY(2deg)  rotate(1.5deg); }
  100% { transform: translate(0,    0)    scale(1)    skewX(0deg)  skewY(0deg)  rotate(0deg); }
}

@keyframes ob-drift-2 {
  0%   { transform: translate(0,     0)     scale(1)    skewX(0deg)  skewY(0deg)  rotate(0deg); }
  30%  { transform: translate(-50px, -40px) scale(1.06) skewX(-3deg) skewY(-2deg) rotate(-2deg); }
  60%  { transform: translate(30px,  -20px) scale(0.96) skewX(2deg)  skewY(1deg)  rotate(1deg); }
  80%  { transform: translate(-15px, -50px) scale(1.03) skewX(-1deg) skewY(-1deg) rotate(-0.5deg); }
  100% { transform: translate(0,     0)     scale(1)    skewX(0deg)  skewY(0deg)  rotate(0deg); }
}

@keyframes ob-drift-3 {
  0%   { transform: translate(0,     0)    scale(1)    skewX(0deg)  rotate(0deg); }
  50%  { transform: translate(-30px, 40px) scale(1.08) skewX(2deg)  rotate(1deg); }
  100% { transform: translate(0,     0)    scale(1)    skewX(0deg)  rotate(0deg); }
}

/* ── Corner accent glows ── */
.ob-corner {
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  filter: blur(40px);
  pointer-events: none;
  z-index: 0;
}

.ob-corner--tl {
  top: 40px;
  left: -40px;
  background: radial-gradient(circle, hsl(260 90% 70% / 0.26), transparent 70%);
  animation: ob-corner-pulse 6s ease-in-out infinite;
}

.ob-corner--tr {
  top: -40px;
  right: -40px;
  background: radial-gradient(circle, hsl(38 95% 60% / 0.22), transparent 70%);
  animation: ob-corner-pulse 8s ease-in-out infinite reverse;
}

.ob-corner--bl {
  bottom: -40px;
  left: -40px;
  background: radial-gradient(circle, hsl(38 95% 60% / 0.18), transparent 70%);
  animation: ob-corner-pulse 9s ease-in-out infinite;
}

.ob-corner--br {
  bottom: -40px;
  right: -40px;
  background: radial-gradient(circle, hsl(290 75% 65% / 0.22), transparent 70%);
  animation: ob-corner-pulse 7s ease-in-out infinite reverse;
}

@keyframes ob-corner-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.25); }
}

/* Subtle grain for premium feel */
.ob-noise {
  position: absolute;
  inset: 0;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 180px;
  pointer-events: none;
}

/* ── Text card — same style as app bold-card--static ── */
.ob-text-card {
  background: hsl(var(--card) / 0.92);
  border: 2.5px solid var(--bold-border-color);
  border-radius: var(--bold-radius);
  box-shadow: var(--bold-shadow);
  padding: 1rem 1.25rem;
  text-align: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ob-text-card--scan {
  max-width: 22rem;
}


.ob-media-card {
  width: min(100%, 16.25rem);
  margin: 0 auto;
  border: 2.5px solid var(--bold-border-color);
  border-radius: var(--bold-radius-xl);
  box-shadow: var(--bold-shadow-sm);
  background: hsl(var(--card) / 0.96);
}

.ob-media-shell {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--bold-radius-xl) - 4px);
  border: 2px solid hsl(var(--foreground) / 0.08);
  background: hsl(var(--muted) / 0.35);
  height: fit-content;
}

.ob-demo-image {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 13.2rem;
  height: auto;
  object-fit: contain;
}

.ob-media-kicker {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
  padding: 0.35rem 0.55rem;
  border-radius: var(--bold-radius-pill);
  border: 1.5px solid hsl(var(--foreground) / 0.1);
  background: hsl(var(--card) / 0.96);
  box-shadow: var(--bold-shadow-xs);
  font-size: 0.64rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1.15;
  color: hsl(var(--foreground));
}

.ob-check-card {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--bold-radius);
  border: 2px solid var(--bold-border-color);
  background: hsl(var(--card));
  box-shadow: var(--bold-shadow-xs);
  text-align: left;
}

.ob-check-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  border-radius: 0.65rem;
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  font-size: 0.76rem;
  font-weight: 900;
  border: 1.5px solid hsl(var(--primary) / 0.14);
}

.ob-assistant-preview {
  position: relative;
  width: min(100%, 22rem);
  border-radius: var(--bold-radius-xl);
  border: 2.5px solid var(--bold-border-color);
  background: hsl(var(--card));
  box-shadow: var(--bold-shadow);
  padding: 0.95rem;
  text-align: left;
}

.ob-assistant-preview::before {
  content: "";
  position: absolute;
  inset: -12px;
  border-radius: inherit;
  background:
    radial-gradient(circle at 14% 20%, hsl(308 100% 68% / 0.22), transparent 34%),
    radial-gradient(circle at 84% 18%, hsl(196 92% 72% / 0.18), transparent 30%),
    radial-gradient(circle at 58% 90%, hsl(46 100% 62% / 0.1), transparent 34%);
  filter: blur(14px);
  opacity: 0.92;
  pointer-events: none;
  z-index: -1;
}

.ob-assistant-preview__top {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.8rem;
}

.ob-assistant-preview__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.28rem 0.55rem;
  border-radius: var(--bold-radius-pill);
  border: 1.5px solid hsl(var(--primary) / 0.18);
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.ob-assistant-preview__title {
  font-size: 0.9rem;
  font-weight: 900;
  color: hsl(var(--foreground));
  line-height: 1.2;
}

.ob-assistant-preview__summary {
  margin-top: 0.18rem;
  font-size: 0.76rem;
  line-height: 1.4;
  color: hsl(var(--muted-foreground));
}

.ob-assistant-phrase {
  border-radius: 1rem;
  border: 1.5px solid hsl(var(--foreground) / 0.08);
  background: hsl(var(--background));
  padding: 0.75rem;
}

.ob-assistant-phrase + .ob-assistant-phrase {
  margin-top: 0.55rem;
}

.ob-assistant-phrase--japanese {
  background: hsl(var(--primary) / 0.06);
}

.ob-assistant-phrase--romaji {
  background: hsl(var(--muted) / 0.28);
}

.ob-assistant-phrase__label {
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.ob-assistant-phrase__text {
  margin-top: 0.35rem;
  font-size: 0.84rem;
  line-height: 1.5;
  color: hsl(var(--foreground));
}

.ob-assistant-phrase__text--japanese {
  font-size: 0.9rem;
  font-weight: 700;
}

.ob-assistant-phrase__text--romaji {
  font-size: 0.8rem;
  font-style: italic;
}

@media (min-width: 640px) {
  .ob-media-card {
    width: min(100%, 17.25rem);
  }
}
</style>
