-- Authentication data for the existing employee directory.
-- Run this migration after the public.employee table exists.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.employee
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.employee
SET email = lower(
  regexp_replace(trim(lastname), '\s+', '', 'g')
  || '.'
  || regexp_replace(trim(firstname), '\s+', '', 'g')
  || '@hope.inc'
)
WHERE email IS NULL
  AND nullif(trim(lastname), '') IS NOT NULL
  AND nullif(trim(firstname), '') IS NOT NULL;

ALTER TABLE public.employee
  ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employee_email_lower_idx
  ON public.employee (lower(email));

CREATE TABLE IF NOT EXISTS public.app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empno text NOT NULL UNIQUE REFERENCES public.employee (empno) ON UPDATE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disabled')),
  role text NOT NULL DEFAULT 'employee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_user_empno_idx
  ON public.app_user (empno);

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_user FROM anon, authenticated;
GRANT SELECT ON TABLE public.app_user TO service_role;

-- The API connects with the server-side database role and performs the
-- password verification there. No browser role can read password hashes.

INSERT INTO public.app_user (empno, email, password_hash, status, role)
SELECT
  e.empno,
  lower(e.email),
  '$2b$12$Sh.fL6u/TPNAjGI/fSW8hOvULS15zndPibEKyqu1MEXHTrsxqF31m',
  'active',
  'employee'
FROM public.employee AS e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_user AS u
  WHERE u.empno = e.empno
);

COMMENT ON COLUMN public.app_user.password_hash IS
  'bcrypt hash. Seed accounts use the documented temporary password and must be changed before production use.';
