<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useMutation, useQuery } from '@tanstack/vue-query'
import {
  PhSpinnerGap, PhScan, PhLock, PhTrash,
  PhWarning,
  PhClockCounterClockwise, PhImageBroken, PhSparkle, PhX
} from '@phosphor-icons/vue'
import AppEmoji from '~/components/ui/AppEmoji.vue'
import { APP_EMOJI, EMOJI_MAP, STATUS_EMOJIS } from '~/utils/emojis'
import type { ProductStatus, ScanRow as DbScanRow } from '~/utils/types'
import {
  getScanAlertCount,
  getScanBatchProgress,
  getScanIngredientCount,
  getScanProductTitle,
  getScanResultStatus,
  getStatusEmojiFilterClass,
  getScanStatusCircleConfig,
} from '~/utils/scan'
import { getServerDayKey } from '~/utils/server-day'
import { useScanImageSessionCache } from '~/composables/useScanImageSessionCache'

const { t, locale } = useI18n()
const localePath = useLocalePath()

useHead({ title: computed(() => t('account.dashboard.meta_title')), meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const supabase = useSupabase()
const { user, loading: authLoading, initialized, authStatus } = useAuth()
const { openScan } = useScanFlow()
const { deleteScan: deleteScanEdge } = useEdgeFunctions()
const { hasDailyCredit, refreshCredits } = useCredits()
const { invalidateAppData } = useAppDataInvalidation()
const { maybeResumePendingScan } = useActiveScanRecovery()
const { tryShow: tryShowOnboarding } = useOnboarding()
const { getSignedImageUrl, cacheSignedImageUrl, removeSignedImageUrl } = useScanImageSessionCache()
const { shouldRun: shouldRunDashboardForegroundRefresh } = useForegroundRefreshGate(10_000)
const isCheckingAuth = computed(() => (!initialized.value && !user.value) || (authLoading.value && !user.value))
const deletingId = ref<string | null>(null)
const scanToDelete = ref<ScanRow | null>(null)
const activeFilter = ref<'all' | ProductStatus>('all')
const DAILY_CARD_HIDE_MS = 10 * 60 * 1000
const dailyBannerDismissedUntil = ref<number | null>(null)
let dailyBannerTimer: ReturnType<typeof setTimeout> | null = null
type ThumbnailLoadState = 'loading' | 'loaded' | 'error'

function dailyBannerStorageKey(userId: string | null | undefined) {
  return `daily-credit-banner-dismissed-until:${userId ?? 'guest'}:${getServerDayKey()}`
}

function clearDailyBannerTimer() {
  if (dailyBannerTimer) {
    clearTimeout(dailyBannerTimer)
    dailyBannerTimer = null
  }
}

function persistDailyBannerDismissal(userId: string | null | undefined, until: number | null) {
  if (!import.meta.client) return
  const key = dailyBannerStorageKey(userId)
  try {
    if (!until) {
      sessionStorage.removeItem(key)
      return
    }
    sessionStorage.setItem(key, String(until))
  } catch {
    // Ignore storage failures and keep an in-memory fallback.
  }
}

function scheduleDailyBannerReset(userId: string | null | undefined) {
  clearDailyBannerTimer()
  const until = dailyBannerDismissedUntil.value
  if (!until) return

  const remaining = until - Date.now()
  if (remaining <= 0) {
    dailyBannerDismissedUntil.value = null
    persistDailyBannerDismissal(userId, null)
    return
  }

  dailyBannerTimer = setTimeout(() => {
    dailyBannerDismissedUntil.value = null
    persistDailyBannerDismissal(userId, null)
    dailyBannerTimer = null
  }, remaining)
}

function hydrateDailyBannerDismissal(userId: string | null | undefined) {
  if (!import.meta.client) return

  let nextValue: number | null = null
  try {
    const raw = sessionStorage.getItem(dailyBannerStorageKey(userId))
    const parsed = raw ? Number(raw) : Number.NaN
    if (Number.isFinite(parsed) && parsed > Date.now()) {
      nextValue = parsed
    }
  } catch {
    nextValue = dailyBannerDismissedUntil.value
  }

  dailyBannerDismissedUntil.value = nextValue
  scheduleDailyBannerReset(userId)
}

function openDeleteConfirm(scan: ScanRow) {
  scanToDelete.value = scan
}

function closeDeleteConfirm() {
  scanToDelete.value = null
}

function confirmDelete() {
  if (!scanToDelete.value) return
  const id = scanToDelete.value.id
  deleteScan.mutate(
    { id },
    {
      onSettled: () => {
        closeDeleteConfirm()
      },
    }
  )
}

onMounted(async () => {
  // Trigger onboarding for first-time users
  nextTick(() => tryShowOnboarding())
  hydrateDailyBannerDismissal(user.value?.id)
  void maybeResumePendingScan('dashboard')

  if (import.meta.client) {
    document.addEventListener('visibilitychange', handleVisibilityRefresh, { passive: true })
    window.addEventListener('pageshow', handleVisibilityRefresh, { passive: true })
  }
})

onBeforeUnmount(() => {
  clearDailyBannerTimer()
  if (import.meta.client) {
    document.removeEventListener('visibilitychange', handleVisibilityRefresh)
    window.removeEventListener('pageshow', handleVisibilityRefresh)
  }
})

type ScanRow = Pick<
  DbScanRow,
  | 'id'
  | 'created_at'
  | 'product_status'
  | 'processing_status'
  | 'processing_error'
  | 'result_json'
  | 'certified_raw_text'
  | 'credit_consumed_type'
  | 'image_storage_path'
>

const { data: scans, isLoading: scansLoading, refetch: refetchScans } = useQuery({
  queryKey: ['user-scans'],
  queryFn: async () => {
    if (!user.value?.id) return []
    const { data, error } = await supabase
      .from('scans')
      .select('id, created_at, product_status, processing_status, processing_error, result_json, certified_raw_text, credit_consumed_type, image_storage_path')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as ScanRow[]
  },
  enabled: computed(() => !isCheckingAuth.value && !!user.value?.id),
  staleTime: 30_000,
  refetchOnMount: 'always',
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  refetchInterval: (query) => {
    const rows = query.state.data as ScanRow[] | undefined
    return rows?.some(scan => scan.processing_status === 'processing') ? 2000 : false
  },
  refetchIntervalInBackground: false,
})

const filteredScans = computed(() => {
  if (!scans.value) return []
  if (activeFilter.value === 'all') return scans.value
  return scans.value.filter(s => s.product_status === activeFilter.value)
})
const canRenderWarmDashboard = computed(() =>
  (filteredScans.value.length > 0 || !!scans.value) && authStatus.value !== 'unauthenticated',
)
const showDashboardInitialLoading = computed(() =>
  isCheckingAuth.value && !canRenderWarmDashboard.value,
)
const showDashboardLoggedOutState = computed(() =>
  !showDashboardInitialLoading.value && !user.value && !canRenderWarmDashboard.value,
)

const deleteScan = useMutation({
  mutationFn: async (payload: { id: string }) => {
    const { id } = payload
    deletingId.value = id
    try {
      await deleteScanEdge(id)
    } finally {
      deletingId.value = null
    }
  },
  onSuccess: (_data, variables) => {
    purgeThumbnailForScan(variables.id)
    void invalidateAppData('scan_deleted', { scanId: variables.id })
  },
  onError: () => { },
})

const signedUrls = ref<Record<string, string>>({})
const thumbnailLoadState = ref<Record<string, ThumbnailLoadState>>({})
const failedSignedPaths = ref(new Set<string>())
const pendingSignedPaths = ref(new Set<string>())

function purgeThumbnailForScan(scanId: string) {
  const deletedScan = scans.value?.find(scan => scan.id === scanId)
  if (deletedScan?.image_storage_path) {
    removeSignedImageUrl(deletedScan.image_storage_path)
  }

  const { [scanId]: _removedUrl, ...nextUrls } = signedUrls.value
  signedUrls.value = nextUrls

  const { [scanId]: _removedLoadState, ...nextLoadState } = thumbnailLoadState.value
  thumbnailLoadState.value = nextLoadState
}

function markThumbnailState(scanId: string, state: ThumbnailLoadState) {
  if (thumbnailLoadState.value[scanId] === state) return
  thumbnailLoadState.value = {
    ...thumbnailLoadState.value,
    [scanId]: state,
  }
}

function handleThumbnailLoaded(scanId: string) {
  markThumbnailState(scanId, 'loaded')
}

function handleThumbnailError(scan: ScanRow) {
  if (scan.image_storage_path) {
    removeSignedImageUrl(scan.image_storage_path, ['dashboard-thumb'])
  }

  const { [scan.id]: _removedUrl, ...nextUrls } = signedUrls.value
  signedUrls.value = nextUrls
  markThumbnailState(scan.id, 'error')
}

function showThumbnailSkeleton(scan: ScanRow) {
  if (!scan.image_storage_path) return false

  if (thumbnailLoadState.value[scan.id] === 'loading') return true
  const isPendingSignature = pendingSignedPaths.value.has(scan.image_storage_path)
  if (isPendingSignature) return true

  return !!signedUrls.value[scan.id] && thumbnailLoadState.value[scan.id] !== 'loaded'
}

function showThumbnailFallback(scan: ScanRow) {
  if (!scan.image_storage_path) return true
  if (showThumbnailSkeleton(scan)) return false
  return !signedUrls.value[scan.id] || thumbnailLoadState.value[scan.id] === 'error'
}

async function refreshDashboardScans(options: { allowRetry?: boolean } = {}) {
  if (!user.value?.id) return
  if (scansLoading.value) return
  if (options.allowRetry) {
    failedSignedPaths.value = new Set<string>()
  }
  await refetchScans()
}

function handleVisibilityRefresh() {
  if (!import.meta.client) return
  if (document.visibilityState === 'hidden') return
  if (!shouldRunDashboardForegroundRefresh()) return
  void refreshDashboardScans({ allowRetry: true })
}

watch(scans, async (rows) => {
  if (!rows) return

  const activeIds = new Set(rows.map(scan => scan.id))
  const nextSignedUrls = Object.fromEntries(
    Object.entries(signedUrls.value).filter(([id]) => activeIds.has(id)),
  )
  const nextThumbnailLoadState = Object.fromEntries(
    Object.entries(thumbnailLoadState.value).filter(([id]) => activeIds.has(id)),
  ) as Record<string, ThumbnailLoadState>

  rows.forEach((row) => {
    if (!row.image_storage_path) return
    const cachedUrl = getSignedImageUrl(row.image_storage_path, 'dashboard-thumb')
    if (!cachedUrl && nextThumbnailLoadState[row.id] !== 'loaded') {
      nextThumbnailLoadState[row.id] = 'loading'
    }
    if (cachedUrl) {
      nextSignedUrls[row.id] = cachedUrl
      nextThumbnailLoadState[row.id] = 'loaded'
    }
  })

  signedUrls.value = nextSignedUrls
  thumbnailLoadState.value = nextThumbnailLoadState

  const pathsToSign = rows
    .filter(r =>
      r.image_storage_path
      && !signedUrls.value[r.id]
      && !failedSignedPaths.value.has(r.image_storage_path)
      && !pendingSignedPaths.value.has(r.image_storage_path),
    )
    .map(r => ({ id: r.id, path: r.image_storage_path! }))
  if (pathsToSign.length === 0) return

  const previouslyLoadedIds = new Set(
    pathsToSign
      .filter(({ id }) => thumbnailLoadState.value[id] === 'loaded' && !!signedUrls.value[id])
      .map(({ id }) => id),
  )

  pendingSignedPaths.value = new Set([
    ...pendingSignedPaths.value,
    ...pathsToSign.map(({ path }) => path),
  ])
  pathsToSign.forEach(({ id }) => {
    if (!previouslyLoadedIds.has(id)) {
      markThumbnailState(id, 'loading')
    }
  })

  await Promise.allSettled(
    pathsToSign.map(async ({ id, path }) => {
      try {
        const { data, error } = await supabase.storage
          .from('scan-images')
          .createSignedUrl(path, 3600, {
            transform: { width: 100, height: 100, resize: 'cover' },
          })
        if (!error && data?.signedUrl) {
          cacheSignedImageUrl(path, 'dashboard-thumb', data.signedUrl, 3600)
          signedUrls.value = {
            ...signedUrls.value,
            [id]: data.signedUrl,
          }
          if (!previouslyLoadedIds.has(id)) {
            markThumbnailState(id, 'loading')
          }
          return
        }

        const nextFailures = new Set(failedSignedPaths.value)
        nextFailures.add(path)
        failedSignedPaths.value = nextFailures
        markThumbnailState(id, 'error')
      } finally {
        const nextPending = new Set(pendingSignedPaths.value)
        nextPending.delete(path)
        pendingSignedPaths.value = nextPending
      }
    })
  )
}, { immediate: true })

watch(scans, (rows, previousRows) => {
  if (!rows?.length || !previousRows?.length) return

  const previousById = new Map(previousRows.map(scan => [scan.id, scan]))
  const shouldRefreshCredits = rows.some((scan) => {
    const previous = previousById.get(scan.id)
    if (!previous) return false

    const leftProcessing = previous.processing_status === 'processing' && scan.processing_status !== 'processing'
    const consumedDaily = previous.credit_consumed_type !== 'daily' && scan.credit_consumed_type === 'daily'
    return leftProcessing || consumedDaily
  })

  if (!shouldRefreshCredits) return

  const scanWithTransition = rows.find((scan) => {
    const previous = previousById.get(scan.id)
    if (!previous) return false
    return previous.processing_status === 'processing' && scan.processing_status === 'completed'
  })

  const failedScan = rows.find((scan) => {
    const previous = previousById.get(scan.id)
    if (!previous) return false
    return previous.processing_status === 'processing' && scan.processing_status === 'failed'
  })

  if (scanWithTransition) {
    void invalidateAppData('scan_finished', { scanId: scanWithTransition.id })
    return
  }

  if (failedScan) {
    void invalidateAppData('scan_failed', { scanId: failedScan.id })
    return
  }

  void refreshCredits()
}, { deep: false })

function extractProductTitle(scan: ScanRow): string {
  return getScanProductTitle(scan.result_json, scan.certified_raw_text, t('account.dashboard.scan_item.untitled_scan'))
}

function ingredientCount(scan: ScanRow): number {
  return getScanIngredientCount(scan.result_json)
}

function alertCount(scan: ScanRow): number {
  return getScanAlertCount(scan.result_json)
}

function isProcessingScan(scan: ScanRow): boolean {
  return scan.processing_status === 'processing'
}

function isFailedScan(scan: ScanRow): boolean {
  return scan.processing_status === 'failed'
}

function resolvedStatus(scan: ScanRow): ProductStatus {
  return getScanResultStatus(scan.result_json, scan.product_status) as ProductStatus
}

function processingProgressLabel(scan: ScanRow): string {
  const progress = getScanBatchProgress(scan.result_json)
  if (!progress) {
    return t('account.dashboard.scan_item.processing')
  }

  return `${t('account.dashboard.scan_item.progress_items', {
    completed: progress.completed_items,
    total: progress.total_items,
  })} · ${t('account.dashboard.scan_item.processing_live')}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const time = d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return t('account.dashboard.scan_item.date_today', { time })
  if (diffDays === 1) return t('account.dashboard.scan_item.date_yesterday', { time })
  return d.toLocaleDateString(locale.value, { day: 'numeric', month: 'short' }).toUpperCase() + `, ${time}`
}

const filters = computed<{ key: 'all' | ProductStatus; label: string }[]>(() => [
  { key: 'all', label: t('account.dashboard.filters.all') },
  { key: 'ok', label: t('account.dashboard.filters.ok') },
  { key: 'contains_allergen', label: t('account.dashboard.filters.contains_allergen') },
  { key: 'ambiguous', label: t('account.dashboard.filters.ambiguous') },
])
const scanThumbnailAlt = computed(() => t('account.dashboard.scan_item.preview_alt'))

const showDailyCreditBanner = computed(() => {
  if (!hasDailyCredit.value) return false
  const until = dailyBannerDismissedUntil.value
  return !until || until <= Date.now()
})

watch(() => user.value?.id ?? null, (userId) => {
  hydrateDailyBannerDismissal(userId)
}, { immediate: true })

function dismissDailyCreditBanner() {
  const until = Date.now() + DAILY_CARD_HIDE_MS
  dailyBannerDismissedUntil.value = until
  persistDailyBannerDismissal(user.value?.id, until)
  scheduleDailyBannerReset(user.value?.id)
}
</script>

<template>
  <div>
    <!-- Loading auth -->
    <div class="min-h-screen flex flex-col bg-background" v-if="showDashboardInitialLoading">
      <div class="flex-1 flex items-center justify-center pt-4 pb-24 md:pt-20 md:pb-0">
        <PhSpinnerGap class="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>

    <!-- Not logged in -->
    <div v-else-if="showDashboardLoggedOutState" class="min-h-screen flex flex-col bg-background pt-4 pb-24 md:pt-20 md:pb-0">
      <main id="dashboard-login-content" class="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <div class="max-w-sm text-center space-y-6">
          <div class="w-16 h-16 flex items-center justify-center mx-auto bg-primary/10"
            style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-sm);">
            <PhLock :size="28" weight="duotone" class="text-primary" />
          </div>
          <h1 class="text-2xl font-black font-heading tracking-tight">{{ t('account.dashboard.lbl_restricted_access') }}</h1>
          <p class="text-muted-foreground text-sm leading-relaxed font-medium">
            {{ t('account.dashboard.desc_restricted') }}
          </p>
          <div class="flex flex-col gap-3">
            <NuxtLink :to="$localePath('/login?redirect=/app/dashboard')">
              <button class="bold-btn bold-btn--primary bold-btn--lg bold-btn--pill w-full">{{ t('account.dashboard.btn_login') }}</button>
            </NuxtLink>
          </div>
        </div>
      </main>
    </div>

    <!-- Dashboard -->
    <div v-else class="min-h-screen flex flex-col bg-background pb-24 md:pt-20 md:pb-0">
      <main id="main-content" class="flex-1 container mx-auto px-4 py-6 max-w-lg">

      <!-- Filter pills -->
      <div class="flex gap-2 overflow-x-auto pb-4 pr-1 no-scrollbar">
        <button v-for="f in filters" :key="f.key" :class="[
          'shrink-0 px-4 py-2 text-sm font-bold transition-all duration-150',
          activeFilter === f.key
            ? 'bg-primary text-white'
            : 'bg-card text-foreground hover:bg-muted/50',
        ]"
          style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-pill); box-shadow: var(--bold-shadow-xs);"
          @click="activeFilter = f.key">
          {{ f.label }}
        </button>
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <PhClockCounterClockwise :size="20" weight="duotone" class="text-primary" />
          <h1 class="text-lg font-black font-heading tracking-tight uppercase">{{ t('account.dashboard.header_history') }}</h1>
        </div>
        <span v-if="filteredScans.length > 0" class="text-xs font-bold px-3 py-1 bg-card"
          style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-pill); box-shadow: var(--bold-shadow-xs);">
          {{ t('account.dashboard.lbl_total', { count: filteredScans.length }) }}
        </span>
      </div>

      <!-- Loading: shadow cards -->
      <div v-if="scansLoading && !canRenderWarmDashboard" class="space-y-3" aria-busy="true" :aria-label="t('account.dashboard.loading_aria')">
        <div v-for="i in 4" :key="i" class="bold-card flex items-center gap-3 p-3 animate-pulse">
          <div class="w-14 h-14 shrink-0 rounded-lg bg-muted/60"
            style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);" />
          <div class="flex-1 min-w-0 space-y-2">
            <div class="h-3.5 w-3/4 rounded bg-muted/60" />
            <div class="h-3 w-1/2 rounded bg-muted/40" />
            <div class="h-2.5 w-1/3 rounded bg-muted/30" />
          </div>
          <div class="w-9 h-9 shrink-0 rounded-full bg-muted/50 ring-2 ring-muted/30" />
          <div class="w-8 h-8 shrink-0 rounded bg-muted/30" />
        </div>
      </div>

      <!-- Empty -->
      <section v-else-if="filteredScans.length === 0" class="bold-card--static p-8 text-center">
        <div class="w-16 h-16 flex items-center justify-center mx-auto mb-4 bg-primary/10 overflow-hidden"
          style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-xs);">
          <img :src="EMOJI_MAP[APP_EMOJI.emptyScan]" alt="" width="56" height="56"
            class="w-14 h-14 object-contain select-none" />
        </div>
        <h2 class="text-lg font-extrabold font-heading mb-2">{{ t('account.dashboard.empty_title') }}</h2>
        <p class="text-sm text-muted-foreground mb-6 max-w-sm mx-auto font-medium">
          {{ t('account.dashboard.empty_desc') }}
        </p>
        <ScanCtaButton @click="openScan()" />
      </section>

      <!-- Scan list -->
      <div v-else class="space-y-3">
        <!-- New scan CTA — hidden when daily credit card is floating above -->
        <button
          v-if="!showDailyCreditBanner"
          class="w-full flex items-center justify-center gap-2 p-4 mb-4 cursor-pointer text-primary font-bold text-sm transition-colors hover:bg-primary/5"
          style="border: 2.5px dashed var(--bold-border-color); border-radius: var(--bold-radius); opacity: 0.7;"
          @click="openScan()">
          <span class="relative">
            <PhScan :size="18" weight="duotone" class="animate-subtle-pulse" />
            <PhSparkle class="w-2.5 h-2.5 absolute -top-[0.14rem] -right-[0.14rem] animate-subtle-pulse text-primary"
              weight="fill" />
          </span>
          {{ t('account.dashboard.btn_scan_ai') }}
        </button>

        <NuxtLink v-for="scan in filteredScans" :key="scan.id" :to="localePath(`/app/scan/${scan.id}`)" class="block">
          <div class="bold-card flex items-center gap-3 p-3 cursor-pointer">
            <!-- Thumbnail -->
            <div class="relative w-14 h-14 shrink-0 overflow-hidden flex items-center justify-center bg-muted/40"
              style="border: 2px solid var(--bold-border-color); border-radius: var(--bold-radius-sm);">
              <div
                v-if="showThumbnailSkeleton(scan)"
                class="scan-thumb-skeleton absolute inset-0"
                aria-hidden="true"
              />
              <img
                v-if="signedUrls[scan.id]"
                :src="signedUrls[scan.id]"
                :alt="scanThumbnailAlt"
                class="w-full h-full object-cover transition-all duration-300"
                :class="thumbnailLoadState[scan.id] === 'loaded' ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.04]'"
                @load="handleThumbnailLoaded(scan.id)"
                @error="handleThumbnailError(scan)"
              />
              <PhImageBroken v-else-if="showThumbnailFallback(scan)" :size="24" class="text-muted-foreground/40" />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-black font-heading leading-tight line-clamp-1 uppercase">
                {{ extractProductTitle(scan) }}
              </p>
              <p
                v-if="isProcessingScan(scan)"
                class="text-xs text-primary mt-0.5 font-bold"
              >
                {{ t('account.dashboard.scan_item.processing') }}
              </p>
              <p
                v-else-if="isFailedScan(scan)"
                class="text-xs text-red-600 mt-0.5 font-bold"
              >
                {{ t('account.dashboard.scan_item.failed') }}
              </p>
              <p v-else class="text-xs text-muted-foreground mt-0.5 font-medium">
                {{ t('account.dashboard.scan_item.ingredients_count', { count: ingredientCount(scan) }) }}
                <span v-if="alertCount(scan) > 0" class="text-red-500 font-bold">
                  &middot; {{ t('account.dashboard.scan_item.alert_count', { count: alertCount(scan) }) }}
                </span>
              </p>
              <p
                v-if="isProcessingScan(scan)"
                class="text-[11px] text-muted-foreground mt-0.5 font-medium"
              >
                {{ processingProgressLabel(scan) }}
              </p>
              <p
                v-else-if="isFailedScan(scan) && scan.processing_error"
                class="text-[11px] text-muted-foreground mt-0.5 line-clamp-2"
              >
                {{ scan.processing_error }}
              </p>
              <p class="text-[11px] text-muted-foreground/70 mt-0.5">
                {{ formatDate(scan.created_at) }}
              </p>
            </div>

            <!-- Status emoji (conforme → happy, allergène → angry, ambigu → thinking) -->
            <div
              :class="[
                isProcessingScan(scan)
                  ? 'bg-primary/10 ring-primary/30'
                  : isFailedScan(scan)
                    ? 'bg-red-50 ring-red-200'
                    : getScanStatusCircleConfig(resolvedStatus(scan)).bg,
                !isProcessingScan(scan) && !isFailedScan(scan) ? getScanStatusCircleConfig(resolvedStatus(scan)).ring : '',
              ]"
              class="w-9 h-9 shrink-0 flex items-center justify-center ring-2 overflow-hidden" style="border-radius: 50%;">
              <PhSpinnerGap
                v-if="isProcessingScan(scan)"
                :size="18"
                class="animate-spin text-primary"
              />
              <PhWarning
                v-else-if="isFailedScan(scan)"
                :size="18"
                weight="fill"
                class="text-red-600"
              />
              <AppEmoji
                v-else
                :name="STATUS_EMOJIS[resolvedStatus(scan)]"
                :size="35"
                :filter-class="getStatusEmojiFilterClass(resolvedStatus(scan))"
              />
            </div>

            <!-- Delete -->
            <button class="shrink-0 p-1.5 text-muted-foreground/40 hover:text-red-500 transition-colors"
              :disabled="deletingId === scan.id" @click.prevent.stop="openDeleteConfirm(scan)">
              <PhSpinnerGap v-if="deletingId === scan.id" :size="16" class="animate-spin" />
              <PhTrash v-else :size="16" />
            </button>
          </div>
        </NuxtLink>
      </div>

      </main>

      <!-- Modal confirmation suppression scan -->
      <Teleport to="body">
        <Transition name="modal">
          <div v-if="scanToDelete" class="fixed inset-0 z-[100] flex items-center justify-center p-4"
            @click.self="closeDeleteConfirm">
            <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" @click="closeDeleteConfirm" />
            <div class="relative z-10 w-full max-w-sm bg-card overflow-hidden animate-pop-in"
              style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius-lg); box-shadow: var(--bold-shadow-lg);">
              <div class="px-6 pt-8 pb-2 text-center">
                <div class="w-14 h-14 flex items-center justify-center mx-auto mb-3 bg-red-500/10"
                  style="border: 2.5px solid var(--bold-border-color); border-radius: var(--bold-radius); box-shadow: var(--bold-shadow-xs);">
                  <PhTrash :size="24" weight="duotone" class="text-red-500" />
                </div>
                <h2 class="text-xl font-black font-heading tracking-tight mb-1">{{ t('account.dashboard.delete_modal.title') }}</h2>
                <p class="text-sm text-muted-foreground leading-relaxed">
                  {{ t('account.dashboard.delete_modal.desc') }}
                </p>
              </div>
              <div class="px-6 pb-8 flex gap-3 justify-center">
                <button type="button" class="bold-btn flex-1" style="border: 2.5px solid var(--bold-border-color);"
                  @click="closeDeleteConfirm">
                  {{ t('account.dashboard.delete_modal.btn_cancel') }}
                </button>
                <button type="button" class="bold-btn bold-btn--primary flex-1"
                  :disabled="deletingId === scanToDelete?.id" @click="confirmDelete">
                  <PhSpinnerGap v-if="deletingId === scanToDelete?.id" :size="18" class="animate-spin" />
                  <PhTrash v-else :size="18" />
                  {{ t('account.dashboard.delete_modal.btn_delete') }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
      <!-- Sticky floating daily credit card (above nav) -->
      <Teleport to="body">
        <Transition name="daily-card">
          <div
            v-if="showDailyCreditBanner"
            class="fixed z-40 left-0 right-0 flex justify-center mb-[2rem] daily-card-floating"
            style="bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));"
          >
            <div
              class="daily-card-shiny w-full max-w-sm mx-4 relative overflow-visible flex items-center gap-3 px-4 py-3"
              style="
                border-radius: var(--bold-radius-lg);
                border: 2px solid hsl(42 90% 60% / 0.55);
                background: linear-gradient(135deg, hsl(var(--card)) 55%, hsl(42 90% 95% / 0.12));
                box-shadow: 0 0 0 1px hsl(42 90% 60% / 0.12), var(--bold-shadow-lg), 0 0 28px hsl(42 90% 60% / 0.2);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
              "
            >
              <button
                type="button"
                class="absolute -top-3 -left-3 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-background/95 text-muted-foreground hover:text-foreground transition-colors"
                style="border: 2px solid hsl(42 90% 60% / 0.75); box-shadow: var(--bold-shadow-xs), 0 0 0 1px hsl(42 90% 60% / 0.12);"
                :aria-label="t('account.dashboard.daily_credit.btn_dismiss')"
                @click.stop="dismissDailyCreditBanner"
              >
                <PhX :size="12" weight="bold" />
              </button>

              <div
                class="absolute inset-0 overflow-hidden pointer-events-none"
                style="border-radius: inherit;"
              >
                <!-- Shimmer sweep -->
                <div class="shimmer-sweep absolute inset-0" />

                <!-- Gold radial glow -->
                <div
                  class="absolute inset-0 opacity-[0.06]"
                  style="background: radial-gradient(ellipse at 15% 50%, hsl(42 90% 60%), transparent 65%);"
                />
              </div>

              <div class="relative z-10 flex items-center gap-3 w-full min-w-0">
                <!-- Happy emoji (gold tinted) -->
                <div class="shrink-0 relative">
                  <img
                    src="/images/emojis/happy.webp"
                    alt=""
                    width="64"
                    height="64"
                    class="w-14 h-14 object-contain select-none relative z-10"
                    style="filter: drop-shadow(0 2px 8px hsl(42 90% 60% / 0.6)) sepia(1) saturate(5) hue-rotate(-12deg) contrast(1.15);"
                  />
                </div>

                <!-- Text -->
                <div class="flex-1 min-w-0 relative">
                  <p class="text-sm font-black font-heading leading-tight text-foreground">{{ t('account.dashboard.daily_credit.title') }}</p>
                  <p class="text-[11px] font-bold mt-0.5" style="color: hsl(42 100% 35%);">
                    {{ t('account.dashboard.daily_credit.desc') }}
                  </p>
                </div>

                <!-- CTA gold shiny (bold design click animation) -->
                <button
                  class="bold-btn bold-btn--pill shrink-0 relative flex items-center gap-1.5 font-black overflow-hidden"
                  style="
                    font-size: 0.75rem;
                    padding: 0.45rem 1rem;
                    background: linear-gradient(135deg, hsl(42 95% 55%), hsl(38 98% 46%));
                    color: #fff;
                    border: 2px solid hsl(42 90% 36%);
                    text-shadow: 0 1px 2px hsl(38 90% 28% / 0.5);
                    --bold-color: hsl(38 90% 30%);
                  "
                  @click="openScan()"
                >
                  <span
                    class="absolute inset-0 pointer-events-none"
                    style="background: linear-gradient(105deg, transparent 30%, hsl(42 100% 92% / 0.4) 55%, transparent 80%); animation: shimmer 2s ease-in-out infinite;"
                  />
                  <PhScan :size="14" weight="bold" class="relative" />
                  <span class="relative">{{ t('account.dashboard.daily_credit.btn_scan') }}</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scan-thumb-skeleton {
  background:
    linear-gradient(135deg, hsl(var(--muted) / 0.75), hsl(var(--background) / 0.6)),
    hsl(var(--muted) / 0.45);
}

.scan-thumb-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 18%,
    hsl(var(--background) / 0.55) 48%,
    transparent 78%
  );
  transform: translateX(-120%);
  animation: scan-thumb-sheen 1.35s ease-in-out infinite;
}

@keyframes scan-thumb-sheen {
  to {
    transform: translateX(180%);
  }
}

/* Floating animation */
.daily-card-floating {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-5px); }
}

/* Shimmer sweep */
.shimmer-sweep::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 20%,
    hsl(42 100% 90% / 0.4) 50%,
    transparent 80%
  );
  animation: shimmer 2.4s ease-in-out infinite;
  border-radius: inherit;
}

@keyframes shimmer {
  0%   { transform: translateX(-110%); }
  100% { transform: translateX(210%); }
}

/* Enter / leave transition */
.daily-card-enter-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.daily-card-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.daily-card-enter-from,
.daily-card-leave-to {
  opacity: 0;
  transform: translateY(18px);
}

/* Desktop: card sits below the top nav */
@media (min-width: 768px) {
  .daily-card-floating {
    bottom: auto !important;
    top: 5.5rem;
    animation: none;
  }
}
</style>
