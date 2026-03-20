type SignedImageCacheVariant = 'dashboard-thumb' | 'scan-detail'

type SignedImageCacheEntry = {
  url: string
  expiresAt: number
}

function signedImageCacheKey(userId: string, path: string, variant: SignedImageCacheVariant) {
  return `${userId}::${variant}::${path}`
}

export function useScanImageSessionCache() {
  const { user } = useAuth()
  const cache = useState<Record<string, SignedImageCacheEntry>>('scan-signed-image-cache', () => ({}))
  const bound = useState<boolean>('scan-signed-image-cache-bound', () => false)
  const lastUserId = useState<string | null>('scan-signed-image-cache-user', () => null)

  function purgeExpired(now = Date.now()) {
    const nextEntries = Object.entries(cache.value).filter(([, entry]) => entry.expiresAt > now)
    if (nextEntries.length === Object.keys(cache.value).length) return

    cache.value = Object.fromEntries(nextEntries)
  }

  function clearCache() {
    cache.value = {}
  }

  function retainUserEntries(userId: string) {
    const nextEntries = Object.entries(cache.value).filter(([key]) => key.startsWith(`${userId}::`))
    if (nextEntries.length === Object.keys(cache.value).length) return
    cache.value = Object.fromEntries(nextEntries)
  }

  if (import.meta.client && !bound.value) {
    bound.value = true

    watch(() => user.value?.id ?? null, (userId) => {
      purgeExpired()

      if (!userId) {
        if (lastUserId.value) {
          clearCache()
        }
        lastUserId.value = null
        return
      }

      if (lastUserId.value && lastUserId.value !== userId) {
        clearCache()
      }

      retainUserEntries(userId)
      lastUserId.value = userId
    }, { immediate: true })
  }

  function getSignedImageUrl(path: string, variant: SignedImageCacheVariant) {
    purgeExpired()

    const userId = user.value?.id
    if (!userId) return null

    return cache.value[signedImageCacheKey(userId, path, variant)]?.url ?? null
  }

  function cacheSignedImageUrl(path: string, variant: SignedImageCacheVariant, url: string, expiresInSeconds: number) {
    const userId = user.value?.id
    if (!userId) return

    cache.value = {
      ...cache.value,
      [signedImageCacheKey(userId, path, variant)]: {
        url,
        expiresAt: Date.now() + Math.max(1, expiresInSeconds - 60) * 1000,
      },
    }
  }

  function removeSignedImageUrl(path: string, variants?: SignedImageCacheVariant[]) {
    const userId = user.value?.id
    if (!userId) return

    const targetVariants = variants ?? ['dashboard-thumb', 'scan-detail']
    const keysToRemove = new Set(
      targetVariants.map(variant => signedImageCacheKey(userId, path, variant)),
    )
    const nextEntries = Object.entries(cache.value).filter(([key]) => !keysToRemove.has(key))
    const mutated = nextEntries.length !== Object.keys(cache.value).length

    if (!mutated) return
    cache.value = Object.fromEntries(nextEntries)
  }

  return {
    getSignedImageUrl,
    cacheSignedImageUrl,
    removeSignedImageUrl,
    clearScanImageCache: clearCache,
  }
}
