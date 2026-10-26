-- Issue #65 [S3-DBA-04 & S3-DBA-05]: HR Child-Record Delete Constraints and Personnel Demo Data

-- 1. Active HR Views
CREATE OR REPLACE VIEW public.department_active AS
SELECT *
FROM public.department
WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.job_active AS
SELECT *
FROM public.job
WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.employee_active AS
SELECT *
FROM public.employee
WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.jobhistory_active AS
SELECT *
FROM public.jobhistory
WHERE is_deleted = false;

-- 2. Foreign Key & Check Constraints Integrity Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employee'::regclass
      AND conname = 'gender_ck'
  ) THEN
    ALTER TABLE public.employee
      ADD CONSTRAINT gender_ck CHECK (gender = ANY (ARRAY['M'::bpchar, 'F'::bpchar]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'salary_ck'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT salary_ck CHECK (salary >= 0.0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'jobhistory_empno_fkey'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT jobhistory_empno_fkey
      FOREIGN KEY (empno) REFERENCES public.employee(empno);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'jobhistory_jobcode_fkey'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT jobhistory_jobcode_fkey
      FOREIGN KEY (jobcode) REFERENCES public.job(jobcode);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'jobhistory_deptcode_fkey'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT jobhistory_deptcode_fkey
      FOREIGN KEY (deptcode) REFERENCES public.department(deptcode);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales'::regclass
      AND conname = 'sales_empno_fkey'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_empno_fkey
      FOREIGN KEY (empno) REFERENCES public.employee(empno);
  END IF;
END
$$;

-- 3. Trigger Functions for Hard-Delete Blocking and Child-Record Delete Constraints
CREATE OR REPLACE FUNCTION public.trg_block_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Hard delete/truncate not allowed on %. Use UPDATE ... SET is_deleted = true.', TG_TABLE_NAME;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_check_children()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_n INT := 0;
BEGIN
    IF NOT (NEW.is_deleted AND NOT OLD.is_deleted) THEN
        RETURN NEW;                                  -- not a soft delete
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'employee' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM public.jobhistory WHERE empno = OLD.empno AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM public.sales      WHERE empno = OLD.empno AND NOT is_deleted
            ) c;
        WHEN 'department' THEN
            SELECT count(*) INTO v_n
            FROM public.jobhistory jh
            LEFT JOIN public.employee e ON e.empno = jh.empno
            WHERE jh.deptcode = OLD.deptcode
              AND (NOT jh.is_deleted OR (e.empno IS NOT NULL AND NOT e.is_deleted));
        WHEN 'job' THEN
            SELECT count(*) INTO v_n
            FROM public.jobhistory jh
            LEFT JOIN public.employee e ON e.empno = jh.empno
            WHERE jh.jobcode = OLD.jobcode
              AND (NOT jh.is_deleted OR (e.empno IS NOT NULL AND NOT e.is_deleted));
        WHEN 'customer' THEN
            SELECT count(*) INTO v_n FROM public.sales
             WHERE custno = OLD.custno AND NOT is_deleted;
        WHEN 'sales' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM public.salesdetail WHERE transno = OLD.transno AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM public.payment     WHERE transno = OLD.transno AND NOT is_deleted
            ) c;
        WHEN 'product' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM public.salesdetail WHERE prodcode = OLD.prodcode AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM public.pricehist   WHERE prodcode = OLD.prodcode AND NOT is_deleted
            ) c;
        ELSE
            NULL;                                    -- child tables: nothing to check
    END CASE;

    IF v_n > 0 THEN
        RAISE EXCEPTION 'Cannot delete % row: % active related record(s) still exist.', TG_TABLE_NAME, v_n;
    END IF;
    RETURN NEW;
END;
$function$;

-- Ensure HR delete-constraint triggers are attached idempotently without destructive DROP
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.department'::regclass AND tgname = 'department_bd_block'
  ) THEN
    CREATE TRIGGER department_bd_block
      BEFORE DELETE ON public.department
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.department'::regclass AND tgname = 'department_bu_check'
  ) THEN
    CREATE TRIGGER department_bu_check
      BEFORE UPDATE ON public.department
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_check_children();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.job'::regclass AND tgname = 'job_bd_block'
  ) THEN
    CREATE TRIGGER job_bd_block
      BEFORE DELETE ON public.job
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.job'::regclass AND tgname = 'job_bu_check'
  ) THEN
    CREATE TRIGGER job_bu_check
      BEFORE UPDATE ON public.job
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_check_children();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.employee'::regclass AND tgname = 'employee_bd_block'
  ) THEN
    CREATE TRIGGER employee_bd_block
      BEFORE DELETE ON public.employee
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.employee'::regclass AND tgname = 'employee_bu_check'
  ) THEN
    CREATE TRIGGER employee_bu_check
      BEFORE UPDATE ON public.employee
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_check_children();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.jobhistory'::regclass AND tgname = 'jobhistory_bd_block'
  ) THEN
    CREATE TRIGGER jobhistory_bd_block
      BEFORE DELETE ON public.jobhistory
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.jobhistory'::regclass AND tgname = 'jobhistory_bu_check'
  ) THEN
    CREATE TRIGGER jobhistory_bu_check
      BEFORE UPDATE ON public.jobhistory
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_check_children();
  END IF;
END
$$;

