-- Login seed for current employees.
-- The bcrypt hash below is for the temporary password: ChangeMe123!
-- Replace it before applying this seed in a production environment.

INSERT INTO public.department (deptcode, deptname, is_deleted)
VALUES
  ('ACT', 'Accounting', false),
  ('BR1', 'Sales Branch 1', false),
  ('BR2', 'Sales Branch 2', false),
  ('EXC', 'Executive', false),
  ('HRD', 'Human Resource', false),
  ('IT',  'Information Tech', false),
  ('PAY', 'Payroll', false),
  ('WHS', 'Warehouse', false),
  ('YNR', 'Yearner', false)
ON CONFLICT (deptcode) DO UPDATE
SET deptname = EXCLUDED.deptname,
    is_deleted = false;

INSERT INTO public.job (jobcode, jobdesc, is_deleted)
VALUES
  ('ACCT', 'Accountant', false),
  ('ANYS', 'Analyst', false),
  ('CLK1', 'Clerk 1', false),
  ('CLK2', 'Clerk 2', false),
  ('HRS',  'HR Specialist', false),
  ('MGR',  'Manager', false),
  ('PR1',  'Programmer 1', false),
  ('PR2',  'Programmer 2', false),
  ('PRES', 'President', false),
  ('SA1',  'Sales Agent 1', false),
  ('SA2',  'Sales Agent 2', false),
  ('SPVR', 'Supervisor', false),
  ('VP',   'Vice president', false),
  ('WMAN', 'Warehouse man', false)
ON CONFLICT (jobcode) DO UPDATE
SET jobdesc = EXCLUDED.jobdesc,
    is_deleted = false;

