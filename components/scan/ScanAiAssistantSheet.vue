<script setup lang="ts">
import { PhArrowClockwise, PhCheck, PhCopy, PhPause, PhPlus, PhSparkle, PhSpeakerHigh, PhSpinnerGap, PhWarning } from '@phosphor-icons/vue'
import { mergeCachedScanAssistant, type ScanAmbiguousAssistantResponse } from '~/utils/scan-ai-assistant'

const props = defineProps<{
  open: boolean
  scanId: string
  selectedAllergens: string[]
  supportMode: 'ambiguous' | 'allergen' | 'mixed'
  signalCount: number | { blocking: number; ambiguous: number }
  initialAssistantData: ScanAmbiguousAssistantResponse | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t, locale } = useI18n()
const { scanAmbiguousAssistant, scanAssistantTts } = useEdgeFunctions()
const { $queryClient } = useNuxtApp()

const bodyRef = ref<HTMLElement | null>(null)
const assistantData = ref<ScanAmbiguousAssistantResponse | null>(props.open ? props.initialAssistantData : null)
const assistantLoading = ref(false)
const assistantAppendingCards = ref(false)
const assistantError = ref<string | null>(null)
const assistantCardsError = ref<string | null>(null)
const analysisRequested = ref(Boolean(props.open && props.initialAssistantData))
const copiedKey = ref('')
const loadingStageIndex = ref(0)
const revealStage = ref(0)
const headerScrolled = ref(false)
const isPullClosing = ref(false)
const playbackAudio = shallowRef<HTMLAudioElement | null>(null)
const playingAudioKey = ref('')
const loadingAudioKey = ref('')
const audioErrorKey = ref('')
const audioUrlCache = ref<Record<string, string>>({})

let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null
let loadingStageTimer: ReturnType<typeof setInterval> | null = null
let revealTimers: ReturnType<typeof setTimeout>[] = []
let pullStartY = 0
let pullDeltaY = 0

const PULL_CLOSE_THRESHOLD = 72
const MAX_ASSISTANT_CARD_COUNT = 6

const currentLanguage = computed<'fr' | 'en'>(() => (locale.value === 'en' ? 'en' : 'fr'))
const dialogTitleId = computed(() => `assistant-sheet-title-${props.scanId}`)
const effectiveMode = computed<'ambiguous' | 'allergen'>(() => assistantData.value?.mode ?? (props.supportMode === 'mixed' ? 'allergen' : props.supportMode))
const assistantCopyKey = computed<'ambiguous' | 'allergen' | 'mixed'>(() =>
  assistantData.value?.mode
    ? assistantData.value.mode
    : props.supportMode,
)
const assistantSubtitle = computed(() =>
  t(`scan.scan.detail.assistant.subtitle_${assistantCopyKey.value}`),
)
const assistantPreviewBody = computed(() =>
  t(`scan.scan.detail.assistant.preview_body_${assistantCopyKey.value}`),
)
const assistantSummaryTitle = computed(() =>
  t(`scan.scan.detail.assistant.summary_title_${assistantCopyKey.value}`),
)
const assistantReasonsTitle = computed(() =>
  t(`scan.scan.detail.assistant.reasons_title_${assistantCopyKey.value}`),
)
const assistantCheckpointsTitle = computed(() =>
  t(`scan.scan.detail.assistant.checkpoints_title_${assistantCopyKey.value}`),
)
const assistantContextLabel = computed(() =>
  assistantCopyKey.value === 'mixed'
    ? t('scan.scan.detail.assistant.context_mixed', {
      blocking: typeof props.signalCount === 'object' ? props.signalCount.blocking : props.signalCount,
      ambiguous: typeof props.signalCount === 'object' ? props.signalCount.ambiguous : props.signalCount,
    })
    : t(`scan.scan.detail.assistant.context_${assistantCopyKey.value}`, {
      count: typeof props.signalCount === 'object'
        ? assistantCopyKey.value === 'allergen'
          ? props.signalCount.blocking
          : props.signalCount.ambiguous
        : props.signalCount,
    }),
)
const assistantCardCount = computed(() => assistantData.value?.store_phrases.length ?? 0)
const remainingAssistantCardSlots = computed(() => Math.max(0, MAX_ASSISTANT_CARD_COUNT - assistantCardCount.value))
const canAppendCards = computed(() =>
  Boolean(assistantData.value) && remainingAssistantCardSlots.value > 0 && !assistantLoading.value,
)

const loadingStageLabels = computed(() => ([
  t('scan.scan.detail.assistant.loading_stage_reason'),
  t('scan.scan.detail.assistant.loading_stage_japanese'),
  t('scan.scan.detail.assistant.loading_stage_cards'),
]))

function syncAssistantCacheLocally(response: ScanAmbiguousAssistantResponse) {
  $queryClient?.setQueryData(['scan-detail', props.scanId], (current: Record<string, unknown> | null | undefined) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return current
    }

    return {
      ...current,
      assistant_cache_json: mergeCachedScanAssistant(
        current.assistant_cache_json ?? null,
        currentLanguage.value,
        response,
      ),
    }
  })
}


