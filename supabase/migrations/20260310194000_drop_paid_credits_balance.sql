DROP FUNCTION IF EXISTS public.admin_list_users(uuid, integer, integer, text);

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

REVOKE ALL ON FUNCTION public.admin_list_users(uuid, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(uuid, integer, integer, text) TO service_role;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS paid_credits_balance;

NOTIFY pgrst, 'reload schema';
