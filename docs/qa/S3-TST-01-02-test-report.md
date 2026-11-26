# Sprint 3 QA Test Report: Department, Job, and Employee Directory CRUD

**Document ID:** S3-TST-01 & S3-TST-02  
**Assignee:** [@princenelson](https://github.com/princenelson) (Test Engineer)  
**Module:** HOPE, Inc. ERP (BAIYOGESIC) — Human Resources (Departments, Jobs, Employee Directory)  
**Prerequisites:** Sprint 1 & Sprint 2 complete ([#26](https://github.com/Raii-stack/BAIYOGESIC/issues/26) RBAC, [#56](https://github.com/Raii-stack/BAIYOGESIC/issues/56) Demo Data)  
**Execution Date:** 2026-11-26  
**Status:** Verified — 100% Pass Rate (Zero Regressions)

---

## 1. Executive Summary & Scope

This report documents automated test coverage for Sprint 3 HR Master Data and Employee Directory CRUD:
1. **Departments & Jobs CRUD (`/api/employees/departments`, `/api/employees/jobs`):** Listing, creation, updates, soft-delete dependency guards (`409 Conflict` when active `jobhistory` rows exist), restore, validation (`deptcode`/`jobcode` ≤ 4 chars, `deptname`/`jobdesc` ≤ 20 chars), and RBAC (`403 Forbidden` for view-only employees).
2. **Employee Directory CRUD & Validation (`/api/employees`):** Auto-generated 5-digit `empno`, `firstname`/`lastname` ≤ 15 chars, work email format validation (`400 Bad Request`), duplicate email conflict (`409 Conflict`), server-side pagination, debounced search, department/job filtering, salary masking, and inline job history.

---

## 2. Target Files & Coverage Matrix

| Layer | File Path | Verified Scenarios |
|---|---|---|
| **Frontend Employee Directory** | `src/pages/EmployeeDirectoryPage.test.tsx` | Skeleton loading, server pagination, department & job filters, empty-filter state & reset, debounced search, salary/email masking for standard users, employee creation (with `409` duplicate email alert) & editing, archive with separation date & `409` active sales guard, inline job history, and `Jobs`/`Departments` tab CRUD & `409` conflict handling. |
| **Frontend Department Page** | `src/pages/DepartmentManagementPage.test.tsx` | Department pagination, search/status filtering, create/edit modals, duplicate code validation, archive/restore, and `409` conflict when employees are assigned. |
| **Frontend Modals & Panels** | `src/components/employees/EmployeePanel.test.tsx`, `src/components/employees/EmployeeModals.test.tsx`, `src/components/departments/DepartmentModal.test.tsx`, `src/components/jobs/JobModal.test.tsx` | Lookup gating, date/field validation, loading states, and error preservation. |
| **Backend HR Routes** | `routes/employee-routes.test.js` | Supertest route-level `authenticate` + `requirePermission` checks across `/api/employees`, `/api/employees/departments`, `/api/employees/jobs`, and `/:empno/job-history` (`200`, `201`, `400`, `403`, `409`). |
| **Backend HR Integration & Controllers** | `tests/integration/hr-api.test.js`, `tests/integration/hr-employee.test.js`, `controllers/employee-controller.test.js` | Controller status filtering (`active`, `blocked`, `disabled`, `rejected`, `pending`), `app_user` lateral join, salary masking, and promotion history validation. |

---

## 3. Acceptance Criteria Verification

| Criterion | Expected Behavior | Verification Result |
|---|---|---|
| **Departments & Jobs CRUD** | `GET`, `POST`, `PUT`, `DELETE`, and `POST .../restore` work on `/api/employees/departments` and `/api/employees/jobs` with `400` validation, `403` RBAC, and `409` active `jobhistory` guards. | **Pass** — Verified in `routes/employee-routes.test.js`, `EmployeeDirectoryPage.test.tsx`, `DepartmentManagementPage.test.tsx`, and `tests/integration/hr-api.test.js`. |
| **Employee Creation & Update Validation** | Enforces `firstname`/`lastname` ≤ 15 chars, valid email format (`400`), required `hiredate` & non-negative `salary`, unique email (`409`), and 5-digit `empno` allocation. | **Pass** — Verified in `routes/employee-routes.test.js`, `EmployeeDirectoryPage.test.tsx`, `EmployeePanel.test.tsx`, and `tests/integration/hr-employee.test.js`. |
| **Server Pagination & Debounced Filtering** | Server-side pagination (`page`, `limit`, `total`, `totalPages`), debounced search input, and `department` / `job` filter queries update the directory cleanly. | **Pass** — Verified in `EmployeeDirectoryPage.test.tsx`. |

---

## 4. Test Execution Results

### 4.1 Targeted Suites
- `npx vitest run src/pages/EmployeeDirectoryPage.test.tsx`: **1 file passed, 11 passed**, 0 failed.
- `npx vitest run routes/employee-routes.test.js`: **1 file passed, 5 passed**, 0 failed.

### 4.2 Full Regression Suite (`npm test`)
- **Test Files:** 111 passed (111 total)
- **Tests:** 802 passed (802 total)
- **Failed / Skipped:** 0 failed, 0 skipped (100% pass rate)

---

## 5. Defect Summary

No new defects were discovered during S3-TST-01 & S3-TST-02 execution. Existing defect tracking remains in [bug-log.md](file:///c:/Users/Prince%20Aguinaldo/OneDrive/Documents/GitHub/BAIYOGESIC/docs/qa/bug-log.md).
