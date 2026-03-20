<script setup lang="ts">
import type { AllergenCatalogRow } from '~/utils/types'
import { processImageForOCR, compressImageForStorage, blobToBase64, convertHeicToJpeg } from '~/utils/image-processor'
import { EMOJI_MAP, APP_EMOJI } from '~/utils/emojis'
import { SCAN_TIMEOUT_MESSAGE } from '~/composables/useEdgeFunctions'
import { sortAllergensByLocale } from '~/utils/allergens'
import { useI18n } from 'vue-i18n'
import { getAuthenticatedSession } from '~/utils/supabase-auth'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { user } = useAuth()

const LOADER_STEP_DURATION_MS = 1800

const supabase = useSupabase()
const edgeFunctions = useEdgeFunctions()
const { setActiveScanRecovery, clearActiveScanRecovery } = useActiveScanRecovery()
const { invalidateAppData } = useAppDataInvalidation()

const {
  isOpen, view,
  pendingBlob, pendingImageUrl, previewSource, cameraFacingMode,
  closeScan,
} = useScanFlow()

const { hasCredits, creditsUserId, creditsReliable } = useCredits()

const fileInputRef = ref<HTMLInputElement | null>(null)

const allergensCatalog = ref<AllergenCatalogRow[]>([])
const allergensLoading = ref(false)
const selectedAllergenIds = ref(new Set<string>())
const loadedPreferencesUserId = ref<string | null>(null)

const cameraError = ref<string | null>(null)
const scanError = ref<string | null>(null)
const loadingStepIndex = ref(0)
const isScanning = ref(false)
const isProcessingImage = ref(false)

const noCredits = computed(() => !!creditsUserId.value && creditsReliable.value && !hasCredits.value)
const localizedAllergensCatalog = computed(() => sortAllergensByLocale(allergensCatalog.value, locale.value))

watch(
  () => user.value?.id ?? null,
  (nextUserId, previousUserId) => {
    if (nextUserId === previousUserId) return
    loadedPreferencesUserId.value = null
    selectedAllergenIds.value = new Set<string>()
  },
  { immediate: true },
)

const goToPricing = async () => {
  closeScan()
  await navigateTo(localePath('/pricing'))
}

// Track paywall hits (once per open overlay)
let paywallHitRecorded = false
watch(isOpen, (val) => {
  if (!val) paywallHitRecorded = false
})

watchEffect(() => {
  if (isOpen.value && noCredits.value && !paywallHitRecorded) {
    paywallHitRecorded = true
    if (creditsUserId.value) {
      // Fire and forget, no await to not block the UI
      supabase.from('paywall_hits').insert({ user_id: creditsUserId.value }).then()
    }
  }
})

// Load allergens + user prefs each time the overlay opens
watch(isOpen, async (val) => {
  if (!val) return
  scanError.value = null

  if (allergensCatalog.value.length === 0) {
    allergensLoading.value = true
    const { data: catalogData, error: catalogError } = await supabase
      .from('allergens')
      .select('id, name, name_en, slug')
    allergensLoading.value = false
    if (!catalogError && catalogData) allergensCatalog.value = catalogData as AllergenCatalogRow[]
  }

  try {
    const userId = user.value?.id ?? null
    if (!userId || loadedPreferencesUserId.value === userId) return
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .single()
    if (profile?.preferences && Array.isArray(profile.preferences) && profile.preferences.length > 0) {
      if (selectedAllergenIds.value.size === 0) {
        selectedAllergenIds.value = new Set(profile.preferences as string[])
      }
    }
    loadedPreferencesUserId.value = userId
  } catch (e) {
    console.error('Failed to load user allergens', e)
  }
})

const toggleAllergen = (allergenId: string) => {
  const next = new Set(selectedAllergenIds.value)
  if (next.has(allergenId)) next.delete(allergenId)
  else next.add(allergenId)
  selectedAllergenIds.value = next
}

const onClose = () => {
  cameraError.value = null
  closeScan()
}

