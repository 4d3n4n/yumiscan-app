-- Ensure the remote database accepts the canonical daily scan credit type.
-- Older environments may still have a stale CHECK constraint that allows
-- `daily_free` instead of `daily`.

UPDATE public.scans
SET credit_consumed_type = 'daily'
WHERE credit_consumed_type = 'daily_free';

ALTER TABLE public.scans
DROP CONSTRAINT IF EXISTS scans_credit_type_check;

ALTER TABLE public.scans
ADD CONSTRAINT scans_credit_type_check
CHECK (
  credit_consumed_type IS NULL
  OR credit_consumed_type IN ('free', 'daily', 'paid')
);
