/**
 * Shared store for passing a captured/selected image blob
 * from any page (dashboard, etc.) to the scan page.
 */
const pendingScanBlob = ref<Blob | null>(null)
const pendingScanSource = ref<'library' | 'camera'>('library')

export function useScanStore() {
  const setPendingScan = (blob: Blob, source: 'library' | 'camera') => {
    pendingScanBlob.value = blob
    pendingScanSource.value = source
  }

  const consumePendingScan = () => {
    const blob = pendingScanBlob.value
    const source = pendingScanSource.value
    pendingScanBlob.value = null
    return blob ? { blob, source } : null
  }

  const hasPendingScan = computed(() => !!pendingScanBlob.value)

  return { setPendingScan, consumePendingScan, hasPendingScan }
}