INSERT INTO public.employee (empno, lastname, firstname, gender, birthdate, hiredate, sepdate, email, is_deleted)
VALUES
  ('00001', 'Smith',         'John',          'M', '1985-02-20', '2010-05-11', NULL,         'smith.john@hope.inc',         false),
  ('00003', 'Smith',         'Jane',          'F', '1990-05-16', '2010-05-11', NULL,         'smith.jane@hope.inc',         false),
  ('00005', 'King',          'Don',           'M', '1986-02-14', '2010-06-23', NULL,         'king.don@hope.inc',           false),
  ('00007', 'Jenskin',       'Floyd',         'M', '1990-02-20', '2010-05-30', NULL,         'jenskin.floyd@hope.inc',      false),
  ('00009', 'Cerudo',        'Bambie',        'F', '1983-06-23', '2010-05-30', NULL,         'cerudo.bambie@hope.inc',      false),
  ('00011', 'Davis',         'Tom',           'M', '1989-12-16', '2010-06-30', NULL,         'davis.tom@hope.inc',          false),
  ('00013', 'Morris',        'Olive',         'F', '1991-07-21', '2010-06-30', NULL,         'morris.olive@hope.inc',       false),
  ('00015', 'Zulueta',       'Maggie',        'F', '1990-08-03', '2010-07-05', '2011-03-30', 'zulueta.maggie@hope.inc',     false),
  ('00017', 'Celestino',     'Nelia',         'F', '1984-10-24', '2010-07-05', NULL,         'celestino.nelia@hope.inc',    false),
  ('00019', 'Esperanza',     'Nehemiah',      'M', '1982-02-21', '2010-07-05', '2014-04-28', 'esperanza.nehemiah@hope.inc', false),
  ('00021', 'Manchester',    'Chelie',        'F', '1988-12-07', '2010-07-05', NULL,         'manchester.chelie@hope.inc',  false),
  ('00023', 'Kline',         'Nicholas',      'M', '1992-01-21', '2010-07-05', '2010-12-23', 'kline.nicholas@hope.inc',     false),
  ('00025', 'Macapagal',     'Ivy',           'F', '1992-04-30', '2010-07-05', NULL,         'macapagal.ivy@hope.inc',      false),
  ('00027', 'Blanche',       'Ernest',        'M', '1986-12-21', '2010-07-05', NULL,         'blanche.ernest@hope.inc',     false),
  ('00029', 'Chua',          'Evangeline',    'F', '1989-03-10', '2010-07-05', NULL,         'chua.evangeline@hope.inc',    false),
  ('00031', 'Lancaster',     'Greta',         'F', '1987-08-17', '2010-07-05', NULL,         'lancaster.greta@hope.inc',    false),
  ('00033', 'Parks',         'Nigel',         'M', '1993-06-23', '2010-07-05', NULL,         'parks.nigel@hope.inc',        false),
  ('00035', 'Carlston',      'Voltaire',      'F', '1985-06-12', '2010-07-21', NULL,         'carlston.voltaire@hope.inc',  false),
  ('00037', 'Silva',         'Yves',          'M', '1988-09-21', '2010-07-21', NULL,         'silva.yves@hope.inc',         false),
  ('00039', 'Geisert',       'William',       'M', '1980-03-03', '2010-07-21', NULL,         'geisert.william@hope.inc',    false),
  ('00041', 'Darwin',        'Helena',        'F', '1978-11-08', '2010-09-01', NULL,         'darwin.helena@hope.inc',      false),
  ('00043', 'Love',          'Queen',         'F', '1983-11-29', '2010-09-01', NULL,         'love.queen@hope.inc',         false),
  ('00045', 'Raven',         'Danny',         'M', '1984-02-15', '2010-12-03', NULL,         'raven.danny@hope.inc',        false),
  ('00047', 'Devito',        'Clint',         'M', '1981-06-07', '2010-12-03', NULL,         'devito.clint@hope.inc',       false),
  ('00049', 'Irving',        'Nancy',         'F', '1987-09-19', '2010-12-03', NULL,         'irving.nancy@hope.inc',       false),
  ('00051', 'Baltimore',     'Fergie',        'F', '1986-10-10', '2011-01-05', NULL,         'baltimore.fergie@hope.inc',   false),
  ('00053', 'Jones',         'Veronica',      'F', '1983-05-01', '2011-01-05', '2011-03-30', 'jones.veronica@hope.inc',     false),
  ('00055', 'Travis',        'Ursula',        'F', '1987-06-07', '2011-01-05', NULL,         'travis.ursula@hope.inc',      false),
  ('00057', 'Orleans',       'Sylvia',        'F', '1987-01-28', '2011-01-05', NULL,         'orleans.sylvia@hope.inc',     false),
  ('00059', 'Sy',            'Alice',         'F', '1984-08-13', '2011-01-05', '2011-04-20', 'sy.alice@hope.inc',           false),
  ('00061', 'De Leon',       'Girlie',        'F', '1983-07-27', '2011-01-05', NULL,         'deleon.girlie@hope.inc',      false),
  ('00063', 'Grant',         'Albert',        'M', '1979-05-05', '2011-01-05', NULL,         'grant.albert@hope.inc',       false),
  ('T0001', 'Gopio',         'Ryan',          'M', '2003-04-12', '2023-06-01', NULL,         'gopio.ryan@hope.inc',         false),
  ('T0002', 'Aguinaldo Jr.', 'Prince Nelson', 'M', '2003-08-19', '2023-06-01', NULL,         'aguinaldo.prince@hope.inc',   false),
  ('T0003', 'Montes',        'Alain Deiniel', 'M', '2003-11-05', '2023-06-01', NULL,         'montes.alain@hope.inc',       false),
  ('T0004', 'Silvestre',     'Kathryn Chloe', 'F', '2004-02-14', '2023-06-01', NULL,         'silvestre.kathryn@hope.inc',  false),
  ('T0005', 'Beroy',         'Marron',        'M', '2003-09-25', '2023-06-01', NULL,         'beroy.marron@hope.inc',       false)
ON CONFLICT (empno) DO UPDATE
SET lastname   = EXCLUDED.lastname,
    firstname  = EXCLUDED.firstname,
    gender     = COALESCE(public.employee.gender, EXCLUDED.gender),
    birthdate  = COALESCE(public.employee.birthdate, EXCLUDED.birthdate),
    hiredate   = COALESCE(public.employee.hiredate, EXCLUDED.hiredate),
    email      = EXCLUDED.email,
    is_deleted = false;

