INSERT INTO public.app_config (key, value)
VALUES ('scan_batch_size', '8')
ON CONFLICT (key) DO NOTHING;
