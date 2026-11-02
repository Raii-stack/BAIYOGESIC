-- Migration: 20261102010000_issue_76_sales_delete_rules_and_audit_log_queries.sql
-- Description: [S4-DBA-04 & S4-DBA-05] Sales Child Delete Integrity Rules & Audit Log Filter Queries (Closes #76)

-- ============================================================================
-- 1. FOREIGN KEY CONSTRAINTS WITH CASCADE & RESTRICT DELETE ACTIONS
-- ============================================================================

-- 1.1 Sales Transaction Header -> Customer (ON DELETE RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales'::regclass
      AND conname = 'sales_custno_fkey'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_custno_fkey
      FOREIGN KEY (custno) REFERENCES public.customer(custno)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.sales'::regclass
        AND conname = 'sales_custno_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.sales DROP CONSTRAINT sales_custno_fkey;
      ALTER TABLE public.sales
        ADD CONSTRAINT sales_custno_fkey
        FOREIGN KEY (custno) REFERENCES public.customer(custno)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 1.2 Sales Transaction Header -> Employee / Salesperson (ON DELETE RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sales'::regclass
      AND conname = 'sales_empno_fkey'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_empno_fkey
      FOREIGN KEY (empno) REFERENCES public.employee(empno)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.sales'::regclass
        AND conname = 'sales_empno_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.sales DROP CONSTRAINT sales_empno_fkey;
      ALTER TABLE public.sales
        ADD CONSTRAINT sales_empno_fkey
        FOREIGN KEY (empno) REFERENCES public.employee(empno)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 1.3 Sales Line Items -> Sales Header (ON DELETE CASCADE)
-- When a sales order is deleted, line items cascade deletion to prevent dangling line details.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.salesdetail'::regclass
      AND conname = 'salesdetail_transno_fkey'
  ) THEN
    ALTER TABLE public.salesdetail
      ADD CONSTRAINT salesdetail_transno_fkey
      FOREIGN KEY (transno) REFERENCES public.sales(transno)
      ON DELETE CASCADE;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.salesdetail'::regclass
        AND conname = 'salesdetail_transno_fkey'
        AND confdeltype <> 'c'
    ) THEN
      ALTER TABLE public.salesdetail DROP CONSTRAINT salesdetail_transno_fkey;
      ALTER TABLE public.salesdetail
        ADD CONSTRAINT salesdetail_transno_fkey
        FOREIGN KEY (transno) REFERENCES public.sales(transno)
        ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

-- 1.4 Sales Line Items -> Product Master (ON DELETE RESTRICT)
-- Prevents hard deleting a product that is referenced in sales transaction line items.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.salesdetail'::regclass
      AND conname = 'salesdetail_prodcode_fkey'
  ) THEN
    ALTER TABLE public.salesdetail
      ADD CONSTRAINT salesdetail_prodcode_fkey
      FOREIGN KEY (prodcode) REFERENCES public.product(prodcode)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.salesdetail'::regclass
        AND conname = 'salesdetail_prodcode_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.salesdetail DROP CONSTRAINT salesdetail_prodcode_fkey;
      ALTER TABLE public.salesdetail
        ADD CONSTRAINT salesdetail_prodcode_fkey
        FOREIGN KEY (prodcode) REFERENCES public.product(prodcode)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- 1.5 Payments -> Sales Header (ON DELETE RESTRICT)
-- CRITICAL INTEGRITY RULE: Payments can NEVER be orphaned. Sales orders with recorded payments
-- cannot be physically or logically deleted while payment records exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment'::regclass
      AND conname = 'payment_transno_fkey'
  ) THEN
    ALTER TABLE public.payment
      ADD CONSTRAINT payment_transno_fkey
      FOREIGN KEY (transno) REFERENCES public.sales(transno)
      ON DELETE RESTRICT;
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.payment'::regclass
        AND conname = 'payment_transno_fkey'
        AND confdeltype <> 'r'
    ) THEN
      ALTER TABLE public.payment DROP CONSTRAINT payment_transno_fkey;
      ALTER TABLE public.payment
        ADD CONSTRAINT payment_transno_fkey
        FOREIGN KEY (transno) REFERENCES public.sales(transno)
        ON DELETE RESTRICT;
    END IF;
  END IF;
END
$$;

-- ============================================================================
-- 2. DATABASE TRIGGERS FOR HARD-DELETE AND SOFT-DELETE INTEGRITY
-- ============================================================================

-- 2.1 Hard-Delete Blocking Triggers (trg_block_hard_delete)
CREATE OR REPLACE FUNCTION public.trg_block_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Hard delete/truncate not allowed on %. Use UPDATE ... SET is_deleted = true.', TG_TABLE_NAME;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.sales'::regclass AND tgname = 'sales_bd_block'
  ) THEN
    CREATE TRIGGER sales_bd_block
      BEFORE DELETE ON public.sales
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.salesdetail'::regclass AND tgname = 'salesdetail_bd_block'
  ) THEN
    CREATE TRIGGER salesdetail_bd_block
      BEFORE DELETE ON public.salesdetail
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.payment'::regclass AND tgname = 'payment_bd_block'
  ) THEN
    CREATE TRIGGER payment_bd_block
      BEFORE DELETE ON public.payment
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_hard_delete();
  END IF;
