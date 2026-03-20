-- ============================================================================
-- YumiScan — Schéma complet (migration unique consolidée)
-- Générée le 26 février 2026, mise à jour le 7 mars 2026.
-- Inclut : user_purchases, fix_function_search_path, fix_rls_auth_initplan,
--          daily_credit_used_at (crédit journalier gratuit).
-- Idempotente : sûre sur BDD vierge ET sur BDD existante.
--
-- SÉCURITÉ RLS (Row Level Security)
-- - Toutes les tables public ont RLS activé.
-- - Données utilisateur (user_profiles, scans, user_purchases) :
--   accès limité à (select auth.uid()) = user_id ; pas d’accès croisé.
-- - Tables sensibles (user_purchases) : SELECT seul pour le client ;
--   INSERT/UPDATE/DELETE réservés au service_role (webhooks, edge functions).
-- - Storage scan-images : dossiers par user_id ; pas d’accès au dossier d’un autre.
-- - Catalogue (allergens, app_config) : SELECT public ; pas de modification client.
-- - REVOKE explicites pour défense en profondeur sur les opérations interdites.
-- ============================================================================


-- ============================================================================
-- 0. FONCTIONS UTILITAIRES ET TRIGGERS
-- ============================================================================

-- Dédoublonnage et tri des ingrédients dans la table allergens
CREATE OR REPLACE FUNCTION public.clean_ingredients_array()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ingredients IS NOT NULL AND array_length(NEW.ingredients, 1) > 0 THEN
    SELECT array_agg(x ORDER BY x)
    INTO NEW.ingredients
    FROM (SELECT DISTINCT unnest(NEW.ingredients) AS x) sub;
  END IF;

  IF NEW.ingredients_en IS NOT NULL AND array_length(NEW.ingredients_en, 1) > 0 THEN
    SELECT array_agg(x ORDER BY x)
    INTO NEW.ingredients_en
    FROM (SELECT DISTINCT unnest(NEW.ingredients_en) AS x) sub;
  END IF;

  RETURN NEW;
END;
$$;

-- Contrôle du consentement CGU à l'inscription (BEFORE INSERT sur user_profiles)
CREATE OR REPLACE FUNCTION public.check_consent_on_profile_insert()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.accepted_cgu_at IS NULL OR NEW.accepted_health_disclaimer IS NOT TRUE THEN
    RAISE EXCEPTION
      'Consentement obligatoire : accepted_cgu_at et accepted_health_disclaimer doivent être renseignés.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.accepted_cgu_version IS NULL OR trim(NEW.accepted_cgu_version) = '' THEN
    RAISE EXCEPTION
      'Consentement obligatoire : accepted_cgu_version doit être renseigné (ex: v1.0).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_profile_from_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  accepted_cgu_version_value text;
  accepted_cgu_at_text text;
  accepted_cgu_at_value timestamptz;
  accepted_health_disclaimer_value boolean;
  first_name_value text;
  last_name_value text;
  preferences_value text[] := '{}'::text[];
