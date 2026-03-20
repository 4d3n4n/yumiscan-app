/**
 * Helpers partagés pour le back-office admin (listes, formatage, KPIs).
 * Utilisés par les pages /app/admin/* et testables en unitaire.
 */
import type { AdminScanRow } from '../composables/useEdgeFunctions'
import {
  getScanAlertCount,
  getScanIngredientCount,
  getScanProductTitle,
} from './scan'

/** Libellés des statuts de scan pour le tableau de bord KPI. */
export const ADMIN_STATUS_LABELS: Record<string, string> = {
  ok: 'Conforme',
  contains_allergen: 'Allergène',
  ambiguous: 'Douteux',
}

/**
 * Formate une date pour la liste utilisateurs (ex. "3 mars 2025").
 */
export function formatDateList(dateStr: string | null, locale = 'fr-FR'): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Nom d'affichage à partir de first_name et last_name.
 */
export function displayName(user: { first_name: string; last_name: string }): string {
  const parts = [user.first_name, user.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

/**
 * Nombre de pages pour une pagination (au moins 1).
 */
export function computeTotalPages(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage))
}

/**
 * Formate une date en relatif pour la liste des scans (Aujourd'hui 14:30, Hier 09:00, ou "3 MARS, 12:00").
 */
export function formatDateRelative(dateStr: string, locale = 'fr-FR'): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 0) return `Aujourd'hui, ${time}`
  if (diffDays === 1) return `Hier, ${time}`
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).toUpperCase() + `, ${time}`
}

/**
 * Extrait un titre court pour un scan (ingredient_tree ou certified_raw_text).
 */
export function extractProductTitle(scan: AdminScanRow): string {
  return getScanProductTitle(scan.result_json, scan.certified_raw_text, 'Scan sans titre')
}

/**
 * Nombre d'ingrédients dans le tree (phase7.ingredient_tree).
 */
export function ingredientCount(scan: AdminScanRow): number {
  return getScanIngredientCount(scan.result_json)
}

/**
 * Nombre d'éléments du tree dont le statut n'est pas "ok".
 */
export function alertCount(scan: AdminScanRow): number {
  return getScanAlertCount(scan.result_json)
}
