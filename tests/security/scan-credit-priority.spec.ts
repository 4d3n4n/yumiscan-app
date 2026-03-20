import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('scan credit priority', () => {
  it('consomme le credit journalier avant les credits gratuits d inscription', () => {
    const atomicMigration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260308153000_atomic_scan_credit_consumption.sql'),
      'utf8',
    )

    expect(atomicMigration).toContain("v_credit_type := 'daily'")

    const dailyIndex = atomicMigration.indexOf("v_credit_type := 'daily'")
    const freeIndex = atomicMigration.indexOf("v_credit_type := 'free'")

    expect(dailyIndex).toBeGreaterThan(-1)
    expect(freeIndex).toBeGreaterThan(-1)
    expect(dailyIndex).toBeLessThan(freeIndex)
  })

  it('persiste le credit journalier avec la valeur daily', () => {
    const scanFunction = readFileSync(resolve(rootDir, 'supabase/functions/food-scan-analyze/index.ts'), 'utf8')
    const progressiveMigration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260309160000_progressive_scan_payload.sql'),
      'utf8',
    )

    expect(progressiveMigration).not.toContain('daily_free')
    expect(scanFunction).toContain('rpc(')
    expect(scanFunction).toContain('"consume_scan_credit_and_finalize_scan"')
    expect(scanFunction).toContain('Invalid scan credit type produced by progressive finalize RPC')
    expect(scanFunction).toContain('logInfo("Scan credit consumed"')
    expect(progressiveMigration).toContain("v_credit_type := 'daily'")
    expect(progressiveMigration).not.toContain('daily_free')
  })

  it('recree la contrainte scans_credit_type_check avec daily dans une migration dediee', () => {
    const migration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260308150000_fix_scans_credit_type_check.sql'),
      'utf8',
    )

    expect(migration).toContain("UPDATE public.scans")
    expect(migration).toContain("credit_consumed_type = 'daily'")
    expect(migration).toContain("credit_consumed_type = 'daily_free'")
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS scans_credit_type_check')
    expect(migration).toContain("credit_consumed_type IN ('free', 'daily', 'paid')")
  })

  it('rend atomiques la consommation du credit et l insertion du scan via une RPC SQL', () => {
    const schema = readFileSync(resolve(rootDir, 'supabase/migrations/20250226000000_schema.sql'), 'utf8')
    const progressiveMigration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260309160000_progressive_scan_payload.sql'),
      'utf8',
    )
    const ledgerMigration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260310190000_paid_credits_ledger_source.sql'),
      'utf8',
    )

    expect(schema).toContain('CREATE OR REPLACE FUNCTION public.consume_scan_credit_and_finalize_scan(')
    expect(schema).toContain('FOR UPDATE')
    expect(schema).toContain('UPDATE public.scans')
    expect(schema).toContain('debug_json = p_debug_json')
    expect(schema).toContain('SELECT COALESCE(SUM(up.credits_added), 0)::integer')
    expect(schema).toContain('ocr_request_count')
    expect(schema).toContain('gemini_request_count')
    expect(schema).toContain('phase09_executed')
    expect(schema).toContain('GRANT EXECUTE ON FUNCTION public.consume_scan_credit_and_finalize_scan(uuid, uuid, text, jsonb, jsonb, text, text, uuid[], integer, integer, boolean) TO service_role;')
    expect(progressiveMigration).toContain('CREATE OR REPLACE FUNCTION public.consume_scan_credit_and_finalize_scan(')
    expect(ledgerMigration).toContain('CREATE OR REPLACE FUNCTION public.consume_scan_credit_and_finalize_scan(')
    expect(ledgerMigration).toContain('SELECT COALESCE(SUM(up.credits_added), 0)::integer')
  })

  it('persiste les compteurs OCR et Gemini selon la phase 0.9', () => {
    const scanFunction = readFileSync(resolve(rootDir, 'supabase/functions/food-scan-analyze/index.ts'), 'utf8')
    const migration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260308193000_admin_kpi_scan_costs.sql'),
      'utf8',
    )

    expect(scanFunction).toContain('const ocrRequestCount = 1')
    expect(scanFunction).toContain('const geminiRequestCount = phase09Executed ? 5 : 4')
    expect(scanFunction).toContain('p_ocr_request_count: ocrRequestCount')
    expect(scanFunction).toContain('p_gemini_request_count: geminiRequestCount')
    expect(scanFunction).toContain('p_phase09_executed: phase09Executed')
    expect(migration).toContain("result_json->'debug'->'phase09'->>'was_triggered'")
    expect(migration).toContain('THEN 5')
    expect(migration).toContain('ELSE 4')
  })

  it('supprime l ancienne signature RPC pour eviter une union de types Supabase', () => {
    const cleanupMigration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260308194000_drop_legacy_scan_credit_rpc.sql'),
      'utf8',
    )

    expect(cleanupMigration).toContain('DROP FUNCTION IF EXISTS public.consume_scan_credit_and_insert_scan(')
    expect(cleanupMigration).toContain('uuid[]')
  })

  it('rend product_status nullable et ajoute les champs progressifs au schema', () => {
    const schema = readFileSync(resolve(rootDir, 'supabase/migrations/20250226000000_schema.sql'), 'utf8')
    const progressiveMigration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260309160000_progressive_scan_payload.sql'),
      'utf8',
    )

    expect(progressiveMigration).toContain('ALTER COLUMN product_status DROP NOT NULL')
    expect(schema).toContain('product_status        text        NULL')
    expect(schema).toContain('processing_status     text        NOT NULL DEFAULT \'completed\'')
    expect(schema).toContain('processing_error      text        NULL')
    expect(schema).toContain('debug_json            jsonb       NULL')
    expect(schema).toContain('scan_debug_enabled')
  })
})