INSERT INTO public.jobhistory (empno, jobcode, effdate, salary, deptcode, is_deleted)
VALUES
  ('00001', 'PR1',  '2010-05-11',  48000.00, 'IT',  false),
  ('00001', 'PR2',  '2010-12-01',  50000.00, 'IT',  false),
  ('00001', 'ANYS', '2022-03-01',  62000.00, 'IT',  false),
  ('00001', 'MGR',  '2025-01-15',  75000.00, 'IT',  false),
  ('00003', 'PR2',  '2010-05-11',  50000.00, 'IT',  false),
  ('00003', 'ANYS', '2010-12-01',  55000.00, 'IT',  false),
  ('00003', 'SPVR', '2023-06-01',  64000.00, 'IT',  false),
  ('00005', 'SA1',  '2010-06-23',  36000.00, 'BR1', false),
  ('00005', 'SA2',  '2011-01-02',  38000.00, 'BR1', false),
  ('00005', 'SPVR', '2022-07-01',  46000.00, 'BR1', false),
  ('00005', 'MGR',  '2025-02-01',  65000.00, 'BR1', false),
  ('00007', 'ANYS', '2010-05-30',  55000.00, 'IT',  false),
  ('00007', 'MGR',  '2011-01-02',  60000.00, 'IT',  false),
  ('00007', 'VP',   '2011-03-31',  80000.00, 'IT',  false),
  ('00007', 'VP',   '2024-01-01',  95000.00, 'EXC', false),
  ('00009', 'ACCT', '2010-05-30',  50000.00, 'ACT', false),
  ('00009', 'MGR',  '2010-12-01',  60000.00, 'ACT', false),
  ('00009', 'VP',   '2023-01-15',  85000.00, 'ACT', false),
  ('00011', 'PRES', '2010-06-30', 100000.00, 'EXC', false),
  ('00011', 'PRES', '2024-01-01', 125000.00, 'EXC', false),
  ('00013', 'MGR',  '2010-06-30',  60000.00, 'BR1', false),
  ('00013', 'VP',   '2011-01-02',  80000.00, 'BR2', false),
  ('00013', 'VP',   '2011-03-01',  80000.00, 'BR1', false),
  ('00013', 'VP',   '2024-06-01',  92000.00, 'BR1', false),
  ('00015', 'SA1',  '2010-07-05',  36000.00, 'BR1', false),
  ('00017', 'SA1',  '2010-07-05',  36000.00, 'BR1', false),
  ('00017', 'SPVR', '2011-01-12',  40000.00, 'BR1', false),
  ('00017', 'MGR',  '2023-04-01',  62000.00, 'BR2', false),
  ('00019', 'SA1',  '2010-07-05',  36000.00, 'BR1', false),
  ('00019', 'SA2',  '2011-01-12',  38000.00, 'BR1', false),
  ('00021', 'SA1',  '2010-07-05',  36000.00, 'BR1', false),
  ('00021', 'SA2',  '2011-01-12',  38000.00, 'BR1', false),
  ('00021', 'SPVR', '2024-03-01',  45000.00, 'BR1', false),
  ('00023', 'MGR',  '2010-07-05',  60000.00, 'HRD', false),
  ('00025', 'SA1',  '2010-07-05',  36000.00, 'BR1', false),
  ('00025', 'SA2',  '2023-09-01',  41000.00, 'BR1', false),
  ('00027', 'SA1',  '2010-07-05',  36000.00, 'BR1', false),
  ('00027', 'SA2',  '2011-01-12',  38000.00, 'BR1', false),
  ('00029', 'SPVR', '2010-07-05',  40000.00, 'BR1', false),
  ('00029', 'MGR',  '2011-01-02',  60000.00, 'BR1', false),
  ('00031', 'WMAN', '2010-07-05',  35000.00, 'WHS', false),
  ('00031', 'WMAN', '2011-12-01',  40000.00, 'WHS', false),
  ('00031', 'SPVR', '2023-05-01',  48000.00, 'WHS', false),
  ('00033', 'WMAN', '2010-07-05',  35000.00, 'WHS', false),
  ('00035', 'ACCT', '2010-07-21',  50000.00, 'PAY', false),
  ('00035', 'MGR',  '2024-02-01',  66000.00, 'PAY', false),
  ('00037', 'CLK1', '2010-07-21',  34000.00, 'PAY', false),
  ('00037', 'CLK2', '2022-08-01',  38000.00, 'PAY', false),
  ('00039', 'CLK1', '2010-07-21',  34000.00, 'PAY', false),
  ('00039', 'CLK2', '2012-06-30',  35000.00, 'EXC', false),
  ('00041', 'SPVR', '2010-09-01',  40000.00, 'WHS', false),
  ('00041', 'MGR',  '2011-06-01',  60000.00, 'WHS', false),
  ('00043', 'CLK2', '2010-09-01',  35000.00, 'EXC', false),
  ('00043', 'SPVR', '2011-01-12',  35000.00, 'HRD', false),
  ('00043', 'SPVR', '2011-06-01',  35000.00, 'EXC', false),
  ('00043', 'HRS',  '2023-02-01',  52000.00, 'HRD', false),
  ('00045', 'SPVR', '2010-12-03',  40000.00, 'ACT', false),
  ('00047', 'CLK1', '2010-12-03',  34000.00, 'EXC', false),
  ('00047', 'CLK2', '2011-01-12',  35000.00, 'HRD', false),
  ('00047', 'HRS',  '2024-05-01',  50000.00, 'HRD', false),
  ('00049', 'MGR',  '2010-12-03',  60000.00, 'BR2', false),
  ('00051', 'SA1',  '2011-01-05',  36000.00, 'BR2', false),
  ('00053', 'SA1',  '2011-01-05',  36000.00, 'BR2', false),
  ('00055', 'SA1',  '2011-01-05',  36000.00, 'BR2', false),
  ('00055', 'SA2',  '2011-03-01',  38000.00, 'BR2', false),
  ('00057', 'SA1',  '2011-01-05',  36000.00, 'BR2', false),
  ('00057', 'PR1',  '2011-06-01',  48000.00, 'BR2', false),
  ('00059', 'SA1',  '2011-01-05',  36000.00, 'BR2', false),
  ('00061', 'SA1',  '2011-01-05',  36000.00, 'BR2', false),
  ('00063', 'SA2',  '2011-01-05',  38000.00, 'BR2', false),
  ('00063', 'SPVR', '2011-06-01',  40000.00, 'BR2', false),
  ('T0001', 'ANYS', '2024-01-15',  65000.00, 'IT',  false),
  ('T0001', 'MGR',  '2025-01-15',  85000.00, 'EXC', false),
  ('T0001', 'PRES', '2026-10-22',  0.00,     'YNR', false),
  ('T0002', 'PR1',  '2024-06-01',  72000.00, 'IT',  false),
  ('T0002', 'PR2',  '2025-06-01',  88000.00, 'IT',  false),
  ('T0002', 'PR1',  '2026-10-21', 100000.00, 'IT',  false),
  ('T0003', 'PR1',  '2024-03-01',  58000.00, 'IT',  false),
  ('T0003', 'ANYS', '2025-03-01',  74000.00, 'IT',  false),
  ('T0004', 'HRS',  '2024-02-01',  60000.00, 'HRD', false),
  ('T0004', 'SPVR', '2025-02-01',  78000.00, 'HRD', false),
  ('T0004', 'SPVR', '2026-10-22', 100000.00, 'YNR', false),
  ('T0005', 'PR1',  '2023-06-01',  56000.00, 'IT',  false),
  ('T0005', 'PR2',  '2024-06-01',  68000.00, 'IT',  false),
  ('T0005', 'ANYS', '2026-01-15',  82000.00, 'IT',  false)
ON CONFLICT (empno, jobcode, effdate) DO UPDATE
SET salary     = EXCLUDED.salary,
    deptcode   = EXCLUDED.deptcode,
    is_deleted = false;

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
