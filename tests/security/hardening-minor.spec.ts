import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('minor hardening', () => {
  it('ajoute noopener sur le lien externe du footer', () => {
    const footer = readFileSync(resolve(rootDir, 'components/AppFooter.vue'), 'utf8')

    expect(footer).toContain('rel="noopener noreferrer"')
  })

  it('n utilise plus de fallback Access-Control-Allow-Origin arbitraire', () => {
    const sharedCors = readFileSync(resolve(rootDir, 'supabase/functions/_shared/cors.ts'), 'utf8')
    const scanDelete = readFileSync(resolve(rootDir, 'supabase/functions/scan-delete/index.ts'), 'utf8')
    const accountDelete = readFileSync(resolve(rootDir, 'supabase/functions/user-account-delete/index.ts'), 'utf8')
    const userDataExport = readFileSync(resolve(rootDir, 'supabase/functions/user-data-export/index.ts'), 'utf8')
    const foodScanAnalyze = readFileSync(resolve(rootDir, 'supabase/functions/food-scan-analyze/index.ts'), 'utf8')

    expect(sharedCors).toContain('const allowOrigin = origin && allowedOrigins.includes(origin)')
    expect(sharedCors).toContain(': null;')
    expect(sharedCors).not.toContain('allowedOrigins[0]')

    expect(scanDelete).toContain(': null;')
    expect(scanDelete).not.toContain('allowedOrigins[0]')

    expect(accountDelete).toContain('import { getCorsHeaders } from "../_shared/cors.ts"')
    expect(accountDelete).not.toContain('allowedOrigins[0]')

    expect(userDataExport).toContain('import { getCorsHeaders } from "../_shared/cors.ts"')
    expect(userDataExport).not.toContain('allowedOrigins[0]')

    expect(foodScanAnalyze).toContain(': null;')
    expect(foodScanAnalyze).not.toContain('allowedOrigins[0]')
  })

  it('declare des policies explicites sur les tables internes sentry/discord avec RLS', () => {
    const schema = readFileSync(resolve(rootDir, 'supabase/migrations/20250226000000_schema.sql'), 'utf8')
    const migration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260307233000_sentry_internal_tables_rls_policies.sql'),
      'utf8',
    )

    expect(schema).toContain('CREATE POLICY "sentry_discord_threads_no_client_access"')
    expect(schema).toContain('ON public.sentry_discord_threads')
    expect(schema).toContain('CREATE POLICY "sentry_webhook_dedup_no_client_access"')
    expect(schema).toContain('ON public.sentry_webhook_dedup')

    expect(migration).toContain('sentry_discord_threads_no_client_access')
    expect(migration).toContain('sentry_webhook_dedup_no_client_access')
    expect(migration).toContain('USING (false)')
    expect(migration).toContain('WITH CHECK (false)')
  })

  it('sort les tables sentry backend-only de public et passe par des RPC dediees', () => {
    const migration = readFileSync(
      resolve(rootDir, 'supabase/migrations/20260315113000_move_sentry_internal_tables_private.sql'),
      'utf8',
    )
    const webhook = readFileSync(resolve(rootDir, 'supabase/functions/sentry-webhook/index.ts'), 'utf8')

    expect(migration).toContain('CREATE SCHEMA IF NOT EXISTS private')
    expect(migration).toContain('ALTER TABLE public.sentry_discord_threads SET SCHEMA private')
    expect(migration).toContain('ALTER TABLE public.sentry_webhook_dedup SET SCHEMA private')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.sentry_register_webhook_event')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.sentry_get_discord_thread')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.sentry_upsert_discord_thread')

    expect(webhook).toContain("rpc('sentry_register_webhook_event'")
    expect(webhook).toContain("rpc('sentry_get_discord_thread'")
    expect(webhook).toContain("rpc('sentry_upsert_discord_thread'")
    expect(webhook).not.toContain(".from('sentry_discord_threads')")
    expect(webhook).not.toContain(".from('sentry_webhook_dedup')")
  })

  it("supprime le compte auth self-service via RPC DB plutot que auth.admin.deleteUser", () => {
    const accountDelete = readFileSync(resolve(rootDir, 'supabase/functions/user-account-delete/index.ts'), 'utf8')
    const accountDeleteHelper = readFileSync(resolve(rootDir, 'supabase/functions/_shared/account-delete.ts'), 'utf8')

    expect(accountDelete).not.toContain('auth.admin.deleteUser')
    expect(accountDeleteHelper).toContain('rpc(')
    expect(accountDeleteHelper).toContain('"admin_delete_auth_user"')
  })

  it("n utilise plus de dependance distante ImageMagick WASM dans le scan", () => {
    const compress = readFileSync(resolve(rootDir, 'supabase/functions/food-scan-analyze/image/compress.ts'), 'utf8')
    const preprocess = readFileSync(resolve(rootDir, 'supabase/functions/food-scan-analyze/image/preprocess_for_ocr.ts'), 'utf8')

    expect(compress).not.toContain('esm.sh/@imagemagick/magick-wasm')
    expect(compress).not.toContain('cdn.jsdelivr.net/npm/@imagemagick/magick-wasm')
    expect(preprocess).not.toContain('esm.sh/@imagemagick/magick-wasm')
    expect(preprocess).not.toContain('cdn.jsdelivr.net/npm/@imagemagick/magick-wasm')
  })

  it("n utilise plus de navigateFallback Workbox sur '/' et borne le cache runtime aux routes voulues", () => {
    const nuxtConfig = readFileSync(resolve(rootDir, 'nuxt.config.ts'), 'utf8')

    expect(nuxtConfig).not.toContain("navigateFallback: '/'")
    expect(nuxtConfig).toContain('navigateFallback: null')
    expect(nuxtConfig).toContain('runtimeCaching')
    expect(nuxtConfig).not.toContain("cacheName: 'public-documents'")
  })
})
