# Sprint 2 QA Test Report: Soft Delete/Restore Constraints & Per-Right Permissions

**Document ID:** S2-TST-03 & S2-TST-04  
**Assignee:** [@princenelson](https://github.com/princenelson) (Test Engineer)  
**Module:** HOPE, Inc. ERP (BAIYOGESIC) — CRM & Inventory  
**Prerequisites:** [#54](https://github.com/Raii-stack/BAIYOGESIC/issues/54) (Customer & Product Verification), [#56](https://github.com/Raii-stack/BAIYOGESIC/issues/56) (Demo Data)  
**Status:** Verified — 100% Pass Rate (Zero Regressions)

---

## 1. Executive Summary & Scope

This report documents the automated verification of:
1. **S2-TST-03 — Soft Delete / Restore Constraints:** Referential integrity rules blocking soft-deletion (`DELETE`) of customers and products that have active child sales transactions (`public.sales` / `public.salesdetail`), returning **HTTP 409 Conflict** with a clear user-facing error message, keeping records active on failure, and supporting soft-delete/restore workflows when unreferenced.
2. **S2-TST-04 — Granular Per-Right Permissions:** Enforcement of granular action rights (`customers.add`, `customers.edit`, `customers.delete`, `products.add`, `products.edit`, `products.delete`) across both:
   - **Backend API routes** (`routes/customer-routes.js`, `routes/product-routes.js`, `middleware/permissions.js`) returning **HTTP 403 Forbidden** when write/delete rights are missing.
   - **Frontend UI** (`src/pages/CustomerManagementPage.tsx`, `src/pages/InventoryPage.tsx`, `src/lib/rbac.ts`) hiding or disabling `Add`, `Edit`, `Archive`, `Restore`, `Manage prices`, and audit columns (`Status`, `Last change`) according to the authenticated user's `rights` array.

---

## 2. Target Files & Coverage Matrix

| Layer | File Path | Verified Scenarios |
|---|---|---|
| **Frontend CRM** | `src/pages/CustomerManagementPage.test.tsx` | Active sales 409 conflict alert & focus trap, HTTP 403 archive failure keeping customer Active, granular `customers.add` / `customers.edit` / `customers.delete` button & audit-column visibility, boundary input length validation (`custname > 20`, `address > 50`). |
| **Frontend Inventory** | `src/pages/InventoryPage.test.tsx` | Active sales 409 conflict alert keeping product Active, HTTP 403 restore failure keeping product Archived, granular `products.add` / `products.edit` / `products.delete` button, `Manage prices`, and audit-column visibility. |
| **Backend CRM Routes** | `routes/customer-routes.test.js` | Supertest route-level `authenticate` + `requirePermission` checks: 401 unauthenticated, 403 on `POST`/`PUT` without edit right, 403 on `DELETE`/`restore` for `customers.edit`-only, 403 on `PUT` for `customers.delete`-only, and 409 Conflict on `DELETE` when active sales exist. |
| **Backend Product Routes** | `routes/product-routes.test.js` | Supertest route-level `authenticate` + `requirePermission` checks: 403 on `POST /price-history` for view-only, 403 on `DELETE`/`restore` for `products.edit`-only, 403 on `POST` for `products.delete`-only, and 409 Conflict on `DELETE` when active `salesdetail` rows exist. |
| **Backend Controllers** | `controllers/customer-controller.test.js`, `controllers/product-controller.test.js` | Preflight active sales checks and `P0001` trigger fallback returning 409 Conflict, plus soft-delete/restore `is_deleted` cascading across `product` and `pricehist`. |
| **RBAC & Calculations** | `src/lib/rbac.test.ts`, `lib/sales-calculations.test.js`, `src/lib/sales.test.ts` | Role/right matrix evaluation, `roundCurrency`, subtotals, tax, balances, payment status (`Unpaid`/`Partial`/`Paid`), and `lookupUnitPriceAsOfDate` effective date resolution. |

---

## 3. Acceptance Criteria Verification

| Criterion | Expected Behavior | Verification Result |
|---|---|---|
| **Active sales archive guard** | Attempting to archive a customer or product with active sales returns **HTTP 409 Conflict** with a clear message (`"Cannot archive customer while active sales records exist."` / `"Cannot archive product while active sales records exist."`) and leaves the record active. | **Pass** — Verified in `CustomerManagementPage.test.tsx`, `InventoryPage.test.tsx`, `customer-routes.test.js`, `product-routes.test.js`, `customer-controller.test.js`, and `product-controller.test.js`. |
| **Unauthorized write routes** | Roles/users missing Edit or Delete rights receive **HTTP 403 Forbidden** on `POST`, `PUT`, `DELETE`, and `POST .../restore`. | **Pass** — Verified in `customer-routes.test.js` and `product-routes.test.js`. |
| **Frontend permission controls** | Action buttons (`Add customer`, `Add product`, `Edit`, `Archive`, `Restore`, `Manage prices`) and audit columns (`Status`, `Last change`) hide according to `customers.add`, `customers.edit`, `customers.delete`, `products.add`, `products.edit`, and `products.delete`. | **Pass** — Verified in `CustomerManagementPage.test.tsx` and `InventoryPage.test.tsx`. |

---

## 4. Test Execution Results

### 4.1 Targeted Frontend Page Suites
Command:
```bash
npx vitest run src/pages/CustomerManagementPage.test.tsx src/pages/InventoryPage.test.tsx
```
- `src/pages/CustomerManagementPage.test.tsx`: **12 passed** (12 total)
- `src/pages/InventoryPage.test.tsx`: **14 passed** (14 total)
- **Result:** 2 test files passed, **26 passed**, 0 failed.

### 4.2 Targeted Backend Route Suites
Command:
```bash
npx vitest run routes/customer-routes.test.js routes/product-routes.test.js
```
- `routes/customer-routes.test.js`: **3 passed** (3 total)
- `routes/product-routes.test.js`: **4 passed** (4 total)
- **Result:** 2 test files passed, **7 passed**, 0 failed.

### 4.3 Full Regression Suite
Command:
```bash
npm test
```
- **Test Files:** 111 passed (111 total)
- **Tests:** 798 passed (798 total)
- **Failed / Skipped:** 0 failed, 0 skipped (100% pass rate)

---

## 5. Defect Summary

No new defects were discovered during S2-TST-03 & S2-TST-04 test execution. Existing sprint defects remain tracked in [bug-log.md](bug-log.md).
