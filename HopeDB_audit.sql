-- ============================================================================
-- HopeDB_audit.sql
-- HOPE, Inc. ERP — Base Schema Reference & Audit Trigger Architecture
--
-- Authoritative baseline DDL for the 10 core business tables and the
-- append-only audit trail log with audit stamping, soft-delete enforcement,
-- child-record protection, and trigger-level audit logging.
-- Fully idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 2. AUDIT HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Returns current application username or session user
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

-- Formats standard audit stamp: "<ACTION> <USER> <TIMESTAMP>"
CREATE OR REPLACE FUNCTION public.audit_stamp(p_action text)
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT p_action || ' ' || public.audit_user() || ' ' ||
         to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM');
$function$;

-- ----------------------------------------------------------------------------
-- 3. AUDIT LOG TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name varchar(30) NOT NULL,
  action varchar(7) NOT NULL,
  record_key varchar(60),
  old_values jsonb,
  new_values jsonb,
  action_by varchar(50) NOT NULL,
  action_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_check CHECK (action IN ('ADD', 'EDIT', 'DELETE', 'RESTORE'))
);

-- ----------------------------------------------------------------------------
-- 4. CORE BUSINESS TABLES
-- ----------------------------------------------------------------------------

-- 4.1 Department Table
CREATE TABLE IF NOT EXISTS public.department (
  deptcode varchar(3) PRIMARY KEY,
  deptname varchar(30),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60)
);

-- 4.2 Job Position Table
CREATE TABLE IF NOT EXISTS public.job (
  jobcode varchar(4) PRIMARY KEY,
  jobdesc varchar(30),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60)
);

-- 4.3 Employee Table
CREATE TABLE IF NOT EXISTS public.employee (
  empno varchar(5) PRIMARY KEY,
  lastname varchar(25),
  firstname varchar(25),
  gender char(1),
  birthdate date,
  hiredate date,
  sepdate date,
  email text,
  deptcode varchar(4),
  jobcode varchar(4),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60),
  CONSTRAINT gender_ck CHECK (gender IN ('M', 'F'))
);

-- 4.4 Job History Table (Effective-dated compensation & assignments)
CREATE TABLE IF NOT EXISTS public.jobhistory (
  empno varchar(5) NOT NULL REFERENCES public.employee(empno),
  jobcode varchar(4) NOT NULL REFERENCES public.job(jobcode),
  effdate date NOT NULL,
  salary numeric(10,2),
  deptcode varchar(4) REFERENCES public.department(deptcode),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60),
  PRIMARY KEY (empno, jobcode, effdate),
  CONSTRAINT salary_ck CHECK (salary >= 0.0)
);

-- 4.5 Customer Account Table
CREATE TABLE IF NOT EXISTS public.customer (
  custno varchar(5) PRIMARY KEY,
  custname varchar(30),
  address varchar(50),
  payterm varchar(3),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60),
  CONSTRAINT pay_ck CHECK (payterm IN ('COD', '30D', '45D', '60D'))
);

-- 4.6 Product Catalog Table
CREATE TABLE IF NOT EXISTS public.product (
  prodcode varchar(6) PRIMARY KEY,
  description varchar(30),
  unit varchar(3),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60),
  CONSTRAINT unit_ck CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'))
);

-- 4.7 Product Price History (Effective-dated pricing)
CREATE TABLE IF NOT EXISTS public.pricehist (
  effdate date NOT NULL,
  prodcode varchar(6) NOT NULL REFERENCES public.product(prodcode),
  unitprice numeric(10,2),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60),
  PRIMARY KEY (effdate, prodcode),
  CONSTRAINT unitp_ck CHECK (unitprice > 0.0)
);

-- 4.8 Sales Order Header Table
CREATE TABLE IF NOT EXISTS public.sales (
  transno varchar(8) PRIMARY KEY,
  salesdate date,
  custno varchar(5) REFERENCES public.customer(custno),
  empno varchar(5) REFERENCES public.employee(empno),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60)
);

-- 4.9 Sales Order Line Items Table
CREATE TABLE IF NOT EXISTS public.salesdetail (
  transno varchar(8) NOT NULL REFERENCES public.sales(transno),
  prodcode varchar(6) NOT NULL REFERENCES public.product(prodcode),
  quantity numeric(10,2),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60),
  PRIMARY KEY (transno, prodcode),
  CONSTRAINT quantity_ck CHECK (quantity >= 0.0)
);

