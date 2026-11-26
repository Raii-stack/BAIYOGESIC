# Sprint 3 QA Test Report: Job History Promotions & Salary Visibility Permissions

**Document ID:** S3-TST-03 & S3-TST-04  
**Assignee:** [@princenelson](https://github.com/princenelson) (Test Engineer)  
**Module:** HOPE, Inc. ERP (BAIYOGESIC) — Human Resources (Job History & Salary Visibility)  
**Prerequisites:** [#62](https://github.com/Raii-stack/BAIYOGESIC/issues/62), [#64](https://github.com/Raii-stack/BAIYOGESIC/issues/64) (Employee Directory & Archive Features)  
**Execution Date:** 2026-11-27  
**Status:** Verified — 100% Pass Rate (Zero Regressions)

---

## 1. Executive Summary & Scope

This report documents automated verification of:
1. **Job History Promotions & Timeline Ordering (S3-TST-03):** Recording promotions/transfers/salary updates via `POST /api/employees/:empno/job-history`, validating effective date and positive salary boundaries (`400 Bad Request`), and verifying chronological ordering by `effdate DESC` across backend SQL queries and frontend `CareerTimeline` components.
2. **Salary Visibility Permissions (S3-TST-04):** Enforcing field-level salary redaction (`NULL::numeric AS salary` / `salary: null`) for standard employees on `/api/employees` and `/api/employees/:empno/job-history`, exposing unredacted salary figures to `admin` and `superadmin` roles, and masking salary figures in the UI (`EmployeeDirectoryPage`, `EmployeeProfilePage`, `CareerTimeline`) with lock icons and no reveal toggle for unauthorized roles.

---

## 2. Target Files & Coverage Matrix

| Layer | File Path | Verified Scenarios |
|---|---|---|
| **Frontend Employee Directory** | `src/pages/EmployeeDirectoryPage.test.tsx` | Multi-entry job history timeline ordered `effdate DESC` (newest entry first with `Current` badge), salary masking (`Salary hidden due to permissions`, no `$` figures, no reveal button) for `hr.history.view` standard employees, and unredacted salary display for administrators. |
| **Frontend Employee Profile** | `src/pages/EmployeeProfilePage.test.tsx` | Admin unredacted salary & `Promotion`/`Transfer` badges, `hr_manager` salary reveal toggle (`Hide salary` / `Show salary`), and strict masking (`••••••••` + lock icon) for `hr.history.view` employees. |
| **Frontend Salary Masking Utility** | `src/lib/salary-masking.test.ts` | Role and right-based salary visibility and formatting assertions. |
| **Backend HR Routes** | `routes/employee-routes.test.js` | Supertest checks verifying `GET /api/employees` returns `salary: null` for standard employees and unredacted `salary` for `admin` and `superadmin`; `GET /:empno/job-history` returns `salary: null` for `hr.history.view` employees; `POST /:empno/job-history` returns `403` for unauthorized users and `400` for invalid `deptcode` or negative `salary`. |
| **Backend HR Security Integration** | `tests/integration/hr-security.test.js` | Field-level salary masking and `hr.history.view` permission enforcement across employee and job-history endpoints. |

---

## 3. Acceptance Criteria Verification

| Criterion | Expected Behavior | Verification Result |
|---|---|---|
| **Redacted salary for standard employees** | Standard employees querying `/api/employees` and `/api/employees/:empno/job-history` receive `salary: null` and see masked placeholders (`••••••••`) without a reveal toggle in UI. | **Pass** — Verified in `routes/employee-routes.test.js`, `tests/integration/hr-security.test.js`, `EmployeeDirectoryPage.test.tsx`, and `EmployeeProfilePage.test.tsx`. |
| **Unredacted salary for admin & superadmin** | `admin` and `superadmin` roles receive unredacted `salary` figures from `/api/employees` and `/api/employees/:empno/job-history`. | **Pass** — Verified in `routes/employee-routes.test.js` and `tests/integration/hr-security.test.js`. |
| **Job history timeline sorted `effdate DESC`** | Multiple historical entries render in descending `effdate` order (`2026-01-01` → `2024-06-01` → `2022-01-01`) with `Current` on the latest entry. | **Pass** — Verified in `EmployeeDirectoryPage.test.tsx`, `EmployeeProfilePage.test.tsx`, and `tests/integration/hr-security.test.js`. |

---

## 4. Test Execution Results

### 4.1 Targeted Suites
- `npx vitest run src/pages/EmployeeDirectoryPage.test.tsx src/pages/EmployeeProfilePage.test.tsx`: **2 files passed, 19 passed** (`12` in `EmployeeDirectoryPage.test.tsx`, `7` in `EmployeeProfilePage.test.tsx`).
- `npx vitest run routes/employee-routes.test.js`: **1 file passed, 6 passed**.

### 4.2 Full Regression Suite (`npm test`)
- **Test Files:** 114 passed (114 total)
- **Tests:** 812 passed (812 total)
- **Failed / Skipped:** 0 failed, 0 skipped (100% pass rate)

---

## 5. Defect Summary

No new defects were discovered during S3-TST-03 & S3-TST-04 execution. Existing defect tracking remains in [bug-log.md](file:///c:/Users/Prince%20Aguinaldo/OneDrive/Documents/GitHub/BAIYOGESIC/docs/qa/bug-log.md).