const chooseLibrary = () => {
  cameraError.value = null
  nextTick(() => fileInputRef.value?.click())
}

const chooseCamera = () => {
  cameraError.value = null
  view.value = 'camera'
}

const onFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
    scanError.value = t('scan.scan.overlay.error_file_type')
    return
  }

  if (pendingImageUrl.value) URL.revokeObjectURL(pendingImageUrl.value)
  isProcessingImage.value = true
  scanError.value = null

  try {
    const processedBlob = await convertHeicToJpeg(file)
    pendingBlob.value = processedBlob
    pendingImageUrl.value = URL.createObjectURL(processedBlob)
    previewSource.value = 'library'
    view.value = 'preview'
  } catch {
    scanError.value = t('scan.scan.overlay.error_processing')
  } finally {
    isProcessingImage.value = false
  }
}

const onCameraCapture = (blob: Blob) => {
  if (pendingImageUrl.value) URL.revokeObjectURL(pendingImageUrl.value)
  pendingBlob.value = blob
  pendingImageUrl.value = URL.createObjectURL(blob)
  previewSource.value = 'camera'
  view.value = 'preview'
}

const onCameraBack = () => {
  cameraError.value = null
  view.value = 'choice'
}

const onPreviewBack = () => {
  if (pendingImageUrl.value) { URL.revokeObjectURL(pendingImageUrl.value); pendingImageUrl.value = null }
  pendingBlob.value = null
  view.value = 'choice'
}

const onPreviewRetake = () => {
  view.value = 'camera'
}

const onPreviewChangeImage = () => {
  nextTick(() => fileInputRef.value?.click())
}

const runScanWithAI = async () => {
  if (!pendingBlob.value) return
  const session = await getAuthenticatedSession(supabase)
  if (!session) { scanError.value = t('scan.scan.overlay.error_unauthorized'); return }

  if (creditsReliable.value && !hasCredits.value) {
    view.value = 'choice'
    return
  }

  view.value = 'loading'
  scanError.value = null
  isScanning.value = true
  loadingStepIndex.value = 0

  const stepInterval = setInterval(() => {
    loadingStepIndex.value = Math.min(loadingStepIndex.value + 1, 5)
  }, LOADER_STEP_DURATION_MS)

  try {
    const [processedBlob, storagePreviewBlob] = await Promise.all([
      processImageForOCR(pendingBlob.value),
      compressImageForStorage(pendingBlob.value),
    ])

    const [imageBase64, imageProcessedBase64, imageStoragePreviewBase64] = await Promise.all([
      blobToBase64(pendingBlob.value),
      blobToBase64(processedBlob),
      blobToBase64(storagePreviewBlob),
    ])

    const selectedAllergens = allergensCatalog.value
      .filter(a => selectedAllergenIds.value.has(a.id))
    const selectedSlugs = selectedAllergens
      .map(a => a.slug)
      .filter((slug): slug is string => Boolean(slug))

    const result = await edgeFunctions.foodScanAnalyze({
      imageBase64,
      imageProcessedBase64,
      imageStoragePreviewBase64,
      language: locale.value === 'en' ? 'en' : 'fr',
      filters: {
        noCrustaceans: selectedSlugs.includes('sans-crustaces'),
        noGluten: selectedSlugs.includes('sans-gluten'),
        vegan: selectedSlugs.includes('vegan'),
      },
      allergenIds: Array.from(selectedAllergenIds.value),
    })

    clearInterval(stepInterval)
    isScanning.value = false
    if (result.scan_id) {
      await invalidateAppData('scan_started', { scanId: result.scan_id })
      closeScan()
      setActiveScanRecovery(result.scan_id)
      await navigateTo(localePath(`/app/scan/${result.scan_id}`))
      return
    }

    await invalidateAppData('scan_started')
    closeScan()
  } catch (e) {
    clearInterval(stepInterval)
    isScanning.value = false
    await invalidateAppData('scan_started')
    const msg = e instanceof Error ? e.message : t('scan.scan.overlay.error_generic')
    if (/cr[eé]dit/i.test(msg) || /disponible/i.test(msg)) {
      clearActiveScanRecovery()
      scanError.value = null
      view.value = 'choice'
    } else if (msg === SCAN_TIMEOUT_MESSAGE || /upload|timeout|d[eé]lai|fetch|network|abort|load failed|failed to fetch|networkerror|cors/i.test(msg)) {
      scanError.value = t('scan.scan.overlay.error_network')
      view.value = 'preview'
    } else {
      scanError.value = msg
      view.value = 'preview'
    }
  }
}
</script>