-- 4.10 Official Payment Receipts Table
CREATE TABLE IF NOT EXISTS public.payment (
  orno varchar(8) PRIMARY KEY,
  paydate date,
  amount numeric(10,2),
  payment_method varchar(20) NOT NULL DEFAULT 'Cash',
  transno varchar(8) REFERENCES public.sales(transno),
  is_deleted boolean NOT NULL DEFAULT false,
  stamp varchar(60),
  CONSTRAINT payment_amount_ck CHECK (amount > 0.0),
  CONSTRAINT payment_payment_method_check CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Check', 'Card', 'E-wallet'))
);

-- ----------------------------------------------------------------------------
-- 5. TRIGGER PROCEDURES & AUTOMATION
-- ----------------------------------------------------------------------------

-- 5.1 Maintain Audit Stamp on Insert/Update
CREATE OR REPLACE FUNCTION public.trg_set_stamp()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_action TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'ADD';
    ELSE
        v_action := CASE
                      WHEN NOT OLD.is_deleted AND NEW.is_deleted THEN 'DELETE'
                      WHEN OLD.is_deleted AND NOT NEW.is_deleted THEN 'RESTORE'
                      ELSE 'EDIT'
                    END;
    END IF;
    NEW.stamp := public.audit_stamp(v_action);
    RETURN NEW;
END;
$function$;

-- 5.2 Block Hard Deletions (Enforce Soft-Delete Policy)
CREATE OR REPLACE FUNCTION public.trg_block_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Hard delete/truncate not allowed on %. Use UPDATE ... SET is_deleted = true.', TG_TABLE_NAME
      USING ERRCODE = '55000';
END;
$function$;

-- 5.3 Enforce Referential Child Record Guards Before Soft-Deleting Parents
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
            NULL;
    END CASE;

    IF v_n > 0 THEN
        RAISE EXCEPTION 'Cannot delete % row: % active related record(s) still exist.', TG_TABLE_NAME, v_n
          USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$function$;

-- 5.4 Capture Changes to audit_log
CREATE OR REPLACE FUNCTION public.trg_audit_log()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_action TEXT;
    v_key    TEXT;
BEGIN
    SELECT string_agg(to_jsonb(NEW) ->> k, '|' ORDER BY ord)
      INTO v_key
      FROM unnest(TG_ARGV) WITH ORDINALITY AS t(k, ord);

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (table_name, action, record_key, old_values, new_values, action_by)
        VALUES (TG_TABLE_NAME, 'ADD', v_key, NULL, to_jsonb(NEW), public.audit_user());
    ELSE
        IF (to_jsonb(OLD) - 'stamp') = (to_jsonb(NEW) - 'stamp') THEN
            RETURN NULL;
        END IF;
        v_action := CASE
                      WHEN NOT OLD.is_deleted AND NEW.is_deleted THEN 'DELETE'
                      WHEN OLD.is_deleted AND NOT NEW.is_deleted THEN 'RESTORE'
                      ELSE 'EDIT'
                    END;
        INSERT INTO public.audit_log (table_name, action, record_key, old_values, new_values, action_by)
        VALUES (TG_TABLE_NAME, v_action, v_key, to_jsonb(OLD), to_jsonb(NEW), public.audit_user());
    END IF;
    RETURN NULL;
END;
$function$;