-- 4. Seed HR Demo Data: Departments, Job Levels, Personnel, and Multi-Year Job Histories
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
  ('00001', 'Smith',      'John',          'M', '1985-02-20', '2010-05-11', NULL,         'smith.john@hope.inc',        false),
  ('00003', 'Smith',      'Jane',          'F', '1990-05-16', '2010-05-11', NULL,         'smith.jane@hope.inc',        false),
  ('00005', 'King',       'Don',           'M', '1986-02-14', '2010-06-23', NULL,         'king.don@hope.inc',          false),
  ('00007', 'Jenskin',    'Floyd',         'M', '1990-02-20', '2010-05-30', NULL,         'jenskin.floyd@hope.inc',     false),
  ('00009', 'Cerudo',     'Bambie',        'F', '1983-06-23', '2010-05-30', NULL,         'cerudo.bambie@hope.inc',     false),
  ('00011', 'Davis',      'Tom',           'M', '1989-12-16', '2010-06-30', NULL,         'davis.tom@hope.inc',         false),
  ('00013', 'Morris',     'Olive',         'F', '1991-07-21', '2010-06-30', NULL,         'morris.olive@hope.inc',      false),
  ('00015', 'Zulueta',    'Maggie',        'F', '1990-08-03', '2010-07-05', '2011-03-30', 'zulueta.maggie@hope.inc',    false),
  ('00017', 'Celestino',  'Nelia',         'F', '1984-10-24', '2010-07-05', NULL,         'celestino.nelia@hope.inc',   false),
  ('00019', 'Esperanza',  'Nehemiah',      'M', '1982-02-21', '2010-07-05', '2014-04-28', 'esperanza.nehemiah@hope.inc',false),
  ('00021', 'Manchester', 'Chelie',        'F', '1988-12-07', '2010-07-05', NULL,         'manchester.chelie@hope.inc', false),
  ('00023', 'Kline',      'Nicholas',      'M', '1992-01-21', '2010-07-05', '2010-12-23', 'kline.nicholas@hope.inc',    false),
  ('00025', 'Macapagal',  'Ivy',           'F', '1992-04-30', '2010-07-05', NULL,         'macapagal.ivy@hope.inc',     false),
  ('00027', 'Blanche',    'Ernest',        'M', '1986-12-21', '2010-07-05', NULL,         'blanche.ernest@hope.inc',    false),
  ('00029', 'Chua',       'Evangeline',    'F', '1989-03-10', '2010-07-05', NULL,         'chua.evangeline@hope.inc',   false),
  ('00031', 'Lancaster',  'Greta',         'F', '1987-08-17', '2010-07-05', NULL,         'lancaster.greta@hope.inc',   false),
  ('00033', 'Parks',      'Nigel',         'M', '1993-06-23', '2010-07-05', NULL,         'parks.nigel@hope.inc',       false),
  ('00035', 'Carlston',   'Voltaire',      'F', '1985-06-12', '2010-07-21', NULL,         'carlston.voltaire@hope.inc', false),
  ('00037', 'Silva',      'Yves',          'M', '1988-09-21', '2010-07-21', NULL,         'silva.yves@hope.inc',        false),
  ('00039', 'Geisert',    'William',       'M', '1980-03-03', '2010-07-21', NULL,         'geisert.william@hope.inc',   false),
  ('00041', 'Darwin',     'Helena',        'F', '1978-11-08', '2010-09-01', NULL,         'darwin.helena@hope.inc',     false),
  ('00043', 'Love',       'Queen',         'F', '1983-11-29', '2010-09-01', NULL,         'love.queen@hope.inc',        false),
  ('00045', 'Raven',      'Danny',         'M', '1984-02-15', '2010-12-03', NULL,         'raven.danny@hope.inc',       false),
  ('00047', 'Devito',     'Clint',         'M', '1981-06-07', '2010-12-03', NULL,         'devito.clint@hope.inc',      false),
  ('00049', 'Irving',     'Nancy',         'F', '1987-09-19', '2010-12-03', NULL,         'irving.nancy@hope.inc',      false),
  ('00051', 'Baltimore',  'Fergie',        'F', '1986-10-10', '2011-01-05', NULL,         'baltimore.fergie@hope.inc',  false),
  ('00053', 'Jones',      'Veronica',      'F', '1983-05-01', '2011-01-05', '2011-03-30', 'jones.veronica@hope.inc',    false),
  ('00055', 'Travis',     'Ursula',        'F', '1987-06-07', '2011-01-05', NULL,         'travis.ursula@hope.inc',     false),
  ('00057', 'Orleans',    'Sylvia',        'F', '1987-01-28', '2011-01-05', NULL,         'orleans.sylvia@hope.inc',    false),
  ('00059', 'Sy',         'Alice',         'F', '1984-08-13', '2011-01-05', '2011-04-20', 'sy.alice@hope.inc',          false),
  ('00061', 'De Leon',    'Girlie',        'F', '1983-07-27', '2011-01-05', NULL,         'deleon.girlie@hope.inc',     false),
  ('00063', 'Grant',      'Albert',        'M', '1979-05-05', '2011-01-05', NULL,         'grant.albert@hope.inc',      false),
  ('T0001', 'Gopio',      'Ryan',          'M', '2003-04-12', '2023-06-01', NULL,         'gopio.ryan@hope.inc',        false),
  ('T0002', 'Aguinaldo Jr.', 'Prince Nelson', 'M', '2003-08-19', '2023-06-01', NULL,      'aguinaldo.prince@hope.inc',  false),
  ('T0003', 'Montes',     'Alain Deiniel', 'M', '2003-11-05', '2023-06-01', NULL,         'montes.alain@hope.inc',      false),
  ('T0004', 'Silvestre',  'Kathryn Chloe', 'F', '2004-02-14', '2023-06-01', NULL,         'silvestre.kathryn@hope.inc', false),
  ('T0005', 'Beroy',      'Marron',        'M', '2003-09-25', '2023-06-01', NULL,         'beroy.marron@hope.inc',      false)
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
