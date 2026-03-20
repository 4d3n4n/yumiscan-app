INSERT INTO public.app_config (key, value)
VALUES
  ('company_name', 'YumiScan'),
  ('legal_entity_name', ''),
  ('company_address', ''),
  ('company_country', 'France'),
  ('company_siret', ''),
  ('publication_director', ''),
  ('contact_page_path', '/contact'),
  ('vat_number', '')
ON CONFLICT (key) DO NOTHING;
