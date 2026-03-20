ALTER TABLE public.user_purchases
  DROP CONSTRAINT IF EXISTS user_purchases_user_id_fkey;

COMMENT ON COLUMN public.user_purchases.user_id IS
  'Historical auth.users identifier. Preserved after account deletion for BO and financial analytics.';
