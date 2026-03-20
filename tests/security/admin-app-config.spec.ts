import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('admin-app-config function contract', () => {
  const functionPath = join(process.cwd(), 'supabase/functions/admin-app-config/index.ts')
  const raw = readFileSync(functionPath, 'utf-8')

  it('requires admin auth and only exposes get/post', () => {
    expect(raw).toContain('requireAdmin(req)')
    expect(raw).toContain('req.method !== "GET" && req.method !== "POST"')
  })

  it('restricts edited keys to public company config fields', () => {
    for (const key of [
      'company_name',
      'legal_entity_name',
      'company_address',
      'company_country',
      'company_siret',
      'publication_director',
      'contact_page_path',
      'vat_number',
      'maintenance_mode_enabled',
      'scan_debug_enabled',
      'scan_ai_model',
      'scan_batch_size',
      'assistant_ai_model',
      'google_ocr_cost_eur_per_request',
      'scan_ai_cost_eur_per_request',
      'assistant_ai_cost_eur_per_request',
    ]) {
      expect(raw).toContain(`"${key}"`)
    }
    expect(raw).toContain('No valid config keys provided')
    expect(raw).toContain('normalizeConfigValue')
  })
})
