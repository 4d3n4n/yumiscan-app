ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS assistant_tts_cache_json jsonb NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assistant-audio',
  'assistant-audio',
  false,
  10485760,
  ARRAY['audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "assistant_audio_insert_own" ON storage.objects;
CREATE POLICY "assistant_audio_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'assistant-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "assistant_audio_select_own" ON storage.objects;
CREATE POLICY "assistant_audio_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assistant-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "assistant_audio_delete_own" ON storage.objects;
CREATE POLICY "assistant_audio_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'assistant-audio'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