function clearLoadingStageTimer() {
  if (!loadingStageTimer) return
  clearInterval(loadingStageTimer)
  loadingStageTimer = null
}

function startLoadingStageLoop() {
  clearLoadingStageTimer()
  loadingStageIndex.value = 0

  if (!import.meta.client) return

  loadingStageTimer = setInterval(() => {
    loadingStageIndex.value = (loadingStageIndex.value + 1) % loadingStageLabels.value.length
  }, 920)
}

function clearRevealTimers() {
  for (const timer of revealTimers) clearTimeout(timer)
  revealTimers = []
}

function startRevealSequence() {
  clearRevealTimers()

  if (!assistantData.value) {
    revealStage.value = 0
    return
  }

  if (!import.meta.client) {
    revealStage.value = 4
    return
  }

  revealStage.value = 0
  const steps = [
    { stage: 1, delay: 40 },
    { stage: 2, delay: 170 },
    { stage: 3, delay: 300 },
    { stage: 4, delay: 420 },
  ]

  for (const step of steps) {
    revealTimers.push(setTimeout(() => {
      revealStage.value = step.stage
    }, step.delay))
  }
}

function syncHeaderScrolled() {
  headerScrolled.value = (bodyRef.value?.scrollTop ?? 0) > 8
}

function resetPullCloseState() {
  isPullClosing.value = false
  pullStartY = 0
  pullDeltaY = 0
}

function handlePullStart(event: TouchEvent) {
  if (!props.open) return
  pullStartY = event.touches[0]?.clientY ?? 0
  pullDeltaY = 0
  isPullClosing.value = false
}

function handlePullMove(event: TouchEvent) {
  const scrollTop = bodyRef.value?.scrollTop ?? 0
  if (scrollTop > 0) {
    resetPullCloseState()
    return
  }

  const currentY = event.touches[0]?.clientY ?? 0
  const delta = currentY - pullStartY

  if (delta <= 0) {
    if (!isPullClosing.value) return
    resetPullCloseState()
    return
  }

  if (delta < 10) return

  isPullClosing.value = true
  pullDeltaY = delta
  event.preventDefault()
}

function handlePullEnd() {
  if (!isPullClosing.value) {
    resetPullCloseState()
    return
  }

  if (pullDeltaY >= PULL_CLOSE_THRESHOLD) {
    emit('close')
  }

  resetPullCloseState()
}

function handleWheelClose(event: WheelEvent) {
  if ((bodyRef.value?.scrollTop ?? 0) > 0) return
  if (event.deltaY >= -36) return
  emit('close')
}

function resetAssistantState(preserveRequested = false) {
  stopAudioPlayback()
  assistantData.value = null
  assistantLoading.value = false
  assistantAppendingCards.value = false
  assistantError.value = null
  assistantCardsError.value = null
  analysisRequested.value = preserveRequested
  loadingStageIndex.value = 0
  revealStage.value = 0
  headerScrolled.value = false
  loadingAudioKey.value = ''
  audioErrorKey.value = ''
  audioUrlCache.value = {}
  clearLoadingStageTimer()
  clearRevealTimers()
}

function applyInitialAssistantData() {
  if (!props.initialAssistantData) return false

  stopAudioPlayback()
  assistantData.value = props.initialAssistantData
  assistantLoading.value = false
  assistantAppendingCards.value = false
  assistantError.value = null
  assistantCardsError.value = null
  analysisRequested.value = true
  loadingAudioKey.value = ''
  audioErrorKey.value = ''
  audioUrlCache.value = {}
  clearLoadingStageTimer()
  return true
}

function phraseAudioKey(index: number) {
  return `${currentLanguage.value}-${index}`
}

function getAudioButtonLabel(index: number) {
  const key = phraseAudioKey(index)

  if (loadingAudioKey.value === key) {
    return t('scan.scan.detail.assistant.btn_audio_loading')
  }

  if (playingAudioKey.value === key) {
    return t('scan.scan.detail.assistant.btn_stop')
  }

  return t('scan.scan.detail.assistant.btn_listen')
}

function getCopyButtonLabel(key: string) {
  return copiedKey.value === key
    ? t('scan.scan.detail.assistant.btn_copied')
    : t('scan.scan.detail.assistant.btn_copy')
}

function stopAudioPlayback() {
  const audio = playbackAudio.value
  if (audio) {
    audio.onended = null
    audio.onerror = null
    audio.pause()
    audio.currentTime = 0
  }

  playbackAudio.value = null
  playingAudioKey.value = ''
}

