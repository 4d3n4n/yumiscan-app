import type { AppConfigRow } from '~/utils/types'

export const COMPANY_CONFIG_KEYS = [
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
] as const

export type CompanyConfigKey = (typeof COMPANY_CONFIG_KEYS)[number]

export type CompanyConfig = Record<CompanyConfigKey, string>

export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  company_name: 'YumiScan',
  legal_entity_name: '',
  company_address: '',
  company_country: 'France',
  company_siret: '',
  publication_director: '',
  contact_page_path: '/contact',
  vat_number: '',
  maintenance_mode_enabled: 'false',
  scan_debug_enabled: 'false',
  scan_ai_model: 'gemini-2.5-flash',
  scan_batch_size: '8',
  assistant_ai_model: 'gemini-2.5-flash',
  google_ocr_cost_eur_per_request: '0',
  scan_ai_cost_eur_per_request: '0',
  assistant_ai_cost_eur_per_request: '0',
}

export function mapCompanyConfigRows(rows: Pick<AppConfigRow, 'key' | 'value'>[]): CompanyConfig {
  const merged: CompanyConfig = { ...DEFAULT_COMPANY_CONFIG }

  for (const row of rows) {
    if ((COMPANY_CONFIG_KEYS as readonly string[]).includes(row.key)) {
      merged[row.key as CompanyConfigKey] = row.value?.trim() ?? ''
    }
  }

  return merged
}

export function companyField(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

export function companyBoolean(value: string | null | undefined): boolean {
  return (value?.trim().toLowerCase() ?? '') === 'true'
}
