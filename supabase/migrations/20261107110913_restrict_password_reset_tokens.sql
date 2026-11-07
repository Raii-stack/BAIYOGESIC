ALTER TABLE public.password_reset_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.password_reset_token FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.password_reset_token TO service_role;
