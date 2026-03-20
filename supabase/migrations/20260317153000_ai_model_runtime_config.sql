-- AI runtime config
-- - ajoute des cles app_config distinctes pour le modele scan et le modele assistant
-- - migre le cout Gemini historique vers un cout scan plus explicite

INSERT INTO public.app_config (key, value)
VALUES
  ('scan_ai_model', 'gemini-2.5-flash'),
  ('assistant_ai_model', 'gemini-2.5-flash'),
  (
    'scan_ai_cost_eur_per_request',
    COALESCE(
      (SELECT value FROM public.app_config WHERE key = 'gemini_flash_cost_eur_per_request'),
      '0'
    )
  ),
  ('assistant_ai_cost_eur_per_request', '0')
ON CONFLICT (key) DO NOTHING;
