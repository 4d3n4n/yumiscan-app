/**
 * Tests des helpers back-office admin (formatage, pagination, scans).
 */
import { describe, it, expect } from 'vitest'
import {
  ADMIN_STATUS_LABELS,
  formatDateList,
  displayName,
  computeTotalPages,
  formatDateRelative,
  extractProductTitle,
  ingredientCount,
  alertCount,
} from '../../utils/admin-helpers'
import type { AdminScanRow } from '../../composables/useEdgeFunctions'

describe('admin-helpers', () => {
  describe('ADMIN_STATUS_LABELS', () => {
    it('expose les libellés pour ok, contains_allergen, ambiguous', () => {
      expect(ADMIN_STATUS_LABELS.ok).toBe('Conforme')
      expect(ADMIN_STATUS_LABELS.contains_allergen).toBe('Allergène')
      expect(ADMIN_STATUS_LABELS.ambiguous).toBe('Douteux')
    })
  })

  describe('formatDateList', () => {
    it('retourne "—" pour null ou chaîne vide', () => {
      expect(formatDateList(null)).toBe('—')
      expect(formatDateList('')).toBe('—')
    })
    it('formate une date ISO en court (jour mois année)', () => {
      const out = formatDateList('2025-03-15T12:00:00Z')
      expect(out).toMatch(/15/)
      expect(out).toMatch(/mars|mar./i)
      expect(out).toMatch(/2025/)
    })
  })

  describe('displayName', () => {
    it('concatène prénom et nom', () => {
      expect(displayName({ first_name: 'Jean', last_name: 'Dupont' })).toBe('Jean Dupont')
    })
    it('retourne "—" si les deux sont vides', () => {
      expect(displayName({ first_name: '', last_name: '' })).toBe('—')
    })
    it('retourne le seul champ non vide', () => {
      expect(displayName({ first_name: 'Jean', last_name: '' })).toBe('Jean')
      expect(displayName({ first_name: '', last_name: 'Dupont' })).toBe('Dupont')
    })
  })

  describe('computeTotalPages', () => {
    it('retourne au moins 1', () => {
      expect(computeTotalPages(0, 50)).toBe(1)
    })
    it('calcule le nombre de pages correct', () => {
      expect(computeTotalPages(50, 50)).toBe(1)
      expect(computeTotalPages(51, 50)).toBe(2)
      expect(computeTotalPages(100, 50)).toBe(2)
      expect(computeTotalPages(125, 50)).toBe(3)
    })
  })

  describe('formatDateRelative', () => {
    it('contient un horaire au format HH:MM', () => {
      const d = new Date()
      d.setHours(14, 30, 0, 0)
      const out = formatDateRelative(d.toISOString())
      expect(out).toMatch(/\d{1,2}:\d{2}/)
    })
    it('retourne "Aujourd\'hui" pour la date du jour', () => {
      const today = new Date()
      const out = formatDateRelative(today.toISOString())
      expect(out).toContain("Aujourd'hui")
    })
    it('retourne "Hier" pour la veille', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const out = formatDateRelative(yesterday.toISOString())
      expect(out).toContain('Hier')
    })
  })

  describe('extractProductTitle', () => {
    it('retourne "Scan sans titre" si pas de tree ni certified_raw_text', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {},
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(extractProductTitle(scan)).toBe('Scan sans titre')
    })
    it('utilise certified_raw_text si pas de tree', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {},
        certified_raw_text: 'Farine de blé, sucre',
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(extractProductTitle(scan)).toBe('Farine de blé, sucre')
    })
    it('tronque certified_raw_text à 50 caractères avec "..."', () => {
      const long = 'a'.repeat(60)
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {},
        certified_raw_text: long,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(extractProductTitle(scan)).toBe('a'.repeat(50) + '...')
    })
    it('utilise phase7.ingredient_tree si présent (main_text_fr)', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {
          debug: {
            phase7: {
              ingredient_tree: [
                { main_text_fr: 'Farine', main_text_jp: '小麦粉' },
                { main_text_fr: 'Sucre', main_text_jp: '' },
              ],
            },
          },
        },
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(extractProductTitle(scan)).toBe('Farine, Sucre')
    })
    it('préfère ingredient_tree top-level pour les nouveaux scans', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {
          ingredient_tree: [
            { main_text_fr: 'Riz', main_text_jp: '米' },
            { main_text_fr: 'Algue', main_text_jp: '海苔' },
          ],
        },
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(extractProductTitle(scan)).toBe('Riz, Algue')
    })
  })

  describe('ingredientCount', () => {
    it('retourne 0 si pas de tree', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {},
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(ingredientCount(scan)).toBe(0)
    })
    it('retourne la longueur de ingredient_tree', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {
          debug: { phase7: { ingredient_tree: [{}, {}, {}] } },
        },
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(ingredientCount(scan)).toBe(3)
    })
    it('fallback sur meta.batch_progress.total_items pendant processing', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {
          meta: {
            batch_progress: {
              completed_batches: 1,
              total_batches: 4,
              completed_items: 8,
              total_items: 27,
            },
          },
        },
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(ingredientCount(scan)).toBe(27)
    })
  })

  describe('alertCount', () => {
    it('retourne 0 si tous les statuts sont "ok"', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ok',
        result_json: {
          debug: {
            phase7: {
              ingredient_tree: [
                { status: 'ok' },
                { status: 'ok' },
              ],
            },
          },
        },
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(alertCount(scan)).toBe(0)
    })
    it('compte les éléments dont status !== "ok"', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'contains_allergen',
        result_json: {
          debug: {
            phase7: {
              ingredient_tree: [
                { status: 'ok' },
                { status: 'contains_allergen' },
                { status: 'ambiguous' },
              ],
            },
          },
        },
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(alertCount(scan)).toBe(2)
    })
    it('compte aussi les alertes top-level des scans progressifs', () => {
      const scan: AdminScanRow = {
        id: 's1',
        created_at: '',
        product_status: 'ambiguous',
        result_json: {
          ambiguous_ingredients: [
            { raw: 'sauce', normalized: 'sauce', reason: 'Flou' },
          ],
          allergens_ingredients: [
            { raw: 'œuf', normalized: 'oeuf', reason: 'Famille: œuf' },
          ],
        },
        certified_raw_text: null,
        credit_consumed_type: null,
        image_storage_path: null,
      }
      expect(alertCount(scan)).toBe(2)
    })
  })
})
