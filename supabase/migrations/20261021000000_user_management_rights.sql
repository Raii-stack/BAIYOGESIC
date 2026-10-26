-- User management: three roles, account blocking, and per-user rights.
-- Follows the student guide (section 1.2 roles, 2.4 USERS/RIGHTS/USERRIGHTS, 3.8 rights dialog).
--   superadmin : system owner, everything, may assign any role
--   admin      : manages every module and employee accounts/rights, cannot see or change superadmins
--   employee   : only the modules and actions granted through app_user_right

-- 1. Roles -------------------------------------------------------------------
UPDATE public.app_role SET role_name = 'Administrator (Legacy)' WHERE role_code = 'administrator';
UPDATE public.app_role SET role_name = 'User (Legacy)' WHERE role_code = 'user';

INSERT INTO public.app_role (role_code, role_name) VALUES
  ('superadmin', 'Superadmin'), ('admin', 'Admin'), ('employee', 'Employee')
ON CONFLICT (role_code) DO UPDATE SET role_name = EXCLUDED.role_name;

ALTER TABLE public.app_user DROP CONSTRAINT IF EXISTS app_user_role_check;
UPDATE public.app_user SET role = 'superadmin' WHERE role = 'administrator';
UPDATE public.app_user SET role = 'employee' WHERE role NOT IN ('superadmin', 'admin', 'employee');
UPDATE public.app_user SET role = 'admin' WHERE empno IN ('00009', '00011', '00023') AND role = 'employee';

ALTER TABLE public.app_user
  ADD CONSTRAINT app_user_role_check CHECK (role IN ('superadmin', 'admin', 'employee'));
ALTER TABLE public.app_user ALTER COLUMN role SET DEFAULT 'employee';

UPDATE public.app_role_permission SET role_code = 'superadmin' WHERE role_code = 'administrator'
  AND NOT EXISTS (
    SELECT 1 FROM public.app_role_permission p2
    WHERE p2.role_code = 'superadmin' AND p2.module_code = public.app_role_permission.module_code
  );
UPDATE public.app_role_permission SET role_code = 'employee' WHERE role_code = 'user'
  AND NOT EXISTS (
    SELECT 1 FROM public.app_role_permission p2
    WHERE p2.role_code = 'employee' AND p2.module_code = public.app_role_permission.module_code
  );
DELETE FROM public.app_role_permission WHERE role_code IN ('administrator', 'user');
DELETE FROM public.app_role WHERE role_code IN ('administrator', 'user');

-- Admins now manage every module (including archive/restore); employees rely on per-user rights.
UPDATE public.app_role_permission SET can_view = true, can_edit = true, can_delete = true WHERE role_code IN ('superadmin', 'admin');
UPDATE public.app_role_permission SET can_view = false, can_edit = false, can_delete = false WHERE role_code = 'employee';