async function loadAssistant(force = false) {
  if (assistantLoading.value) return
  if (!force && assistantData.value) return

  analysisRequested.value = true
  assistantLoading.value = true
  assistantError.value = null
  assistantCardsError.value = null
  loadingStageIndex.value = 0
  revealStage.value = 0
  stopAudioPlayback()
  loadingAudioKey.value = ''
  audioErrorKey.value = ''
  audioUrlCache.value = {}

  if (import.meta.client) {
    bodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  try {
    const nextAssistantData = await scanAmbiguousAssistant({
      scan_id: props.scanId,
      language: currentLanguage.value,
      force,
    })
    assistantData.value = nextAssistantData
    syncAssistantCacheLocally(nextAssistantData)
  } catch (error) {
    assistantError.value = error instanceof Error
      ? error.message
      : t('scan.scan.detail.assistant.error_generic')
  } finally {
    assistantLoading.value = false
    syncHeaderScrolled()
  }
}

async function appendAssistantCards() {
  if (!assistantData.value || assistantLoading.value || assistantAppendingCards.value || remainingAssistantCardSlots.value <= 0) return

  assistantAppendingCards.value = true
  assistantCardsError.value = null
  stopAudioPlayback()

  try {
    const nextAssistantData = await scanAmbiguousAssistant({
      scan_id: props.scanId,
      language: currentLanguage.value,
      append_cards: true,
    })
    assistantData.value = nextAssistantData
    syncAssistantCacheLocally(nextAssistantData)
  } catch (error) {
    assistantCardsError.value = error instanceof Error
      ? error.message
      : t('scan.scan.detail.assistant.error_generic')
  } finally {
    assistantAppendingCards.value = false
    syncHeaderScrolled()
  }
}

async function togglePhraseAudio(index: number) {
  const key = phraseAudioKey(index)

  if (loadingAudioKey.value === key) return
  if (playingAudioKey.value === key) {
    stopAudioPlayback()
    return
  }

  stopAudioPlayback()
  loadingAudioKey.value = key
  audioErrorKey.value = ''

  try {
    const cachedUrl = audioUrlCache.value[key]
    const audioUrl = cachedUrl || (await scanAssistantTts({
      scan_id: props.scanId,
      phrase_index: index,
      language: currentLanguage.value,
    })).audio_url

    if (!cachedUrl) {
      audioUrlCache.value = {
        ...audioUrlCache.value,
        [key]: audioUrl,
      }
    }

    const audio = new Audio(audioUrl)
    audio.preload = 'auto'
    playbackAudio.value = audio
    audio.onended = () => {
      if (playingAudioKey.value === key) {
        playbackAudio.value = null
        playingAudioKey.value = ''
      }
    }
    audio.onerror = () => {
      if (playingAudioKey.value === key || loadingAudioKey.value === key) {
        playbackAudio.value = null
        playingAudioKey.value = ''
        audioErrorKey.value = key
      }
    }

    await audio.play()
    playingAudioKey.value = key
  } catch {
    stopAudioPlayback()
    audioErrorKey.value = key
  } finally {
    if (loadingAudioKey.value === key) {
      loadingAudioKey.value = ''
    }
  }
}

async function copyBlock(text: string, key: string) {
  if (!text || !navigator?.clipboard?.writeText) return

  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = setTimeout(() => {
      copiedKey.value = ''
      copyFeedbackTimer = null
    }, 1400)
  } catch {
    copiedKey.value = ''
  }
}

watch(() => props.open, async (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }

  if (!open) {
    stopAudioPlayback()
    loadingAudioKey.value = ''
    audioErrorKey.value = ''
    audioUrlCache.value = {}
    headerScrolled.value = false
    resetPullCloseState()
    return
  }

  await nextTick()
  if (!assistantData.value) {
    applyInitialAssistantData()
  }
  syncHeaderScrolled()
})

watch(() => props.scanId, () => {
  resetAssistantState(false)
})

watch(() => props.initialAssistantData, (value) => {
  if (!props.open || assistantLoading.value || assistantData.value || !value) return
  applyInitialAssistantData()
})

watch(currentLanguage, () => {
  const shouldHydrateFromCache = props.open && props.initialAssistantData !== null
  resetAssistantState(shouldHydrateFromCache)
  if (applyInitialAssistantData()) {
    return
  }
})

watch(assistantLoading, (loading) => {
  if (loading) {
    startLoadingStageLoop()
    return
  }

  clearLoadingStageTimer()
})

