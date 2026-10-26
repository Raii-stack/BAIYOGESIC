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

-- Idempotent CRM and inventory demo data for workflow and pagination testing.
INSERT INTO public.customer (custno, custname, address, payterm, is_deleted)
VALUES
  ('C1001', 'Apex Office Co', '12 Market Street', '30D', false),
  ('C1002', 'Beacon Foods', '18 Harbor Road', '45D', false),
  ('C1003', 'Cobalt Retail', '24 Central Avenue', 'COD', false),
  ('C1004', 'Delta Medical', '31 Riverside Drive', '60D', false),
  ('C1005', 'Elm Manufacturing', '42 Industrial Park', '30D', false),
  ('C1006', 'Fjord Logistics', '57 Warehouse Lane', '45D', false),
  ('C1007', 'Granite Hotels', '63 Summit Boulevard', 'COD', false),
  ('C1008', 'Horizon Schools', '75 College Road', '60D', false),
  ('C1009', 'Indigo Hardware', '86 Commerce Street', '30D', false),
  ('C1010', 'Juniper Farms', '91 Orchard Way', '45D', false),
  ('C1011', 'Keystone Energy', '105 Station Road', 'COD', false),
  ('C1012', 'Lighthouse Media', '117 Bayfront Street', '60D', false),
  ('C1013', 'Mariner Transport', '128 Port Avenue', '30D', false),
  ('C1014', 'Northwind Labs', '139 Science Drive', '45D', false),
  ('C1015', 'Orchard Pharmacy', '144 Garden Lane', 'COD', false),
  ('C1016', 'Pioneer Textiles', '156 Mill Road', '60D', false),
  ('C1017', 'Quartz Telecom', '167 Exchange Street', '30D', false),
  ('C1018', 'Redwood Builders', '178 Timber Avenue', '45D', false),
  ('C1019', 'Silverline Events', '189 Parkside Road', 'COD', false),
  ('C1020', 'Terrace Clinics', '201 Wellness Drive', '60D', false),
  ('C1021', 'Umber Studios', '214 Creative Lane', '30D', false),
  ('C1022', 'Valley Hardware', '225 Valley Road', '45D', false),
  ('C1023', 'Waypoint Travel', '237 Airport Boulevard', 'COD', false),
  ('C1024', 'Xenon Systems', '248 Technology Park', '60D', false),
  ('C1025', 'Yellowstone Supply', '259 Depot Street', '30D', false)
ON CONFLICT (custno) DO UPDATE
SET custname = EXCLUDED.custname,
    address = EXCLUDED.address,
    payterm = EXCLUDED.payterm,
    is_deleted = false;

INSERT INTO public.product (prodcode, description, unit, is_deleted)
VALUES
  ('P1001', 'Copy Paper A4', 'pkg', false),
  ('P1002', 'Ballpoint Pens', 'pkg', false),
  ('P1003', 'Desk Organizer', 'ea', false),
  ('P1004', 'Shipping Carton', 'ea', false),
  ('P1005', 'Thermal Labels', 'pkg', false),
  ('P1006', 'Safety Gloves', 'pkg', false),
  ('P1007', 'Cleaning Solution', 'ltr', false),
  ('P1008', 'Cable Ties', 'pkg', false),
  ('P1009', 'Steel Bracket', 'ea', false),
  ('P1010', 'Packing Tape', 'ea', false),
  ('P1011', 'Warehouse Cable', 'mtr', false),
  ('P1012', 'Storage Bin', 'ea', false)
ON CONFLICT (prodcode) DO UPDATE
SET description = EXCLUDED.description,
    unit = EXCLUDED.unit,
    is_deleted = false;

INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
VALUES
  ('2025-01-15', 'P1001', 18.50, false), ('2025-07-01', 'P1001', 19.25, false), ('2026-01-15', 'P1001', 20.00, false),
  ('2025-01-15', 'P1002', 6.75, false),  ('2025-07-01', 'P1002', 7.10, false),  ('2026-01-15', 'P1002', 7.50, false),
  ('2025-01-15', 'P1003', 12.00, false), ('2025-07-01', 'P1003', 12.75, false), ('2026-01-15', 'P1003', 13.50, false),
  ('2025-01-15', 'P1004', 2.25, false),  ('2025-07-01', 'P1004', 2.40, false),  ('2026-01-15', 'P1004', 2.60, false),
  ('2025-01-15', 'P1005', 9.50, false),  ('2025-07-01', 'P1005', 10.00, false), ('2026-01-15', 'P1005', 10.75, false),
  ('2025-01-15', 'P1006', 24.00, false), ('2025-07-01', 'P1006', 25.50, false), ('2026-01-15', 'P1006', 27.00, false),
  ('2025-01-15', 'P1007', 8.25, false),  ('2025-07-01', 'P1007', 8.75, false),  ('2026-01-15', 'P1007', 9.25, false),
  ('2025-01-15', 'P1008', 4.00, false),  ('2025-07-01', 'P1008', 4.35, false),  ('2026-01-15', 'P1008', 4.75, false),
  ('2025-01-15', 'P1009', 15.00, false), ('2025-07-01', 'P1009', 15.75, false), ('2026-01-15', 'P1009', 16.50, false),
  ('2025-01-15', 'P1010', 5.25, false),  ('2025-07-01', 'P1010', 5.50, false),  ('2026-01-15', 'P1010', 5.90, false),
  ('2025-01-15', 'P1011', 3.75, false),  ('2025-07-01', 'P1011', 4.10, false),  ('2026-01-15', 'P1011', 4.50, false),
  ('2025-01-15', 'P1012', 11.00, false), ('2025-07-01', 'P1012', 11.75, false), ('2026-01-15', 'P1012', 12.50, false)
ON CONFLICT (effdate, prodcode) DO UPDATE
SET unitprice = EXCLUDED.unitprice,
    is_deleted = false;
