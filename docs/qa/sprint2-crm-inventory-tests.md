# Sprint 2 QA Test Specifications: Customer, Product, and Price History Verification

**Document ID:** S2-TST-01 & S2-TST-02  
**Assignee:** [@princenelson](https://github.com/princenelson) (Prince Nelson J. Aguinaldo Jr. — Test Engineer)  
**Role:** Test Engineer  
**Module:** HOPE, Inc. ERP (BAIYOGESIC) — CRM, Inventory, and Price History  
**Prerequisites:** [#19](https://github.com/Raii-stack/BAIYOGESIC/issues/19), [#20](https://github.com/Raii-stack/BAIYOGESIC/issues/20), [#21](https://github.com/Raii-stack/BAIYOGESIC/issues/21) (Sprint 1 Database Migrations & RBAC)  
**Status:** Approved & Verified (100% Pass Rate)

---

## 1. Executive Summary & Scope

This specification defines the automated and manual test cases covering Customer Relationship Management (CRM), Product Catalog / Inventory Management, and Price History Effective Date Verification.

The test suite ensures end-to-end reliability across both the backend Express/PostgreSQL API and frontend React/Vitest user journeys:
1. **Customer Management:** Server-side pagination, debounced ILIKE multi-column search (`custno`, `custname`, `address`), payment term filtering (`COD`, `30D`, `45D`, `60D`), status filtering, and referential integrity protection against archiving customers with active transactions.
2. **Product Catalog & Inventory:** Server-side pagination, debounced multi-column search (`prodcode`, `description`), unit filtering (`pc`, `ea`, `mtr`, `pkg`, `ltr`), status filtering, price history audit logging, and dependency protection against archiving products with active sales line items.
3. **Price History & Effective Date Calculations:** Verification that price lookups accurately resolve the latest unit price effective on or before a queried sales transaction date (`effdate <= target_date`), ignoring soft-deleted price entries, future tiers, and properly accounting for the `Asia/Manila` time zone.
4. **Role-Based Access Control (RBAC):** Enforcement of granular rights and role boundaries (`CRM.view`, `CRM.edit`, `CRM.delete`, `Inventory.view`, `Inventory.edit`, `Inventory.delete`), ensuring unauthorized roles receive HTTP 403 Forbidden and restricted action controls remain disabled or hidden.

---

## 2. Target Files & Test Matrix

| Layer | File Path | Coverage Scope |
|---|---|---|
| **Backend Integration** | `tests/integration/crm-inventory.test.js` | Integration test suite for `GET /api/customers`, `GET /api/products`, `GET /api/products/:prodcode/price-history`, `lookupProductPrice`, CRUD operations, status filtering, pagination metadata, and HTTP contract codes. |
| **Backend Unit / Utilities** | `lib/sales-calculations.test.js` | Price history effective date calculation (`lookupUnitPriceAsOfDate`), rounding currency, order subtotals, VAT, line balances, and payment status resolution. |
| **Backend Validation** | `lib/product-validation.test.js` | Product payload normalization, string boundary length enforcement, price decimal constraints, and allowed unit validation. |
| **Backend Auto-ID** | `lib/customer-id.test.js`, `lib/product-code.test.js` | Concurrency-safe sequential code allocation (`C0001`–`C9999`, `PX0001`–`PX9999`) under advisory transaction locks. |
| **Frontend CRM Tests** | `src/pages/CustomerManagementPage.test.tsx` | RTL interaction suite: server-side pagination, URL query syncing, 300ms debounce typing pause, in-place edit updates, create/archive dialogs, active transaction 409 alerts, and RBAC button restrictions. |
| **Frontend Inventory Tests** | `src/pages/InventoryPage.test.tsx` | RTL interaction suite: product table rendering, unit filters, debounced search, expanded price history table, `PriceHistoryModal` tier addition, past-date validation alerts, and 409 conflict notifications. |

---

## 3. API Endpoints & HTTP Response Contracts

The automated tests validate compliance with the following HTTP response codes across all scenarios:

| Endpoint | Method | Expected Status | Condition / Scenario |
|---|---|---|---|
| `/api/customers` | `GET` | **200 OK** | Successful retrieval of paginated customer list matching query filters. |
| `/api/customers` | `GET` | **400 Bad Request** | Invalid `sortBy`, `sortOrder`, `payterm`, or `status` parameter. |
| `/api/customers` | `GET` | **403 Forbidden** | User role or permissions lack `CRM.view`. |
| `/api/customers` | `POST` | **201 Created** | Valid customer record created with auto-numbered `custno`. |
| `/api/customers` | `POST` | **400 Bad Request** | Validation failed (missing name, name > 20 chars, address > 50 chars, invalid payterm). |
| `/api/customers` | `POST` | **403 Forbidden** | User role or permissions lack `CRM.edit`. |
| `/api/customers` | `POST` | **409 Conflict** | Duplicate active customer name exists. |
| `/api/customers/:custno` | `PUT` | **200 OK** | Customer record updated successfully. |
| `/api/customers/:custno` | `PUT` | **404 Not Found** | Customer ID does not exist or is deleted. |
| `/api/customers/:custno` | `PUT` | **409 Conflict** | Customer name collides with another active customer. |
| `/api/customers/:custno` | `DELETE` | **200 OK** | Customer successfully soft-deleted (`is_deleted = true`). |
| `/api/customers/:custno` | `DELETE` | **403 Forbidden** | User role or permissions lack `CRM.delete`. |
| `/api/customers/:custno` | `DELETE` | **409 Conflict** | Customer has active sales transactions. |
| `/api/customers/:custno/restore` | `POST` | **200 OK** | Customer restored to active status (`is_deleted = false`). |
| `/api/products` | `GET` | **200 OK** | Successful retrieval of paginated product catalog with latest active price. |
| `/api/products` | `GET` | **400 Bad Request** | Invalid `sortBy`, `sortOrder`, `unit`, or `status` parameter. |
| `/api/products` | `GET` | **403 Forbidden** | User role or permissions lack `Inventory.view`. |
| `/api/products` | `POST` | **201 Created** | Product created with auto-assigned code and initial `pricehist` entry. |
| `/api/products` | `POST` | **400 Bad Request** | Invalid description (> 30 chars), invalid unit, or non-positive price. |
| `/api/products` | `POST` | **403 Forbidden** | User role or permissions lack `Inventory.edit`. |
| `/api/products` | `POST` | **409 Conflict** | Duplicate active product description. |
| `/api/products/:prodcode` | `PUT` | **200 OK** | Product updated; new `pricehist` and `audit_log` created if price changed. |
| `/api/products/:prodcode` | `PUT` | **404 Not Found** | Product code does not exist or is deleted. |
| `/api/products/:prodcode` | `DELETE` | **200 OK** | Product and its price history soft-deleted. |
| `/api/products/:prodcode` | `DELETE` | **403 Forbidden** | User role or permissions lack `Inventory.delete`. |
| `/api/products/:prodcode` | `DELETE` | **409 Conflict** | Product has active line items in `salesdetail`. |
| `/api/products/:prodcode/price-history` | `GET` | **200 OK** | Returns chronological array of price tiers sorted `effdate DESC`. |
| `/api/products/:prodcode/price-history` | `POST` | **201 Created** | Future or current price tier added; audit log entry recorded. |
| `/api/products/:prodcode/price-history` | `POST` | **400 Bad Request** | Past effective date, non-positive price, or duplicate effective date. |
| `/api/sales/price-lookup/:prodcode` | `GET` | **200 OK** | Latest price effective on or before queried `salesdate`. |
| `/api/sales/price-lookup/:prodcode` | `GET` | **404 Not Found** | Queried sales date is earlier than all product price effective dates. |

---

## 4. Test Case Specifications

### 4.1 Customer Management & CRM (`S2-TST-01`)

| Test ID | Test Scenario | Preconditions | Input / Steps | Expected Result | HTTP Status | Priority | Status |
|---|---|---|---|---|---|---|---|
| **TC-CRM-01** | Default customer pagination | 45 customer records in database | `GET /api/customers` with no query parameters | Returns first 25 customers, `page: 1`, `limit: 25`, `total: 45`, `totalPages: 2`. `_total` column stripped. | 200 OK | P1 | Pass |
| **TC-CRM-02** | Custom pagination offset | 45 customer records | `GET /api/customers?page=3&limit=10` | SQL executes with `LIMIT 10 OFFSET 20`. Returns records 21–30; `totalPages: 5`. | 200 OK | P1 | Pass |
| **TC-CRM-03** | Pagination offset beyond total | 18 customer records | `GET /api/customers?page=5&limit=10` | Initial query returns 0 rows; executes fallback `SELECT count(*)`, returning `customers: []`, `total: 18`, `totalPages: 2`. | 200 OK | P2 | Pass |
| **TC-CRM-04** | Multi-column search query | Active customer records | `GET /api/customers?search=Apex` | SQL executes `(custno ILIKE $1 OR custname ILIKE $1 OR address ILIKE $1)` with `'%Apex%'`. Returns matching records. | 200 OK | P1 | Pass |
| **TC-CRM-05** | Search with zero matches | Active customer records | `GET /api/customers?search=NoSuchCustomer` | Returns `customers: []`, `total: 0`, `totalPages: 0`. | 200 OK | P2 | Pass |
| **TC-CRM-06** | Payment term filtering | Mixed payterm records | `GET /api/customers?payterm=COD` | SQL contains `payterm = $1` with param `'COD'`. Only COD customers returned. | 200 OK | P1 | Pass |
| **TC-CRM-07** | Status filtering (active/archived/all) | Active and soft-deleted rows | `GET /api/customers?status=active`, `status=archived`, `status=all` | Filters by `is_deleted = false`, `is_deleted = true`, or omits deleted filter respectively. | 200 OK | P1 | Pass |
| **TC-CRM-08** | Customer sorting and secondary sort | Active customer records | `GET /api/customers?sortBy=customer&sortOrder=asc` | SQL orders by `custname ASC, custno ASC` (secondary sort ensures stable pagination). | 200 OK | P2 | Pass |
| **TC-CRM-09** | Invalid pagination/filter queries | Any | Send invalid `sortBy=phone`, `sortOrder=rev`, `payterm=90D`, `status=purged` | Each returns descriptive validation error payload. | 400 Bad Request | P1 | Pass |
| **TC-CRM-10** | Create customer happy path | Unique name, valid payload | `POST /api/customers` with `{ custname, address, payterm }` | Auto-allocates next `C0001` ID under lock; returns 201 with customer entity. | 201 Created | P1 | Pass |
| **TC-CRM-11** | Reject duplicate customer name | Existing active customer | `POST /api/customers` with existing `custname` | Duplicate check triggers; returns conflict error message. | 409 Conflict | P1 | Pass |
| **TC-CRM-12** | Customer name length boundary | None | `POST /api/customers` with `custname` = 21 chars | Fails validation: `"Customer Name must be 20 characters or fewer"`. | 400 Bad Request | P2 | Pass |
| **TC-CRM-13** | Customer address length boundary | None | `POST /api/customers` with `address` = 51 chars | Fails validation: `"Address must be 50 characters or fewer"`. | 400 Bad Request | P2 | Pass |
| **TC-CRM-14** | Soft delete customer dependency guard | Customer with active sales | `DELETE /api/customers/C-WITH-SALES` | Dependency check detects active sale or P0001 trigger fires; returns conflict message. | 409 Conflict | P1 | Pass |
| **TC-CRM-15** | Soft delete unreferenced customer | Customer without sales | `DELETE /api/customers/C1001` | Updates `is_deleted = true`, preserves all historical fields. | 200 OK | P1 | Pass |
| **TC-CRM-16** | Restore soft-deleted customer | Archived customer | `POST /api/customers/C1001/restore` | Sets `is_deleted = false`; record becomes active and searchable. | 200 OK | P1 | Pass |
| **TC-CRM-17** | RBAC View permission check | User without CRM right | `GET /api/customers` with `role: "employee", rights: []` | Permission check denies access; returns `{ statusCode: 403 }`. Restricted buttons hidden in UI. | 403 Forbidden | P1 | Pass |
| **TC-CRM-18** | RBAC Edit permission check | View-only employee | `POST /api/customers` or `PUT /api/customers/C1` | Mutation rejected with 403 Forbidden. "Add customer" and "Edit" buttons hidden. | 403 Forbidden | P1 | Pass |
| **TC-CRM-19** | Frontend Search debounce | Customer directory | Rapidly type 3 keystrokes in `<input type="search">` | Network requests are throttled; only 1 request fired after pause with full debounced query. | 200 OK | P1 | Pass |
| **TC-CRM-20** | Frontend Server Error Alert | Customer directory | `GET /api/customers` responds with 500 Internal Error | Displays standardized alert: `"The service is temporarily unavailable. Please try again."` with "Try again" retry trigger. | 500 Error | P2 | Pass |

---

### 4.2 Product Catalog & Inventory (`S2-TST-02`)

| Test ID | Test Scenario | Preconditions | Input / Steps | Expected Result | HTTP Status | Priority | Status |
|---|---|---|---|---|---|---|---|
| **TC-INV-01** | Default product catalog pagination | 50 product records | `GET /api/products` with no query parameters | Returns first 25 products with resolved prices, `page: 1`, `limit: 25`, `total: 50`, `totalPages: 2`. | 200 OK | P1 | Pass |
| **TC-INV-02** | Custom product pagination offset | 50 product records | `GET /api/products?page=3&limit=15` | SQL executes with `LIMIT 15 OFFSET 30`. Returns products 31–45; `totalPages: 4`. | 200 OK | P1 | Pass |
| **TC-INV-03** | Product offset beyond total | 22 product records | `GET /api/products?page=4&limit=10` | First query returns 0 rows; secondary count query returns `total: 22`, `totalPages: 3`, `products: []`. | 200 OK | P2 | Pass |
| **TC-INV-04** | Product multi-column search | Active products | `GET /api/products?search=Laser` | SQL executes `(p.prodcode ILIKE $1 OR p.description ILIKE $1)`. Matches returned. | 200 OK | P1 | Pass |
| **TC-INV-05** | Product search zero matches | Active products | `GET /api/products?search=Unobtainable` | Returns `products: []`, `total: 0`, `totalPages: 0`. | 200 OK | P2 | Pass |
| **TC-INV-06** | Unit type filtering | Products with various units | `GET /api/products?unit=pkg` | SQL filters `p.unit = $1` with `'pkg'`. Only package products returned. | 200 OK | P1 | Pass |
| **TC-INV-07** | Status filtering (active/archived/all) | Active and archived products | `GET /api/products?status=active`, `status=archived` | Correctly filters `p.is_deleted = false` or `p.is_deleted = true`. | 200 OK | P1 | Pass |
| **TC-INV-08** | Product sorting (code/description/price) | Active products | `GET /api/products?sortBy=unitPrice&sortOrder=desc` | SQL orders `ORDER BY price.unitprice DESC NULLS LAST, p.prodcode ASC`. | 200 OK | P2 | Pass |
| **TC-INV-09** | Invalid product query parameters | Any | `GET /api/products?unit=box`, `sortBy=cost`, `status=deleted` | Returns HTTP 400 with descriptive error message. | 400 Bad Request | P1 | Pass |
| **TC-INV-10** | Create product happy path | Unique description, unit, price | `POST /api/products` with valid payload | Allocates `PX0001` code under advisory lock; inserts `product` and initial `pricehist` entry. | 201 Created | P1 | Pass |
| **TC-INV-11** | Reject duplicate product description | Existing active product | `POST /api/products` with duplicate `description` | Conflict caught; returns 409 `"A product with that description already exists"`. | 409 Conflict | P1 | Pass |
| **TC-INV-12** | Product description length boundary | None | `POST /api/products` with `description` = 31 chars | Validation rejects: `"Description must be 30 characters or fewer"`. | 400 Bad Request | P2 | Pass |
| **TC-INV-13** | Product price decimal boundary | None | `POST /api/products` with `unitprice` = 10.999 | Rejects numbers with more than 2 decimal places. | 400 Bad Request | P2 | Pass |
| **TC-INV-14** | Soft delete product dependency guard | Product with active sales line | `DELETE /api/products/P-WITH-SALES` | Checks `salesdetail` or catches trigger P0001; returns 409 Conflict without modifying rows. | 409 Conflict | P1 | Pass |
| **TC-INV-15** | Soft delete product cascade | Product without active sales | `DELETE /api/products/P1001` | Updates `is_deleted = true` on `product` and active rows in `pricehist`. | 200 OK | P1 | Pass |
| **TC-INV-16** | Restore archived product | Soft-deleted product | `POST /api/products/P1001/restore` | Sets `is_deleted = false` on `product` and restores `pricehist` records. | 200 OK | P1 | Pass |
| **TC-INV-17** | RBAC View permission check | Unauthorized employee | `GET /api/products` with `rights: []` | Middleware returns 403 Forbidden. UI hides add/edit/archive buttons. | 403 Forbidden | P1 | Pass |
| **TC-INV-18** | RBAC Edit permission check | View-only employee | `POST /api/products` or `POST /api/products/PX1/price-history` | Mutation returns 403 Forbidden. UI hides "+ Add Price" and edit triggers. | 403 Forbidden | P1 | Pass |
| **TC-INV-19** | Frontend Search debounce | Product catalog | Rapidly type `Prod` in product search | Only 1 API request fired after debounce pause with `search=Product`. | 200 OK | P1 | Pass |
| **TC-INV-20** | Frontend Server Error Alert | Product catalog | `GET /api/products` responds with 500 Internal Error | Displays standardized alert: `"The service is temporarily unavailable. Please try again."`. | 500 Error | P2 | Pass |

---

### 4.3 Price History & Effective Date Calculations (`S2-TST-02`)

| Test ID | Test Scenario | Preconditions | Input / Steps | Expected Result | HTTP Status | Priority | Status |
|---|---|---|---|---|---|---|---|
| **TC-PRC-01** | Price history chronological list | Product with multiple tiers | `GET /api/products/P1001/price-history` | Returns all tiers ordered `effdate DESC`. Includes audit stamps for admins. | 200 OK | P1 | Pass |
| **TC-PRC-02** | Add future price tier | Product exists, valid future date | `POST /api/products/P1001/price-history` with `{ effdate: '2099-01-01', price: 160 }` | Inserts `pricehist` row; writes audit log entry with `old_values` (previous price) and `new_values`. | 201 Created | P1 | Pass |
| **TC-PRC-03** | Reject past effective date | Current date in Asia/Manila | `POST /api/products/P1001/price-history` with `effdate: '2000-01-01'` | Rejects past date: `"Effective date cannot be in the past"`. | 400 Bad Request | P1 | Pass |
| **TC-PRC-04** | Reject non-positive price | None | `POST /api/products/P1001/price-history` with `price: -5.00` or `0` | Rejects: `"price must be a positive number"`. | 400 Bad Request | P1 | Pass |
| **TC-PRC-05** | Reject duplicate effective date | Product has tier on `2099-05-01` | `POST /api/products/P1001/price-history` with same date | Rejects: `"effective date already exists"`. | 400 Bad Request | P1 | Pass |
| **TC-PRC-06** | Effective date lookup: intermediate date | Tiers: Jan 1 ($100), Jun 1 ($120), Nov 1 ($150) | Lookup with `salesdate: '2026-08-15'` | Returns $120.00 (`effdate: '2026-06-01'`), the latest active tier on or before Aug 15. | 200 OK | P1 | Pass |
| **TC-PRC-07** | Effective date lookup: exact date match | Same tiers as above | Lookup with `salesdate: '2026-06-01'` | Returns $120.00 (`effdate: '2026-06-01'`) matching exact effective date. | 200 OK | P1 | Pass |
| **TC-PRC-08** | Effective date lookup: future tier excluded | Same tiers as above | Lookup with `salesdate: '2026-05-31'` | Returns $100.00 (`effdate: '2026-01-01'`); excludes future Jun 1 tier. | 200 OK | P1 | Pass |
| **TC-PRC-09** | Effective date lookup: prior to catalog | Same tiers as above | Lookup with `salesdate: '2025-12-31'` | No tier effective on or before date; returns 404 `"No active price found"`. | 404 Not Found | P1 | Pass |
| **TC-PRC-10** | Effective date lookup: soft-deleted tier ignored | Tier Jun 1 is `is_deleted = true` | Lookup with `salesdate: '2026-08-15'` | Soft-deleted tier excluded; falls back to Jan 1 tier ($100.00). | 200 OK | P1 | Pass |
| **TC-PRC-11** | Effective date lookup: invalid format | None | Lookup with `salesdate: '01-12-2026'` | Rejects non-YYYY-MM-DD: `"salesdate must be a valid date in YYYY-MM-DD format"`. | 400 Bad Request | P1 | Pass |
| **TC-PRC-12** | Effective date lookup: missing product code | None | Lookup with `prodcode: ' '` | Rejects: `"Product code is required"`. | 400 Bad Request | P1 | Pass |
| **TC-PRC-13** | Unit calculation: `lookupUnitPriceAsOfDate` | Unsorted tiers with future/deleted entries | Call utility with target date `2026-10-01` | Correctly filters out `is_deleted: true` and future dates; sorts descending and returns $75.00. | N/A (Unit) | P1 | Pass |
| **TC-PRC-14** | Unit calculation: fallback to Manila date | Active tiers | Call utility with `null` or `undefined` date | Safely defaults to `Asia/Manila` current date; returns current effective unit price. | N/A (Unit) | P2 | Pass |
| **TC-PRC-15** | Unit calculation: safe null handling | None | Call utility with `[]`, `null`, `undefined`, `'not-array'` | Returns `null` without throwing runtime exceptions. | N/A (Unit) | P2 | Pass |

---

## 5. Boundary Condition & Business Formula Assertions

### 5.1 Currency & Financial Calculations
- **Rounding Rule:** All line totals and currency balances are computed using `roundCurrency(Math.round((num + Number.EPSILON) * 100) / 100)`.
- **Floating-point drift protection:** Verified `roundCurrency(0.1 + 0.2) === 0.3`.
- **Line Total Formula:** `calculateLineTotal(qty, unitPrice) = roundCurrency(qty * unitPrice)`.
- **Order Totals Formula:**
  - $\text{Subtotal} = \sum \text{Line Total}$ (excluding `is_deleted = true` or `Inactive` items)
  - $\text{Tax} = \text{roundCurrency}(\text{Subtotal} \times \text{Tax Rate})$
  - $\text{Total Amount} = \text{Subtotal} + \text{Tax}$
  - $\text{Balance} = \max(0, \text{Total Amount} - \text{Amount Paid})$
- **Payment Status Transition:**
  - If $\text{Total Amount} > 0$ and $\text{Balance} \le 0$: `'Paid'`
  - If $\text{Amount Paid} > 0$ and $\text{Balance} > 0$: `'Partial'`
  - Otherwise: `'Unpaid'`

### 5.2 Effective Date Logic & Time Zones
- All date comparisons in backend queries use explicit timezone casting:
  ```sql
  WHERE ph.effdate <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date
  ```
- Price history lookup query in `controllers/sales-controller.js`:
  ```sql
  SELECT ph.prodcode, ph.effdate::text AS effdate, ph.unitprice
  FROM public.pricehist ph
  WHERE ph.prodcode = $1
    AND ph.effdate <= $2::date
    AND ph.is_deleted = false
  ORDER BY ph.effdate DESC
  LIMIT 1
  ```
- This guarantees that price adjustments scheduled for tomorrow in Manila are not prematurely applied, and historical sales transactions preserve the exact price that was legally effective on their sales date.

---

## 6. Execution Results & Regression Summary

### 6.1 Targeted Verification
Command:
```bash
npx vitest run src/pages/CustomerManagementPage.test.tsx src/pages/InventoryPage.test.tsx
```
**Results:**
- `src/pages/CustomerManagementPage.test.tsx`: 10 passed (10 total)
- `src/pages/InventoryPage.test.tsx`: 12 passed (12 total)
- **Total:** 22 passed, 0 failed, 100% pass rate.

### 6.2 Backend & Calculation Verification
Command:
```bash
npx vitest run tests/integration/crm-inventory.test.js lib/sales-calculations.test.js
```
**Results:**
- `tests/integration/crm-inventory.test.js`: 74 passed (74 total)
- `lib/sales-calculations.test.js`: 6 passed (6 total)
- **Total:** 80 passed, 0 failed, 100% pass rate.

### 6.3 Full Project Regression Suite
Command:
```bash
npm test (vitest run)
```
**Results:**
- **Test Files:** 79 passed (79 total)
- **Tests:** 654 passed (654 total)
- **Failures / Regressions:** 0
- **Duration:** 33.45s

---

## 7. QA Sign-Off

- **Test Coverage:** All acceptance criteria for S2-TST-01 and S2-TST-02 are fully implemented with automated unit, integration, and UI tests.
- **Defects:** All observed setup and validation anomalies are resolved and recorded in `docs/qa/bug-log.md`.
- **Verdict:** **PASSED** — Ready for Pull Request merge.
