import { useQueryClient } from '@tanstack/vue-query'
import type { ScanRow } from '~/utils/types'

type AppDataEvent =
  | 'scan_started'
  | 'scan_finished'
  | 'scan_failed'
  | 'scan_deleted'
  | 'credits_purchased'
  | 'profile_updated'
  | 'allergens_updated'

type AppDataEventPayload = {
  scanId?: string
  creditsAdded?: number
}

type UserScansCacheRow = Pick<
  ScanRow,
  | 'id'
  | 'created_at'
  | 'product_status'
  | 'processing_status'
  | 'processing_error'
  | 'result_json'
  | 'certified_raw_text'
  | 'credit_consumed_type'
  | 'image_storage_path'
>

export function useAppDataInvalidation() {
  const { $queryClient } = useNuxtApp()
  const queryClient = $queryClient ?? useQueryClient()
  const { refreshCredits, applyPurchasedCreditsDelta } = useCredits()
  const { removeSignedImageUrl } = useScanImageSessionCache()

  async function invalidateQueries(keys: unknown[][]) {
    await Promise.allSettled(
      keys.map(queryKey => queryClient.invalidateQueries({ queryKey })),
    )
  }

  function buildOptimisticScan(scanId: string): UserScansCacheRow {
    return {
      id: scanId,
      created_at: new Date().toISOString(),
      product_status: null,
      processing_status: 'processing',
      processing_error: null,
      result_json: {},
      certified_raw_text: null,
      credit_consumed_type: null,
      image_storage_path: null,
    }
  }

  function insertOptimisticScan(scanId: string) {
    queryClient.setQueryData<UserScansCacheRow[]>(['user-scans'], (current) => {
      const nextRows = current ?? []
      const optimisticScan = buildOptimisticScan(scanId)
      const existingIndex = nextRows.findIndex(scan => scan.id === scanId)

      if (existingIndex === -1) {
        return [optimisticScan, ...nextRows]
      }

      return nextRows.map((scan, index) => {
        if (index !== existingIndex) return scan
        return {
          ...optimisticScan,
          ...scan,
          processing_status: scan.processing_status ?? optimisticScan.processing_status,
        }
      })
    })
  }

  async function invalidateAppData(event: AppDataEvent, payload: AppDataEventPayload = {}) {
    switch (event) {
      case 'scan_started':
        if (payload.scanId) {
          insertOptimisticScan(payload.scanId)
        }
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['user-scans'], refetchType: 'none' }),
          queryClient.invalidateQueries({ queryKey: ['user-profile'] }),
        ])
        await refreshCredits()
        return

      case 'scan_finished':
      case 'scan_failed': {
        const keys: unknown[][] = [
          ['user-scans'],
          ['user-profile'],
        ]
        if (payload.scanId) {
          keys.push(['scan-detail', payload.scanId])
          keys.push(['scan-allergen-names', payload.scanId])
        }
        await invalidateQueries(keys)
        await refreshCredits()
        return
      }

      case 'scan_deleted': {
        const keys: unknown[][] = [
          ['user-scans'],
        ]
        if (payload.scanId) {
          const scanDetail = queryClient.getQueryData<Record<string, unknown> | null>(['scan-detail', payload.scanId])
          const userScans = queryClient.getQueryData<Record<string, unknown>[]>(['user-scans'])
          const deletedScan = userScans?.find(scan => scan.id === payload.scanId) ?? scanDetail
          const imageStoragePath = typeof deletedScan?.image_storage_path === 'string'
            ? deletedScan.image_storage_path
            : null
          if (imageStoragePath) {
            removeSignedImageUrl(imageStoragePath)
          }
          queryClient.setQueryData<UserScansCacheRow[]>(['user-scans'], (current) =>
            (current ?? []).filter(scan => scan.id !== payload.scanId),
          )
          queryClient.removeQueries({ queryKey: ['scan-detail', payload.scanId], exact: true })
          queryClient.removeQueries({ queryKey: ['scan-allergen-names', payload.scanId], exact: true })
        }
        await invalidateQueries(keys)
        return
      }

      case 'credits_purchased':
        if (typeof payload.creditsAdded === 'number' && payload.creditsAdded > 0) {
          applyPurchasedCreditsDelta(payload.creditsAdded)
        }
        await invalidateQueries([
          ['user-profile'],
          ['stripe-order-history'],
          ['entitlements'],
        ])
        await refreshCredits()
        return

      case 'profile_updated':
        await invalidateQueries([
          ['user-profile'],
        ])
        return

      case 'allergens_updated':
        await invalidateQueries([
          ['user-profile'],
          ['allergens'],
        ])
        return
    }
  }

  return {
    invalidateAppData,
  }
}
