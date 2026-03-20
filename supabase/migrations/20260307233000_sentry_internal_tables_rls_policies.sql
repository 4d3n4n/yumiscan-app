-- Explicit deny-all RLS policies for internal Sentry/Discord tables.
-- These tables are only accessed by backend jobs using the service_role key.
-- Adding policies keeps the current effective behavior while satisfying the
-- Supabase linter requirement that RLS-enabled tables declare policies.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sentry_discord_threads'
      AND policyname = 'sentry_discord_threads_no_client_access'
  ) THEN
    CREATE POLICY "sentry_discord_threads_no_client_access"
    ON public.sentry_discord_threads
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sentry_webhook_dedup'
      AND policyname = 'sentry_webhook_dedup_no_client_access'
  ) THEN
    CREATE POLICY "sentry_webhook_dedup_no_client_access"
    ON public.sentry_webhook_dedup
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;
