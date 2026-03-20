
import type { ParsedIngredient } from './types'

/**
 * Parse result_json from DB: peut être une chaîne JSON ou déjà un objet.
 * Utilisé par dashboard et page scan/[id].
 */
export function parseResultJson(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

type ScanBatchProgress = {
  completed_batches: number
  total_batches: number
  completed_items: number
  total_items: number
}

type ScanMeta = {
  detected_language?: string
  phases_completed?: string[]
  is_final?: boolean
  batch_progress?: ScanBatchProgress
}

type ScanIngredientPair = {
  raw: string
  normalized: string
}

type ScanIngredientWithReason = ScanIngredientPair & {
  reason: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function hasOwnKey(record: Record<string, unknown> | null | undefined, key: string): boolean {
  return !!record && Object.prototype.hasOwnProperty.call(record, key)
}

function getLegacyDebugRecord(value: unknown): Record<string, unknown> | null {
  const json = getScanResultRecord(value)
  return asRecord(json?.debug)
}

function getScanResultRecord(value: unknown): Record<string, unknown> | null {
  return asRecord(parseResultJson(value))
}

export function getScanIngredientTree(value: unknown): ParsedIngredient[] {
  const json = getScanResultRecord(value)
  if (hasOwnKey(json, 'ingredient_tree')) {
    return asArray<ParsedIngredient>(json?.ingredient_tree)
  }

  const phase7 = asRecord(getLegacyDebugRecord(value)?.phase7)
  return asArray<ParsedIngredient>(phase7?.ingredient_tree)
}

function getScanMeta(value: unknown): ScanMeta | undefined {
  const json = getScanResultRecord(value)
  return asRecord(json?.meta) as ScanMeta | undefined
}

export function getScanOkIngredients(value: unknown): ScanIngredientPair[] {
  const json = getScanResultRecord(value)
  if (hasOwnKey(json, 'ok_ingredients')) {
    return asArray<ScanIngredientPair>(json?.ok_ingredients)
  }
  return []
}

export function getScanAmbiguousIngredients(value: unknown): ScanIngredientWithReason[] {
  const json = getScanResultRecord(value)
  if (hasOwnKey(json, 'ambiguous_ingredients')) {
    return asArray<ScanIngredientWithReason>(json?.ambiguous_ingredients)
  }

  const phase2 = asRecord(getLegacyDebugRecord(value)?.phase2)
  return asArray<ScanIngredientWithReason>(phase2?.ambiguous)
}

export function getScanAllergenIngredients(value: unknown): ScanIngredientWithReason[] {
  const json = getScanResultRecord(value)
  if (hasOwnKey(json, 'allergens_ingredients')) {
    return asArray<ScanIngredientWithReason>(json?.allergens_ingredients)
  }

  const phase2 = asRecord(getLegacyDebugRecord(value)?.phase2)
  return asArray<ScanIngredientWithReason>(phase2?.allergens)
}

export function getScanBatchProgress(value: unknown): ScanBatchProgress | undefined {
  return getScanMeta(value)?.batch_progress
}

export function getScanProcessedIngredientCount(value: unknown): number {
  const batchProgress = getScanBatchProgress(value)
  if (typeof batchProgress?.completed_items === 'number') {
    return batchProgress.completed_items
  }

  const fromTopLevel =
    getScanOkIngredients(value).length +
    getScanAmbiguousIngredients(value).length +
    getScanAllergenIngredients(value).length

  if (fromTopLevel > 0) {
    return fromTopLevel
  }

  return getScanIngredientTree(value).length
}

export function isScanResultFinal(value: unknown): boolean {
  const meta = getScanMeta(value)
  if (typeof meta?.is_final === 'boolean') {
    return meta.is_final
  }
  return getScanIngredientTree(value).length > 0
}

export function getScanResultStatus(value: unknown, fallbackStatus?: string | null): string {
  const json = getScanResultRecord(value)
  const resultStatus = json?.product_status
  if (typeof resultStatus === 'string' && resultStatus.length > 0) {
    return resultStatus
  }
  if (fallbackStatus && fallbackStatus.length > 0) {
    return fallbackStatus
  }
  return 'ok'
}

export function getScanProductTitle(
  value: unknown,
  certifiedRawText?: string | null,
  fallback = 'Scan sans titre',
): string {
  const tree = getScanIngredientTree(value)
  if (tree.length > 0) {
    const names = tree.slice(0, 3).map((item) => item.main_text_fr || item.main_text_jp).filter(Boolean)
    if (names.length > 0) return names.join(', ')
  }

  if (certifiedRawText) {
    const compact = certifiedRawText.substring(0, 50).replaceAll('\n', ' ')
    return compact + (certifiedRawText.length > 50 ? '...' : '')
  }

  return fallback
}

export function getScanIngredientCount(value: unknown): number {
  const tree = getScanIngredientTree(value)
  if (tree.length > 0) {
    return tree.length
  }

  const batchProgress = getScanBatchProgress(value)
  if (typeof batchProgress?.total_items === 'number') {
    return batchProgress.total_items
  }

  return getScanProcessedIngredientCount(value)
}

export function getScanAlertCount(value: unknown): number {
  const tree = getScanIngredientTree(value)
  if (tree.length > 0) {
    return tree.filter((item) => item?.status !== 'ok').length
  }

  return getScanAmbiguousIngredients(value).length + getScanAllergenIngredients(value).length
}

type ScanStatusConfig = {
  label: string
  description: string
  color: string
  bg: string
  ring: string
}

type ScanStatusCircleConfig = {
  bg: string
  ring: string
}

/**
 * Configuration d’affichage du statut d’un scan (conforme, allergène, douteux, inconnu).
 * Les composants Vue associent eux-mêmes l’icône (PhShieldCheck, etc.).
 */
export function getScanStatusConfig(status: string): ScanStatusConfig {
  switch (status) {
    case 'ok':
      return {
        label: 'CONFORME',
        description: 'Aucun ingrédient suspect détecté',
        color: 'text-primary',
        bg: 'bg-primary/10',
        ring: 'ring-primary/30',
      }
    case 'contains_allergen':
      return {
        label: 'ALLERGÈNE DÉTECTÉ',
        description: 'Allergène(s) détecté(s) dans ce produit',
        color: 'text-red-700',
        bg: 'bg-red-50',
        ring: 'ring-red-300',
      }
    case 'ambiguous':
      return {
        label: 'DOUTEUX',
        description: 'Certains ingrédients sont ambigus',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        ring: 'ring-amber-300',
      }
    default:
      return {
        label: 'INCONNU',
        description: '',
        color: 'text-gray-700',
        bg: 'bg-gray-50',
        ring: 'ring-gray-300',
      }
  }
}

/**
 * Teinte l'emoji du statut quand il doit refléter visuellement le même niveau d'alerte que son cercle.
 * OK reste neutre pour préserver le rendu original des assets.
 */
export function getStatusEmojiFilterClass(status: string): string {
  switch (status) {
    case 'contains_allergen':
      return 'emoji-status-allergen'
    case 'ambiguous':
      return 'emoji-status-ambiguous'
    default:
      return ''
  }
}

/**
 * Cercle de statut utilisé sur les cartes du dashboard.
 * Le rendu y est volontairement un peu plus marqué que sur les autres zones
 * pour que la couleur du verdict soit immédiatement lisible dans la liste.
 */
export function getScanStatusCircleConfig(status: string): ScanStatusCircleConfig {
  switch (status) {
    case 'ok':
      return {
        bg: 'bg-primary/15',
        ring: 'ring-primary/40',
      }
    case 'contains_allergen':
      return {
        bg: 'bg-red-100',
        ring: 'ring-red-300',
      }
    case 'ambiguous':
      return {
        bg: 'bg-amber-100',
        ring: 'ring-amber-300',
      }
    default:
      return {
        bg: 'bg-gray-100',
        ring: 'ring-gray-300',
      }
  }
}
