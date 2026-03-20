import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('runtime cache ux hardening', () => {
  it('reuses signed scan image urls with a user-scoped in-memory cache and loading states', () => {
    const helper = readFileSync(resolve(rootDir, 'composables/useScanImageSessionCache.ts'), 'utf8')
    const dashboard = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')
    const scanDetail = readFileSync(resolve(rootDir, 'pages/app/scan/[id].vue'), 'utf8')

    expect(helper).toContain("type SignedImageCacheVariant = 'dashboard-thumb' | 'scan-detail'")
    expect(helper).toContain('return `${userId}::${variant}::${path}`')
    expect(helper).toContain('retainUserEntries(userId)')
    expect(helper).toContain('removeSignedImageUrl')
    expect(helper).not.toContain('localStorage.setItem')
    expect(helper).not.toContain('localStorage.getItem')
    expect(helper).not.toContain('SIGNED_IMAGE_CACHE_STORAGE_KEY')

    expect(dashboard).toContain("getSignedImageUrl(row.image_storage_path, 'dashboard-thumb')")
    expect(dashboard).toContain("cacheSignedImageUrl(path, 'dashboard-thumb', data.signedUrl, 3600)")
    expect(dashboard).toContain('showThumbnailSkeleton(scan)')
    expect(dashboard).toContain('refetchOnWindowFocus: false')
    expect(dashboard).toContain("nextThumbnailLoadState[row.id] = 'loaded'")
    expect(dashboard).toContain("@load=\"handleThumbnailLoaded(scan.id)\"")
    expect(scanDetail).toContain("getSignedImageUrl(imagePath, 'scan-detail')")
    expect(scanDetail).toContain("cacheSignedImageUrl(imagePath, 'scan-detail', data.signedUrl, 3600)")
    expect(scanDetail).toContain("const detailImageLoadState = ref<DetailImageLoadState>('idle')")
    expect(scanDetail).toContain('scan-detail-image-skeleton')
    expect(scanDetail).toContain('@load="handleDetailImageLoaded"')
  })

  it('ne rebloque pas toute l ui app pendant une validation auth de fond', () => {
    const authSource = readFileSync(resolve(rootDir, 'composables/useAuth.ts'), 'utf8')
    const dashboard = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')
    const account = readFileSync(resolve(rootDir, 'pages/app/account.vue'), 'utf8')

    expect(authSource).toContain('const OPTIMISTIC_AUTH_MIN_TTL_MS = 60_000')
    expect(authSource).toContain('if (optimisticSession && hasFreshLocalSession(optimisticSession))')
    expect(authSource).toContain('const shouldBlockUi = !initialized.value && !user.value')

    expect(dashboard).toContain("const isCheckingAuth = computed(() => (!initialized.value && !user.value) || (authLoading.value && !user.value))")
    expect(account).toContain("const isCheckingAuth = computed(() => (!initialized.value && !user.value) || (authLoading.value && !user.value))")
  })
})
