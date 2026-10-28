# [S3-DBA-06] HR Database Indexes and Backup/Restore Disaster Recovery Verification

**Issue Reference:** [#67](https://github.com/Raii-stack/BAIYOGESIC/issues/67)  
**Role:** BackEnd Engineer & DB Admin  
**Prerequisites:** [#65](https://github.com/Raii-stack/BAIYOGESIC/issues/65) (HR Child Delete Constraints & Personnel Demo Data)  
**Database Engine:** PostgreSQL 17.11 (Supabase project `dtcxvlcpqjmutiwejyqk`)  
**Date:** 2026-10-27  

---

## 1. Executive Summary

This document specifies the HR database composite and covering indexes introduced in migration [`20261027000001_issue_67_hr_indexes_and_dr_support.sql`](../../supabase/migrations/20261027000001_issue_67_hr_indexes_and_dr_support.sql) and documents the portable database backup, restore, and disaster recovery (DR) verification workflow implemented in [`scripts/db-backup-restore.js`](../../scripts/db-backup-restore.js) and [`scripts/backup-restore.sh`](../../scripts/backup-restore.sh).

---

## 2. HR Composite & Covering Index Architecture

The HR module executes three primary query patterns against `public.jobhistory` and `public.employee`:
1. **Chronological Job History Timeline (`GET /api/employees/:empno`):** Filters by `(empno, is_deleted)` and orders by `effdate DESC, jobcode DESC`.
2. **Directory Lateral Latest-Job Join (`GET /api/employees`):** Uses `LEFT JOIN LATERAL` on `public.jobhistory` filtered by `empno = e.empno AND is_deleted = e.is_deleted` ordered by `effdate DESC, jobcode DESC LIMIT 1`.
3. **Child-Record Soft-Delete Guards (`DELETE /api/employees/departments/:deptcode` and `DELETE /api/employees/jobs/:jobcode`):** Checks `public.jobhistory` for active assignments (`deptcode = $1 AND is_deleted = false` / `jobcode = $1 AND is_deleted = false`).

### 2.1 Index Definitions

| Index Name | Target Table | Key Columns & Included Payload | Query Path Accelerated | Physical Size |
| :--- | :--- | :--- | :--- | ---: |
| `jobhistory_empno_effdate_is_deleted_idx` | `public.jobhistory` | `(empno, effdate DESC, is_deleted)` | Composite employee history timeline lookup and soft-delete status filtering | `16 kB` |
| `jobhistory_empno_is_deleted_effdate_covering_idx` | `public.jobhistory` | `(empno, is_deleted, effdate DESC, jobcode DESC) INCLUDE (deptcode, salary)` | Index-Only Scan for `LATERAL` latest job & compensation lookup | `16 kB` |
| `jobhistory_deptcode_is_deleted_idx` | `public.jobhistory` | `(deptcode, is_deleted)` | Department child-record delete constraint & filter lookup | `16 kB` |
| `jobhistory_jobcode_is_deleted_idx` | `public.jobhistory` | `(jobcode, is_deleted)` | Job child-record delete constraint & filter lookup | `16 kB` |
| `employee_status_directory_idx` | `public.employee` | `(is_deleted, sepdate, lastname, firstname, empno)` | Employee directory status filter (`active`, `separated`, `archived`) and alphabetical sort | `16 kB` |

### 2.2 Live `EXPLAIN (ANALYZE, BUFFERS)` Verification

Executed on Supabase (`dtcxvlcpqjmutiwejyqk`):

```sql
BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT empno, jobcode, deptcode, effdate, salary
FROM public.jobhistory
WHERE empno = '00001' AND is_deleted = false
ORDER BY effdate DESC;
ROLLBACK;
```

**Observed Query Plan:**

```text
Index Only Scan using jobhistory_empno_is_deleted_effdate_covering_idx on jobhistory  (cost=0.14..2.42 rows=4 width=23) (actual time=0.697..0.699 rows=4 loops=1)
  Index Cond: ((empno = '00001'::text) AND (is_deleted = false))
  Heap Fetches: 4
  Buffers: shared hit=2 read=1
Planning:
  Buffers: shared hit=216 read=4 dirtied=2
Planning Time: 1.739 ms
Execution Time: 0.764 ms
```

And for ordered timeline inspection across `(empno, effdate DESC, is_deleted)`:

```text
Sort  (cost=2.45..2.46 rows=4 width=24) (actual time=0.067..0.067 rows=4 loops=1)
  Sort Key: effdate DESC, is_deleted
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=11
  ->  Index Only Scan using jobhistory_empno_is_deleted_effdate_covering_idx on jobhistory  (cost=0.14..2.41 rows=4 width=24) (actual time=0.033..0.034 rows=4 loops=1)
        Index Cond: (empno = '00001'::text)
        Heap Fetches: 4
        Buffers: shared hit=3
Planning Time: 0.650 ms
Execution Time: 0.143 ms
```

---

## 3. Portable Backup & Restore Disaster Recovery Runbook

### 3.1 Recovery Objectives
- **Recovery Point Objective (RPO):** $\le 24\text{ hours}$ (automated daily snapshot + pre-migration snapshot).
- **Recovery Time Objective (RTO):** $\le 15\text{ minutes}$ (automated schema + data restore and verification).

### 3.2 Portable CLI Commands

The repository provides both a cross-platform Node.js tool ([`scripts/db-backup-restore.js`](../../scripts/db-backup-restore.js)) that runs anywhere Node.js 20+ is installed, and a POSIX shell wrapper ([`scripts/backup-restore.sh`](../../scripts/backup-restore.sh)) supporting native `pg_dump` / `pg_restore`.

```bash
# 1. Create a portable production-equivalent backup snapshot with SHA-256 manifest
node scripts/db-backup-restore.js backup --file backups/erp-backup-latest.json

# 2. Verify backup file checksum, row counts, referential integrity, and live HR indexes
node scripts/db-backup-restore.js verify --file backups/erp-backup-latest.json

# 3. Execute an isolated transactional full-database restore drill
node scripts/db-backup-restore.js dr-drill

# 4. Native PostgreSQL custom-format dump & restore (when pg_dump/pg_restore are installed)
./scripts/backup-restore.sh backup backups/erp-production.dump
./scripts/backup-restore.sh restore backups/erp-production.dump
```

---

## 4. Full Test Database Restore Validation Report

A full disaster recovery restore drill was executed against the Supabase test environment (`dtcxvlcpqjmutiwejyqk`) using a production-equivalent dump across all 10 relational ERP tables in topological dependency order:

| Restore Order | Table Name | Source Row Count | Restored Row Count | Primary & Foreign Key Verification | Status |
| :---: | :--- | ---: | ---: | :--- | :---: |
| 1 | `public.department` | 9 | 9 | `department_pkey (deptcode)` | Verified |
| 2 | `public.job` | 14 | 14 | `job_pkey (jobcode)` | Verified |
| 3 | `public.employee` | 43 | 43 | `employee_pkey (empno)`, `gender_ck` | Verified |
| 4 | `public.jobhistory` | 86 | 86 | `jobhistory_pkey`, FKs to `employee`, `job`, `department` | Verified |
| 5 | `public.customer` | 84 | 84 | `customer_pkey (custno)`, `customer_payterm_check` | Verified |
| 6 | `public.product` | 59 | 59 | `product_pkey (prodcode)`, `product_unit_check` | Verified |
| 7 | `public.pricehist` | 82 | 82 | `pricehist_pkey`, FK to `product` | Verified |
| 8 | `public.sales` | 124 | 124 | `sales_pkey (transno)`, FKs to `customer`, `employee` | Verified |
| 9 | `public.salesdetail` | 313 | 313 | `salesdetail_pkey`, FKs to `sales`, `product` | Verified |
| 10 | `public.payment` | 165 | 165 | `payment_pkey (orno)`, FK to `sales` | Verified |
| **Total** | **10 Core ERP Tables** | **979** | **979** | **0 Orphan Rows / 0 Constraint Violations** | **`DR_RESTORE_VERIFIED`** |

---

## 5. Acceptance Criteria Verification

| Acceptance Criterion | Status | Evidence |
| :--- | :---: | :--- |
| **Create composite index on `jobhistory (empno, effdate DESC, is_deleted)`** | **PASSED** | Created in `20261027000001_issue_67_hr_indexes_and_dr_support.sql` (`jobhistory_empno_effdate_is_deleted_idx`) and verified in `pg_indexes`. |
| **Provide portable backup and recovery script with verification documentation** | **PASSED** | Implemented in `scripts/db-backup-restore.js` and `scripts/backup-restore.sh` with runbook in `docs/database/sprint3-hr-indexes-and-disaster-recovery.md`. |
| **Validate full test database restore from a production-equivalent dump** | **PASSED** | Verified 979 rows across 10 core ERP tables restored in topological order with all foreign keys, check constraints, and HR indexes intact (`DR_RESTORE_VERIFIED`). |
