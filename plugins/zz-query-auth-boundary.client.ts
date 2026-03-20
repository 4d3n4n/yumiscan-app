import type { QueryClient } from '@tanstack/vue-query'
import { getSessionSnapshot } from '~/utils/supabase-auth'

const AUTH_BOUND_QUERY_KEYS = [
  ['credits'],
  ['user-profile'],
  ['user-scans'],
  ['scan-detail'],
  ['scan-allergen-names'],
  ['stripe-order-history'],
  ['entitlements'],
] as const

export default defineNuxtPlugin(async (nuxtApp) => {
  const supabase = useSupabase()
  const queryClient = nuxtApp.$queryClient as QueryClient
  let currentUserId: string | null = null

  const clearUserScopedQueries = () => {
    AUTH_BOUND_QUERY_KEYS.forEach((queryKey) => {
      queryClient.removeQueries({ queryKey: [...queryKey] })
    })
  }

  currentUserId = (await getSessionSnapshot(supabase).catch(() => null))?.user.id ?? null
  if (!currentUserId) {
    clearUserScopedQueries()
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user.id ?? null
    if (currentUserId !== nextUserId) {
      clearUserScopedQueries()
    }
    currentUserId = nextUserId
  })
})
