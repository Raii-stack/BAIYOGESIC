-- Issue #114 [S3-DEV-06]: Employee Job History Promotion & Transfer Tracking
-- Ensures employee master table tracks current deptcode and jobcode alongside jobhistory timeline
-- and provides the public.job_history view alias for compatibility.

ALTER TABLE public.employee
  ADD COLUMN IF NOT EXISTS deptcode character varying(4),
  ADD COLUMN IF NOT EXISTS jobcode character varying(4);

-- Backfill current deptcode and jobcode on employee master rows from latest jobhistory entry
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
  AND (e.deptcode IS DISTINCT FROM latest.deptcode OR e.jobcode IS DISTINCT FROM latest.jobcode);

-- Refresh active employee view to include deptcode and jobcode columns
CREATE OR REPLACE VIEW public.employee_active AS
SELECT *
FROM public.employee
WHERE is_deleted = false;

-- Provide job_history view alias over public.jobhistory
CREATE OR REPLACE VIEW public.job_history AS
SELECT *
FROM public.jobhistory;
