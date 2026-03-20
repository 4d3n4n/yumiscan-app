/**
 * Global singleton for the scan overlay flow.
 * Opened from anywhere (homepage, dashboard, scan/[id]).
 * The ScanOverlay component (mounted in app.vue) listens to this state.
 */

type ScanView = 'choice' | 'camera' | 'preview' | 'loading'

const isOpen = ref(false)
const view = ref<ScanView>('choice')
const pendingBlob = ref<Blob | null>(null)
const pendingImageUrl = ref<string | null>(null)
const previewSource = ref<'library' | 'camera'>('library')
const cameraFacingMode = ref<'environment' | 'user'>('environment')

function _clearBlob() {
  if (pendingImageUrl.value) {
    URL.revokeObjectURL(pendingImageUrl.value)
    pendingImageUrl.value = null
  }
  pendingBlob.value = null
}

export function useScanFlow() {
  const openScan = () => {
    _clearBlob()
    view.value = 'choice'
    isOpen.value = true
  }

  const closeScan = () => {
    _clearBlob()
    view.value = 'choice'
    isOpen.value = false
  }

  return {
    isOpen,
    view,
    pendingBlob,
    pendingImageUrl,
    previewSource,
    cameraFacingMode,
    openScan,
    closeScan,
  }
}