-- 2. Blocking and audit stamp ------------------------------------------------
-- A blocked account cannot sign in or call any data API. Kept separate from
-- status so a pending account keeps its state after being unblocked.
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_user ADD COLUMN IF NOT EXISTS stamp text;
UPDATE public.app_user
SET stamp = 'ADD system ' || to_char(COALESCE(created_at, now()) AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM')
WHERE stamp IS NULL;

-- 3. Rights catalogue (RIGHTS) -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_right (
  right_code text PRIMARY KEY,
  module text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL,
  is_module_access boolean NOT NULL DEFAULT false
);

-- 4. Granted rights (USERRIGHTS) ---------------------------------------------
-- A ticked checkbox is one row; unticking deletes it.
CREATE TABLE IF NOT EXISTS public.app_user_right (
  user_id uuid NOT NULL REFERENCES public.app_user (user_id) ON DELETE CASCADE,
  right_code text NOT NULL REFERENCES public.app_right (right_code) ON UPDATE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by text,
  PRIMARY KEY (user_id, right_code)
);
CREATE INDEX IF NOT EXISTS app_user_right_right_code_idx ON public.app_user_right (right_code);

ALTER TABLE public.app_right ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_right ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_right, public.app_user_right FROM anon, authenticated;
GRANT SELECT ON TABLE public.app_right, public.app_user_right TO service_role;

-- Module access rows switch a module on (the module checkbox in the rights dialog);
-- the remaining 36 rows are the action checkboxes listed in the guide.
INSERT INTO public.app_right (right_code, module, description, sort_order, is_module_access) VALUES
  ('customers.access',        'customers', 'Open Customer Management', 100, true),
  ('customers.add',           'customers', 'Add Customer',             101, false),
  ('customers.edit',          'customers', 'Edit Customer',            102, false),
  ('customers.delete',        'customers', 'Delete Customer',          103, false),
  ('products.access',         'products',  'Open Product Management',  200, true),
  ('products.add',            'products',  'Add Product',              201, false),
  ('products.edit',           'products',  'Edit Product',             202, false),
  ('products.delete',         'products',  'Delete Product',           203, false),
  ('products.price.add',      'products',  'Add Price',                204, false),
  ('products.price.edit',     'products',  'Edit Price',               205, false),
  ('products.price.delete',   'products',  'Delete Price',             206, false),
  ('hr.access',               'hr',        'Open Human Resources',     300, true),
  ('hr.job.add',              'hr',        'Add Job',                  301, false),
  ('hr.job.edit',             'hr',        'Edit Job',                 302, false),
  ('hr.job.delete',           'hr',        'Delete Job',               303, false),
  ('hr.department.add',       'hr',        'Add Department',           304, false),
  ('hr.department.edit',      'hr',        'Edit Department',          305, false),
  ('hr.department.delete',    'hr',        'Delete Department',        306, false),
  ('hr.employee.add',         'hr',        'Add Employee',             307, false),
  ('hr.employee.edit',        'hr',        'Edit Employee',            308, false),
  ('hr.employee.delete',      'hr',        'Delete Employee',          309, false),
  ('hr.history.view',         'hr',        'View Job History',         310, false),
  ('hr.history.add',          'hr',        'Add Job History',          311, false),
  ('hr.history.edit',         'hr',        'Edit Job History',         312, false),
  ('hr.history.delete',       'hr',        'Delete Job History',       313, false),
  ('sales.access',            'sales',     'Open Sales Management',    400, true),
  ('sales.add',               'sales',     'Add Sale',                 401, false),
  ('sales.edit',              'sales',     'Edit Sale',                402, false),
  ('sales.delete',            'sales',     'Delete Sale',              403, false),
  ('sales.details.view',      'sales',     'View Sale Details',        404, false),
  ('sales.details.add',       'sales',     'Add Sale Detail',          405, false),
  ('sales.details.edit',      'sales',     'Edit Sale Detail',         406, false),
  ('sales.details.delete',    'sales',     'Delete Sale Detail',       407, false),
  ('reports.access',          'reports',   'Open Reports',             500, true),
  ('reports.top-customers',   'reports',   'Top Customers',            501, false),
  ('reports.product-master',  'reports',   'Product Master List',      502, false),
  ('reports.top-products',    'reports',   'Top Products',             503, false),
  ('reports.active-employees','reports',   'Active Employees',         504, false),
  ('reports.all-employees',   'reports',   'All Employees',            505, false),
  ('reports.job-history',     'reports',   'Employee Job History',     506, false),
  ('reports.top-sales',       'reports',   'Top Sales',                507, false)
ON CONFLICT (right_code) DO UPDATE
  SET module = EXCLUDED.module,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order,
      is_module_access = EXCLUDED.is_module_access;

-- 5. Preserve current access for existing accounts ---------------------------
-- Seed full rights for existing superadmin and admin accounts so Superadmins can
-- inspect and customize individual rights on Admin and other Superadmin accounts.
INSERT INTO public.app_user_right (user_id, right_code, granted_by)
SELECT u.user_id, r.right_code, 'migration'
FROM public.app_user u
CROSS JOIN public.app_right r
WHERE u.role IN ('superadmin', 'admin')
ON CONFLICT DO NOTHING;

-- Before this migration every employee could open Customers, Products, HR and Sales (read only).
INSERT INTO public.app_user_right (user_id, right_code, granted_by)
SELECT u.user_id, r.right_code, 'migration'
FROM public.app_user u
CROSS JOIN (VALUES ('customers.access'), ('products.access'), ('hr.access'), ('sales.access')) AS r(right_code)
WHERE u.role = 'employee'
ON CONFLICT DO NOTHING;
