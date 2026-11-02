-- Migration: 20261102070000_issue_81_rebuild_verification_and_dr_support.sql
-- Description: [S4-DBA-06] Database Rebuild Verification, PITR & Disaster Recovery Support (Closes #81)

-- ============================================================================
-- 1. COVERING INDEXES ON COMPOSITE QUERY KEYS
-- ============================================================================

-- 1.1 Covering index for Employee Job History timeline lookups: (empno, effdate DESC)
CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_covering_idx
  ON public.jobhistory (empno, effdate DESC)
  INCLUDE (jobcode, deptcode, salary, is_deleted);

-- 1.2 Covering index for Product Price History effective date lookups: (prodcode, effdate DESC)
CREATE INDEX IF NOT EXISTS pricehist_prodcode_effdate_covering_idx
  ON public.pricehist (prodcode, effdate DESC)
  INCLUDE (unitprice, is_deleted);

-- ============================================================================
-- 2. FOREIGN KEY RESTRICT RULES FOR ORPHAN PREVENTION
-- ============================================================================

-- 2.1 Job History -> Employee (ON DELETE RESTRICT)
DO $$
BEGIN
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
END
$$;

-- 2.2 Job History -> Job Position (ON DELETE RESTRICT)
DO $$
BEGIN
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
END
$$;

-- 2.3 Job History -> Department (ON DELETE RESTRICT)
DO $$
BEGIN
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
END
$$;

-- 2.4 Price History -> Product (ON DELETE RESTRICT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.pricehist'::regclass
      AND conname = 'pricehist_prodcode_fkey'
      AND confdeltype <> 'r'
  ) THEN
    ALTER TABLE public.pricehist DROP CONSTRAINT pricehist_prodcode_fkey;
    ALTER TABLE public.pricehist
      ADD CONSTRAINT pricehist_prodcode_fkey
      FOREIGN KEY (prodcode) REFERENCES public.product(prodcode)
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- ============================================================================
-- 3. DISASTER RECOVERY & SCHEMA INTEGRITY VERIFICATION PROCEDURE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_database_integrity()
RETURNS TABLE (
    check_category varchar,
    check_target varchar,
    status varchar,
    details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_orphan_count integer;
BEGIN
    -- Check 1: Jobhistory Orphan Check (empno)
    SELECT count(*)::integer INTO v_orphan_count
    FROM public.jobhistory jh
    WHERE NOT EXISTS (SELECT 1 FROM public.employee e WHERE e.empno = jh.empno);

    check_category := 'FOREIGN_KEY_INTEGRITY';
    check_target := 'jobhistory -> employee';
    IF v_orphan_count = 0 THEN
        status := 'PASSED';
        details := '0 orphan records found';
    ELSE
        status := 'FAILED';
        details := v_orphan_count || ' orphan record(s) detected';
    END IF;
    RETURN NEXT;

    -- Check 2: Sales Orphan Check (custno)
    SELECT count(*)::integer INTO v_orphan_count
    FROM public.sales s
    WHERE NOT EXISTS (SELECT 1 FROM public.customer c WHERE c.custno = s.custno);

    check_category := 'FOREIGN_KEY_INTEGRITY';
    check_target := 'sales -> customer';
    IF v_orphan_count = 0 THEN
        status := 'PASSED';
        details := '0 orphan records found';
    ELSE
        status := 'FAILED';
        details := v_orphan_count || ' orphan record(s) detected';
    END IF;
    RETURN NEXT;

    -- Check 3: Sales Detail Orphan Check (transno)
    SELECT count(*)::integer INTO v_orphan_count
    FROM public.salesdetail sd
    WHERE NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.transno = sd.transno);

    check_category := 'FOREIGN_KEY_INTEGRITY';
    check_target := 'salesdetail -> sales';
    IF v_orphan_count = 0 THEN
        status := 'PASSED';
        details := '0 orphan records found';
    ELSE
        status := 'FAILED';
        details := v_orphan_count || ' orphan record(s) detected';
    END IF;
    RETURN NEXT;

    -- Check 4: Payment Orphan Check (transno)
    SELECT count(*)::integer INTO v_orphan_count
    FROM public.payment p
    WHERE NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.transno = p.transno);

    check_category := 'FOREIGN_KEY_INTEGRITY';
    check_target := 'payment -> sales';
    IF v_orphan_count = 0 THEN
        status := 'PASSED';
        details := '0 orphan records found';
    ELSE
        status := 'FAILED';
        details := v_orphan_count || ' orphan record(s) detected';
    END IF;
    RETURN NEXT;

    -- Check 5: Covering Indexes Verification
    check_category := 'INDEX_INTEGRITY';
    check_target := 'jobhistory (empno, effdate DESC)';
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'jobhistory'
          AND indexname IN ('jobhistory_empno_effdate_covering_idx', 'jobhistory_empno_effdate_is_deleted_idx')
    ) THEN
        status := 'PASSED';
        details := 'Covering index verified on jobhistory (empno, effdate DESC)';
    ELSE
        status := 'FAILED';
        details := 'Missing covering index on jobhistory (empno, effdate DESC)';
    END IF;
    RETURN NEXT;

    check_category := 'INDEX_INTEGRITY';
    check_target := 'pricehist (prodcode, effdate DESC)';
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'pricehist'
          AND indexname IN ('pricehist_prodcode_effdate_covering_idx', 'pricehist_prodcode_effdate_idx', 'pricehist_active_lookup_idx')
    ) THEN
        status := 'PASSED';
        details := 'Covering index verified on pricehist (prodcode, effdate DESC)';
    ELSE
        status := 'FAILED';
        details := 'Missing covering index on pricehist (prodcode, effdate DESC)';
    END IF;
    RETURN NEXT;

    -- Check 6: Audit Log Immutability
    check_category := 'AUDIT_SECURITY';
    check_target := 'audit_log immutability trigger';
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.audit_log'::regclass
          AND tgname IN ('audit_log_prevent_mutation', 'audit_log_protect_row')
    ) THEN
        status := 'PASSED';
        details := 'Append-only immutability trigger verified on audit_log';
    ELSE
        status := 'FAILED';
        details := 'Missing immutability trigger on audit_log';
    END IF;
    RETURN NEXT;
END;
$function$;
