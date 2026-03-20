import { describe, expect, it } from 'vitest'

import {
  getRestorablePersistedQuery,
  getQueryCachePolicy,
  isPersistedQueryExpired,
  normalizePersistableValue,
  normalizePersistedQueryKey,
  sanitizePersistedQueryData,
} from '../../utils/query-cache'

describe('query cache policies', () => {
  it('persists user history but strips processing scans from durable cache', () => {
    const sanitized = sanitizePersistedQueryData(['user-scans'], [
      { id: 'scan-1', processing_status: 'processing', signedUrl: 'https://private.example.com/file' },
      { id: 'scan-2', processing_status: 'completed', product_status: 'ok', signed_image_url: 'https://private.example.com/file-2' },
    ])

    expect(sanitized).toEqual([
      { id: 'scan-2', processing_status: 'completed', product_status: 'ok' },
    ])
  })

  it('does not persist scan detail while a scan is still processing', () => {
    expect(sanitizePersistedQueryData(['scan-detail', 'scan-1'], {
      id: 'scan-1',
      processing_status: 'processing',
    })).toBeUndefined()
  })

  it('keeps admin queries out of durable persistence', () => {
    const policy = getQueryCachePolicy(['admin-kpi', { range: '30d' }])

    expect(policy.persist).toBe(false)
    expect(policy.scope).toBe('public')
    expect(policy.revalidateOnRestore).toBe(false)
  })

  it('expires persisted entries once their ttl has elapsed', () => {
    const now = Date.now()

    expect(isPersistedQueryExpired(['app-config'], now - (21 * 60 * 1000), now)).toBe(true)
    expect(isPersistedQueryExpired(['user-profile'], now - (2 * 60 * 1000), now)).toBe(false)
  })

  it('normalizes ref-like query keys and strips non-cloneable values before persistence', () => {
    const refLikeKey = ['scan-detail', { __v_isRef: true, value: 'scan-123' }]
    const normalizedKey = normalizePersistedQueryKey(refLikeKey)

    expect(normalizedKey).toEqual(['scan-detail', 'scan-123'])

    const persistable = normalizePersistableValue({
      nested: { ok: true },
      badFn: () => 'nope',
      innerRef: { __v_isRef: true, value: 'value' },
    })

    expect(persistable).toEqual({
      nested: { ok: true },
      innerRef: 'value',
    })
  })

  it('does not persist public pricing offers in the durable query cache anymore', () => {
    const policy = getQueryCachePolicy(['pricing-offers-public'])

    expect(policy.persist).toBe(false)
    expect(policy.scope).toBe('public')
    expect(policy.revalidateOnRestore).toBe(false)
  })

  it('marks persisted user queries as user-scoped and shared config as public-scoped', () => {
    expect(getQueryCachePolicy(['user-profile']).scope).toBe('user')
    expect(getQueryCachePolicy(['credits']).scope).toBe('user')
    expect(getQueryCachePolicy(['user-scans']).scope).toBe('user')
    expect(getQueryCachePolicy(['app-config']).scope).toBe('public')
    expect(getQueryCachePolicy(['company-config']).scope).toBe('public')
    expect(getQueryCachePolicy(['user-scans']).revalidateOnRestore).toBe(true)
  })

  it('revalidates restored queries against the current persistence policy before hydration', () => {
    const now = Date.now()

    expect(getRestorablePersistedQuery(
      ['admin-kpi', { range: '30d' }],
      { totalUsers: 99 },
      now,
      now,
    )).toBeUndefined()

    expect(getRestorablePersistedQuery(
      ['scan-detail', { __v_isRef: true, value: 'scan-1' }],
      { id: 'scan-1', processing_status: 'processing' },
      now,
      now,
    )).toBeUndefined()

    expect(getRestorablePersistedQuery(
      ['user-scans'],
      [{ id: 'scan-2', processing_status: 'completed', signedUrl: 'https://private.example.com/file' }],
      now,
      now,
    )).toEqual({
      queryKey: ['user-scans'],
      data: [{ id: 'scan-2', processing_status: 'completed' }],
      dataUpdatedAt: now,
    })
  })
})