END
$$;

-- 2.2 Soft-Delete Child Integrity Check Trigger (trg_check_children)
-- Ensures sales with active payment records cannot be soft deleted.
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
            SELECT count(*) INTO v_n FROM public.payment
             WHERE transno = OLD.transno AND NOT is_deleted;
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.sales'::regclass AND tgname = 'sales_bu_check'
  ) THEN
    CREATE TRIGGER sales_bu_check
      BEFORE UPDATE ON public.sales
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_check_children();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.customer'::regclass AND tgname = 'customer_bu_check'
  ) THEN
    CREATE TRIGGER customer_bu_check
      BEFORE UPDATE ON public.customer
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_check_children();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.product'::regclass AND tgname = 'product_bu_check'
  ) THEN
    CREATE TRIGGER product_bu_check
      BEFORE UPDATE ON public.product
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_check_children();
  END IF;
END
$$;

-- 2.3 Sales Soft-Delete Cascading Trigger (trg_sales_cascade_soft_delete)
-- Automatically cascades soft-delete or restore to salesdetail lines
CREATE OR REPLACE FUNCTION public.trg_sales_cascade_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.is_deleted AND NOT OLD.is_deleted THEN
        UPDATE public.salesdetail
        SET is_deleted = true
        WHERE transno = OLD.transno AND NOT is_deleted;
    ELSIF NOT NEW.is_deleted AND OLD.is_deleted THEN
        UPDATE public.salesdetail
        SET is_deleted = false
        WHERE transno = OLD.transno AND is_deleted;
    END IF;
    RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.sales'::regclass AND tgname = 'sales_au_cascade_soft_delete'
  ) THEN
    CREATE TRIGGER sales_au_cascade_soft_delete
      AFTER UPDATE OF is_deleted ON public.sales
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_sales_cascade_soft_delete();
  END IF;
END
$$;

-- ============================================================================
-- 3. AUDIT LOG FILTERING QUERY PROCEDURES & COVERING INDEXES
-- ============================================================================

-- 3.1 Additional Multi-Filter Covering Indexes
CREATE INDEX IF NOT EXISTS audit_log_table_action_at_idx
  ON public.audit_log (table_name, action_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_action_at_idx
  ON public.audit_log (action_by, action_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_action_at_idx
  ON public.audit_log (action, action_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_composite_filter_idx
  ON public.audit_log (table_name, action, action_at DESC);

-- 3.2 Single-Roundtrip Window Pagination Query Function
CREATE OR REPLACE FUNCTION public.query_audit_logs(
    p_table_name varchar DEFAULT NULL,
    p_action varchar DEFAULT NULL,
    p_action_by varchar DEFAULT NULL,
    p_from timestamptz DEFAULT NULL,
    p_to timestamptz DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    audit_id bigint,
    table_name varchar,
    action varchar,
    record_key varchar,
    old_values jsonb,
    new_values jsonb,
    action_by varchar,
    action_at timestamptz,
    total_count integer,
    _total integer
)
LANGUAGE sql
STABLE
AS $function$
    SELECT
        al.audit_id,
        al.table_name::varchar,
        al.action::varchar,
        al.record_key::varchar,
        al.old_values,
        al.new_values,
        al.action_by::varchar,
        al.action_at,
        count(*) OVER()::integer AS total_count,
        count(*) OVER()::integer AS _total
    FROM public.audit_log al
    WHERE (p_table_name IS NULL OR al.table_name = p_table_name)
      AND (p_action IS NULL OR al.action = p_action)
      AND (p_action_by IS NULL OR al.action_by ILIKE '%' || p_action_by || '%' OR al.action_by = p_action_by)
      AND (p_from IS NULL OR al.action_at >= p_from)
      AND (p_to IS NULL OR al.action_at <= p_to)
    ORDER BY al.action_at DESC, al.audit_id DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0);
$function$;

-- Alias procedure filter_audit_logs matching specification contracts
CREATE OR REPLACE FUNCTION public.filter_audit_logs(
    p_table_name varchar DEFAULT NULL,
    p_action varchar DEFAULT NULL,
    p_action_by varchar DEFAULT NULL,
    p_from timestamptz DEFAULT NULL,
    p_to timestamptz DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    audit_id bigint,
    table_name varchar,
    action varchar,
    record_key varchar,
    old_values jsonb,
    new_values jsonb,
    action_by varchar,
    action_at timestamptz,
    total_count integer,
    _total integer
)
LANGUAGE sql
STABLE
AS $function$
    SELECT * FROM public.query_audit_logs(
        p_table_name,
        p_action,
        p_action_by,
        p_from,
        p_to,
        p_limit,
        p_offset
    );
$function$;

-- 3.3 Active Filtered Audit Log View
CREATE OR REPLACE VIEW public.audit_log_filtered_view AS
SELECT
    al.audit_id,
    al.table_name,
    al.action,
    al.record_key,
    al.old_values,
    al.new_values,
    al.action_by,
    al.action_at
FROM public.audit_log al
ORDER BY al.action_at DESC, al.audit_id DESC;