watch(assistantData, (value) => {
  if (!value) {
    clearRevealTimers()
    revealStage.value = 0
    return
  }

  startRevealSequence()
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
  stopAudioPlayback()
  clearLoadingStageTimer()
  clearRevealTimers()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="assistant-sheet-overlay">
      <div
        v-if="open"
        class="assistant-sheet-root fixed inset-0 z-[120] flex items-end md:items-stretch md:justify-end"
      >
        <button
          class="assistant-sheet-backdrop absolute inset-0"
          :aria-label="t('scan.scan.detail.assistant.btn_close')"
          @click="emit('close')"
        />

        <dialog
          open
          class="assistant-sheet-panel relative ml-auto flex h-[80vh] w-full max-w-xl flex-col overflow-hidden md:h-full md:max-w-[30rem]"
          :aria-labelledby="dialogTitleId"
          @cancel.prevent="emit('close')"
          @touchstart.passive="handlePullStart"
          @touchmove="handlePullMove"
          @touchend="handlePullEnd"
          @touchcancel="handlePullEnd"
        >
            <div
              :class="{ 'assistant-sheet-header--scrolled': headerScrolled }"
              class="assistant-sheet-header"
            >
              <div class="assistant-sheet-badge-row">
                <button
                  class="assistant-close-handle"
                  type="button"
                  :aria-label="t('scan.scan.detail.assistant.btn_close')"
                  @click="emit('close')"
                >
                  <span class="assistant-close-handle__bar" />
                </button>
              </div>

              <div class="assistant-sheet-title-row">
                <div>
                  <h2 :id="dialogTitleId" class="assistant-sheet-title">
                    {{ t('scan.scan.detail.assistant.title') }}
                  </h2>
                  <p class="assistant-sheet-subtitle">
                    {{ assistantSubtitle }}
                  </p>
                </div>
              </div>

              <div class="assistant-sheet-context">
                <span class="assistant-context-pill">
                  {{ assistantContextLabel }}
                </span>
                <span
                  v-for="allergen in selectedAllergens.slice(0, 3)"
                  :key="allergen"
                  class="bold-pill bold-pill--primary assistant-allergen-pill"
                >
                  <PhSparkle :size="10" weight="fill" class="assistant-allergen-pill__icon" />
                  <span>{{ allergen }}</span>
                </span>
              </div>
            </div>

            <div
              ref="bodyRef"
              class="assistant-sheet-body"
              @scroll="syncHeaderScrolled"
              @wheel.passive="handleWheelClose"
            >
              <div
                v-if="!analysisRequested && !assistantLoading && !assistantData && !assistantError"
                class="assistant-intro-stack"
              >
                <article class="assistant-intro-card">
                  <p class="assistant-section-eyebrow">
                    {{ t('scan.scan.detail.assistant.preview_title') }}
                  </p>
                  <p class="assistant-intro-copy">
                    {{ assistantPreviewBody }}
                  </p>

                  <div class="assistant-stage-stack">
                    <div
                      v-for="(stage, index) in loadingStageLabels"
                      :key="stage"
                      class="assistant-stage-pill"
                    >
                      <span class="assistant-stage-index">{{ index + 1 }}</span>
                      <span>{{ stage }}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="assistant-launch-btn bold-btn bold-btn--primary bold-btn--pill bold-btn--lg w-full"
                    @click="loadAssistant()"
                  >
                    <span class="assistant-launch-btn__icon">
                      <PhSparkle :size="16" weight="fill" />
                    </span>
                    {{ t('scan.scan.detail.assistant.btn_start') }}
                  </button>
                </article>
              </div>

              <div v-else-if="assistantLoading" class="assistant-loading-stack">
                <div class="assistant-loading-card assistant-loading-card--hero">
                  <div class="assistant-loading-orb" aria-hidden="true">
                    <PhSpinnerGap :size="18" weight="bold" class="assistant-loading-orb__spinner animate-spin" />
                  </div>
                  <div class="assistant-loading-copy">
                    <p class="assistant-loading-title">
                      {{ t('scan.scan.detail.assistant.loading') }}
                    </p>
                  </div>
                </div>

                <div class="assistant-loading-stage-stack">
                  <div
                    v-for="(stage, index) in loadingStageLabels"
                    :key="stage"
                    :class="{ 'assistant-loading-stage--active': index === loadingStageIndex }"
                    class="assistant-loading-stage"
                  >
                    <span class="assistant-loading-stage-index">{{ index + 1 }}</span>
                    <div class="assistant-loading-stage-copy">
                      <p class="assistant-loading-stage-title">{{ stage }}</p>
                      <div class="assistant-loading-line" />
                    </div>
                    <PhSpinnerGap
                      v-if="index === loadingStageIndex"
                      :size="14"
                      class="animate-spin text-primary"
                    />
                  </div>
                </div>
              </div>

              <div v-else-if="assistantError" class="assistant-error-card">
                <div class="flex items-start gap-3">
                  <div class="assistant-error-icon">
                    <PhWarning :size="18" weight="fill" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-black text-foreground">
                      {{ t('scan.scan.detail.assistant.error_title') }}
                    </p>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {{ assistantError }}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="assistant-refresh-btn"
                  @click="loadAssistant(true)"
                >
                  <PhArrowClockwise :size="14" weight="bold" />
                  {{ t('scan.scan.detail.assistant.btn_retry') }}
                </button>
              </div>

              <template v-else-if="assistantData">
                <article
                  :class="{ 'assistant-reveal-card--visible': revealStage >= 1 }"
                  class="assistant-summary-card assistant-reveal-card"
                >
                  <div class="assistant-summary-head">
                    <p class="assistant-section-eyebrow">
                      {{ assistantSummaryTitle }}
                    </p>
                    <button
                      type="button"
                      class="assistant-refresh-btn assistant-refresh-btn--quiet"
                      :disabled="assistantAppendingCards"
                      @click="loadAssistant(true)"
                    >
                      <PhArrowClockwise :size="13" weight="bold" />
                      {{ t('scan.scan.detail.assistant.btn_regenerate') }}
                    </button>
                  </div>
                  <p class="assistant-summary-text assistant-summary-text--generated">
                    {{ assistantData.analysis_summary }}
                  </p>
                </article>

                <div
                  :class="{ 'assistant-reveal-card--visible': revealStage >= 2 }"
                  class="assistant-detail-grid assistant-reveal-card"
                >
                  <article class="assistant-list-card">
                    <p class="assistant-section-eyebrow">
                      {{ assistantReasonsTitle }}
                    </p>
                    <ul class="assistant-list">
                      <li
                        v-for="reason in assistantData.ambiguity_reasons"
                        :key="reason"
                        class="assistant-list-item"
                      >
                        {{ reason }}
                      </li>
                    </ul>
                  </article>

                  <article class="assistant-list-card">
                    <div class="assistant-list-header">
                      <p class="assistant-section-eyebrow">
                        {{ assistantCheckpointsTitle }}
                      </p>
                    </div>
                    <ul class="assistant-list">
                      <li
                        v-for="checkpoint in assistantData.checkpoints"
                        :key="checkpoint"
                        class="assistant-list-item"
                      >
                        {{ checkpoint }}
                      </li>
                    </ul>
                  </article>
                </div>

                <div
                  :class="{ 'assistant-reveal-card--visible': revealStage >= 3 }"
                  class="assistant-phrase-stack assistant-reveal-card"
                >
                  <p v-if="assistantCardsError" class="assistant-audio-error">
                    {{ assistantCardsError }}
                  </p>
                  <template v-for="(phrase, index) in assistantData.store_phrases" :key="`${phrase.title}-${index}`">
                    <article
                      class="assistant-phrase-card assistant-phrase-card--visible"
                      :style="{ transitionDelay: `${index * 80}ms` }"
                    >
                      <div class="assistant-phrase-head">
                        <div>
                          <h3 class="assistant-phrase-title">{{ phrase.title }}</h3>
                        </div>
                        <span class="assistant-phrase-step">
                          {{ t('scan.scan.detail.assistant.card_index', { index: index + 1 }) }}
                        </span>
                      </div>

                      <div class="assistant-language-block assistant-language-block--japanese assistant-language-block--featured">
                        <div class="assistant-language-head">
                          <span>{{ t('scan.scan.detail.assistant.language_japanese') }}</span>
                          <div class="assistant-language-actions">
                            <button
                              type="button"
                              class="assistant-copy-btn assistant-copy-btn--icon"
                              :disabled="loadingAudioKey === phraseAudioKey(index)"
                              :aria-label="getAudioButtonLabel(index)"
                              :title="getAudioButtonLabel(index)"
                              :aria-pressed="playingAudioKey === phraseAudioKey(index)"
                              @click="togglePhraseAudio(index)"
                            >
                              <PhSpinnerGap
                                v-if="loadingAudioKey === phraseAudioKey(index)"
                                :size="15"
                                class="animate-spin"
                              />
                              <PhPause
                                v-else-if="playingAudioKey === phraseAudioKey(index)"
                                :size="15"
                                weight="fill"
                              />
                              <PhSpeakerHigh
                                v-else
                                :size="15"
                                weight="fill"
                              />
                            </button>
                            <button
                              type="button"
                              class="assistant-copy-btn assistant-copy-btn--icon"
                              :aria-label="getCopyButtonLabel(`jp-${index}`)"
                              :title="getCopyButtonLabel(`jp-${index}`)"
                              @click="copyBlock(phrase.japanese, `jp-${index}`)"
                            >
                              <PhCheck v-if="copiedKey === `jp-${index}`" :size="15" weight="bold" />
                              <PhCopy v-else :size="15" weight="bold" />
                            </button>
                          </div>
                        </div>
                        <p class="assistant-language-text assistant-language-text--japanese">{{ phrase.japanese }}</p>
                        <p v-if="audioErrorKey === phraseAudioKey(index)" class="assistant-audio-error">
                          {{ t('scan.scan.detail.assistant.audio_error') }}
                        </p>
                      </div>

                      <div class="assistant-language-grid">
                        <div class="assistant-language-block">
                          <div class="assistant-language-head">
                            <span>{{ t('scan.scan.detail.assistant.language_user') }}</span>
                            <button
                              type="button"
                              class="assistant-copy-btn assistant-copy-btn--icon"
                              :aria-label="getCopyButtonLabel(`user-${index}`)"
                              :title="getCopyButtonLabel(`user-${index}`)"
                              @click="copyBlock(phrase.user_language, `user-${index}`)"
                            >
                              <PhCheck v-if="copiedKey === `user-${index}`" :size="15" weight="bold" />
                              <PhCopy v-else :size="15" weight="bold" />
                            </button>
                          </div>
                          <p class="assistant-language-text">{{ phrase.user_language }}</p>
                        </div>

                        <div class="assistant-language-block assistant-language-block--romaji">
                          <div class="assistant-language-head">
                            <span>{{ t('scan.scan.detail.assistant.language_romaji') }}</span>
                            <button
                              type="button"
                              class="assistant-copy-btn assistant-copy-btn--icon"
                              :aria-label="getCopyButtonLabel(`romaji-${index}`)"
                              :title="getCopyButtonLabel(`romaji-${index}`)"
                              @click="copyBlock(phrase.romaji, `romaji-${index}`)"
                            >
                              <PhCheck v-if="copiedKey === `romaji-${index}`" :size="15" weight="bold" />
                              <PhCopy v-else :size="15" weight="bold" />
                            </button>
                          </div>
                          <p class="assistant-language-text assistant-language-text--romaji">{{ phrase.romaji }}</p>
                        </div>
                      </div>
                    </article>
                  </template>
                  <button
                    v-if="canAppendCards"
                    type="button"
                    class="assistant-add-cards-btn bold-btn bold-btn--pill bold-btn--lg w-full"
                    :disabled="assistantAppendingCards"
                    @click="appendAssistantCards()"
                  >
                    <span class="assistant-launch-btn__icon">
                      <PhSpinnerGap
                        v-if="assistantAppendingCards"
                        :size="16"
                        class="animate-spin"
                      />
                      <PhPlus v-else :size="16" weight="bold" />
                    </span>
                    {{ t('scan.scan.detail.assistant.btn_add_cards') }}
                  </button>
                </div>

                <article
                  :class="{ 'assistant-reveal-card--visible': revealStage >= 4 }"
                  class="assistant-disclaimer-card assistant-reveal-card"
                >
                  <p class="assistant-section-eyebrow">
                    {{ t('scan.scan.detail.assistant.disclaimer_title') }}
                  </p>
                  <p class="assistant-disclaimer-text">
                    {{ assistantData.disclaimer }}
                  </p>
                </article>
              </template>
            </div>
        </dialog>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.assistant-sheet-backdrop {
  background: hsl(222 15% 10% / 0.42);
  backdrop-filter: blur(10px);
}

.assistant-sheet-panel {
  margin: 0;
  padding: 0;
  border-top-left-radius: 1.5rem;
  border-top-right-radius: 1.5rem;
  border: 2px solid hsl(var(--foreground) / 0.08);
  background:
    radial-gradient(circle at top right, hsl(var(--primary) / 0.12), transparent 34%),
    linear-gradient(180deg, hsl(var(--background)), hsl(var(--background)));
  box-shadow: 0 24px 80px hsl(222 18% 10% / 0.22);
}

.assistant-sheet-header {
  position: relative;
  z-index: 2;
  padding: 0rem 1rem 0.85rem 1rem;
  background: hsl(var(--background));
  backdrop-filter: blur(14px) saturate(145%);
}

.assistant-sheet-header::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3.6rem;
  height: 3.6rem;
  background: linear-gradient(180deg, hsl(var(--background) / 1), hsl(var(--background)) 20%, hsl(var(--background) / 0));
  pointer-events: none;
}

.assistant-sheet-header--scrolled {
  border-bottom-color: hsl(var(--foreground) / 0.1);
}

.assistant-sheet-header--scrolled::after {
  background: linear-gradient(180deg, hsl(var(--background) / 1), hsl(var(--background)) 20%, hsl(var(--background) / 0));
}

.assistant-sheet-badge-row {
  display: flex;
  align-items: center;
  justify-content: center;
}

.assistant-close-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4.4rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.assistant-close-handle__bar {
  display: block;
  width: 3.15rem;
  height: 0.36rem;
  border-radius: 999px;
  background: hsl(var(--foreground) / 0.22);
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.35);
}

