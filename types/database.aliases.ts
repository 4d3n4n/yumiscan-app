/**
 * Alias propres pour les types auto-générés par Supabase.
 * Utiliser ces raccourcis dans tout le code front-end au lieu de
 * `Database['public']['Tables']['xxx']['Row']`.
 *
 * Régénérer après chaque migration :
 *   npx supabase gen types typescript --local > types/supabase.ts
 */
import type { Tables, TablesInsert, TablesUpdate } from '~/types/supabase'

// ─── Row (SELECT) ────────────────────────────────────────────
export type AllergenRow = Tables<'allergens'>
export type AppConfigRow = Tables<'app_config'>
export type PaywallHitRow = Tables<'paywall_hits'>
export type PricingOfferRow = Tables<'pricing_offers'>
export type ScanRow = Tables<'scans'>
export type UserProfileRow = Tables<'user_profiles'>
export type UserPurchaseRow = Tables<'user_purchases'>

// ─── Insert ──────────────────────────────────────────────────
export type ScanInsert = TablesInsert<'scans'>
export type PaywallHitInsert = TablesInsert<'paywall_hits'>
export type PricingOfferInsert = TablesInsert<'pricing_offers'>
export type UserProfileInsert = TablesInsert<'user_profiles'>
export type UserPurchaseInsert = TablesInsert<'user_purchases'>

// ─── Update ──────────────────────────────────────────────────
export type UserProfileUpdate = TablesUpdate<'user_profiles'>
export type PricingOfferUpdate = TablesUpdate<'pricing_offers'>
