ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS processing_error text NULL,
  ADD COLUMN IF NOT EXISTS debug_json jsonb NULL;

ALTER TABLE public.scans
  ALTER COLUMN product_status DROP NOT NULL;

UPDATE public.scans
SET processing_status = 'completed'
WHERE processing_status IS NULL;

ALTER TABLE public.scans
  DROP CONSTRAINT IF EXISTS scans_product_status_check;

ALTER TABLE public.scans
  ADD CONSTRAINT scans_product_status_check
  CHECK (
    product_status IS NULL
    OR product_status IN ('ok', 'not_ok', 'ambiguous', 'contains_allergen')
  );

ALTER TABLE public.scans
  DROP CONSTRAINT IF EXISTS scans_processing_status_check;

ALTER TABLE public.scans
  ADD CONSTRAINT scans_processing_status_check
  CHECK (processing_status IN ('processing', 'completed', 'failed'));

INSERT INTO public.app_config (key, value)
VALUES ('scan_debug_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

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
