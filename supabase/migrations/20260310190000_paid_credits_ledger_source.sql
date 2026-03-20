CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_admin_user_id uuid,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 50,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  first_name text,
  last_name text,
  free_scans_used integer,
  paid_scans_used integer,
  paid_credits_purchased integer,
  scans_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH purchase_totals AS (
    SELECT user_id, COALESCE(SUM(credits_added), 0)::integer AS paid_credits_purchased
    FROM public.user_purchases
    GROUP BY user_id
  ),
  filtered_users AS (
    SELECT
      u.id,
      u.email,
      COALESCE(u.created_at, p.created_at) AS created_at,
      COALESCE(p.first_name, '') AS first_name,
      COALESCE(p.last_name, '') AS last_name,
      COALESCE(p.free_scans_used, 0) AS free_scans_used,
      COALESCE(p.paid_scans_used, 0) AS paid_scans_used,
      COALESCE(pt.paid_credits_purchased, 0) AS paid_credits_purchased,
      COALESCE(sc.scans_count, 0)::bigint AS scans_count
    FROM auth.users u
    INNER JOIN public.user_profiles p
      ON p.user_id = u.id
    LEFT JOIN purchase_totals pt
      ON pt.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::bigint AS scans_count
      FROM public.scans
      GROUP BY user_id
    ) sc
      ON sc.user_id = u.id
    WHERE u.id <> p_admin_user_id
      AND (
        NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
        OR LOWER(COALESCE(u.email, '')) LIKE LOWER('%' || p_search || '%')
        OR LOWER(COALESCE(p.first_name, '')) LIKE LOWER('%' || p_search || '%')
        OR LOWER(COALESCE(p.last_name, '')) LIKE LOWER('%' || p_search || '%')
      )
  )
  SELECT
    id,
    email,
    created_at,
    first_name,
    last_name,
    free_scans_used,
    paid_scans_used,
    paid_credits_purchased,
    scans_count
  FROM filtered_users
  ORDER BY created_at DESC, id DESC
  LIMIT GREATEST(COALESCE(p_per_page, 50), 1)
  OFFSET (GREATEST(COALESCE(p_page, 1), 1) - 1) * GREATEST(COALESCE(p_per_page, 50), 1);
$$;

WITH duplicate_sessions AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY stripe_session_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.user_purchases
  ) ranked
  WHERE rn > 1
)
DELETE FROM public.user_purchases up
USING duplicate_sessions ds
WHERE up.id = ds.id;

CREATE UNIQUE INDEX IF NOT EXISTS user_purchases_stripe_session_id_key
  ON public.user_purchases USING btree (stripe_session_id);

CREATE OR REPLACE FUNCTION public.consume_scan_credit_and_finalize_scan(
  p_scan_id uuid,
  p_user_id uuid,
  p_product_status text,
  p_result_json jsonb,
  p_debug_json jsonb DEFAULT NULL,
  p_certified_raw_text text DEFAULT NULL,
  p_pipeline_version text DEFAULT NULL,
  p_selected_allergen_ids uuid[] DEFAULT NULL,
  p_ocr_request_count integer DEFAULT 1,
  p_gemini_request_count integer DEFAULT 4,
  p_phase09_executed boolean DEFAULT false
)
RETURNS TABLE (
  scan_id uuid,
  credit_consumed_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_scan public.scans%ROWTYPE;
  v_free_scans_count integer := 3;
  v_today date := CURRENT_DATE;
  v_credit_type text;
  v_paid_credits_purchased integer := 0;
BEGIN
  SELECT *
  INTO v_scan
  FROM public.scans
  WHERE id = p_scan_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scan introuvable';
  END IF;

  IF v_scan.processing_status = 'completed' THEN
    RETURN QUERY
    SELECT v_scan.id, v_scan.credit_consumed_type;
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(value, '')::integer, 3)
  INTO v_free_scans_count
  FROM public.app_config
  WHERE key = 'free_scans_count';

  SELECT *
  INTO v_profile
  FROM public.user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable';
  END IF;

  SELECT COALESCE(SUM(up.credits_added), 0)::integer
  INTO v_paid_credits_purchased
  FROM public.user_purchases up
  WHERE up.user_id = p_user_id;

  IF v_profile.daily_credit_used_at IS NULL OR v_profile.daily_credit_used_at < v_today THEN
    UPDATE public.user_profiles
    SET
      daily_credit_used_at = v_today,
      updated_at = now()
    WHERE user_id = p_user_id;
    v_credit_type := 'daily';
  ELSIF COALESCE(v_profile.free_scans_used, 0) < v_free_scans_count THEN
    UPDATE public.user_profiles
    SET
      free_scans_used = COALESCE(v_profile.free_scans_used, 0) + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
    v_credit_type := 'free';
  ELSIF v_paid_credits_purchased - COALESCE(v_profile.paid_scans_used, 0) > 0 THEN
    UPDATE public.user_profiles
    SET
      paid_scans_used = COALESCE(v_profile.paid_scans_used, 0) + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
    v_credit_type := 'paid';
  ELSE
    RAISE EXCEPTION 'Aucun crédit scan disponible.';
  END IF;

  UPDATE public.scans
  SET
    certified_raw_text = p_certified_raw_text,
    product_status = p_product_status,
    result_json = COALESCE(p_result_json, '{}'::jsonb),
    debug_json = p_debug_json,
    credit_consumed_type = v_credit_type,
    pipeline_version = p_pipeline_version,
    selected_allergen_ids = COALESCE(p_selected_allergen_ids, '{}'::uuid[]),
    ocr_request_count = GREATEST(COALESCE(p_ocr_request_count, 1), 0),
    gemini_request_count = GREATEST(COALESCE(p_gemini_request_count, 4), 0),
    phase09_executed = COALESCE(p_phase09_executed, false),
    processing_status = 'completed',
    processing_error = NULL
  WHERE id = p_scan_id
    AND user_id = p_user_id;

  RETURN QUERY
  SELECT p_scan_id, v_credit_type;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_scan_credit_and_finalize_scan(uuid, uuid, text, jsonb, jsonb, text, text, uuid[], integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_scan_credit_and_finalize_scan(uuid, uuid, text, jsonb, jsonb, text, text, uuid[], integer, integer, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
