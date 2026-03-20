import {
  VueQueryPlugin,
  QueryClient,
  dehydrate,
  hydrate,
  type QueryKey,
} from '@tanstack/vue-query'
import {
  getRestorablePersistedQuery,
  getQueryCachePolicy,
  normalizePersistedQueryKey,
  sanitizePersistedQueryData,
} from '~/utils/query-cache'
import { getSessionSnapshot } from '~/utils/supabase-auth'

type PersistedQueryRecord = {
  queryHash: string
  queryKey: QueryKey
  scope: 'public' | 'user'
  ownerUserId: string | null
  state: {
    data: unknown
    dataUpdatedAt: number
    error: null
    fetchStatus: 'idle'
    status: 'success'
  }
}

type PersistedQuerySnapshot = {
  version: number
  timestamp: number
  queries: PersistedQueryRecord[]
}

const QUERY_CACHE_DB = 'yumiscan-runtime-cache'
const QUERY_CACHE_STORE = 'query-persist'
const QUERY_CACHE_KEY = 'tanstack-v1'
const PERSISTED_QUERY_SNAPSHOT_VERSION = 3
const PERSIST_DEBOUNCE_MS = 400

function stableQueryHash(queryKey: QueryKey) {
  return JSON.stringify(queryKey, (_, value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value
    }

    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (value as Record<string, unknown>)[key]
        return acc
      }, {})
  })
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

function openPersistedQueryDatabase() {
  if (!import.meta.client || typeof indexedDB === 'undefined') {
    return Promise.resolve<IDBDatabase | null>(null)
  }

  return new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(QUERY_CACHE_DB, 1)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(QUERY_CACHE_STORE)) {
        database.createObjectStore(QUERY_CACHE_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function readPersistedSnapshot() {
  const database = await openPersistedQueryDatabase()
  if (!database) return null

  return new Promise<PersistedQuerySnapshot | null>((resolve) => {
    const transaction = database.transaction(QUERY_CACHE_STORE, 'readonly')
    const store = transaction.objectStore(QUERY_CACHE_STORE)
    const request = store.get(QUERY_CACHE_KEY)

    request.onsuccess = () => resolve((request.result as PersistedQuerySnapshot | undefined) ?? null)
    request.onerror = () => resolve(null)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => database.close()
  })
}

async function writePersistedSnapshot(snapshot: PersistedQuerySnapshot | null) {
  const database = await openPersistedQueryDatabase()
  if (!database) return

  await new Promise<void>((resolve) => {
    let transaction: IDBTransaction

    try {
      transaction = database.transaction(QUERY_CACHE_STORE, 'readwrite')
      const store = transaction.objectStore(QUERY_CACHE_STORE)

      if (snapshot) {
        store.put(snapshot, QUERY_CACHE_KEY)
      } else {
        store.delete(QUERY_CACHE_KEY)
      }
    } catch (error) {
      console.warn('[vue-query] persisted snapshot skipped:', error)
      database.close()
      resolve()
      return
    }

    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      resolve()
    }
  })
}

function buildPersistedSnapshot(queryClient: QueryClient, currentUserId: string | null): PersistedQuerySnapshot | null {
  const dehydratedState = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) => {
      if (query.state.status !== 'success') return false

      const policy = getQueryCachePolicy(query.queryKey)
      if (!policy.persist) return false
      if (policy.scope === 'user' && !currentUserId) return false

      const sanitized = sanitizePersistedQueryData(query.queryKey, query.state.data)
      return sanitized !== undefined
    },
  })

  const queries = dehydratedState.queries.flatMap((query) => {
    const normalizedQueryKey = normalizePersistedQueryKey(query.queryKey)
    if (!normalizedQueryKey) return []
    const policy = getQueryCachePolicy(normalizedQueryKey)
    if (policy.scope === 'user' && !currentUserId) return []

    const sanitized = sanitizePersistedQueryData(query.queryKey, query.state.data)
    if (sanitized === undefined) return []

    return [{
      queryHash: stableQueryHash(normalizedQueryKey),
      queryKey: normalizedQueryKey,
      scope: policy.scope,
      ownerUserId: policy.scope === 'user' ? currentUserId : null,
      state: {
        data: sanitized,
        dataUpdatedAt: query.state.dataUpdatedAt,
        error: null,
        fetchStatus: 'idle' as const,
        status: 'success' as const,
      },
    }]
  })

  if (queries.length === 0) return null

  return {
    version: PERSISTED_QUERY_SNAPSHOT_VERSION,
    timestamp: Date.now(),
    queries,
  }
}

async function restorePersistedQueries(queryClient: QueryClient, currentUserId: string | null) {
  const snapshot = await readPersistedSnapshot()
  if (!snapshot) return [] as QueryKey[]
  if (snapshot.version !== PERSISTED_QUERY_SNAPSHOT_VERSION) {
    await writePersistedSnapshot(null)
    return [] as QueryKey[]
  }

  const now = Date.now()
  const queriesToHydrate = snapshot.queries.flatMap((query) => {
    const restorable = getRestorablePersistedQuery(
      query.queryKey,
      query.state.data,
      query.state.dataUpdatedAt,
      now,
    )
    if (!restorable) return []
    const policy = getQueryCachePolicy(restorable.queryKey)
    if (policy.scope === 'user' && query.ownerUserId !== currentUserId) {
      return []
    }

    return [{
      queryHash: stableQueryHash(restorable.queryKey),
      queryKey: restorable.queryKey,
      scope: query.scope,
      ownerUserId: query.ownerUserId,
      state: {
        data: restorable.data,
        dataUpdatedAt: restorable.dataUpdatedAt,
        error: null,
        fetchStatus: 'idle' as const,
        status: 'success' as const,
      },
    }]
  })
  if (queriesToHydrate.length === 0) {
    await writePersistedSnapshot(null)
    return [] as QueryKey[]
  }

  if (queriesToHydrate.length !== snapshot.queries.length) {
    await writePersistedSnapshot({
      version: PERSISTED_QUERY_SNAPSHOT_VERSION,
      timestamp: Date.now(),
      queries: queriesToHydrate,
    })
  }

  hydrate(queryClient, {
    mutations: [],
    queries: queriesToHydrate,
  })

  return queriesToHydrate
    .filter(query => getQueryCachePolicy(query.queryKey).revalidateOnRestore)
    .map(query => query.queryKey)
}

function revalidateRestoredQueries(queryClient: QueryClient, queryKeys: QueryKey[]) {
  if (!import.meta.client || queryKeys.length === 0) return

  queueMicrotask(() => {
    queryKeys.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey })
    })
  })
}

export default defineNuxtPlugin(async (nuxtApp) => {
  const queryClient = createQueryClient()

  if (import.meta.client) {
    const supabase = useSupabase()
    let currentUserId = (await getSessionSnapshot(supabase).catch(() => null))?.user.id ?? null
    const revalidateQueryKeys = await restorePersistedQueries(queryClient, currentUserId)
    let persistTimer: ReturnType<typeof setTimeout> | null = null

    const schedulePersist = () => {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => {
        persistTimer = null
        const snapshot = buildPersistedSnapshot(queryClient, currentUserId)
        void writePersistedSnapshot(snapshot)
      }, PERSIST_DEBOUNCE_MS)
    }

    queryClient.getQueryCache().subscribe(() => {
      schedulePersist()
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user.id ?? null
    })

    nuxtApp.hook('app:mounted', () => {
      revalidateRestoredQueries(queryClient, revalidateQueryKeys)
    })
  }

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })

  return {
    provide: {
      queryClient,
    },
  }
})
