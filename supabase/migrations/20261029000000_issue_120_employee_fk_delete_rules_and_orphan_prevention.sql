-- 0. Ensure deptcode and jobcode are populated on employee from latest jobhistory entry before adding constraints
UPDATE public.employee e
SET deptcode = latest.deptcode,
    jobcode  = latest.jobcode
FROM (
  SELECT DISTINCT ON (empno) empno, deptcode, jobcode
  FROM public.jobhistory
  WHERE is_deleted = false
  ORDER BY empno, effdate DESC, jobcode DESC
) latest
WHERE e.empno = latest.empno
  AND (e.deptcode IS NULL OR e.jobcode IS NULL);

-- 1. Foreign Key between employee.deptcode and department.deptcode ON DELETE RESTRICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employee'::regclass
      AND conname = 'employee_deptcode_fkey'
  ) THEN
    ALTER TABLE public.employee
      ADD CONSTRAINT employee_deptcode_fkey
      FOREIGN KEY (deptcode) REFERENCES public.department(deptcode)
      ON DELETE RESTRICT;
  ELSE
    -- Ensure confdeltype is 'r' (RESTRICT)
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.employee'::regclass
        AND conname = 'employee_deptcode_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.employee DROP CONSTRAINT employee_deptcode_fkey;
      ALTER TABLE public.employee
        ADD CONSTRAINT employee_deptcode_fkey
        FOREIGN KEY (deptcode) REFERENCES public.department(deptcode)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 2. Foreign Key between employee.jobcode and job.jobcode ON DELETE RESTRICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employee'::regclass
      AND conname = 'employee_jobcode_fkey'
  ) THEN
    ALTER TABLE public.employee
      ADD CONSTRAINT employee_jobcode_fkey
      FOREIGN KEY (jobcode) REFERENCES public.job(jobcode)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.employee'::regclass
        AND conname = 'employee_jobcode_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.employee DROP CONSTRAINT employee_jobcode_fkey;
      ALTER TABLE public.employee
        ADD CONSTRAINT employee_jobcode_fkey
        FOREIGN KEY (jobcode) REFERENCES public.job(jobcode)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 3. Foreign Key between jobhistory.empno and employee.empno ON DELETE RESTRICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'jobhistory_empno_fkey'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT jobhistory_empno_fkey
      FOREIGN KEY (empno) REFERENCES public.employee(empno)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.jobhistory'::regclass
        AND conname = 'jobhistory_empno_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.jobhistory DROP CONSTRAINT jobhistory_empno_fkey;
      ALTER TABLE public.jobhistory
        ADD CONSTRAINT jobhistory_empno_fkey
        FOREIGN KEY (empno) REFERENCES public.employee(empno)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 4. Foreign Key between jobhistory.deptcode and department.deptcode ON DELETE RESTRICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'jobhistory_deptcode_fkey'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT jobhistory_deptcode_fkey
      FOREIGN KEY (deptcode) REFERENCES public.department(deptcode)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.jobhistory'::regclass
        AND conname = 'jobhistory_deptcode_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.jobhistory DROP CONSTRAINT jobhistory_deptcode_fkey;
      ALTER TABLE public.jobhistory
        ADD CONSTRAINT jobhistory_deptcode_fkey
        FOREIGN KEY (deptcode) REFERENCES public.department(deptcode)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 5. Foreign Key between jobhistory.jobcode and job.jobcode ON DELETE RESTRICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'jobhistory_jobcode_fkey'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT jobhistory_jobcode_fkey
      FOREIGN KEY (jobcode) REFERENCES public.job(jobcode)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.jobhistory'::regclass
        AND conname = 'jobhistory_jobcode_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.jobhistory DROP CONSTRAINT jobhistory_jobcode_fkey;
      ALTER TABLE public.jobhistory
        ADD CONSTRAINT jobhistory_jobcode_fkey
        FOREIGN KEY (jobcode) REFERENCES public.job(jobcode)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 6. Composite Unique Key on jobhistory (empno, effdate) preventing duplicate promotions on the same date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.jobhistory'::regclass
      AND conname = 'jobhistory_empno_effdate_key'
  ) THEN
    ALTER TABLE public.jobhistory
      ADD CONSTRAINT jobhistory_empno_effdate_key
      UNIQUE (empno, effdate);
  END IF;
END
$$;

-- 7. Ensure child-record trigger trg_check_children prevents soft-deleting department with active employees or jobhistory
CREATE OR REPLACE FUNCTION public.trg_check_children()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_n INT := 0;
BEGIN
    IF NOT (NEW.is_deleted AND NOT OLD.is_deleted) THEN
        RETURN NEW;
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'employee' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM public.jobhistory WHERE empno = OLD.empno AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM public.sales      WHERE empno = OLD.empno AND NOT is_deleted
            ) c;
        WHEN 'department' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM public.employee   WHERE deptcode = OLD.deptcode AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM public.jobhistory WHERE deptcode = OLD.deptcode AND NOT is_deleted
            ) c;
        WHEN 'job' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM public.employee   WHERE jobcode = OLD.jobcode AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM public.jobhistory WHERE jobcode = OLD.jobcode AND NOT is_deleted
            ) c;
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
            NULL;
    END CASE;

    IF v_n > 0 THEN
        RAISE EXCEPTION 'Cannot delete % row: % active related record(s) still exist.', TG_TABLE_NAME, v_n;
    END IF;
    RETURN NEW;
END;
$function$;

-- 8. Refresh views
CREATE OR REPLACE VIEW public.employee_active AS
SELECT *
FROM public.employee
WHERE is_deleted = false;

CREATE OR REPLACE VIEW public.job_history AS
SELECT *
FROM public.jobhistory;
