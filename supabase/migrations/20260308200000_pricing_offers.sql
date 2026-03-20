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