-- 5.5 Guard audit_log from Modification or Deletion (Immutability)
CREATE OR REPLACE FUNCTION public.trg_protect_audit_log()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and append-only. Updates and deletions are strictly prohibited.'
      USING ERRCODE = 'P0001';
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. ATTACH TRIGGERS IDEMPOTENTLY
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Department triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'department_biu_stamp') THEN
    CREATE TRIGGER department_biu_stamp BEFORE INSERT OR UPDATE ON public.department FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'department_bd_block') THEN
    CREATE TRIGGER department_bd_block BEFORE DELETE ON public.department FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'department_bu_check') THEN
    CREATE TRIGGER department_bu_check BEFORE UPDATE ON public.department FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'department_aiu_audit') THEN
    CREATE TRIGGER department_aiu_audit AFTER INSERT OR UPDATE ON public.department FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('deptcode');
  END IF;

  -- Job triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'job_biu_stamp') THEN
    CREATE TRIGGER job_biu_stamp BEFORE INSERT OR UPDATE ON public.job FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'job_bd_block') THEN
    CREATE TRIGGER job_bd_block BEFORE DELETE ON public.job FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'job_bu_check') THEN
    CREATE TRIGGER job_bu_check BEFORE UPDATE ON public.job FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'job_aiu_audit') THEN
    CREATE TRIGGER job_aiu_audit AFTER INSERT OR UPDATE ON public.job FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('jobcode');
  END IF;

  -- Employee triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employee_biu_stamp') THEN
    CREATE TRIGGER employee_biu_stamp BEFORE INSERT OR UPDATE ON public.employee FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employee_bd_block') THEN
    CREATE TRIGGER employee_bd_block BEFORE DELETE ON public.employee FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employee_bu_check') THEN
    CREATE TRIGGER employee_bu_check BEFORE UPDATE ON public.employee FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employee_aiu_audit') THEN
    CREATE TRIGGER employee_aiu_audit AFTER INSERT OR UPDATE ON public.employee FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('empno');
  END IF;

  -- JobHistory triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jobhistory_biu_stamp') THEN
    CREATE TRIGGER jobhistory_biu_stamp BEFORE INSERT OR UPDATE ON public.jobhistory FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jobhistory_bd_block') THEN
    CREATE TRIGGER jobhistory_bd_block BEFORE DELETE ON public.jobhistory FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jobhistory_bu_check') THEN
    CREATE TRIGGER jobhistory_bu_check BEFORE UPDATE ON public.jobhistory FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'jobhistory_aiu_audit') THEN
    CREATE TRIGGER jobhistory_aiu_audit AFTER INSERT OR UPDATE ON public.jobhistory FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('empno', 'jobcode', 'effdate');
  END IF;

  -- Customer triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_biu_stamp') THEN
    CREATE TRIGGER customer_biu_stamp BEFORE INSERT OR UPDATE ON public.customer FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_bd_block') THEN
    CREATE TRIGGER customer_bd_block BEFORE DELETE ON public.customer FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_bu_check') THEN
    CREATE TRIGGER customer_bu_check BEFORE UPDATE ON public.customer FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_aiu_audit') THEN
    CREATE TRIGGER customer_aiu_audit AFTER INSERT OR UPDATE ON public.customer FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('custno');
  END IF;

  -- Product triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_biu_stamp') THEN
    CREATE TRIGGER product_biu_stamp BEFORE INSERT OR UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_bd_block') THEN
    CREATE TRIGGER product_bd_block BEFORE DELETE ON public.product FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_bu_check') THEN
    CREATE TRIGGER product_bu_check BEFORE UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_aiu_audit') THEN
    CREATE TRIGGER product_aiu_audit AFTER INSERT OR UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('prodcode');
  END IF;

  -- PriceHist triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pricehist_biu_stamp') THEN
    CREATE TRIGGER pricehist_biu_stamp BEFORE INSERT OR UPDATE ON public.pricehist FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pricehist_bd_block') THEN
    CREATE TRIGGER pricehist_bd_block BEFORE DELETE ON public.pricehist FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pricehist_bu_check') THEN
    CREATE TRIGGER pricehist_bu_check BEFORE UPDATE ON public.pricehist FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pricehist_aiu_audit') THEN
    CREATE TRIGGER pricehist_aiu_audit AFTER INSERT OR UPDATE ON public.pricehist FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('prodcode', 'effdate');
  END IF;

  -- Sales triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sales_biu_stamp') THEN
    CREATE TRIGGER sales_biu_stamp BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sales_bd_block') THEN
    CREATE TRIGGER sales_bd_block BEFORE DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sales_bu_check') THEN
    CREATE TRIGGER sales_bu_check BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.trg_check_children();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sales_aiu_audit') THEN
    CREATE TRIGGER sales_aiu_audit AFTER INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('transno');
  END IF;

  -- SalesDetail triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'salesdetail_biu_stamp') THEN
    CREATE TRIGGER salesdetail_biu_stamp BEFORE INSERT OR UPDATE ON public.salesdetail FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'salesdetail_bd_block') THEN
    CREATE TRIGGER salesdetail_bd_block BEFORE DELETE ON public.salesdetail FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'salesdetail_aiu_audit') THEN
    CREATE TRIGGER salesdetail_aiu_audit AFTER INSERT OR UPDATE ON public.salesdetail FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('transno', 'prodcode');
  END IF;

  -- Payment triggers
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payment_biu_stamp') THEN
    CREATE TRIGGER payment_biu_stamp BEFORE INSERT OR UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payment_bd_block') THEN
    CREATE TRIGGER payment_bd_block BEFORE DELETE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'payment_aiu_audit') THEN
    CREATE TRIGGER payment_aiu_audit AFTER INSERT OR UPDATE ON public.payment FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('orno');
  END IF;

  -- Audit Log Immutability trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_log_protect_row') THEN
    CREATE TRIGGER audit_log_protect_row BEFORE UPDATE OR DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.trg_protect_audit_log();
  END IF;
END
$$;
