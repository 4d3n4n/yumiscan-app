import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null

export function useSupabase() {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const key = config.public.supabaseKey as string

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  if (import.meta.client && supabaseInstance) {
    return supabaseInstance
  }

  const client = createClient<Database>(url, key, {
    auth: {
      persistSession: import.meta.client,
      autoRefreshToken: import.meta.client,
      detectSessionInUrl: import.meta.client,
    },
  })

  if (import.meta.client) {
    supabaseInstance = client
  }

  return client
}
