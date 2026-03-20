/**
 * Réserve l'accès aux utilisateurs admin (user_profiles.is_admin).
 * Utilisé par /example-error : les non-admins (ou non connectés) voient une 404 (page inexistante).
 * La vérification ne s'exécute qu'au client (SSR : pas de session cookie côté serveur).
 */
import { resolveAuthenticatedSession } from '~/utils/supabase-auth'

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const authUser = useState<{ id: string } | null>('auth-user')
  const authStatus = useState<'authenticated' | 'unauthenticated' | 'unknown'>('auth-status', () => 'unknown')
  const supabase = useSupabase()
  const { isAdmin, loading: adminLoading, check } = useAdmin()
  const userId = authStatus.value === 'authenticated'
    ? authUser.value?.id ?? null
    : null

  async function ensureAdminAccess(candidateUserId: string | null) {
    if (!candidateUserId) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }

    await check(candidateUserId)
    if (isAdmin.value !== true) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }
  }

  if (userId && isAdmin.value === true) {
    void check(userId)
    return
  }

  if (userId && adminLoading.value === false) {
    if (isAdmin.value === false) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }
  }

  if (userId) {
    await ensureAdminAccess(userId)
    return
  }

  if (authStatus.value !== 'unauthenticated') {
    const resolution = await resolveAuthenticatedSession(supabase)
    if (resolution.state === 'unknown') {
      return
    }

    const resolvedUserId = resolution.session?.user?.id ?? null
    await ensureAdminAccess(resolvedUserId)
    return
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
