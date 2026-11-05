-- Migration: 20261102060000_issue_80_audit_log_immutability.sql
-- Description: [S4-DEV-08] Audit Log Immutability Enforcement & Prevention of Mutation (Closes #80)

-- ============================================================================
-- 1. TRIGGER FUNCTION TO PREVENT UPDATE OR DELETE ON AUDIT_LOG
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_block_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and append-only. Updates and deletions are strictly prohibited.'
      USING ERRCODE = 'P0001';
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_log'::regclass AND tgname = 'audit_log_prevent_mutation'
  ) THEN
    CREATE TRIGGER audit_log_prevent_mutation
      BEFORE UPDATE OR DELETE ON public.audit_log
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_block_audit_log_mutation();
  END IF;
END
$$;
