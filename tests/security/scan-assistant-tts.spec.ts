import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(currentDir, '../..')

describe('scan assistant TTS hardening', () => {
  it('protège la génération audio, lit le cache assistant et persiste un cache Storage dédié', () => {
    const functionFile = readFileSync(resolve(rootDir, 'supabase/functions/scan-assistant-tts/index.ts'), 'utf8')
    const sharedCache = readFileSync(resolve(rootDir, 'supabase/functions/_shared/scan-assistant-tts-cache.ts'), 'utf8')
    const migration = readFileSync(resolve(rootDir, 'supabase/migrations/20260316153000_scan_assistant_tts_cache.sql'), 'utf8')
    const config = readFileSync(resolve(rootDir, 'supabase/config.toml'), 'utf8')

    expect(functionFile).toContain('const { user, supabase } = await getAuthUser(req)')
    expect(functionFile).toContain('.eq("id", body.scan_id)')
    expect(functionFile).toContain('.eq("user_id", user.id)')
    expect(functionFile).toContain('assistant_cache_json')
    expect(functionFile).toContain('assistant_tts_cache_json')
    expect(functionFile).toContain('texttospeech.googleapis.com/v1/text:synthesize')
    expect(functionFile).toContain('DEFAULT_ASSISTANT_TTS_VOICE')
    expect(functionFile).toContain('.from("assistant-audio")')
    expect(functionFile).toContain('buildAssistantTtsCachePayload')
    expect(functionFile).toContain('computeAssistantTtsTextHash')

    expect(sharedCache).toContain('buildAssistantTtsStoragePath')
    expect(sharedCache).toContain('listAssistantTtsStoragePaths')

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS assistant_tts_cache_json jsonb NULL')
    expect(migration).toContain("'assistant-audio'")

    expect(config).toContain('[functions.scan-assistant-tts]\nverify_jwt = false')
  })

  it('supprime aussi les audios TTS quand un scan est supprimé', () => {
    const scanDelete = readFileSync(resolve(rootDir, 'supabase/functions/scan-delete/index.ts'), 'utf8')
    const accountDelete = readFileSync(resolve(rootDir, 'supabase/functions/_shared/account-delete.ts'), 'utf8')

    expect(scanDelete).toContain('removeStorageFilesUnderPrefix')
    expect(scanDelete).toContain('"assistant-audio"')
    expect(scanDelete).toContain('`${user.id}/${scanId}`')
    expect(scanDelete).toContain('Échec de la suppression des audios Assistant IA.')
    expect(accountDelete).toContain('removeStorageFilesUnderPrefix')
    expect(accountDelete).toContain('"assistant-audio", userId')
  })

  it('rollback le fichier audio si la persistance du cache DB échoue après upload', () => {
    const functionFile = readFileSync(resolve(rootDir, 'supabase/functions/scan-assistant-tts/index.ts'), 'utf8')

    expect(functionFile).toContain('Failed to rollback uploaded audio')
    expect(functionFile).toContain('.remove([storagePath])')
  })
})
