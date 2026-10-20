CREATE TABLE IF NOT EXISTS public.app_module (
  module_code text PRIMARY KEY,
  module_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.app_role (
  role_code text PRIMARY KEY,
  role_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.app_role_permission (
  role_code text NOT NULL REFERENCES public.app_role (role_code) ON UPDATE CASCADE,
  module_code text NOT NULL REFERENCES public.app_module (module_code) ON UPDATE CASCADE,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_code, module_code)
);

ALTER TABLE public.app_module ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_role_permission ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_module, public.app_role, public.app_role_permission
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.app_module, public.app_role, public.app_role_permission
  TO service_role;

CREATE OR REPLACE FUNCTION public.audit_user()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(
    NULLIF(current_setting('app.username', true), ''),
    session_user::text
  );
$function$;
