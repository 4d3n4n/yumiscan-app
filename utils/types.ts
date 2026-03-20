export type ScanFilters = {
  noCrustaceans: boolean
  noGluten: boolean
  vegan: boolean
}

export type IngredientPair = {
  raw: string
  normalized: string
  parsed?: ParsedIngredient
}

export type SubIngredient = ParsedIngredient

export type ParsedIngredient = {
  main_text_jp: string
  main_text_fr: string
  has_sub_ingredients: boolean
  sub_ingredients: SubIngredient[]
  is_ambiguous?: boolean
  ambiguous_reason?: string
  id?: string
  status?: ProductStatus
  normalized_fr?: string
  raw?: string
}

export type IngredientWithReason = IngredientPair & {
  reason: string
}

export type ProductStatus = 'ok' | 'ambiguous' | 'contains_allergen'

export type ScanResult = {
  product_status: ProductStatus
  ok_ingredients: IngredientPair[]
  ambiguous_ingredients: IngredientWithReason[]
  allergens_ingredients: IngredientWithReason[]
  ingredient_tree?: ParsedIngredient[]
  meta?: {
    detected_language?: string
    phases_completed?: string[]
    is_final?: boolean
    batch_progress?: {
      completed_batches: number
      total_batches: number
      completed_items: number
      total_items: number
    }
  }
}

// ─── Types DB: re-export depuis le schéma auto-généré ────────
export type { AllergenRow as AllergenCatalogRow } from '~/types/database.aliases'
export type { UserProfileRow as UserProfile } from '~/types/database.aliases'
export type { UserProfileInsert } from '~/types/database.aliases'
export type { UserProfileUpdate as UserProfileUpdateByUser } from '~/types/database.aliases'
export type { ScanRow } from '~/types/database.aliases'
export type { AppConfigRow } from '~/types/database.aliases'
export type { PricingOfferRow } from '~/types/database.aliases'

export type AllergeneScanResult = {
  status: 'Alerte' | 'Sécurité'
  detected: string[]
  message: string
}

export type ScanView = 'default' | 'camera' | 'preview' | 'loading' | 'result'

export type Plan = '14_days' | '1_month' | '3_months'
export type PassStatus = 'active' | 'expired' | 'canceled'
export type Verdict = 'ok' | 'alert' | 'doubt'

export interface AllergenCatalog {
  id: string
  name: string
  name_en?: string | null
  slug: string | null
  ingredients?: string[] | null
  ingredients_en?: string[] | null
  created_at?: string
}
