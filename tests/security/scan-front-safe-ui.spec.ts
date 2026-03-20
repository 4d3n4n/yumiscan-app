import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('scan front-safe progressive UI', () => {
  it('fait poller le détail scan sans relire le debug utilisateur', () => {
    const page = readFileSync(resolve(rootDir, 'pages/app/scan/[id].vue'), 'utf8')

    expect(page).toContain("processing_status, processing_error, result_json")
    expect(page).toContain('refetchInterval:')
    expect(page).toContain('beforeunload')
    expect(page).toContain('processingStreamItems')
    expect(page).toContain('revealedProcessingStreamItems')
    expect(page).toContain('hasProcessingStreamItems')
    expect(page).toContain('showProcessingPlaceholders')
    expect(page).toContain('getProcessingRevealBatchSize')
    expect(page).toContain('scheduleProcessingReveal')
    expect(page).toContain("v-if=\"!hasProcessingStreamItems\"")
    expect(page).toContain('name="processing-stream"')
    expect(page).toContain('name="scan-detail-shell"')
    expect(page).toContain('scan-detail-skeleton-card')
    expect(page).toContain('scan-ai-halo--ingredients')
    expect(page).toContain('getScanAllergenIngredients')
    expect(page).toContain('getScanIngredientTree')
    expect(page).toContain('.maybeSingle()')
    expect(page).not.toContain('.single()')
    expect(page).not.toContain("t('scan.scan.detail.progress_batches_label')")
    expect(page).not.toContain(".select('*')")
    expect(page).not.toContain('resultJson.value?.debug')
  })

  it('fait aussi suivre le dashboard tant que des scans sont en cours', () => {
    const page = readFileSync(resolve(rootDir, 'pages/app/dashboard.vue'), 'utf8')

    expect(page).toContain('processing_status')
    expect(page).toContain('refetchInterval:')
    expect(page).toContain('getScanBatchProgress')
    expect(page).toContain('getScanProductTitle')
    expect(page).toContain('account.dashboard.scan_item.processing_live')
    expect(page).not.toContain('account.dashboard.scan_item.progress_batches')
  })
})
