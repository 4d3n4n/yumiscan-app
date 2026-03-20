import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPANY_CONFIG, companyField, mapCompanyConfigRows } from '../../utils/company-config'

describe('company config utils', () => {
  it('maps known app_config rows and keeps defaults for missing values', () => {
    const config = mapCompanyConfigRows([
      { key: 'company_name', value: '  YumiScan Pro  ' },
      { key: 'company_siret', value: ' 12345678901234 ' },
      { key: 'ignored_key', value: 'noop' } as never,
    ])

    expect(config.company_name).toBe('YumiScan Pro')
    expect(config.company_siret).toBe('12345678901234')
    expect(config.contact_page_path).toBe(DEFAULT_COMPANY_CONFIG.contact_page_path)
    expect(config.company_country).toBe(DEFAULT_COMPANY_CONFIG.company_country)
    expect(config.maintenance_mode_enabled).toBe(DEFAULT_COMPANY_CONFIG.maintenance_mode_enabled)
    expect(config.scan_debug_enabled).toBe(DEFAULT_COMPANY_CONFIG.scan_debug_enabled)
    expect(config.scan_ai_model).toBe(DEFAULT_COMPANY_CONFIG.scan_ai_model)
    expect(config.scan_batch_size).toBe(DEFAULT_COMPANY_CONFIG.scan_batch_size)
    expect(config.assistant_ai_model).toBe(DEFAULT_COMPANY_CONFIG.assistant_ai_model)
    expect(config.google_ocr_cost_eur_per_request).toBe(DEFAULT_COMPANY_CONFIG.google_ocr_cost_eur_per_request)
    expect(config.scan_ai_cost_eur_per_request).toBe(DEFAULT_COMPANY_CONFIG.scan_ai_cost_eur_per_request)
    expect(config.assistant_ai_cost_eur_per_request).toBe(DEFAULT_COMPANY_CONFIG.assistant_ai_cost_eur_per_request)
  })

  it('normalizes display fields and hides empty values', () => {
    expect(companyField('  test  ')).toBe('test')
    expect(companyField('   ')).toBeNull()
    expect(companyField(undefined)).toBeNull()
    expect(companyField(null)).toBeNull()
  })
})
