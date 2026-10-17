-- Login seed for current employees.
-- The bcrypt hash below is for the temporary password: ChangeMe123!
-- Replace it before applying this seed in a production environment.

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