.assistant-sheet-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  justify-content: space-between;
  margin-top: 0.5rem;
}

.assistant-sheet-title {
  font-size: 1.25rem;
  line-height: 1.05;
  font-weight: 900;
  font-family: var(--font-heading, inherit);
  letter-spacing: -0.02em;
  color: hsl(var(--foreground));
}

.assistant-sheet-subtitle {
  margin-top: 0.3rem;
  font-size: 0.9rem;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
  max-width: 100%;
}

.assistant-sheet-context {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.9rem;
}

.assistant-context-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  border: 1.5px solid hsl(var(--foreground) / 0.08);
  background: hsl(var(--card) / 0.88);
  font-size: 0.7rem;
  font-weight: 800;
  color: hsl(var(--muted-foreground));
}

.assistant-allergen-pill {
  gap: 0.35rem;
  padding: 0.28rem 0.68rem;
  font-size: 0.72rem;
  line-height: 1;
}

.assistant-allergen-pill__icon {
  flex-shrink: 0;
}

.assistant-sheet-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 2rem 1rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.assistant-intro-stack,
.assistant-loading-stack,
.assistant-phrase-stack {
  display: grid;
  gap: 0.85rem;
}

.assistant-intro-card,
.assistant-summary-card,
.assistant-list-card,
.assistant-phrase-card,
.assistant-disclaimer-card,
.assistant-loading-card,
.assistant-error-card {
  border-radius: var(--bold-radius);
  border: 2px solid var(--bold-border-color);
  background: hsl(var(--card));
  box-shadow: var(--bold-shadow-xs);
}

