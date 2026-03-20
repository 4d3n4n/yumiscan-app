/**
 * Tests du composable useAdmin (verification is_admin pour le back-office).
 * Le composable depend maintenant du socle auth global useAuth().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

const mockSingle = vi.fn()
const mockFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockSingle,
}))

describe('useAdmin', () => {
  const authUser = ref<{ id: string } | null>(null)
  const authInitialized = ref(true)
  const authStatus = ref<'authenticated' | 'unauthenticated' | 'unknown'>('unauthenticated')

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    authUser.value = null
    authInitialized.value = true
    authStatus.value = 'unauthenticated'

    vi.doMock('../../composables/useSupabase', () => ({
      useSupabase: () => ({
        from: mockFrom,
      }),
    }))
    vi.doMock('../../composables/useAuth', () => ({
      useAuth: () => ({
        user: authUser,
        initialized: authInitialized,
        authStatus,
      }),
    }))
    vi.stubGlobal('useSupabase', () => ({
      from: mockFrom,
    }))
    vi.stubGlobal('useAuth', () => ({
      user: authUser,
      initialized: authInitialized,
      authStatus,
    }))
  })

  afterEach(() => {
    vi.doUnmock('../../composables/useSupabase')
    vi.doUnmock('../../composables/useAuth')
    vi.unstubAllGlobals()
  })

  async function mountUseAdmin() {
    const { useAdmin } = await import('../../composables/useAdmin')
    let api: ReturnType<typeof useAdmin> | null = null

    const Harness = defineComponent({
      setup() {
        api = useAdmin()
        return () => null
      },
    })

    const wrapper = mount(Harness)

    if (!api) {
      throw new Error('useAdmin n a pas ete initialise')
    }

    return { wrapper, api: api as ReturnType<typeof useAdmin> }
  }

  it('expose isAdmin, loading et check', async () => {
    authUser.value = { id: 'user-1' }
    authStatus.value = 'authenticated'
    mockSingle.mockResolvedValue({ data: { is_admin: true } })

    const { wrapper, api } = await mountUseAdmin()
    const { isAdmin, loading, check } = api

    expect(isAdmin.value).toBe(null)
    expect(loading.value).toBe(true)

    await check()
    await flushPromises()

    expect(loading.value).toBe(false)
    expect(isAdmin.value).toBe(true)
    expect(typeof check).toBe('function')
    expect(mockFrom).toHaveBeenCalledWith('user_profiles')
    expect(mockSingle).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('met isAdmin a false quand pas de user', async () => {
    authUser.value = null

    const { wrapper, api } = await mountUseAdmin()

    await api.check()
    await flushPromises()

    expect(api.isAdmin.value).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('met isAdmin a false quand is_admin !== true dans le profil', async () => {
    authUser.value = { id: 'user-2' }
    authStatus.value = 'authenticated'
    mockSingle.mockResolvedValue({ data: { is_admin: false } })

    const { wrapper, api } = await mountUseAdmin()

    await api.check()
    await flushPromises()

    expect(api.isAdmin.value).toBe(false)
    wrapper.unmount()
  })

  it('met isAdmin a false quand le profil est null', async () => {
    authUser.value = { id: 'user-3' }
    authStatus.value = 'authenticated'
    mockSingle.mockResolvedValue({ data: null })

    const { wrapper, api } = await mountUseAdmin()

    await api.check()
    await flushPromises()

    expect(api.isAdmin.value).toBe(false)
    wrapper.unmount()
  })

  it('ne reste pas en chargement si l etat auth est inconnu', async () => {
    authUser.value = { id: 'user-4' }
    authStatus.value = 'unknown'

    const { wrapper, api } = await mountUseAdmin()

    await api.check()
    await flushPromises()

    expect(api.loading.value).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('garde un acces admin connu pendant une revalidation silencieuse du meme user', async () => {
    authUser.value = { id: 'user-5' }
    authStatus.value = 'authenticated'

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(0)
    mockSingle.mockResolvedValueOnce({ data: { is_admin: true } })

    const { wrapper, api } = await mountUseAdmin()

    await api.check()
    await flushPromises()

    expect(api.isAdmin.value).toBe(true)
    expect(api.loading.value).toBe(false)

    let resolvePending!: (value: { data: { is_admin: boolean } }) => void
    const pendingRefresh = new Promise<{ data: { is_admin: boolean } }>((resolve) => {
      resolvePending = resolve
    })
    mockSingle.mockImplementationOnce(() => pendingRefresh)

    nowSpy.mockReturnValue(30_001)
    const silentRefresh = api.check()

    expect(api.isAdmin.value).toBe(true)
    expect(api.loading.value).toBe(false)

    resolvePending({ data: { is_admin: true } })
    await silentRefresh
    await flushPromises()

    expect(api.isAdmin.value).toBe(true)
    expect(api.loading.value).toBe(false)

    nowSpy.mockRestore()
    wrapper.unmount()
  })

  it('n utilise plus de watcher one-shot qui casse au remount', async () => {
    const source = readFileSync(resolve(rootDir, 'composables/useAdmin.ts'), 'utf8')

    expect(source).toContain('const ADMIN_CACHE_TTL_MS = 30_000')
    expect(source).toContain('let adminLastCheckedUserId: string | null = null')
    expect(source).toContain('const preserveKnownAdminAccess = !!userId')
    expect(source).toContain('watch(')
    expect(source).not.toContain('adminWatchBound')
  })
})
