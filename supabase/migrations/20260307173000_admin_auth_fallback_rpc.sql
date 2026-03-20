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

REVOKE ALL ON FUNCTION public.admin_get_user_email(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_auth_user(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_get_user_email(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_auth_user(uuid) TO service_role;
