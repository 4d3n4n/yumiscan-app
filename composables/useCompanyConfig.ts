import { COMPANY_CONFIG_KEYS, DEFAULT_COMPANY_CONFIG, mapCompanyConfigRows, type CompanyConfig } from '~/utils/company-config'

export function useCompanyConfig() {
  const supabase = useSupabase()

  return useAsyncData<CompanyConfig>('company-config', async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [...COMPANY_CONFIG_KEYS])

    if (error) {
      return { ...DEFAULT_COMPANY_CONFIG }
    }

    return mapCompanyConfigRows(data ?? [])
  }, {
    default: () => ({ ...DEFAULT_COMPANY_CONFIG }),
  })
}
