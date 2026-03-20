import { companyBoolean } from '~/utils/company-config'
import { resolveAuthenticatedSession } from '~/utils/supabase-auth'

const MAINTENANCE_CACHE_TTL_MS = 30_000
const MAINTENANCE_QUERY_TIMEOUT_MS = 1_200
const MAINTENANCE_ALLOWED_PATHS = new Set([
  '/maintenance',
  '/login',
  '/forgot-password',
  '/auth/confirm',
])

let maintenanceRefreshInFlight: Promise<boolean> | null = null

function localeMaintenancePath(path: string): string {
  return path === '/en' || path.startsWith('/en/') ? '/en/maintenance' : '/maintenance'
}

function isAllowedMaintenancePath(path: string): boolean {
  if (MAINTENANCE_ALLOWED_PATHS.has(path)) return true
  if (path.startsWith('/en/')) {
    return MAINTENANCE_ALLOWED_PATHS.has(path.replace(/^\/en/, '') || '/')
  }

  return false
}

async function readMaintenanceFlag(
  supabase: ReturnType<typeof useSupabase>,
  fallback: boolean,
): Promise<boolean> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), MAINTENANCE_QUERY_TIMEOUT_MS)

  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'maintenance_mode_enabled')
      .abortSignal(controller.signal)
      .maybeSingle() as { data: { value: string } | null }

    return companyBoolean(data?.value)
  } catch {
    return fallback
  } finally {
    globalThis.clearTimeout(timer)
  }
}

async function isAdminUser(
  supabase: ReturnType<typeof useSupabase>,
  userId: string,
): Promise<boolean> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), MAINTENANCE_QUERY_TIMEOUT_MS)

  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .abortSignal(controller.signal)
      .single() as { data: { is_admin: boolean } | null }

    return data?.is_admin === true
  } catch {
    return false
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const supabase = useSupabase()
  const cache = useState<{ enabled: boolean; fetchedAt: number }>('maintenance-mode-cache', () => ({
    enabled: false,
    fetchedAt: 0,
  }))

  const refreshMaintenanceCache = async (blocking: boolean) => {
    if (maintenanceRefreshInFlight) {
      if (blocking) {
        cache.value = {
          enabled: await maintenanceRefreshInFlight,
          fetchedAt: Date.now(),
        }
      }
      return
    }

    const fallback = cache.value.enabled
    maintenanceRefreshInFlight = readMaintenanceFlag(supabase, fallback)

    if (!blocking) {
      void maintenanceRefreshInFlight
        .then((enabled) => {
          cache.value = {
            enabled,
            fetchedAt: Date.now(),
          }
        })
        .finally(() => {
          maintenanceRefreshInFlight = null
        })
      return
    }

    try {
      cache.value = {
        enabled: await maintenanceRefreshInFlight,
        fetchedAt: Date.now(),
      }
    } finally {
      maintenanceRefreshInFlight = null
    }
  }

  const hasCachedValue = cache.value.fetchedAt > 0
  const cacheIsStale = (Date.now() - cache.value.fetchedAt) > MAINTENANCE_CACHE_TTL_MS

  if (!hasCachedValue) {
    await refreshMaintenanceCache(true)
  } else if (cacheIsStale) {
    await refreshMaintenanceCache(false)
  }

  if (!cache.value.enabled) return
  if (isAllowedMaintenancePath(to.path)) return

  const authUser = useState<{ id: string } | null>('auth-user')
  const authStatus = useState<'authenticated' | 'unauthenticated' | 'unknown'>('auth-status', () => 'unknown')

  if (authStatus.value === 'authenticated' && authUser.value?.id) {
    if (await isAdminUser(supabase, authUser.value.id)) {
      return
    }
  }

  const resolution = await resolveAuthenticatedSession(supabase)
  if (resolution.state === 'authenticated' && resolution.session?.user?.id) {
    if (await isAdminUser(supabase, resolution.session.user.id)) {
      return
    }
  }

  return navigateTo(localeMaintenancePath(to.path))
})
