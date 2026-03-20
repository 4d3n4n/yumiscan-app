ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS assistant_cache_json jsonb NULL;
