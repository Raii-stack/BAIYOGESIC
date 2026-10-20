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

INSERT INTO public.app_module (module_code, module_name)
VALUES
  ('crm', 'CRM'),
  ('inventory', 'Inventory'),
  ('hr', 'HR'),
  ('sales', 'Sales')
ON CONFLICT (module_code) DO UPDATE
SET module_name = EXCLUDED.module_name,
    is_active = true;

INSERT INTO public.app_role (role_code, role_name)
VALUES
  ('administrator', 'Superadmin'),
  ('admin', 'Admin'),
  ('user', 'User')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name,
    is_active = true;

INSERT INTO public.app_role_permission (role_code, module_code, can_view, can_edit, can_delete)
SELECT
  roles.role_code,
  modules.module_code,
  roles.role_code IN ('administrator', 'admin') OR modules.module_code IN ('crm', 'inventory', 'sales'),
  roles.role_code IN ('administrator', 'admin'),
  roles.role_code = 'administrator'
FROM public.app_role AS roles
CROSS JOIN public.app_module AS modules
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete;

INSERT INTO public.employee (empno, lastname, firstname, email, is_deleted)
VALUES
  ('T0001', 'Gopio', 'Ryan James M.', 'gopio.ryan@hope.inc', false),
  ('T0002', 'Aguinaldo Jr.', 'Prince Nelson', 'aguinaldo.prince@hope.inc', false),
  ('T0003', 'Montes', 'Alain Deiniel', 'montes.alain@hope.inc', false),
  ('T0004', 'Silvestre', 'Kathryn Chloe', 'silvestre.kathryn@hope.inc', false),
  ('T0005', 'Beroy', 'Marron', 'beroy.marron@hope.inc', false)
ON CONFLICT (empno) DO UPDATE
SET email = EXCLUDED.email,
    is_deleted = false;

INSERT INTO public.app_user (
  empno,
  email,
  password_hash,
  status,
  role,
  must_change_password
)
SELECT
  team.empno,
  team.email,
  crypt(gen_random_uuid()::text, gen_salt('bf', 12)),
  'pending',
  'administrator',
  true
FROM (
  VALUES
    ('T0001', 'gopio.ryan@hope.inc'),
    ('T0002', 'aguinaldo.prince@hope.inc'),
    ('T0003', 'montes.alain@hope.inc'),
    ('T0004', 'silvestre.kathryn@hope.inc'),
    ('T0005', 'beroy.marron@hope.inc')
) AS team(empno, email)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.app_user AS existing
  WHERE existing.empno = team.empno
);
