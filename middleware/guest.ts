import { shouldShowRecoveryForm } from '~/utils/auth-recovery'
import { parseAuthCallbackParams } from '~/utils/auth-callback'
import { resolveAuthenticatedSession } from '~/utils/supabase-auth'

function extractSearchFromFullPath(fullPath: string): string {
  const queryIndex = fullPath.indexOf('?')
  if (queryIndex === -1) return ''

  const hashIndex = fullPath.indexOf('#', queryIndex)
  const query = hashIndex === -1
    ? fullPath.slice(queryIndex + 1)
    : fullPath.slice(queryIndex + 1, hashIndex)

  return query ? `?${query}` : ''
}

function isRecoveryNavigation(fullPath: string, hash: string) {
  const search = extractSearchFromFullPath(fullPath)
  const parsed = parseAuthCallbackParams({ hash, search })
  if (parsed.type === 'recovery') return true

  return shouldShowRecoveryForm({
    hash,
    search,
    getStorageItem: (key) => {
      try {
        return sessionStorage.getItem(key)
      } catch {
        return null
      }
    },
  })
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  if (isRecoveryNavigation(to.fullPath, to.hash)) {
    return
  }

  const authUser = useState<{ id: string } | null>('auth-user')
  const authStatus = useState<'authenticated' | 'unauthenticated' | 'unknown'>('auth-status', () => 'unknown')
  const supabase = useSupabase()
  const localePath = useLocalePath()

  if (authStatus.value === 'authenticated' && authUser.value?.id) {
    return navigateTo(localePath('/app/account'))
  }

  if (authStatus.value === 'unauthenticated') {
    return
  }

  const resolution = await resolveAuthenticatedSession(supabase)

  if (resolution.state === 'authenticated' && resolution.session?.user?.id) {
    return navigateTo(localePath('/app/account'))
  }
})