BEGIN
  accepted_cgu_version_value := NULLIF(BTRIM(COALESCE(metadata ->> 'accepted_cgu_version', '')), '');
  accepted_cgu_at_text := NULLIF(BTRIM(COALESCE(metadata ->> 'accepted_cgu_at', '')), '');
  accepted_health_disclaimer_value := LOWER(COALESCE(metadata ->> 'accepted_health_disclaimer', 'false')) = 'true';

  IF accepted_cgu_version_value IS NULL
    OR accepted_cgu_at_text IS NULL
    OR accepted_health_disclaimer_value IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  BEGIN
    accepted_cgu_at_value := accepted_cgu_at_text::timestamptz;
  EXCEPTION
    WHEN others THEN
      RETURN NEW;
  END;

  first_name_value := COALESCE(NULLIF(BTRIM(COALESCE(metadata ->> 'first_name', '')), ''), 'Utilisateur');
  last_name_value := COALESCE(NULLIF(BTRIM(COALESCE(metadata ->> 'last_name', '')), ''), '');

  IF jsonb_typeof(metadata -> 'preferences') = 'array' THEN
    SELECT COALESCE(array_agg(pref), '{}'::text[])
      INTO preferences_value
    FROM (
      SELECT DISTINCT BTRIM(value) AS pref
      FROM jsonb_array_elements_text(metadata -> 'preferences') AS value
      WHERE BTRIM(value) <> ''
      LIMIT 5
    ) AS normalized_preferences;
  END IF;

  INSERT INTO public.user_profiles (
    user_id,
    first_name,
    last_name,
    preferences,
    accepted_cgu_version,
    accepted_cgu_at,
    accepted_health_disclaimer
  )
  VALUES (
    NEW.id,
    first_name_value,
    last_name_value,
    preferences_value,
    accepted_cgu_version_value,
    accepted_cgu_at_value,
    accepted_health_disclaimer_value
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.admin_count_users(
  p_admin_user_id uuid,
  p_search text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COUNT(*)::bigint
  FROM auth.users u
  INNER JOIN public.user_profiles p
    ON p.user_id = u.id
  WHERE u.id <> p_admin_user_id
    AND (
      NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
      OR LOWER(COALESCE(u.email, '')) LIKE LOWER('%' || p_search || '%')
      OR LOWER(COALESCE(p.first_name, '')) LIKE LOWER('%' || p_search || '%')
      OR LOWER(COALESCE(p.last_name, '')) LIKE LOWER('%' || p_search || '%')
    );
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_email(
  p_user_id uuid
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.email
  FROM auth.users u
  WHERE u.id = p_user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_auth_user(
  p_user_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  DELETE FROM auth.users
  WHERE id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(uuid, integer, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_count_users(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_user_email(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_auth_user(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_users(uuid, integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_count_users(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_user_email(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_auth_user(uuid) TO service_role;


-- ============================================================================
-- 1. TABLE allergens — catalogue d'allergènes (lecture publique)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.allergens (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  name_en     text        NULL,
  slug        text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ingredients text[]      NULL    DEFAULT '{}'::text[],
  ingredients_en text[]   NULL    DEFAULT '{}'::text[],
  CONSTRAINT allergens_pkey        PRIMARY KEY (id),
  CONSTRAINT allergens_name_unique UNIQUE (name),
  CONSTRAINT allergens_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_allergens_ingredients ON public.allergens USING gin (ingredients);

DROP TRIGGER IF EXISTS trigger_unique_ingredients ON public.allergens;
CREATE TRIGGER trigger_unique_ingredients
  BEFORE INSERT OR UPDATE ON public.allergens
  FOR EACH ROW EXECUTE FUNCTION public.clean_ingredients_array();

ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allergens_select_only" ON public.allergens;
CREATE POLICY "allergens_select_only" ON public.allergens
  FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE : aucune policy pour anon/authenticated → refusé (service_role seul peut modifier)
GRANT SELECT ON public.allergens TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.allergens FROM anon, authenticated;


-- ============================================================================
-- 2. TABLE user_profiles — profil utilisateur, crédits et consentement
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                         uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id                    uuid        NOT NULL,
  first_name                 text        NOT NULL DEFAULT '',
  last_name                  text        NOT NULL DEFAULT '',
  preferences                text[]      NOT NULL DEFAULT '{}'::text[],
  free_scans_used            int         NOT NULL DEFAULT 0,
  paid_scans_used            int         NOT NULL DEFAULT 0,
  -- Consentement CGU (obligatoire à l'inscription, contrôlé par trigger)
  accepted_cgu_version       text        NULL,
  accepted_cgu_at            timestamptz NULL,
  accepted_health_disclaimer boolean     NULL,
  daily_credit_used_at       date        NULL,   -- crédit journalier : NULL/passé=dispo, aujourd'hui=utilisé
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey           PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_key    UNIQUE (user_id),
  CONSTRAINT user_profiles_user_id_fkey   FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_profiles_preferences_check
    CHECK (array_length(preferences, 1) IS NULL OR array_length(preferences, 1) <= 5),
  CONSTRAINT user_profiles_free_scans_check
    CHECK (free_scans_used >= 0),
  CONSTRAINT user_profiles_paid_scans_check
    CHECK (paid_scans_used >= 0)
);

-- Colonnes ajoutées en ALTER pour idempotence sur BDD existante sans ces colonnes
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS free_scans_used            int         NOT NULL DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS paid_scans_used            int         NOT NULL DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS accepted_cgu_version       text        NULL;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS accepted_cgu_at            timestamptz NULL;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS accepted_health_disclaimer boolean     NULL;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_admin                    boolean     NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS daily_credit_used_at       date        NULL;

COMMENT ON COLUMN public.user_profiles.is_admin IS 'Réservé : seul service_role peut passer à true (trigger).';

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles USING btree (user_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;

CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user_profiles_update_own" ON public.user_profiles
  FOR UPDATE USING ((select auth.uid()) = user_id);
-- DELETE : refusé côté client (suppression compte via Edge Function service_role uniquement)
REVOKE DELETE ON public.user_profiles FROM anon, authenticated;

-- Trigger de consentement : s'applique uniquement aux nouveaux INSERT
DROP TRIGGER IF EXISTS trigger_check_consent_on_profile_insert ON public.user_profiles;
CREATE TRIGGER trigger_check_consent_on_profile_insert
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_consent_on_profile_insert();

DROP TRIGGER IF EXISTS trigger_create_profile_from_auth_user ON auth.users;
CREATE TRIGGER trigger_create_profile_from_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_from_auth_user();

-- Trigger is_admin : seul service_role (ou SQL Dashboard) peut passer un utilisateur en admin.
-- Bloque INSERT et UPDATE depuis le client (rôle authenticated) : is_admin ne peut pas être true.
CREATE OR REPLACE FUNCTION public.ensure_is_admin_only_by_service_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.jwt() ->> 'role' = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_admin := false;
    ELSIF TG_OP = 'UPDATE' AND NEW.is_admin = true AND (OLD.is_admin IS DISTINCT FROM true) THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_is_admin_only_by_service_role ON public.user_profiles;
CREATE TRIGGER trigger_ensure_is_admin_only_by_service_role
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_is_admin_only_by_service_role();


-- ============================================================================
-- 3. TABLE scans — historique des scans IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scans (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  image_storage_path    text        NULL,
  certified_raw_text    text        NULL,
  product_status        text        NULL,
  result_json           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  debug_json            jsonb       NULL,
  credit_consumed_type  text        NULL,
  pipeline_version      text        NULL,
  selected_allergen_ids uuid[]      NULL    DEFAULT '{}'::uuid[],
  ocr_request_count     integer     NOT NULL DEFAULT 1,
  gemini_request_count  integer     NOT NULL DEFAULT 4,
  phase09_executed      boolean     NOT NULL DEFAULT false,
  processing_status     text        NOT NULL DEFAULT 'completed',
  processing_error      text        NULL,
  CONSTRAINT scans_pkey PRIMARY KEY (id),
  CONSTRAINT scans_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT scans_product_status_check
    CHECK (product_status IS NULL OR product_status IN ('ok', 'not_ok', 'ambiguous', 'contains_allergen')),
  CONSTRAINT scans_processing_status_check
    CHECK (processing_status IN ('processing', 'completed', 'failed')),
  CONSTRAINT scans_credit_type_check
    CHECK (credit_consumed_type IS NULL OR credit_consumed_type IN ('free', 'daily', 'paid'))
);

-- Colonnes idempotentes pour BDD existante
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS image_storage_path    text  NULL;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS certified_raw_text     text  NULL;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS debug_json            jsonb NULL;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS pipeline_version       text  NULL;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS selected_allergen_ids  uuid[] NULL DEFAULT '{}'::uuid[];
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS ocr_request_count      integer NOT NULL DEFAULT 1;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS gemini_request_count   integer NOT NULL DEFAULT 4;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS phase09_executed       boolean NOT NULL DEFAULT false;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS processing_status      text NOT NULL DEFAULT 'completed';
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS processing_error       text NULL;
ALTER TABLE public.scans ALTER COLUMN product_status DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scans_user_id    ON public.scans USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.scans USING btree (created_at DESC);

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scans_select_own" ON public.scans;
DROP POLICY IF EXISTS "scans_insert_own" ON public.scans;
DROP POLICY IF EXISTS "scans_delete_own" ON public.scans;

CREATE POLICY "scans_select_own" ON public.scans
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "scans_insert_own" ON public.scans
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "scans_delete_own" ON public.scans
  FOR DELETE USING ((select auth.uid()) = user_id);
-- UPDATE : réservé à l'edge function (résultat du scan) → refusé pour le client
REVOKE UPDATE ON public.scans FROM anon, authenticated;


-- ============================================================================
-- 4. TABLE app_config — paramètres globaux clé/valeur
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  key   text NOT NULL,
  value text NOT NULL,
  CONSTRAINT app_config_pkey PRIMARY KEY (key)
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_select_all" ON public.app_config;
CREATE POLICY "app_config_select_all" ON public.app_config
  FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE : refusé pour anon/authenticated (config réservée au backend)
GRANT SELECT ON public.app_config TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.app_config FROM anon, authenticated;

-- Valeurs publiques par défaut
INSERT INTO public.app_config (key, value)
VALUES
  ('free_scans_count', '3'),
  ('company_name', 'YumiScan'),
  ('legal_entity_name', ''),
  ('company_address', ''),
  ('company_country', 'France'),
  ('company_siret', ''),
  ('publication_director', ''),
  ('contact_page_path', '/contact'),
  ('vat_number', ''),
  ('maintenance_mode_enabled', 'false'),
  ('scan_debug_enabled', 'false'),
  ('google_ocr_cost_eur_per_request', '0'),
  ('gemini_flash_cost_eur_per_request', '0')
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 5. TABLE pricing_offers — offres credits Stripe pilotées depuis le BO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pricing_offers (
  id                       uuid        NOT NULL DEFAULT gen_random_uuid(),
  code                     text        NOT NULL,
  title                    text        NOT NULL,
  credits                  integer     NOT NULL,
  full_price_cents         integer     NOT NULL,
  discount_price_cents     integer     NULL,
  stripe_price_id_full     text        NULL,
  stripe_price_id_discount text        NULL,
  active                   boolean     NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_offers_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_offers_code_key UNIQUE (code),
  CONSTRAINT pricing_offers_credits_check CHECK (credits > 0),
  CONSTRAINT pricing_offers_full_price_check CHECK (full_price_cents > 0),
  CONSTRAINT pricing_offers_discount_check CHECK (
    discount_price_cents IS NULL
    OR (discount_price_cents > 0 AND discount_price_cents < full_price_cents)
  ),
  CONSTRAINT pricing_offers_full_price_id_check CHECK (
    stripe_price_id_full IS NULL OR stripe_price_id_full LIKE 'price_%'
  ),
  CONSTRAINT pricing_offers_discount_price_id_check CHECK (
    stripe_price_id_discount IS NULL OR stripe_price_id_discount LIKE 'price_%'
  )
);

CREATE INDEX IF NOT EXISTS idx_pricing_offers_active ON public.pricing_offers USING btree (active);

ALTER TABLE public.pricing_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_offers_select_active" ON public.pricing_offers;
CREATE POLICY "pricing_offers_select_active" ON public.pricing_offers
  FOR SELECT USING (active = true);

GRANT SELECT ON public.pricing_offers TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pricing_offers FROM anon, authenticated;

INSERT INTO public.pricing_offers (
  code,
  title,
  credits,
  full_price_cents,
  discount_price_cents,
  stripe_price_id_full,
  stripe_price_id_discount,
  active
)
VALUES
  ('100_credits', '100 credits', 100, 749, NULL, NULL, NULL, true),
  ('300_credits', '300 credits', 300, 1249, NULL, NULL, NULL, true)
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- 6. RPC scan — consommation atomique du crédit + insertion du scan
-- ============================================================================

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


-- ============================================================================
-- 7. TABLE user_purchases — historique des achats de crédits (Stripe)
-- Remplie par stripe-webhook sur checkout.session.completed.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_purchases (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL,
  stripe_session_id text        NOT NULL,
  plan              text        NOT NULL,
  credits_added     int         NOT NULL,
  amount_cents      int         NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT user_purchases_stripe_session_id_key UNIQUE (stripe_session_id),
  CONSTRAINT user_purchases_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id ON public.user_purchases USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_created_at ON public.user_purchases USING btree (created_at DESC);

ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_purchases_select_own" ON public.user_purchases;
CREATE POLICY "user_purchases_select_own" ON public.user_purchases
  FOR SELECT USING ((select auth.uid()) = user_id);
-- INSERT/UPDATE/DELETE : aucune policy → service_role uniquement (stripe-webhook)
REVOKE INSERT, UPDATE, DELETE ON public.user_purchases FROM anon, authenticated;


-- ============================================================================
-- 8. STORAGE — bucket scan-images (privé, accès par signed URL)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scan-images',
  'scan-images',
  false,
  5242880,  -- 5 Mo max par image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Upload : dans le dossier propre à chaque utilisateur {user_id}/...
DROP POLICY IF EXISTS "scan_images_insert_own" ON storage.objects;
CREATE POLICY "scan_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Lecture : uniquement ses propres images
DROP POLICY IF EXISTS "scan_images_select_own" ON storage.objects;
CREATE POLICY "scan_images_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Suppression : uniquement ses propres images
DROP POLICY IF EXISTS "scan_images_delete_own" ON storage.objects;
CREATE POLICY "scan_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'scan-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================================
-- 9. SENTRY ↔ DISCORD — mapping issue → thread + dédup webhooks
-- Utilisé par l’Edge Function sentry-webhook (Service Role uniquement).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sentry_discord_threads (
  id                       uuid        NOT NULL DEFAULT gen_random_uuid(),
  sentry_issue_id         text        NOT NULL,
  discord_thread_id       text        NOT NULL,
  sentry_issue_url        text        NULL,
  discord_first_message_id text       NULL,
  status                  text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sentry_discord_threads_pkey           PRIMARY KEY (id),
  CONSTRAINT sentry_discord_threads_issue_id_unique UNIQUE (sentry_issue_id)
);

CREATE INDEX IF NOT EXISTS idx_sentry_discord_threads_issue_id ON public.sentry_discord_threads (sentry_issue_id);
CREATE INDEX IF NOT EXISTS idx_sentry_discord_threads_discord_thread_id ON public.sentry_discord_threads (discord_thread_id);

ALTER TABLE public.sentry_discord_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sentry_discord_threads_no_client_access"
ON public.sentry_discord_threads
FOR ALL
TO public
USING (false)
WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.sentry_webhook_dedup (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_id     text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sentry_webhook_dedup_pkey       PRIMARY KEY (id),
  CONSTRAINT sentry_webhook_dedup_event_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_sentry_webhook_dedup_event_id ON public.sentry_webhook_dedup (event_id);

ALTER TABLE public.sentry_webhook_dedup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sentry_webhook_dedup_no_client_access"
ON public.sentry_webhook_dedup
FOR ALL
TO public
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.sentry_discord_threads IS 'Mapping Sentry issue → Discord forum thread (1 issue = 1 thread)';
COMMENT ON TABLE public.sentry_webhook_dedup IS 'Déduplication des événements webhook Sentry (idempotency)';

-- ============================================================================
-- 8. TABLE paywall_hits — historique des affichages du paywall faute de crédits
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.paywall_hits (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paywall_hits_pkey PRIMARY KEY (id),
  CONSTRAINT paywall_hits_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_paywall_hits_user_id ON public.paywall_hits USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_paywall_hits_created_at ON public.paywall_hits USING btree (created_at DESC);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================
ALTER TABLE public.paywall_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own paywall hits"
ON public.paywall_hits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own paywall hits"
ON public.paywall_hits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