.assistant-intro-card,
.assistant-summary-card,
.assistant-list-card,
.assistant-disclaimer-card,
.assistant-loading-card,
.assistant-error-card {
  padding: 1rem;
}

.assistant-phrase-card {
  position: relative;
  overflow: hidden;
  transform: translateY(0);
  padding: 0.95rem;
}

.assistant-section-eyebrow {
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.assistant-intro-copy,
.assistant-summary-text,
.assistant-disclaimer-text {
  margin-top: 0.45rem;
  font-size: 0.96rem;
  line-height: 1.58;
  color: hsl(var(--foreground));
}

.assistant-summary-text--generated {
  position: relative;
}

.assistant-summary-text--generated::after {
  content: "";
  position: absolute;
  inset: -0.1rem;
  background: linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.12) 48%, transparent 100%);
  opacity: 0;
  pointer-events: none;
  animation: assistant-summary-sheen 680ms ease-out 1;
}

.assistant-copy-btn,
.assistant-refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-radius: 999px;
  border: 1.5px solid var(--bold-border-color);
  background: hsl(var(--card));
  padding: 0.55rem 0.95rem;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: hsl(var(--foreground));
  box-shadow: var(--bold-shadow-xs);
  cursor: pointer;
}

.assistant-copy-btn:disabled {
  cursor: default;
  opacity: 0.72;
}

