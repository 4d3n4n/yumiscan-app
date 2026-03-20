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

DROP TRIGGER IF EXISTS trigger_create_profile_from_auth_user ON auth.users;
CREATE TRIGGER trigger_create_profile_from_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_from_auth_user();
