<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useQuery } from '@tanstack/vue-query'
import {
  PhSpinnerGap,
  PhCaretLeft,
  PhCaretDown,
  PhCaretRight,
  PhShieldCheck,
  PhShieldWarning,
  PhWarning,
  PhScan,
  PhSparkle,
  PhTarget,
} from '@phosphor-icons/vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import ScanAiAssistantSheet from '~/components/scan/ScanAiAssistantSheet.vue'
import homeSections from '~/assets/css/home-sections.module.css'
import { APP_EMOJI, STATUS_EMOJIS } from '~/utils/emojis'
import { readCachedScanAssistant } from '~/utils/scan-ai-assistant'
import type { AllergenCatalogRow, ParsedIngredient, ProductStatus, ScanRow as DbScanRow } from '~/utils/types'
import { getLocalizedAllergenName } from '~/utils/allergens'
import {
  getScanAllergenIngredients,
  getScanAmbiguousIngredients,
  getScanBatchProgress,
  getScanIngredientTree,
  getScanOkIngredients,
  getScanProcessedIngredientCount,
  getScanResultStatus,
  getScanStatusConfig,
  getStatusEmojiFilterClass,
  isScanResultFinal,
} from '~/utils/scan'
import { useScanImageSessionCache } from '~/composables/useScanImageSessionCache'
import { useSupabase } from '~/composables/useSupabase'

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead({
  title: computed(() => t('scan.scan.detail.title')),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const route = useRoute()
const router = useRouter()
const supabase = useSupabase()
const scanId = computed(() => route.params.id as string)
const { invalidateAppData } = useAppDataInvalidation()
const { getSignedImageUrl, cacheSignedImageUrl, removeSignedImageUrl } = useScanImageSessionCache()

type ScanDetailRow = Pick<
  DbScanRow,
  | 'id'
  | 'created_at'
  | 'certified_raw_text'
  | 'product_status'
  | 'processing_status'
  | 'processing_error'
  | 'result_json'
  | 'selected_allergen_ids'
  | 'image_storage_path'
  | 'credit_consumed_type'
  | 'assistant_cache_json'
>

const showRawText = ref(false)
const showAssistantSheet = ref(false)
const expandedIngredients = ref(new Set<string>())
const collapsedSections = ref(new Set<string>())

function toggleIngredient(key: string) {
  const next = new Set(expandedIngredients.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedIngredients.value = next
}

function toggleSection(key: string) {
  if (collapsedSections.value.has(key)) collapsedSections.value.delete(key)
  else collapsedSections.value.add(key)
}

function isSectionOpen(key: string) {
  return !collapsedSections.value.has(key)
}

const { openScan } = useScanFlow()
const { touchActiveScanRecovery, clearActiveScanRecovery, markControlledScanExit } = useActiveScanRecovery()
const scanDetailQueryKey = computed(() => ['scan-detail', scanId.value] as const)
const scanAllergenNamesQueryKey = computed(() => ['scan-allergen-names', scanId.value] as const)

const { data: scan, isLoading } = useQuery({
  queryKey: scanDetailQueryKey,
  queryFn: async (): Promise<ScanDetailRow | null> => {
    const { data, error } = await supabase
      .from('scans')
      .select('id, created_at, certified_raw_text, product_status, processing_status, processing_error, result_json, selected_allergen_ids, image_storage_path, credit_consumed_type, assistant_cache_json')
      .eq('id', scanId.value)
      .maybeSingle()
    if (error) throw error
    return (data as ScanDetailRow | null) ?? null
  },
  refetchInterval: (query) => {
    const current = query.state.data as ScanDetailRow | null | undefined
    return current?.processing_status === 'processing' ? 1500 : false
  },
  refetchIntervalInBackground: false,
})
const showInitialScanLoading = computed(() => isLoading.value && !scan.value)

const selectedAllergenIds = computed<string[]>(() => scan.value?.selected_allergen_ids ?? [])

const { data: selectedAllergenRows } = useQuery({
  queryKey: scanAllergenNamesQueryKey,
  queryFn: async (): Promise<AllergenCatalogRow[]> => {
    const ids = selectedAllergenIds.value
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('allergens')
      .select('id, name, name_en')
      .in('id', ids)
    if (error) return []
    return (data ?? []) as AllergenCatalogRow[]
  },
  enabled: computed(() => !!scan.value && selectedAllergenIds.value.length > 0),
})

const selectedAllergenNames = computed(() =>
  (selectedAllergenRows.value ?? []).map(allergen => getLocalizedAllergenName(allergen, locale.value)),
)
const hasSelectedAllergens = computed(() => selectedAllergenNames.value.length > 0)

type DetailImageLoadState = 'idle' | 'loading' | 'loaded' | 'error'

const signedUrl = ref<string | null>(null)
const detailImageLoadState = ref<DetailImageLoadState>('idle')
const failedSignedPaths = ref(new Set<string>())
const pendingSignedPaths = ref(new Set<string>())

watch(scan, async (currentScan) => {
  const imagePath = currentScan?.image_storage_path
  if (!imagePath) {
    signedUrl.value = null
    detailImageLoadState.value = 'idle'
    return
  }

  const cachedUrl = getSignedImageUrl(imagePath, 'scan-detail')
  if (cachedUrl) {
    const alreadyLoaded = signedUrl.value === cachedUrl && detailImageLoadState.value === 'loaded'
    signedUrl.value = cachedUrl
    if (!alreadyLoaded) {
      detailImageLoadState.value = 'loading'
    }
    return
  }

  signedUrl.value = null

  if (failedSignedPaths.value.has(imagePath)) {
    detailImageLoadState.value = 'error'
    return
  }

  if (pendingSignedPaths.value.has(imagePath)) {
    detailImageLoadState.value = 'loading'
    return
  }

  detailImageLoadState.value = 'loading'

  pendingSignedPaths.value = new Set([...pendingSignedPaths.value, imagePath])

  try {
    const { data, error } = await supabase.storage
      .from('scan-images')
      .createSignedUrl(imagePath, 3600)

    if (!error && data?.signedUrl) {
      cacheSignedImageUrl(imagePath, 'scan-detail', data.signedUrl, 3600)
      signedUrl.value = data.signedUrl
      detailImageLoadState.value = 'loading'
      return
    }

    const nextFailures = new Set(failedSignedPaths.value)
    nextFailures.add(imagePath)
    failedSignedPaths.value = nextFailures
    detailImageLoadState.value = 'error'
  } finally {
    const nextPending = new Set(pendingSignedPaths.value)
    nextPending.delete(imagePath)
    pendingSignedPaths.value = nextPending
  }
}, { immediate: true })

function handleDetailImageLoaded() {
  detailImageLoadState.value = 'loaded'
}

function handleDetailImageError() {
  const imagePath = scan.value?.image_storage_path
  if (imagePath) {
    removeSignedImageUrl(imagePath, ['scan-detail'])
    failedSignedPaths.value = new Set([...failedSignedPaths.value, imagePath])
  }
  signedUrl.value = null
  detailImageLoadState.value = 'error'
}

const shouldShowProductSection = computed(() => {
  const imagePath = scan.value?.image_storage_path
  if (!imagePath) return false
  return detailImageLoadState.value !== 'idle' || !!signedUrl.value
})

const resultJson = computed(() => scan.value?.result_json ?? null)
const ingredientTree = computed<ParsedIngredient[]>(() => getScanIngredientTree(resultJson.value))
const allergenIngredients = computed(() => getScanAllergenIngredients(resultJson.value))
const ambiguousIngredients = computed(() => getScanAmbiguousIngredients(resultJson.value))
const okIngredients = computed(() => getScanOkIngredients(resultJson.value))
const batchProgress = computed(() => getScanBatchProgress(resultJson.value))
const processedIngredientCount = computed(() => getScanProcessedIngredientCount(resultJson.value))
const totalIngredientCount = computed(() => batchProgress.value?.total_items ?? processedIngredientCount.value)
const isFinal = computed(() => isScanResultFinal(resultJson.value))
const processingStatus = computed(() => scan.value?.processing_status ?? (isFinal.value ? 'completed' : 'processing'))
const isProcessing = computed(() => processingStatus.value === 'processing')
const isFailed = computed(() => processingStatus.value === 'failed')
const productStatus = computed<ProductStatus>(() => (
  getScanResultStatus(resultJson.value, scan.value?.product_status ?? 'ok') as ProductStatus
))

type ProcessingStreamItem = {
  key: string
  badge: string
  badgeClass: string
  reasonClass: string
  normalized: string
  raw: string
  reason?: string
}

const processingStreamItems = computed<ProcessingStreamItem[]>(() => [
  ...allergenIngredients.value.map((item, index) => ({
    key: `allergen-${item.raw}-${index}`,
    badge: t('scan.scan.detail.processing_badge_allergen'),
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
    reasonClass: 'text-purple-700',
    normalized: item.normalized || item.raw,
    raw: item.raw,
    reason: item.reason,
  })),
  ...ambiguousIngredients.value.map((item, index) => ({
    key: `ambiguous-${item.raw}-${index}`,
    badge: t('scan.scan.detail.processing_badge_ambiguous'),
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    reasonClass: 'text-amber-700',
    normalized: item.normalized || item.raw,
    raw: item.raw,
    reason: item.reason,
  })),
  ...okIngredients.value.map((item, index) => ({
    key: `ok-${item.raw}-${index}`,
    badge: t('scan.scan.detail.processing_badge_ok'),
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    reasonClass: 'text-emerald-700',
    normalized: item.normalized || item.raw,
    raw: item.raw,
  })),
])

const revealedProcessingStreamItems = ref<ProcessingStreamItem[]>([])
let processingRevealTimer: ReturnType<typeof setTimeout> | null = null

const processingSignalsCount = computed(() => allergenIngredients.value.length + ambiguousIngredients.value.length)
const hasProcessingStreamItems = computed(() => revealedProcessingStreamItems.value.length > 0)

const remainingPlaceholders = computed(() => {
  const remaining = Math.max(0, (batchProgress.value?.total_items ?? 0) - (batchProgress.value?.completed_items ?? 0))
  return Math.min(remaining, 5)
})

const showProcessingPlaceholders = computed(() => !hasProcessingStreamItems.value && remainingPlaceholders.value > 0)

const progressPercent = computed(() => {
  const total = batchProgress.value?.total_items ?? 0
  if (total <= 0) return 0
  return Math.round(((batchProgress.value?.completed_items ?? 0) / total) * 100)
})

const meta = computed(() => {
  const current = resultJson.value
  return current && typeof current === 'object' && !Array.isArray(current)
    ? ((current as Record<string, unknown>).meta as Record<string, unknown> | undefined)
    : undefined
})
const completedPhases = computed(() => (meta.value?.phases_completed as unknown[] | undefined)?.length ?? 0)
const totalPhases = 7
const confidencePct = computed(() => Math.round((completedPhases.value / totalPhases) * 100))

const STATUS_ICONS: Record<string, typeof PhShieldCheck> = {
  ok: PhShieldCheck,
  contains_allergen: PhShieldWarning,
  ambiguous: PhWarning,
}

function statusConfig(status: ProductStatus) {
  const config = getScanStatusConfig(status)
  return { ...config, icon: STATUS_ICONS[status] ?? PhScan }
}

const finalStatusConfig = computed(() => statusConfig(productStatus.value))
const assistantSupportMode = computed<'ambiguous' | 'allergen' | 'mixed'>(() => {
  const hasAllergenSignals = allergenIngredients.value.length > 0 || productStatus.value === 'contains_allergen'
  const hasAmbiguousSignals = ambiguousIngredients.value.length > 0

  if (hasAllergenSignals && hasAmbiguousSignals) return 'mixed'
  return hasAllergenSignals ? 'allergen' : 'ambiguous'
})
const assistantLanguage = computed<'fr' | 'en'>(() => (locale.value === 'en' ? 'en' : 'fr'))
const initialAssistantData = computed(() =>
  readCachedScanAssistant(scan.value?.assistant_cache_json ?? null, assistantLanguage.value),
)
const canUseAssistant = computed(() =>
  !isProcessing.value && !isFailed.value && ['ambiguous', 'contains_allergen'].includes(productStatus.value),
)
const assistantSignalCount = computed(() => {
  if (assistantSupportMode.value === 'mixed') {
    return {
      blocking: Math.max(1, allergenIngredients.value.length),
      ambiguous: Math.max(1, ambiguousIngredients.value.length),
    }
  }

  return Math.max(
    1,
    assistantSupportMode.value === 'allergen'
      ? allergenIngredients.value.length
      : ambiguousIngredients.value.length,
  )
})
const assistantInlineDescription = computed(() =>
  t(`scan.scan.detail.assistant.inline_description_${assistantSupportMode.value}`),
)

function clearProcessingRevealTimer() {
  if (!processingRevealTimer) return
  clearTimeout(processingRevealTimer)
  processingRevealTimer = null
}

function getProcessingRevealBatchSize(remaining: number) {
  const maxBatchSize = Math.min(3, remaining)
  return Math.max(1, Math.ceil(Math.random() * maxBatchSize))
}

function getProcessingRevealDelay() {
  return 120 + Math.floor(Math.random() * 220)
}

function scheduleProcessingReveal() {
  clearProcessingRevealTimer()

  if (!import.meta.client) {
    revealedProcessingStreamItems.value = processingStreamItems.value.slice()
    return
  }

  if (!isProcessing.value) {
    revealedProcessingStreamItems.value = processingStreamItems.value.slice()
    return
  }

  const revealedKeys = new Set(revealedProcessingStreamItems.value.map(item => item.key))
  const pendingItems = processingStreamItems.value.filter(item => !revealedKeys.has(item.key))

  if (pendingItems.length === 0) return

  processingRevealTimer = setTimeout(() => {
    const batchSize = getProcessingRevealBatchSize(pendingItems.length)
    revealedProcessingStreamItems.value = [
      ...revealedProcessingStreamItems.value,
      ...pendingItems.slice(0, batchSize),
    ]
    scheduleProcessingReveal()
  }, getProcessingRevealDelay())
}

function formatDetailDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function goBackToDashboard() {
  if (isProcessing.value) return
  markControlledScanExit(scanId.value)
  router.push(localePath('/app/dashboard'))
}

watch(isProcessing, (processing, _previous, onCleanup) => {
  if (!import.meta.client || !processing) return

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault()
    event.returnValue = ''
  }

  window.addEventListener('beforeunload', handleBeforeUnload)
  onCleanup(() => window.removeEventListener('beforeunload', handleBeforeUnload))
}, { immediate: true })

watch(scanId, () => {
  clearProcessingRevealTimer()
  revealedProcessingStreamItems.value = []
  showAssistantSheet.value = false
}, { immediate: true })

watch([processingStreamItems, isProcessing], ([items, processing]) => {
  const validKeys = new Set(items.map(item => item.key))
  revealedProcessingStreamItems.value = revealedProcessingStreamItems.value.filter(item => validKeys.has(item.key))

  if (!processing) {
    clearProcessingRevealTimer()
    revealedProcessingStreamItems.value = items.slice()
    return
  }

  scheduleProcessingReveal()
}, { immediate: true })

onUnmounted(() => {
  clearProcessingRevealTimer()
})

watch([scanId, processingStatus], async ([currentScanId, status], previousTuple) => {
  const [previousScanId, previousStatus] = previousTuple ?? []

  if (status === 'processing') {
    touchActiveScanRecovery(currentScanId)
    return
  }

  clearActiveScanRecovery(currentScanId)

  if (previousStatus === 'processing' && status !== 'processing') {
    await invalidateAppData(status === 'failed' ? 'scan_failed' : 'scan_finished', { scanId: currentScanId })
  }

  if (previousScanId && previousScanId !== currentScanId) {
    clearActiveScanRecovery(previousScanId)
  }
}, { immediate: true })
</script>

<template>
  <div>
    <Transition name="scan-detail-shell" mode="out-in">
      <div
        v-if="showInitialScanLoading"
        key="scan-loading"
        class="min-h-screen flex flex-col bg-background pb-24 md:pb-0 md:pt-20"
      >
        <main id="scan-loading-content" class="flex-1 container mx-auto px-4 pt-4 pb-8 max-w-lg">
          <div class="scan-detail-skeleton-header">
            <div class="scan-detail-skeleton-pill scan-detail-skeleton-pill--icon" />
            <div class="scan-detail-skeleton-line scan-detail-skeleton-line--title" />
          </div>

          <div class="scan-detail-skeleton-card scan-detail-skeleton-card--hero">
            <div class="scan-detail-skeleton-orb" />
            <div class="space-y-3 w-full">
              <div class="scan-detail-skeleton-line scan-detail-skeleton-line--headline" />
              <div class="scan-detail-skeleton-line scan-detail-skeleton-line--copy" />
              <div class="scan-detail-skeleton-line scan-detail-skeleton-line--copy short" />
            </div>
          </div>

          <div class="scan-detail-skeleton-card">
            <div class="scan-detail-skeleton-line scan-detail-skeleton-line--eyebrow" />
            <div class="scan-detail-skeleton-media" />
          </div>

          <div class="scan-detail-skeleton-card scan-detail-skeleton-card--ai">
            <div class="scan-detail-skeleton-line scan-detail-skeleton-line--eyebrow" />
            <div class="scan-detail-skeleton-line scan-detail-skeleton-line--headline" />
            <div class="scan-detail-skeleton-grid">
              <div class="scan-detail-skeleton-chip" />
              <div class="scan-detail-skeleton-chip" />
              <div class="scan-detail-skeleton-chip" />
            </div>
          </div>

          <div class="scan-detail-skeleton-card">
            <div class="scan-detail-skeleton-line scan-detail-skeleton-line--eyebrow" />
            <div class="scan-detail-skeleton-list">
              <div class="scan-detail-skeleton-list-item" />
              <div class="scan-detail-skeleton-list-item" />
              <div class="scan-detail-skeleton-list-item short" />
            </div>
          </div>
        </main>
      </div>

      <div v-else-if="scan" key="scan-ready" class="min-h-screen flex flex-col bg-background pb-24 md:pb-0 md:pt-20">
      <main id="main-content" class="flex-1 container mx-auto px-4 pt-4 pb-8 max-w-lg">
      <div class="flex items-center gap-3 mb-6">
        <button
          class="w-10 h-10 flex items-center justify-center shrink-0 bg-card hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-xs);"
          :disabled="isProcessing"
          @click="goBackToDashboard"
        >
          <PhCaretLeft :size="18" weight="bold" />
        </button>
        <h1 class="text-base font-black font-heading tracking-tight uppercase truncate">
          {{ t('scan.scan.detail.title') }}
        </h1>
      </div>

      <div v-if="isProcessing" class="scan-hero-card scan-hero-card--processing">
        <div class="scan-hero-card__content">
          <div
            class="scan-hero-card__orb w-16 h-16 flex items-center justify-center ring-4 ring-primary/20 bg-primary/10"
            style="border-radius: 50%;"
          >
            <PhSpinnerGap :size="28" class="animate-spin text-primary" />
          </div>

          <div class="scan-hero-card__body">
            <h2 class="scan-hero-card__title text-primary">
              {{ t('scan.scan.detail.processing_title') }}
            </h2>
            <p class="scan-hero-card__note">
              {{ t('scan.scan.detail.processing_leave_warning') }}
            </p>
          </div>
        </div>

        <div v-if="hasSelectedAllergens" class="scan-hero-card__filters">
          <div class="scan-hero-card__filters-label">
            {{ t('scan.scan.detail.lbl_allergens_active') }}
          </div>
          <div class="scan-hero-card__filters-list">
            <span
              v-for="name in selectedAllergenNames"
              :key="name"
              class="bold-pill bold-pill--primary scan-allergen-pill"
            >
              <PhSparkle :size="10" weight="fill" class="scan-allergen-pill__icon" />
              <span>{{ name }}</span>
            </span>
          </div>
        </div>
      </div>

      <div v-else-if="isFailed" class="scan-hero-card scan-hero-card--failed">
        <div class="scan-hero-card__content">
          <div class="scan-hero-card__emoji-wrap">
            <AppEmoji :name="APP_EMOJI.scanError" :size="64" />
          </div>

          <div class="scan-hero-card__body">
            <h2 class="scan-hero-card__title text-red-700">
              {{ t('scan.scan.detail.failed_title') }}
            </h2>
            <p class="scan-hero-card__note scan-hero-card__note--danger">
              {{ t('scan.scan.detail.failed_no_credit') }}
            </p>
          </div>
        </div>

        <div v-if="hasSelectedAllergens" class="scan-hero-card__filters">
          <div class="scan-hero-card__filters-label">
            {{ t('scan.scan.detail.lbl_allergens_active') }}
          </div>
          <div class="scan-hero-card__filters-list">
            <span
              v-for="name in selectedAllergenNames"
              :key="name"
              class="bold-pill bold-pill--primary scan-allergen-pill"
            >
              <PhSparkle :size="10" weight="fill" class="scan-allergen-pill__icon" />
              <span>{{ name }}</span>
            </span>
          </div>
        </div>
      </div>

      <div v-else :class="['scan-hero-card', 'scan-hero-card--result', `scan-hero-card--${productStatus}`]">
        <div class="scan-hero-card__content">
          <div class="scan-hero-card__emoji-wrap">
            <AppEmoji
              :name="STATUS_EMOJIS[productStatus]"
              :size="68"
              :filter-class="getStatusEmojiFilterClass(productStatus)"
            />
          </div>

          <div class="scan-hero-card__body">
            <h2 :class="finalStatusConfig.color" class="scan-hero-card__title">
              {{ finalStatusConfig.label }}
            </h2>
          </div>
        </div>

        <div v-if="hasSelectedAllergens" class="scan-hero-card__filters">
          <div class="scan-hero-card__filters-label">
            {{ t('scan.scan.detail.lbl_allergens_active') }}
          </div>
          <div class="scan-hero-card__filters-list">
            <span
              v-for="name in selectedAllergenNames"
              :key="name"
              class="bold-pill bold-pill--primary scan-allergen-pill"
            >
              <PhSparkle :size="10" weight="fill" class="scan-allergen-pill__icon" />
              <span>{{ name }}</span>
            </span>
          </div>
        </div>
      </div>

      <div class="mb-5">
        <button
          class="w-full flex items-center gap-2 py-2.5 text-left"
          @click="toggleSection('progress')"
        >
          <PhCaretDown v-if="isSectionOpen('progress')" :size="13" class="text-muted-foreground shrink-0" />
          <PhCaretRight v-else :size="13" class="text-muted-foreground shrink-0" />
          <span class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {{ isProcessing ? t('scan.scan.detail.scan_progress') : t('scan.scan.detail.scan_confidence') }}
          </span>
        </button>

        <div v-if="isSectionOpen('progress')" class="bold-card--static p-4">
          <div v-if="isProcessing" class="space-y-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <span>{{ t('scan.scan.detail.progress_items_label') }}</span>
                <span>{{ progressPercent }}%</span>
              </div>
              <div class="h-2.5 bg-muted/50 overflow-hidden" style="border-radius: 999px;">
                <div
                  class="h-full bg-primary transition-all duration-300"
                  style="border-radius: 999px;"
                  :style="{ width: `${progressPercent}%` }"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-[var(--bold-radius-sm)] bg-primary/5 p-3" style="border: 2px solid var(--bold-border-color);">
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {{ t('scan.scan.detail.progress_items_label') }}
                </p>
                <p class="mt-1 text-lg font-black font-heading text-foreground">
                  {{ processedIngredientCount }} / {{ totalIngredientCount }}
                </p>
              </div>
              <div class="rounded-[var(--bold-radius-sm)] bg-primary/5 p-3" style="border: 2px solid var(--bold-border-color);">
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {{ t('scan.scan.detail.processing_signals_label') }}
                </p>
                <p class="mt-1 text-lg font-black font-heading text-foreground">
                  {{ processingSignalsCount }}
                </p>
              </div>
            </div>

            <div
              class="rounded-[var(--bold-radius)] p-4 text-left"
              style="border: 2px solid var(--bold-border-color); background:
                radial-gradient(circle at top left, hsl(var(--primary) / 0.12), transparent 48%),
                radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.12), transparent 42%),
                hsl(var(--background));"
            >
              <p class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {{ t('scan.scan.detail.processing_results_title') }}
              </p>
              <p class="mt-1 text-sm font-medium text-foreground">
                {{ processingStreamItems.length > 0 ? t('scan.scan.detail.processing_waiting_more') : t('scan.scan.detail.processing_stream_empty') }}
              </p>
            </div>
          </div>

          <div v-else-if="isFailed" class="space-y-2">
            <p class="text-sm font-bold text-foreground">{{ t('scan.scan.detail.failed_summary_title') }}</p>
            <p class="text-xs text-muted-foreground">
              {{ scan.processing_error || t('scan.scan.detail.failed_desc') }}
            </p>
            <p class="text-xs font-bold text-red-700">{{ t('scan.scan.detail.failed_no_credit') }}</p>
          </div>

          <div v-else class="flex items-center gap-4">
            <div class="relative w-12 h-12 shrink-0">
              <svg viewBox="0 0 36 36" class="w-12 h-12 -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="hsl(var(--muted))" stroke-width="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="hsl(var(--primary))" stroke-width="3"
                  :stroke-dasharray="`${confidencePct}, 100`" stroke-linecap="round"
                />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-xs font-black text-primary">
                {{ confidencePct }}%
              </span>
            </div>
            <div>
              <p class="text-sm font-bold">
                {{ confidencePct >= 80 ? t('scan.scan.detail.accuracy_high') : confidencePct >= 50 ? t('scan.scan.detail.accuracy_medium') : t('scan.scan.detail.accuracy_low') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('scan.scan.detail.scan_date', { date: formatDetailDate(scan.created_at) }) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="shouldShowProductSection" class="mb-5">
        <button
          class="w-full flex items-center gap-2 py-2.5 text-left"
          @click="toggleSection('product')"
        >
          <PhCaretDown v-if="isSectionOpen('product')" :size="13" class="text-muted-foreground shrink-0" />
          <PhCaretRight v-else :size="13" class="text-muted-foreground shrink-0" />
          <span class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {{ t('scan.scan.detail.product_scanned') }}
          </span>
        </button>
        <div v-if="isSectionOpen('product')" class="bold-card--static overflow-hidden">
          <div class="relative min-h-56 bg-muted/20">
            <div
              v-if="detailImageLoadState === 'loading'"
              class="scan-detail-image-skeleton absolute inset-0"
              aria-hidden="true"
            />

            <img
              v-if="signedUrl"
              :src="signedUrl"
              :alt="t('scan.scan.detail.product_scanned')"
              class="w-full max-h-56 object-contain transition-opacity duration-200"
              :class="detailImageLoadState === 'loaded' ? 'opacity-100' : 'opacity-0'"
              @load="handleDetailImageLoaded"
              @error="handleDetailImageError"
            >

            <div
              v-else-if="detailImageLoadState === 'error'"
              class="min-h-56 flex items-center justify-center px-4 text-center"
            >
              <p class="text-sm font-medium text-muted-foreground">
                {{ t('scan.scan.detail.product_scanned_unavailable') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="allergenIngredients.length > 0" class="mb-5">
        <button
          class="w-full flex items-center gap-2 py-2.5 text-left"
          @click="toggleSection('allergens')"
        >
          <PhCaretDown v-if="isSectionOpen('allergens')" :size="13" class="text-muted-foreground shrink-0" />
          <PhCaretRight v-else :size="13" class="text-muted-foreground shrink-0" />
          <PhTarget :size="13" class="text-muted-foreground shrink-0" />
          <span class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {{ t('scan.scan.detail.allergens_detected') }}
          </span>
          <span
            class="ml-auto text-[10px] font-black px-2 py-0.5 bg-purple-100 text-purple-700"
            style="border: 1.5px solid #e9d5ff; border-radius: var(--bold-radius-pill);"
          >
            {{ allergenIngredients.length }}
          </span>
        </button>
        <div v-if="isSectionOpen('allergens')" class="grid grid-cols-2 gap-2">
          <div
            v-for="(allergen, index) in allergenIngredients"
            :key="`${allergen.raw}-${index}`"
            class="bold-card--static p-3"
            style="border-color: #e9d5ff;"
          >
            <p class="text-sm font-black text-purple-700">{{ allergen.normalized || allergen.raw }}</p>
            <p class="text-[11px] text-muted-foreground mt-1 leading-snug">{{ allergen.reason }}</p>
          </div>
        </div>
      </div>

      <div v-if="canUseAssistant" class="mb-5">
        <button
          type="button"
          :class="[homeSections.ctaBanner, 'assistant-inline-trigger', 'scan-ai-halo', 'scan-ai-halo--assistant']"
          @click="showAssistantSheet = true"
        >
          <div :class="homeSections.ctaBannerIcon">
            <PhSparkle :size="22" weight="fill" class="assistant-inline-trigger__symbol" />
          </div>

          <div :class="homeSections.ctaBannerText">
            <h3 :class="homeSections.ctaBannerTitle">
              {{ t('scan.scan.detail.assistant.title') }}
            </h3>
            <p :class="homeSections.ctaBannerDesc">
              {{ assistantInlineDescription }}
            </p>
          </div>

          <div :class="homeSections.ctaBannerArrow">
            <PhCaretRight :size="16" weight="bold" class="assistant-inline-trigger__symbol" />
          </div>
        </button>
      </div>

      <div class="mb-5">
        <div class="flex items-center gap-2 py-2.5">
          <button class="flex items-center gap-2" @click="toggleSection('ingredients')">
            <PhCaretDown v-if="isSectionOpen('ingredients')" :size="13" class="text-muted-foreground shrink-0" />
            <PhCaretRight v-else :size="13" class="text-muted-foreground shrink-0" />
            <span class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {{ t('scan.scan.detail.ingredients') }}
            </span>
          </button>
          <span
            class="text-[10px] font-black px-2 py-0.5 bg-muted/60 text-muted-foreground"
            style="border: 1.5px solid var(--bold-border-color); border-radius: var(--bold-radius-pill);"
          >
            {{ isProcessing ? `${processedIngredientCount}/${totalIngredientCount}` : ingredientTree.length }}
          </span>
          <div class="flex-1" />
          <button
            v-if="scan.certified_raw_text"
            class="bold-btn bold-btn--secondary bold-btn--sm bold-btn--pill"
            style="font-size: 11px; padding: 4px 12px;"
            @click="showRawText = !showRawText"
          >
            {{ showRawText ? t('scan.scan.detail.btn_view_analysis') : t('scan.scan.detail.btn_view_original') }}
          </button>
        </div>

        <div v-if="isSectionOpen('ingredients')">
          <div v-if="showRawText && scan.certified_raw_text" class="bold-card--static p-4">
            <p class="text-xs font-mono whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {{ scan.certified_raw_text }}
            </p>
          </div>

          <div v-else-if="isProcessing" class="scan-ai-halo scan-ai-halo--ingredients">
            <div class="bold-card--static overflow-hidden scan-ai-results-surface scan-ingredients-surface">
              <div class="bg-foreground px-4 py-2.5">
                <p class="text-[11px] font-bold uppercase tracking-widest text-background">
                  {{ t('scan.scan.detail.processing_results_title') }}
                </p>
              </div>
              <div class="p-4 space-y-4 min-h-[13rem]">
                <div
                  v-if="!hasProcessingStreamItems"
                  class="rounded-[var(--bold-radius-sm)] p-3.5 space-y-3"
                  style="border: 2px solid var(--bold-border-color); background: hsl(var(--card));"
                >
                  <div>
                    <p class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      {{ t('scan.scan.detail.processing_remaining_title') }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      {{ t('scan.scan.detail.processing_waiting_more') }}
                    </p>
                  </div>

                  <div v-if="showProcessingPlaceholders" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div
                      v-for="index in remainingPlaceholders"
                      :key="index"
                      class="rounded-[var(--bold-radius-sm)] border animate-pulse p-3 bg-muted/20"
                      style="border: 2px solid var(--bold-border-color);"
                    >
                      <div class="h-3 rounded bg-muted/50 w-2/3" />
                      <div class="h-2.5 rounded bg-muted/35 w-1/2 mt-2" />
                    </div>
                  </div>

                  <div v-else class="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <PhSpinnerGap class="h-5 w-5 animate-spin text-primary shrink-0" />
                    <span>{{ t('scan.scan.detail.processing_stream_empty') }}</span>
                  </div>
                </div>

                <TransitionGroup
                  v-else
                  tag="div"
                  name="processing-stream"
                  class="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  <div
                    v-for="(item, index) in revealedProcessingStreamItems.slice(0, 12)"
                    :key="item.key"
                    :class="[
                      'processing-stream-card',
                      index % 2 === 0
                        ? 'processing-stream-card--left'
                        : 'processing-stream-card--right',
                    ]"
                    class="rounded-[var(--bold-radius-sm)] p-3 transition-all duration-500"
                    style="border: 2px solid var(--bold-border-color); background: hsl(var(--card));"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-sm font-bold text-foreground processing-stream-title">{{ item.normalized }}</p>
                      <span
                        class="text-[10px] font-black px-2 py-0.5 border shrink-0 processing-stream-badge"
                        :class="item.badgeClass"
                        style="border-radius: var(--bold-radius-pill);"
                      >
                        {{ item.badge }}
                      </span>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1 processing-stream-raw">{{ item.raw }}</p>
                    <p v-if="item.reason" class="text-[11px] mt-1 font-medium processing-stream-reason" :class="item.reasonClass">
                      {{ item.reason }}
                    </p>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>

          <div v-else-if="ingredientTree.length > 0" class="scan-ai-halo scan-ai-halo--ingredients">
            <div class="bold-card--static overflow-hidden scan-ai-results-surface scan-ingredients-surface">
              <div class="bg-foreground px-4 py-2.5">
                <p class="text-[11px] font-bold uppercase tracking-widest text-background">
                  {{ t('scan.scan.detail.auto_detect') }}
                </p>
              </div>
              <ScanIngredientRow
                v-for="(ingredient, index) in ingredientTree"
                :key="ingredient.id || index"
                :ingredient="ingredient"
                :depth="0"
                :node-key="ingredient.id || String(index)"
                :expanded-set="expandedIngredients"
                :on-toggle="toggleIngredient"
              />
            </div>
          </div>

          <div v-else class="px-4 py-8 flex flex-col items-center gap-2 text-sm text-muted-foreground bold-card--static">
            <AppEmoji name="thinking" :size="40" class="opacity-70" />
            <span>{{ t('scan.scan.detail.no_ingredients_detected') }}</span>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-4">
        <div class="flex-1">
          <ScanCtaButton
            :label="t('scan.scan.detail.btn_scan_new')"
            :disabled="isProcessing"
            @click="openScan()"
          />
        </div>
      </div>
      </main>

      <ScanAiAssistantSheet
        v-if="canUseAssistant"
        :open="showAssistantSheet"
        :scan-id="scanId"
        :selected-allergens="selectedAllergenNames"
        :support-mode="assistantSupportMode"
        :signal-count="assistantSignalCount"
        :initial-assistant-data="initialAssistantData"
        @close="showAssistantSheet = false"
      />
      </div>

      <div v-else key="scan-missing" class="min-h-screen flex flex-col items-center justify-center bg-background gap-4 pb-24 md:pb-0">
        <AppEmoji :name="APP_EMOJI.notFound" :size="56" class="opacity-80" />
        <p class="text-muted-foreground font-medium">{{ t('scan.scan.detail.not_found') }}</p>
        <NuxtLink :to="$localePath('/app/dashboard')">
          <button class="bold-btn bold-btn--secondary bold-btn--pill">{{ t('scan.scan.detail.btn_back_history') }}</button>
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scan-hero-card {
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  border: 2.5px solid var(--bold-border-color);
  border-radius: var(--bold-radius-lg, 18px);
  background: hsl(var(--card));
  box-shadow: var(--bold-shadow-sm);
}

.scan-hero-card__content,
.scan-hero-card__filters {
  position: relative;
  z-index: 1;
}

.scan-hero-card__content {
  display: flex;
  align-items: center;
  gap: 1.05rem;
}

.scan-hero-card__orb {
  flex-shrink: 0;
}

.scan-hero-card__emoji-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 4.25rem;
  min-height: 4.25rem;
  align-self: flex-start;
}

.scan-hero-card__body {
  min-width: 0;
  flex: 1;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
}

.scan-hero-card__title {
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-size: 1.5rem;
  line-height: 0.98;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.scan-hero-card__note {
  margin-top: 0.65rem;
  font-size: 0.75rem;
  line-height: 1.45;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.scan-hero-card__note--danger {
  color: #b91c1c;
}


.scan-hero-card__filters-label {
  font-size: 0.7rem;
  font-weight: 800;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.04em;
}

.scan-hero-card__filters-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.7rem;
}

.scan-detail-image-skeleton {
  background:
    linear-gradient(
      100deg,
      hsl(var(--muted) / 0.42) 12%,
      hsl(var(--card)) 38%,
      hsl(var(--muted) / 0.42) 64%
    );
  background-size: 200% 100%;
  animation: scan-detail-image-shimmer 1.25s linear infinite;
}

.scan-allergen-pill {
  gap: 0.35rem;
  padding: 0.28rem 0.68rem;
  font-size: 0.72rem;
  line-height: 1;
}

.scan-allergen-pill__icon {
  flex-shrink: 0;
}

@keyframes scan-detail-image-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (max-width: 640px) {
  .scan-hero-card {
    padding: 1rem;
  }

  .scan-hero-card__content {
    align-items: center;
    gap: 0.8rem;
  }

  .scan-hero-card__title {
    font-size: 1.34rem;
  }
  .scan-hero-card__filters {
    padding: 0.2rem 0rem 0rem;
  }
}

.assistant-inline-trigger {
  width: 100%;
  text-align: left;
  appearance: none;
  -webkit-appearance: none;
  font: inherit;
  padding: 1.5rem;
  color: #fff;
  background: #2c64ff;
  border-color: var(--bold-border-color);
  box-shadow: var(--bold-shadow-sm);
  transition: all 150ms ease;
}


.assistant-inline-trigger :deep(h3) {
  color: #fff;
}

.assistant-inline-trigger :deep(p) {
  color: #fff;
}

.assistant-inline-trigger > div:first-child,
.assistant-inline-trigger > div:last-child {
  background: hsl(0 0% 100% / 0.5);
  border: 1.5px solid hsl(315 38% 18% / 0.16);
}

.assistant-inline-trigger__symbol {
  color: #fff;
}

.assistant-inline-trigger:not(:hover) > div:last-child .assistant-inline-trigger__symbol {
  animation: assistant-cta-arrow-nudge 1.9s ease-in-out infinite;
}

.assistant-inline-trigger:hover {
  box-shadow: none;
  transform: translate(4px, 4px);
}

.scan-ingredients-surface {
  background: hsl(var(--card));
}

.scan-ingredients-surface :deep(.scan-ingredient-row) {
  background: transparent;
}

.scan-ingredients-surface :deep(.scan-ingredient-row:hover) {
  background: hsl(var(--muted) / 0.28);
}

.scan-detail-shell-enter-active,
.scan-detail-shell-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.scan-detail-shell-enter-from,
.scan-detail-shell-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.scan-detail-skeleton-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 1.5rem;
}

.scan-detail-skeleton-card {
  border: 2.5px solid var(--bold-border-color);
  border-radius: var(--bold-radius);
  background: hsl(var(--card));
  padding: 1rem;
}

.scan-detail-skeleton-card + .scan-detail-skeleton-card {
  margin-top: 1rem;
}

.scan-detail-skeleton-card--hero {
  display: flex;
  align-items: center;
  gap: 1rem;
}

@keyframes assistant-cta-bob {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  40% {
    transform: translate3d(0, -4px, 0);
  }
}

@keyframes assistant-cta-arrow-nudge {
  0%,
  100% {
    transform: translateX(0);
  }

  35% {
    transform: translateX(4px);
  }

  55% {
    transform: translateX(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .assistant-inline-trigger,
  .assistant-inline-trigger > div:last-child .assistant-inline-trigger__symbol {
    animation: none !important;
  }
}

.scan-detail-skeleton-pill,
.scan-detail-skeleton-line,
.scan-detail-skeleton-media,
.scan-detail-skeleton-chip,
.scan-detail-skeleton-list-item,
.scan-detail-skeleton-orb {
  position: relative;
  overflow: hidden;
  background: hsl(var(--muted) / 0.26);
}

.scan-detail-skeleton-pill::after,
.scan-detail-skeleton-line::after,
.scan-detail-skeleton-media::after,
.scan-detail-skeleton-chip::after,
.scan-detail-skeleton-list-item::after,
.scan-detail-skeleton-orb::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.4), transparent);
  animation: scan-detail-skeleton-shimmer 1.1s linear infinite;
}

.scan-detail-skeleton-pill {
  border-radius: var(--bold-radius);
}

.scan-detail-skeleton-pill--icon {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.scan-detail-skeleton-line {
  border-radius: 999px;
}

.scan-detail-skeleton-line--title {
  width: 9rem;
  height: 0.95rem;
}

.scan-detail-skeleton-line--eyebrow {
  width: 7rem;
  height: 0.7rem;
  margin-bottom: 0.9rem;
}

.scan-detail-skeleton-line--headline {
  width: 70%;
  height: 1rem;
}

.scan-detail-skeleton-line--copy {
  width: 100%;
  height: 0.78rem;
}

.scan-detail-skeleton-line--copy.short {
  width: 68%;
}

.scan-detail-skeleton-orb {
  width: 4rem;
  height: 4rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.scan-detail-skeleton-media {
  width: 100%;
  height: 10.5rem;
  border-radius: var(--bold-radius);
}

.scan-detail-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.scan-detail-skeleton-chip {
  height: 2rem;
  border-radius: var(--bold-radius-pill);
}

.scan-detail-skeleton-list {
  display: grid;
  gap: 0.75rem;
}

.scan-detail-skeleton-list-item {
  height: 4rem;
  border-radius: var(--bold-radius-sm);
}

.scan-detail-skeleton-list-item.short {
  width: 82%;
}

@keyframes scan-detail-skeleton-shimmer {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(100%);
  }
}

.processing-stream-enter-active {
  transition:
    transform 340ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease,
    filter 340ms ease;
}

.processing-stream-enter-from {
  opacity: 0;
  filter: blur(10px);
}

.processing-stream-card--left.processing-stream-enter-from {
  transform: translate3d(-26px, 6px, 0) scale(0.965);
}

.processing-stream-card--right.processing-stream-enter-from {
  transform: translate3d(26px, 6px, 0) scale(0.965);
}

.processing-stream-enter-active .processing-stream-title {
  animation: processing-stream-text 170ms 50ms both;
}

.processing-stream-enter-active .processing-stream-badge {
  animation: processing-stream-badge-pop 160ms 80ms both;
}

.processing-stream-enter-active .processing-stream-raw {
  animation: processing-stream-text 170ms 110ms both;
}

.processing-stream-enter-active .processing-stream-reason {
  animation: processing-stream-text 170ms 150ms both;
}

.processing-stream-enter-to {
  opacity: 1;
  filter: blur(0);
  transform: translate3d(0, 0, 0) scale(1);
}

.processing-stream-move {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}


@keyframes processing-stream-text {
  from {
    opacity: 0;
    filter: blur(6px);
    clip-path: inset(0 100% 0 0);
  }

  to {
    opacity: 1;
    filter: blur(0);
    clip-path: inset(0 0 0 0);
  }
}

@keyframes processing-stream-badge-pop {
  from {
    opacity: 0;
    transform: scale(0.72);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
