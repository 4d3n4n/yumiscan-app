INSERT INTO public.app_config (key, value)
VALUES ('maintenance_mode_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