<template>
  <!-- Hidden file input, always mounted when overlay is active -->
  <input
    v-if="isOpen"
    ref="fileInputRef"
    type="file"
    accept="image/*,.heic,.heif"
    class="hidden"
    @change="onFileSelected"
  >

  <!-- Choice modal : import/photo ; si plus de crédits, boutons désactivés + message CTA en dessous -->
  <ScanChoiceModal
    :open="isOpen && view === 'choice'"
    :no-credits="noCredits"
    @update:open="!$event && onClose()"
    @library="chooseLibrary"
    @camera="chooseCamera"
    @go-to-pricing="goToPricing"
  />

  <!-- Fullscreen overlays via Teleport to avoid z-index conflicts -->
  <Teleport to="body">
    <!-- Camera -->
    <div v-if="isOpen && view === 'camera'" class="fixed inset-0 z-[200] bg-background">
      <ScanCamera
        :facing-mode="cameraFacingMode"
        :error="cameraError"
        @capture="onCameraCapture"
        @back="onCameraBack"
        @switch-camera="cameraFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment'"
        @clear-error="cameraError = null"
        @error="(msg: string) => cameraError = msg"
        @open-gallery="() => nextTick(() => fileInputRef?.click())"
      />
    </div>

    <!-- Preview -->
    <div v-if="isOpen && view === 'preview' && pendingImageUrl" class="fixed inset-0 z-[200] bg-background">
      <ScanCapturePreview
        :image-url="pendingImageUrl"
        :source="previewSource"
        :scanning="isScanning"
        :allergens-catalog="localizedAllergensCatalog"
        :allergens-loading="allergensLoading"
        :selected-allergen-ids="selectedAllergenIds"
        @back="onPreviewBack"
        @retake="onPreviewRetake"
        @change-image="onPreviewChangeImage"
        @scan-with-a-i="runScanWithAI"
        @toggle="toggleAllergen"
      />
    </div>

    <!-- Loading (scan IA en cours) -->
    <div
      v-if="view === 'loading'"
      class="fixed inset-0 z-[210] bg-black/80 flex items-center justify-center backdrop-blur-sm"
    >
      <ScanProgressLoader :current-step-index="loadingStepIndex" />
    </div>

    <!-- Processing image (HEIC conversion etc.) -->
    <div
      v-if="isProcessingImage"
      class="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center backdrop-blur-sm"
    >
      <div class="flex flex-col items-center gap-4">
        <span class="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p class="text-white font-medium">{{ t('scan.scan.overlay.loading_image') }}</p>
      </div>
    </div>

    <!-- Scan error (toast) -->
    <div
      v-if="isOpen && scanError"
      class="fixed bottom-6 left-4 right-4 z-[220] max-w-sm mx-auto"
    >
      <div
        class="flex items-center gap-3 p-4 font-medium text-sm"
        style="border: 2px solid hsl(var(--destructive) / 0.4); border-radius: var(--bold-radius); background: hsl(var(--card)); color: hsl(var(--destructive)); box-shadow: var(--bold-shadow-lg);"
      >
        <img
          :src="EMOJI_MAP[APP_EMOJI.scanError]"
          alt=""
          width="28"
          height="28"
          class="shrink-0 w-10 h-10 object-contain select-none emoji-error"
        >
        <span class="leading-snug flex-1 min-w-0 break-words">{{ scanError }}</span>
        <button class="shrink-0 font-bold text-base leading-none" @click="scanError = null">✕</button>
      </div>
    </div>
  </Teleport>
</template>
