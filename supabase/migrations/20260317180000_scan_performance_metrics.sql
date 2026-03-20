-- Scan performance metrics
-- - ajoute une charge utile legere de timings persistés par scan
-- - ces donnees servent au back-office pour suivre la latence reelle du pipeline

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS performance_json jsonb NULL;
