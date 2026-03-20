-- KPI admin : revenus, couts theoriques et marge
-- - ajoute les compteurs OCR/Gemini sur scans
-- - backfill les scans existants selon result_json.debug.phase09
-- - ajoute les couts API editables dans app_config
-- - etend la RPC atomique scan+consommation de credit

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS ocr_request_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS gemini_request_count integer NOT NULL DEFAULT 4;

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS phase09_executed boolean NOT NULL DEFAULT false;

UPDATE public.scans
SET
  ocr_request_count = 1,
  phase09_executed = COALESCE((result_json->'debug'->'phase09'->>'was_triggered')::boolean, false),
  gemini_request_count = CASE
    WHEN COALESCE((result_json->'debug'->'phase09'->>'was_triggered')::boolean, false) THEN 5
    ELSE 4
  END
WHERE
  ocr_request_count IS DISTINCT FROM 1
  OR gemini_request_count IS DISTINCT FROM CASE
    WHEN COALESCE((result_json->'debug'->'phase09'->>'was_triggered')::boolean, false) THEN 5
    ELSE 4
  END
  OR phase09_executed IS DISTINCT FROM COALESCE((result_json->'debug'->'phase09'->>'was_triggered')::boolean, false);

INSERT INTO public.app_config (key, value)
VALUES
  ('google_ocr_cost_eur_per_request', '0'),
  ('gemini_flash_cost_eur_per_request', '0')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.consume_scan_credit_and_insert_scan(
  p_user_id uuid,
  p_product_status text,
  p_result_json jsonb,
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
  v_free_scans_count integer := 3;
  v_today date := CURRENT_DATE;
  v_credit_type text;
  v_scan_id uuid;
  v_paid_credits_purchased integer := 0;
BEGIN
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

  INSERT INTO public.scans (
    user_id,
    image_storage_path,
    certified_raw_text,
    product_status,
    result_json,
    credit_consumed_type,
    pipeline_version,
    selected_allergen_ids,
    ocr_request_count,
    gemini_request_count,
    phase09_executed
  )
  VALUES (
    p_user_id,
    NULL,
    p_certified_raw_text,
    p_product_status,
    COALESCE(p_result_json, '{}'::jsonb),
    v_credit_type,
    p_pipeline_version,
    COALESCE(p_selected_allergen_ids, '{}'::uuid[]),
    GREATEST(COALESCE(p_ocr_request_count, 1), 0),
    GREATEST(COALESCE(p_gemini_request_count, 4), 0),
    COALESCE(p_phase09_executed, false)
  )
  RETURNING id INTO v_scan_id;

  RETURN QUERY
  SELECT v_scan_id, v_credit_type;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_scan_credit_and_insert_scan(uuid, text, jsonb, text, text, uuid[], integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_scan_credit_and_insert_scan(uuid, text, jsonb, text, text, uuid[], integer, integer, boolean) TO service_role;