.assistant-launch-btn {
  margin-top: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  justify-content: center;
}

.assistant-launch-btn__icon {
  position: relative;
  top: -1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.assistant-refresh-btn--quiet {
  font-size: 0.64rem;
}

.assistant-stage-stack {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.95rem;
}

.assistant-stage-pill,
.assistant-loading-stage {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border-radius: 1rem;
  border: 1.5px solid hsl(var(--foreground) / 0.08);
  background: hsl(var(--background));
  padding: 0.75rem 0.85rem;
}

.assistant-stage-index,
.assistant-loading-stage-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  min-height: 1.5rem;
  border-radius: 999px;
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  font-size: 0.7rem;
  font-weight: 900;
}

.assistant-loading-card--hero {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  background:
    radial-gradient(circle at top right, hsl(var(--primary) / 0.12), transparent 42%),
    hsl(var(--card));
}

.assistant-loading-orb {
  width: 2.9rem;
  height: 2.9rem;
  min-width: 2.9rem;
  min-height: 2.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 999px;
  background: hsl(var(--background));
  border: 1.5px solid hsl(var(--primary) / 0.18);
}

.assistant-loading-orb__spinner {
  color: hsl(var(--primary));
}

.assistant-loading-copy {
  min-width: 0;
}

.assistant-loading-title {
  margin-top: 0.28rem;
  font-size: 0.98rem;
  line-height: 1.45;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.assistant-loading-stage-stack {
  display: grid;
  gap: 0.65rem;
}

.assistant-loading-stage {
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.assistant-loading-stage--active {
  transform: translateY(-1px);
  border-color: hsl(var(--primary) / 0.22);
  background:
    linear-gradient(180deg, hsl(var(--primary) / 0.08), hsl(var(--background)));
}

.assistant-loading-stage-copy {
  min-width: 0;
  flex: 1;
}

.assistant-loading-stage-title {
  font-size: 0.84rem;
  font-weight: 800;
  color: hsl(var(--foreground));
}

.assistant-loading-line {
  height: 0.5rem;
  margin-top: 0.45rem;
  border-radius: 999px;
  background: linear-gradient(90deg, hsl(var(--muted) / 0.6), hsl(var(--muted) / 0.28), hsl(var(--muted) / 0.6));
  background-size: 200% 100%;
  animation: assistant-skeleton 1.15s linear infinite;
}

.assistant-error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 0.85rem;
  background: hsl(38 95% 90%);
  color: hsl(28 92% 22%);
}

.assistant-error-card {
  display: grid;
  gap: 0.9rem;
}

.assistant-detail-grid {
  display: grid;
  gap: 0.85rem;
}

.assistant-summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.assistant-list {
  margin-top: 0.55rem;
  display: grid;
  gap: 0.55rem;
}

.assistant-language-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.assistant-copy-btn--icon {
  width: 2.35rem;
  height: 2.35rem;
  min-width: 2.35rem;
  min-height: 2.35rem;
  padding: 0;
  border-radius: 10px;
}

.assistant-audio-error {
  margin-top: 0.55rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: hsl(28 92% 26%);
}

.assistant-list-item {
  position: relative;
  padding-left: 1rem;
  font-size: 0.92rem;
  line-height: 1.5;
  color: hsl(var(--foreground));
}

.assistant-list-item::before {
  content: "";
  position: absolute;
  top: 0.58rem;
  left: 0;
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: hsl(var(--primary));
}

.assistant-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.assistant-add-cards-btn {
  margin-top: 0.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.95rem 1rem;
  border: 2.5px dashed #000;
  border-radius: var(--bold-radius);
  box-shadow: none;
  background: hsl(var(--card));
  color: #000;
  opacity: 0.8;
  transition: background 160ms ease, opacity 160ms ease, transform 160ms ease;
}

.assistant-add-cards-btn:hover:not(:disabled) {
  background: hsl(var(--primary) / 0.05);
  opacity: 1;
  transform: translateY(-1px);
}

.assistant-add-cards-btn:disabled {
  cursor: default;
  opacity: 0.68;
  transform: none;
}

.assistant-phrase-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 10%, hsl(var(--primary) / 0.12) 50%, transparent 90%);
  opacity: 0;
  pointer-events: none;
}

