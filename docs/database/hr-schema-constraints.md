# [S3-DBA-02] Database: Employee Foreign Key Delete Rules and Department Orphan Prevention

**Issue Reference:** [#120](https://github.com/Raii-stack/BAIYOGESIC/issues/120)  
**Role:** BackEnd Engineer & DB Admin  
**Module:** HOPE, Inc. ERP (Database Integrity)  
**Prerequisites:** [#19](https://github.com/Raii-stack/BAIYOGESIC/issues/19) (Base Migrations), [#113](https://github.com/Raii-stack/BAIYOGESIC/issues/113) (Department and Job Master List CRUD)  
**Database Engine:** PostgreSQL 17.11 (Supabase project `dtcxvlcpqjmutiwejyqk`)  
**Migration:** [`supabase/migrations/20261029000000_issue_120_employee_fk_delete_rules_and_orphan_prevention.sql`](../../supabase/migrations/20261029000000_issue_120_employee_fk_delete_rules_and_orphan_prevention.sql)  

---

## 1. Overview and Scope

This specification establishes database-level referential integrity and constraint enforcement for Human Resources (HR) domain tables within the HOPE, Inc. ERP database. The primary objectives are:

1. **Department & Job Orphan Prevention:** Prevent hard or soft deactivation of departments and job classifications that currently have active employee assignments or historical job assignment records.
2. **Cascading / Restrictive Foreign Keys:** Ensure `ON DELETE RESTRICT` semantics across all employee and job history foreign key relationships to prevent silent data loss or dangling foreign references.
3. **Duplicate Promotion Prevention:** Enforce a composite unique constraint on `public.jobhistory(empno, effdate)` to guarantee that an employee cannot receive multiple conflicting promotion or transfer records on the same calendar effective date.

---

## 2. Relational Schema and Constraint Architecture

### 2.1 Foreign Key Delete Constraints (`ON DELETE RESTRICT`)

All foreign key relationships guarding child entities are explicitly configured with `ON DELETE RESTRICT` (`confdeltype = 'r'`). Any attempt to delete a referenced parent record (e.g., department, job, or employee) while dependent records exist triggers PostgreSQL error code `23503` (`foreign_key_violation`).

| Constraint Name | Source Table | Source Column | Target Table | Target Column | Delete Action | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `employee_deptcode_fkey` | `public.employee` | `deptcode` | `public.department` | `deptcode` | `ON DELETE RESTRICT` | Prevents deleting department with assigned employees |
| `employee_jobcode_fkey` | `public.employee` | `jobcode` | `public.job` | `jobcode` | `ON DELETE RESTRICT` | Prevents deleting job title with assigned employees |
| `jobhistory_empno_fkey` | `public.jobhistory` | `empno` | `public.employee` | `empno` | `ON DELETE RESTRICT` | Prevents deleting employee with job history entries |
| `jobhistory_deptcode_fkey` | `public.jobhistory` | `deptcode` | `public.department` | `deptcode` | `ON DELETE RESTRICT` | Prevents deleting department referenced in timeline |
| `jobhistory_jobcode_fkey` | `public.jobhistory` | `jobcode` | `public.job` | `jobcode` | `ON DELETE RESTRICT` | Prevents deleting job title referenced in timeline |

### 2.2 Composite Unique Key Constraint

To prevent duplicate promotions or contradictory departmental transfers on the same effective date, a composite unique constraint is enforced on `public.jobhistory`:

```sql
ALTER TABLE public.jobhistory
  ADD CONSTRAINT jobhistory_empno_effdate_key
  UNIQUE (empno, effdate);
```

- **Constraint Name:** `jobhistory_empno_effdate_key`
- **Columns:** `(empno, effdate)`
- **Behavior:** Attempts to insert a second job history or promotion record for the same employee with an identical `effdate` are rejected with PostgreSQL error code `23505` (`unique_violation`).

### 2.3 Two-Tier Soft-Delete and Hard-Delete Guards

In accordance with HOPE, Inc. ERP soft-delete architecture:

1. **Hard Delete Guard (`trg_block_hard_delete`):** A `BEFORE DELETE` trigger on `public.department`, `public.job`, `public.employee`, and `public.jobhistory` raises exception `P0001` preventing physical deletion.
2. **Soft-Delete Orphan Guard (`trg_check_children`):** A `BEFORE UPDATE` trigger fires whenever `is_deleted` transitions from `false` to `true`. When archiving a department, it inspects active child records:
   ```sql
   WHEN 'department' THEN
       SELECT count(*) INTO v_n FROM (
           SELECT 1 FROM public.employee   WHERE deptcode = OLD.deptcode AND NOT is_deleted
           UNION ALL
           SELECT 1 FROM public.jobhistory WHERE deptcode = OLD.deptcode AND NOT is_deleted
       ) c;
   ```
   If active child records exist, it aborts the transaction with `Cannot delete department row: % active related record(s) still exist.`.

---

## 3. Application Layer Error Handling

The API layer in `controllers/employee-controller.js` maps database-level constraint violations into predictable HTTP error responses:

| PostgreSQL Code | Exception Origin | Trigger Condition | HTTP Status | Response Message |
| :--- | :--- | :--- | :--- | :--- |
| `23503` | `employee_deptcode_fkey` / `jobhistory_deptcode_fkey` | Department referenced by active employees or history | `409 Conflict` | `Cannot archive department while active job-history records exist.` |
| `P0001` | `trg_check_children()` | Active department child records during soft-delete | `409 Conflict` | `Cannot archive department while active job-history records exist.` |
| `23505` | `jobhistory_empno_effdate_key` | Duplicate promotion on identical effective date | `400 Bad Request` | `A job history entry with this effective date already exists for this employee` |
| `23503` | `jobhistory_jobcode_fkey` / `jobhistory_deptcode_fkey` | Invalid job or department code in promotion payload | `400 Bad Request` | `The selected job or department no longer exists` |

---

## 4. Verification and Testing Runbook

### 4.1 SQL Inspection Queries

Execute in the Supabase SQL editor or `psql` to verify constraints:

```sql
-- Verify employee constraints (foreign keys & check constraints)
SELECT conname, contype, confdeltype
FROM pg_constraint
WHERE conrelid = 'public.employee'::regclass;

-- Expected Output includes:
-- conname: employee_deptcode_fkey | contype: f | confdeltype: r
-- conname: employee_jobcode_fkey  | contype: f | confdeltype: r

-- Verify jobhistory constraints (foreign keys & unique constraints)
SELECT conname, contype, confdeltype
FROM pg_constraint
WHERE conrelid = 'public.jobhistory'::regclass;

-- Expected Output includes:
-- conname: jobhistory_empno_fkey         | contype: f | confdeltype: r
-- conname: jobhistory_deptcode_fkey      | contype: f | confdeltype: r
-- conname: jobhistory_jobcode_fkey       | contype: f | confdeltype: r
-- conname: jobhistory_empno_effdate_key  | contype: u | confdeltype: a
```

### 4.2 Automated Test Coverage

The integration test suite in `tests/integration/hr-employee.test.js` covers:
- Blocking department deletion when active employees or job histories exist.
- Blocking duplicate promotion effective dates via composite key unique violation.
- Migration file structure and idempotent constraint definition verification.
- Migration sequencing and timestamp format verification via `scripts/verify-migrations.js`.

To run the verification tests:
```bash
npm test tests/integration/hr-employee.test.js
npm run verify:migrations
npm run lint
```
