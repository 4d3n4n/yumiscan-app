CREATE SCHEMA IF NOT EXISTS private;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'sentry_discord_threads'
  ) THEN
    ALTER TABLE public.sentry_discord_threads SET SCHEMA private;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'sentry_webhook_dedup'
  ) THEN
    ALTER TABLE public.sentry_webhook_dedup SET SCHEMA private;
  END IF;
END $$;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO postgres;
GRANT USAGE ON SCHEMA private TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA private TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION public.sentry_register_webhook_event(p_event_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_event_id text;
BEGIN
  INSERT INTO private.sentry_webhook_dedup (event_id)
  VALUES (p_event_id)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id INTO inserted_event_id;

  RETURN inserted_event_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sentry_get_discord_thread(p_sentry_issue_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT thread.discord_thread_id
  FROM private.sentry_discord_threads AS thread
  WHERE thread.sentry_issue_id = p_sentry_issue_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sentry_upsert_discord_thread(
  p_sentry_issue_id text,
  p_discord_thread_id text,
  p_sentry_issue_url text,
  p_status text,
  p_updated_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO private.sentry_discord_threads (
    sentry_issue_id,
    discord_thread_id,
    sentry_issue_url,
    status,
    updated_at
  )
  VALUES (
    p_sentry_issue_id,
    p_discord_thread_id,
    p_sentry_issue_url,
    p_status,
    COALESCE(p_updated_at, timezone('utc', now()))
  )
  ON CONFLICT (sentry_issue_id) DO UPDATE
  SET discord_thread_id = EXCLUDED.discord_thread_id,
      sentry_issue_url = EXCLUDED.sentry_issue_url,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.sentry_register_webhook_event(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sentry_register_webhook_event(text) FROM anon;
REVOKE ALL ON FUNCTION public.sentry_register_webhook_event(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sentry_register_webhook_event(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.sentry_register_webhook_event(text) TO service_role;

REVOKE ALL ON FUNCTION public.sentry_get_discord_thread(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sentry_get_discord_thread(text) FROM anon;
REVOKE ALL ON FUNCTION public.sentry_get_discord_thread(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sentry_get_discord_thread(text) TO postgres;
GRANT EXECUTE ON FUNCTION public.sentry_get_discord_thread(text) TO service_role;

REVOKE ALL ON FUNCTION public.sentry_upsert_discord_thread(text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sentry_upsert_discord_thread(text, text, text, text, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.sentry_upsert_discord_thread(text, text, text, text, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sentry_upsert_discord_thread(text, text, text, text, timestamptz) TO postgres;
GRANT EXECUTE ON FUNCTION public.sentry_upsert_discord_thread(text, text, text, text, timestamptz) TO service_role;
