ALTER TABLE public.app_user DROP CONSTRAINT app_user_role_check;
ALTER TABLE public.app_user ADD CONSTRAINT app_user_role_check
  CHECK (role IN ('superadmin', 'admin', 'employee', 'it_admin'));