.assistant-reveal-card {
  opacity: 0;
  transform: translateY(16px);
  filter: blur(10px);
  transition: opacity 260ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms ease;
}

.assistant-reveal-card--visible {
  opacity: 1;
  transform: translateY(0);
  filter: blur(0);
}

.assistant-reveal-card--visible .assistant-phrase-card {
  animation: assistant-card-arrive 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.assistant-reveal-card--visible .assistant-phrase-card::after {
  animation: assistant-card-sheen 680ms ease-out both;
}

.assistant-phrase-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.8rem;
}

.assistant-phrase-title {
  margin-top: 0.25rem;
  font-size: 1rem;
  line-height: 1.15;
  font-weight: 900;
  color: hsl(var(--foreground));
}

.assistant-phrase-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.55rem;
  min-width: fit-content;
  border-radius: 999px;
  border: 1.5px solid hsl(215 20% 84%);
  background: hsl(210 20% 94%);
  font-size: 0.68rem;
  font-weight: 900;
  color: hsl(222 24% 20%);
}

.assistant-language-grid {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.65rem;
}

.assistant-language-block {
  border-radius: 1rem;
  border: 1.5px solid hsl(var(--foreground) / 0.08);
  background: hsl(var(--background));
  padding: 0.75rem;
}

.assistant-language-block--featured {
  border-color: #2c64ff;
  background: #2c64ff;
  color: hsl(0 0% 100%);
}

.assistant-language-block--featured .assistant-language-head,
.assistant-language-block--featured .assistant-language-head span,
.assistant-language-block--featured .assistant-language-text {
  color: hsl(0 0% 100%);
}

.assistant-language-block--romaji {
  background: linear-gradient(180deg, hsl(var(--muted) / 0.42), hsl(var(--background)));
}

.assistant-language-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.assistant-language-text {
  margin-top: 0.45rem;
  font-size: 0.96rem;
  line-height: 1.58;
  color: hsl(var(--foreground));
}

.assistant-language-text--japanese {
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1.72;
}

.assistant-language-text--romaji {
  font-size: 0.92rem;
  font-style: italic;
}

.assistant-copy-btn {
  padding: 0.35rem 0.7rem;
}


.assistant-sheet-overlay-enter-active,
.assistant-sheet-overlay-leave-active {
  transition: opacity 180ms ease;
}

.assistant-sheet-overlay-enter-from,
.assistant-sheet-overlay-leave-to {
  opacity: 0;
}

.assistant-sheet-overlay-enter-active .assistant-sheet-panel,
.assistant-sheet-overlay-leave-active .assistant-sheet-panel {
  transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease;
}

.assistant-sheet-overlay-enter-from .assistant-sheet-panel,
.assistant-sheet-overlay-leave-to .assistant-sheet-panel {
  opacity: 0;
  transform: translateY(calc(100% + 1.5rem));
}

.assistant-sheet-overlay-enter-to .assistant-sheet-panel,
.assistant-sheet-overlay-leave-from .assistant-sheet-panel {
  opacity: 1;
  transform: translateY(0);
}

@keyframes assistant-skeleton {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@keyframes assistant-card-arrive {
  from {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scale(0.985);
    filter: blur(8px);
  }

  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes assistant-card-sheen {
  0% {
    opacity: 0;
    transform: translateX(-115%);
  }

  28% {
    opacity: 0.9;
  }

  100% {
    opacity: 0;
    transform: translateX(115%);
  }
}

@keyframes assistant-summary-sheen {
  0% {
    opacity: 0;
    transform: translateX(-35%);
  }

  40% {
    opacity: 0.8;
  }

  100% {
    opacity: 0;
    transform: translateX(35%);
  }
}

@media (min-width: 640px) {
  .assistant-language-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .assistant-sheet-panel {
    border-radius: 0;
    border-top-left-radius: 1.5rem;
    border-bottom-left-radius: 1.5rem;
  }
}
</style>
