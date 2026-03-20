import type { QueryKey } from '@tanstack/vue-query'

type QueryCachePolicy = {
  persist: boolean
  scope: 'public' | 'user'
  ttlMs: number
  revalidateOnRestore: boolean
  sanitizeBeforePersist?: boolean
}

type CachePolicyMatcher = {
  matches: (queryKey: QueryKey) => boolean
  policy: QueryCachePolicy
}

const SHORT_TTL_MS = 5 * 60 * 1000
const MEDIUM_TTL_MS = 20 * 60 * 1000

function isRefLike(value: unknown): value is { value: unknown } {
  return !!value && typeof value === 'object' && '__v_isRef' in value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizePersistableValueInternal(
  value: unknown,
  seen: WeakSet<object>,
): unknown {
  if (value == null) return value

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value
  }

  if (valueType === 'bigint') {
    return value.toString()
  }

  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') {
    return undefined
  }

  if (isRefLike(value)) {
    return normalizePersistableValueInternal(value.value, seen)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return value.toString()
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => {
      const normalized = normalizePersistableValueInternal(entry, seen)
      return normalized === undefined ? null : normalized
    })
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return undefined
    seen.add(value as object)

    if (!isPlainObject(value)) {
      // Rebuild foreign/proxied objects into plain dictionaries when possible.
      const rebuilt: Record<string, unknown> = {}
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        const normalized = normalizePersistableValueInternal(nestedValue, seen)
        if (normalized !== undefined) {
          rebuilt[key] = normalized
        }
      }
      return rebuilt
    }

    const normalizedObject: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalized = normalizePersistableValueInternal(nestedValue, seen)
      if (normalized !== undefined) {
        normalizedObject[key] = normalized
      }
    }
    return normalizedObject
  }

  return undefined
}

export function normalizePersistableValue<T = unknown>(value: T): T | undefined {
  return normalizePersistableValueInternal(value, new WeakSet()) as T | undefined
}

export function normalizePersistedQueryKey(queryKey: QueryKey): QueryKey | undefined {
  const normalized = normalizePersistableValue(queryKey)
  return Array.isArray(normalized) ? normalized as QueryKey : undefined
}

export function getRestorablePersistedQuery(
  queryKey: QueryKey,
  data: unknown,
  dataUpdatedAt: number,
  now = Date.now(),
) {
  const normalizedQueryKey = normalizePersistedQueryKey(queryKey)
  if (!normalizedQueryKey) return undefined

  const policy = getQueryCachePolicy(normalizedQueryKey)
  if (!policy.persist) return undefined
  if (isPersistedQueryExpired(normalizedQueryKey, dataUpdatedAt, now)) return undefined

  const sanitizedData = sanitizePersistedQueryData(normalizedQueryKey, data)
  if (sanitizedData === undefined) return undefined

  return {
    queryKey: normalizedQueryKey,
    data: sanitizedData,
    dataUpdatedAt,
  }
}

function hasBaseKey(queryKey: QueryKey, value: string) {
  return Array.isArray(queryKey) && queryKey[0] === value
}

function matchesPrefixedKey(queryKey: QueryKey, prefix: string) {
  if (!Array.isArray(queryKey) || typeof queryKey[0] !== 'string') return false
  return queryKey[0].startsWith(prefix)
}

const CACHE_POLICY_MATCHERS: CachePolicyMatcher[] = [
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'user-profile'),
    policy: { persist: true, scope: 'user', ttlMs: SHORT_TTL_MS, revalidateOnRestore: false },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'credits'),
    policy: { persist: true, scope: 'user', ttlMs: SHORT_TTL_MS, revalidateOnRestore: false },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'allergens'),
    policy: { persist: true, scope: 'user', ttlMs: SHORT_TTL_MS, revalidateOnRestore: false },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'stripe-order-history'),
    policy: { persist: true, scope: 'user', ttlMs: SHORT_TTL_MS, revalidateOnRestore: false },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'entitlements'),
    policy: { persist: true, scope: 'user', ttlMs: SHORT_TTL_MS, revalidateOnRestore: false },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'user-scans'),
    policy: { persist: true, scope: 'user', ttlMs: MEDIUM_TTL_MS, revalidateOnRestore: true, sanitizeBeforePersist: true },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'scan-detail'),
    policy: { persist: true, scope: 'user', ttlMs: SHORT_TTL_MS, revalidateOnRestore: false, sanitizeBeforePersist: true },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'scan-allergen-names'),
    policy: { persist: true, scope: 'user', ttlMs: SHORT_TTL_MS, revalidateOnRestore: false },
  },
  {
    matches: (queryKey) => hasBaseKey(queryKey, 'app-config') || hasBaseKey(queryKey, 'company-config'),
    policy: { persist: true, scope: 'public', ttlMs: MEDIUM_TTL_MS, revalidateOnRestore: false },
  },
  {
    matches: (queryKey) => matchesPrefixedKey(queryKey, 'admin-'),
    policy: { persist: false, scope: 'public', ttlMs: 0, revalidateOnRestore: false },
  },
]

export function getQueryCachePolicy(queryKey: QueryKey): QueryCachePolicy {
  const matched = CACHE_POLICY_MATCHERS.find(entry => entry.matches(queryKey))
  return matched?.policy ?? { persist: false, scope: 'public', ttlMs: 0, revalidateOnRestore: false }
}

function sanitizeScansPayload(data: unknown) {
  if (!Array.isArray(data)) return undefined

  const sanitizedRows = data
    .filter((row) => {
      if (!row || typeof row !== 'object') return false
      return (row as Record<string, unknown>).processing_status !== 'processing'
    })
    .map((row) => {
      const current = { ...(row as Record<string, unknown>) }
      delete current.signed_image_url
      delete current.signedUrl
      return current
    })

  return sanitizedRows
}

function sanitizeScanDetailPayload(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined

  const current = { ...(data as Record<string, unknown>) }
  if (current.processing_status === 'processing') {
    return undefined
  }

  delete current.signed_image_url
  delete current.signedUrl
  return current
}

export function sanitizePersistedQueryData(queryKey: QueryKey, data: unknown) {
  const policy = getQueryCachePolicy(queryKey)
  if (!policy.persist) return undefined
  if (!policy.sanitizeBeforePersist) {
    return normalizePersistableValue(data)
  }

  if (hasBaseKey(queryKey, 'user-scans')) {
    return normalizePersistableValue(sanitizeScansPayload(data))
  }

  if (hasBaseKey(queryKey, 'scan-detail')) {
    return normalizePersistableValue(sanitizeScanDetailPayload(data))
  }

  return normalizePersistableValue(data)
}

export function isPersistedQueryExpired(queryKey: QueryKey, dataUpdatedAt: number, now = Date.now()) {
  const policy = getQueryCachePolicy(queryKey)
  if (!policy.persist || policy.ttlMs <= 0) return true
  if (!dataUpdatedAt) return true
  return (dataUpdatedAt + policy.ttlMs) <= now
}
