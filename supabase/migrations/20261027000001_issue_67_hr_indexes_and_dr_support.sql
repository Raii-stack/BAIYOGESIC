-- Issue #67 [S3-DBA-06]: HR Database Indexes and Backup/Restore Disaster Recovery Support
-- Composite and covering indexes for HR job history timeline queries, lateral latest-job joins,
-- and child-record dependency checks.

-- 1. Required composite index on jobhistory (empno, effdate DESC, is_deleted)
CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_is_deleted_idx
  ON public.jobhistory (empno, effdate DESC, is_deleted);

-- 2. Covering index for LATERAL latest-job lookup in listEmployees / getEmployee
CREATE INDEX IF NOT EXISTS jobhistory_empno_is_deleted_effdate_covering_idx
  ON public.jobhistory (empno, is_deleted, effdate DESC, jobcode DESC)
  INCLUDE (deptcode, salary);

-- 3. Child-record lookup indexes for department and job soft-delete constraint checks
CREATE INDEX IF NOT EXISTS jobhistory_deptcode_is_deleted_idx
  ON public.jobhistory (deptcode, is_deleted);

CREATE INDEX IF NOT EXISTS jobhistory_jobcode_is_deleted_idx
  ON public.jobhistory (jobcode, is_deleted);

-- 4. Employee directory status and sort index
CREATE INDEX IF NOT EXISTS employee_status_directory_idx
  ON public.employee (is_deleted, sepdate, lastname, firstname, empno);
