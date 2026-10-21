# HOPE, Inc. ERP — Backlog & Remaining Tasks Issues

This document contains all remaining issues needed to complete the project, formatted in the exact convention of existing GitHub issues (`### [TASK-ID] Title`, `**Assignee:**`, `**Role:**`, `**Priority:**`, `**Deadline:**`, `**Description:**`, and `**Acceptance Criteria:**`).

All issues below have been published to GitHub in chronological order of deadlines.

---

## 🟢 Sprint 1 Outstanding Gaps & Defect Fixes

### [#51 [BUG-001] Fix Registration API 503 and App_User DB Insertion](https://github.com/Raii-stack/BAIYOGESIC/issues/51)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P1 (Critical)  
**Deadline:** Sprint 1, Day 9  
**Description:**  
Resolve defect BUG-001 where `POST /api/auth/register` returns `503 Service Unavailable` due to permission error (code 42501). Ensure the registration workflow uses the authorized Supabase client, enforces duplicate email checks (409), and properly inserts the new user into the `app_user` table with `status: pending`.  
**Acceptance Criteria:**  
- [ ] `POST /api/auth/register` with valid data returns HTTP 201 Created.
- [ ] Submitting an existing email returns HTTP 409 Conflict.
- [ ] The registered user is securely inserted into `app_user` with `status: pending` and default employee role.
- [ ] Automated integration tests `TC-AUTH-01` and `TC-AUTH-01b` pass cleanly.

---

### [#52 [S1-UIX-05] Usability Review of Built Authentication and User Management Screens](https://github.com/Raii-stack/BAIYOGESIC/issues/52)
**Assignee:** @AlainDeiniel  
**Role:** UI/UX & Frontend Developer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 1, Day 9  
**Description:**  
Conduct a comprehensive usability review across the built Sprint 1 screens (Login, Registration, Set/Reset Password, User Management, and Rights Modal) to catch interaction inconsistencies, accessibility contrast issues, and responsive layout flaws.  
**Acceptance Criteria:**  
- [ ] Perform WCAG AA contrast and keyboard navigation audit across all auth and admin modal screens.
- [ ] Review mobile and tablet breakpoints for User Management table and slide-over panel.
- [ ] Document findings and UI polish tickets in `docs/design/sprint1-usability-review.md`.

---

### [#53 [S1-SM-01 & S1-SM-05] Repository Issue Templates & Sprint 1 Retrospective Report](https://github.com/Raii-stack/BAIYOGESIC/issues/53)
**Assignee:** @RyanJames  
**Role:** Scrum Master  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 1, Day 10  
**Description:**  
Standardize issue templates in `.github/ISSUE_TEMPLATE` for bug reports and tasks, document mid-sprint impediment tracking, and produce the Sprint 1 Review and Retrospective report.  
**Acceptance Criteria:**  
- [ ] Create standardized `.github/ISSUE_TEMPLATE/bug_report.md` matching team format.
- [ ] Create standardized `.github/ISSUE_TEMPLATE/task_issue.md` with role and acceptance criteria.
- [ ] Document mid-sprint impediments and velocity checkpoints in `docs/agile/sprint1-impediments.md`.
- [ ] Publish the Sprint 1 Review and Retrospective report in `docs/agile/sprint1-retrospective.md`.

---

## 🟡 Sprint 2 Remaining Tasks (CRM & Inventory QA, Demo Data, Performance)

### [#54 [S2-TST-01 & S2-TST-02] Test Cases: Customer, Product, and Price History Verification](https://github.com/Raii-stack/BAIYOGESIC/issues/54)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 2, Day 3 (Week 3)  
**Description:**  
Develop automated and manual test cases covering Customer and Product CRUD operations, server pagination, debounced searches, and price history effective date calculations.  
**Acceptance Criteria:**  
- [ ] Write integration tests for `GET /api/customers` and `GET /api/products` pagination and search queries.
- [ ] Validate that price history lookups return the latest price effective on or before the queried date.
- [ ] Document test case specifications in `docs/qa/sprint2-crm-inventory-tests.md`.

---

### [#55 [S2-SM-01 to S2-SM-03] Sprint 2 Agile Tracking, Retro Action Follow-up & Impediment Log](https://github.com/Raii-stack/BAIYOGESIC/issues/55)
**Assignee:** @RyanJames  
**Role:** Scrum Master  
**Priority:** P3 (Low)  
**Deadline:** Sprint 2, Day 5 (Week 3)  
**Description:**  
Initialize the Sprint 2 board, map user stories to PRs, track follow-ups on Sprint 1 retrospective action items, and record blockers in the mid-sprint impediment log.  
**Acceptance Criteria:**  
- [ ] Initialize Sprint 2 GitHub Projects board with user stories and acceptance criteria.
- [ ] Document follow-up progress on Sprint 1 retrospective action items.
- [ ] Log mid-sprint check notes and team impediments in `docs/agile/sprint2-mid-sprint.md`.

---

### [#56 [S2-DBA-05] CRM & Inventory Demo Data and Price History Records](https://github.com/Raii-stack/BAIYOGESIC/issues/56)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 2, Day 7 (Week 4)  
**Description:**  
Populate representative demo records for customer accounts, product items, and multi-tier price history to support full workflow validation and UI pagination.  
**Acceptance Criteria:**  
- [ ] Seed at least 25 realistic customer accounts across `30D`, `45D`, and `COD` payment terms.
- [ ] Seed diverse product inventory with effective price history tiers across multiple dates.
- [ ] Verify demo datasets can be re-run idempotently via Supabase seed scripts.

---

### [#57 [S2-TST-03 & S2-TST-04] Test Cases: Soft Delete/Restore Constraints & Per-Right Permissions](https://github.com/Raii-stack/BAIYOGESIC/issues/57)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P1 (High)  
**Deadline:** Sprint 2, Day 8 (Week 4)  
**Description:**  
Verify data integrity rules blocking soft-deletion of customers and products with active child sales transactions, and test granular per-action permissions (`customers.add`, `customers.edit`, `customers.delete`, `products.edit`).  
**Acceptance Criteria:**  
- [ ] Assert that attempting to archive a customer or product with active sales returns HTTP 409 Conflict with a clear message.
- [ ] Test that unauthorized roles (missing Edit/Delete rights) receive HTTP 403 Forbidden on write routes.
- [ ] Verify frontend action buttons (Edit, Archive, Add) hide or disable according to user permissions.

---

### [#58 [S2-DBA-06] Search Performance Check and Wildcard Index Tuning](https://github.com/Raii-stack/BAIYOGESIC/issues/58)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 2, Day 9 (Week 4)  
**Description:**  
Analyze query execution plans for debounced wildcard customer and product searches and tune database indexes for sub-50ms lookup performance under volume.  
**Acceptance Criteria:**  
- [ ] Run `EXPLAIN ANALYZE` on trigram search indexes (`customer.custname`, `product.description`).
- [ ] Ensure bitmap index scans are prioritized over sequential scans for text queries.
- [ ] Document query performance benchmark results in `docs/database/sprint2-performance.md`.

---

### [#59 [S2-TST-05 & S2-TST-06] Sprint 2 Regression Testing & Bug Fix Verification](https://github.com/Raii-stack/BAIYOGESIC/issues/59)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P1 (High)  
**Deadline:** Sprint 2, Day 9 (Week 4)  
**Description:**  
Execute full regression testing across Sprint 1 auth and Sprint 2 CRM/Inventory deliverables. Log and verify all defects discovered prior to the Sprint 2 review.  
**Acceptance Criteria:**  
- [ ] Run full test suite (`npm test`) ensuring zero regressions across auth, session, and inventory suites.
- [ ] Log Sprint 2 bugs in `docs/qa/bug-log.md` with clear reproduction steps and screenshots.
- [ ] Verify resolved defects and deliver the Sprint 2 QA Sign-off report before the Sprint Review.

---

### [#60 [S2-UIX-04 & S2-UIX-05] CRM & Inventory Empty, Error, Delete States & Usability Review](https://github.com/Raii-stack/BAIYOGESIC/issues/60)
**Assignee:** @AlainDeiniel  
**Role:** UI/UX & Frontend Developer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 2, Day 9 (Week 4)  
**Description:**  
Audit and refine UI states across Customer and Inventory pages: ensure consistent loading skeletons, empty search results, validation error states, and destructive action confirmation dialogs.  
**Acceptance Criteria:**  
- [ ] Implement clear empty-state illustrations and messages when filters match zero customers/products.
- [ ] Design accessible confirmation dialogs for archiving customer and inventory items.
- [ ] Conduct usability walkthrough and document UI polish adjustments in `docs/design/sprint2-usability-review.md`.

---

### [#61 [S2-SM-04 & S2-SM-05] Sprint 2 Velocity Burndown, Review & Retrospective Report](https://github.com/Raii-stack/BAIYOGESIC/issues/61)
**Assignee:** @RyanJames  
**Role:** Scrum Master  
**Priority:** P3 (Low)  
**Deadline:** Sprint 2, Day 10 (Week 4)  
**Description:**  
Update sprint velocity metrics and burndown chart, facilitate the Sprint 2 review and blameless retrospective, and compile the sprint report.  
**Acceptance Criteria:**  
- [ ] Calculate velocity burndown comparing planned vs merged PR targets across roles.
- [ ] Coordinate Sprint 2 demonstration with product stakeholders.
- [ ] Publish the Sprint 2 Review and Retrospective report in `docs/agile/sprint2-retrospective.md`.

---

## 🔵 Sprint 3 Remaining Tasks (HR Archive, Constraints, QA & Usability)

### [#62 [S3-TST-01 & S3-TST-02] Test Cases: Department, Job, and Employee Directory CRUD](https://github.com/Raii-stack/BAIYOGESIC/issues/62)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 3, Day 3 (Week 5)  
**Description:**  
Create automated test suites validating department, job title, and employee directory management, including validation rules (empno format, name length, unique email).  
**Acceptance Criteria:**  
- [ ] Test CRUD operations on `/api/employees/departments` and `/api/employees/jobs`.
- [ ] Test employee creation and update validation (max length, email formats, required fields).
- [ ] Verify server pagination and debounced filtering across department and job filters.

---

### [#63 [S3-SM-01 to S3-SM-03] Sprint 3 Planning Notes, Carryover Prioritization & Impediment Log](https://github.com/Raii-stack/BAIYOGESIC/issues/63)
**Assignee:** @RyanJames  
**Role:** Scrum Master  
**Priority:** P3 (Low)  
**Deadline:** Sprint 3, Day 5 (Week 5)  
**Description:**  
Facilitate Sprint 3 planning, re-prioritize any carryover work from Sprint 2, manage the board, and log blockers in the mid-sprint impediment log.  
**Acceptance Criteria:**  
- [ ] Initialize Sprint 3 project board and map PR deliverables for HR capabilities.
- [ ] Re-prioritize any Sprint 2 carryover tasks.
- [ ] Document mid-sprint impediment notes in `docs/agile/sprint3-mid-sprint.md`.

---

### [#64 [S3-DEV-05] API & Frontend: Employee Soft Delete, Separation Date, and Archive Workflow](https://github.com/Raii-stack/BAIYOGESIC/issues/64)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P1 (High)  
**Deadline:** Sprint 3, Day 6 (Week 6)  
**Description:**  
Build the employee archive/soft-delete API endpoint and UI action. When an employee separates, record separation date and update `is_deleted = true`, preventing deletion if open active transactions exist.  
**Acceptance Criteria:**  
- [ ] Implement `DELETE /api/employees/:empno` setting `is_deleted = true` and `separation_date`.
- [ ] Block deletion if employee has linked active sales orders, returning HTTP 409 Conflict.
- [ ] Connect the archive action in `EmployeeDirectoryPage.tsx` with confirmation modal and toast feedback.

---

### [#65 [S3-DBA-04 & S3-DBA-05] HR Child-Record Delete Constraints and Personnel Demo Data](https://github.com/Raii-stack/BAIYOGESIC/issues/65)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 3, Day 6 (Week 6)  
**Description:**  
Enforce referential integrity triggers preventing hard deletion of departments or jobs with active employee assignments, and seed comprehensive HR demo data with diverse job titles and departments.  
**Acceptance Criteria:**  
- [ ] Add trigger constraints blocking department and job deletion if active employees are assigned.
- [ ] Seed demo data covering multiple departments, job levels, and multi-year job histories.
- [ ] Verify foreign key integrity and cascade rules in Supabase test environment.

---

### [#66 [S3-TST-03 & S3-TST-04] Test Cases: Job History Promotions & Salary Visibility Permissions](https://github.com/Raii-stack/BAIYOGESIC/issues/66)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P1 (High)  
**Deadline:** Sprint 3, Day 7 (Week 6)  
**Description:**  
Validate that employee job history tracking (promotions, transfers, salary updates) functions accurately and that salary data is strictly hidden from non-admin roles both in API responses and UI components.  
**Acceptance Criteria:**  
- [ ] Assert that standard employees querying `/api/employees` receive redacted/null salary fields.
- [ ] Verify admin and superadmin roles receive unredacted salary figures.
- [ ] Validate that job history timeline properly sorts multiple historical entries by `effdate DESC`.

---

### [#67 [S3-DBA-06] HR Database Indexes and Backup/Restore Disaster Recovery Script](https://github.com/Raii-stack/BAIYOGESIC/issues/67)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 3, Day 9 (Week 6)  
**Description:**  
Add covering indexes for HR job history queries and provide verified database backup and restore automation scripts.  
**Acceptance Criteria:**  
- [ ] Create composite index on `jobhistory (empno, effdate DESC, is_deleted)`.
- [ ] Provide portable backup and recovery script with verification documentation.
- [ ] Validate full test database restore from a production-equivalent dump.

---

### [#68 [S3-TST-05 & S3-TST-06] Sprint 3 Full Regression Testing & Defect Verification](https://github.com/Raii-stack/BAIYOGESIC/issues/68)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P1 (High)  
**Deadline:** Sprint 3, Day 9 (Week 6)  
**Description:**  
Perform complete regression testing covering Auth, CRM, Inventory, and HR modules. Log defects, track developer fixes, and prepare Sprint 3 test sign-off.  
**Acceptance Criteria:**  
- [ ] Execute automated regression suite across all active modules with zero critical defects.
- [ ] Verify fix resolution for all Sprint 3 bug log tickets.
- [ ] Publish the Sprint 3 QA Test Summary in `docs/qa/`.

---

### [#69 [S3-UIX-05] Usability Review of Built HR Screens & Timeline Components](https://github.com/Raii-stack/BAIYOGESIC/issues/69)
**Assignee:** @AlainDeiniel  
**Role:** UI/UX & Frontend Developer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 3, Day 9 (Week 6)  
**Description:**  
Review the Employee Directory, Job Timeline, and Department/Job management tabs for visual hierarchy, responsive layout behavior, and ease of navigation.  
**Acceptance Criteria:**  
- [ ] Review Job Timeline visualization across desktop, tablet, and mobile breakpoints.
- [ ] Ensure Department and Job tab modals adhere to Figma design tokens and keyboard focus standards.
- [ ] Document usability improvements in `docs/design/sprint3-usability-review.md`.

---

### [#70 [S3-SM-04 & S3-SM-05] Sprint 3 Velocity Tracking, Sprint 4 Risk Register & Retrospective](https://github.com/Raii-stack/BAIYOGESIC/issues/70)
**Assignee:** @RyanJames  
**Role:** Scrum Master  
**Priority:** P3 (Low)  
**Deadline:** Sprint 3, Day 10 (Week 6)  
**Description:**  
Update team velocity burndown metrics, maintain the Sprint 4 Risk Register covering remaining Sales and Reports modules, and publish the Sprint 3 retrospective report.  
**Acceptance Criteria:**  
- [ ] Update team backlog and velocity metrics for Sprint 3.
- [ ] Maintain the Sprint 4 Risk Register covering Sales and Reports complexity.
- [ ] Publish Sprint 3 Review and Retrospective report in `docs/agile/sprint3-retrospective.md`.

---

## 🟣 Sprint 4 Tasks (Sales & Reports Modules - Unimplemented Backlog)

### [#71 [S4-DEV-01 & S4-DEV-02] API & UI: Sales Transaction Header & Line Items with Price Lookup](https://github.com/Raii-stack/BAIYOGESIC/issues/71)
**Assignee:** @KathrynChloe, @AlainDeiniel  
**Role:** BackEnd Engineer & Frontend Developer  
**Priority:** P1 (High)  
**Deadline:** Sprint 4, Day 3 (Week 7)  
**Description:**  
Implement the Sales module backend and frontend. Support auto-generated transaction numbering, customer and salesperson selection, line item entry (product, quantity), and auto-filling unit price from price history as of sales date.  
**Acceptance Criteria:**  
- [ ] Create `POST /api/sales` and `GET /api/sales` endpoints supporting transaction header and line items.
- [ ] Auto-lookup unit price from `public.current_active_price(prodcode)` or effective date query as of `salesdate`.
- [ ] Replace mock sales data in `CreateSalePage.tsx` and `SalesManagementPage.tsx` with live API integration.
- [ ] Calculate total sale amount, tax, and item subtotals accurately.

---

### [#72 [S4-DBA-01 to S4-DBA-03] Database Queries: Sales Totals, Payment Balance View & 7 Report Queries](https://github.com/Raii-stack/BAIYOGESIC/issues/72)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P1 (High)  
**Deadline:** Sprint 4, Day 4 (Week 7)  
**Description:**  
Write optimized PostgreSQL views and functions for sales calculations, payment balances, and all 7 report queries (master lists, active/separated employee rosters, Top N sales aggregations).  
**Acceptance Criteria:**  
- [ ] Create `sales_balance_view` calculating line subtotals, VAT, total amount, payments, and balance.
- [ ] Write SQL queries for Top N Customers, Top N Products, and Top N Sales orders with date filters.
- [ ] Ensure report aggregation queries utilize covering indexes and run within acceptable performance thresholds.

---

### [#73 [S4-TST-01] Test Cases: Sales Transactions and Unit Price-as-of-Date Calculation](https://github.com/Raii-stack/BAIYOGESIC/issues/73)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 4, Day 5 (Week 7)  
**Description:**  
Develop automated integration test suites validating sales creation, price lookup logic effective as of transaction date, line-item quantity math, and subtotal computations.  
**Acceptance Criteria:**  
- [ ] Write integration tests for sales creation with single and multiple line items.
- [ ] Test edge cases: historical price changes, zero quantities, and invalid product codes.
- [ ] Validate tax and line-item total calculations match backend constraints.

---

### [#74 [S4-DEV-03 & S4-DEV-06] API & UI: Payment Recording & Customer Transaction Balance Calculation](https://github.com/Raii-stack/BAIYOGESIC/issues/74)
**Assignee:** @KathrynChloe, @AlainDeiniel  
**Role:** BackEnd Engineer & Frontend Developer  
**Priority:** P1 (High)  
**Deadline:** Sprint 4, Day 6 (Week 8)  
**Description:**  
Build endpoints and UI to record customer payments against sales transactions, calculate remaining outstanding balances per sale and per customer, and handle partial/full payment states.  
**Acceptance Criteria:**  
- [ ] Create `POST /api/sales/:transno/payments` to record payment amount, date, and method.
- [ ] Implement balance calculation view returning `total_amount - amount_paid`.
- [ ] Provide modal in Sales Management UI to log payments and display updated balance badges (Unpaid, Partial, Paid).

---

### [#75 [S4-DEV-04 & S4-DEV-05] API & UI: Reports Module (7 Reports, Date Range, Top N, PDF Export)](https://github.com/Raii-stack/BAIYOGESIC/issues/75)
**Assignee:** @KathrynChloe, @AlainDeiniel  
**Role:** BackEnd Engineer & Frontend Developer  
**Priority:** P1 (High)  
**Deadline:** Sprint 4, Day 6 (Week 8)  
**Description:**  
Implement the Reports module supporting all 7 system reports: Product Master List, Active Employees, All Employees, Employee Job History, Top Customers, Top Products, and Top Sales. Support date range, Top N parameter, per-report permissions, and Print/Save as PDF.  
**Acceptance Criteria:**  
- [ ] Create `GET /api/reports/:reportType` endpoint with query parameters for `startDate`, `endDate`, and `limit`.
- [ ] Enforce per-report access rights using `requirePermission('Reports', reportCode)`.
- [ ] Replace sample report data in `ReportsPage.tsx` with live data fetching.
- [ ] Implement browser Print and Save as PDF styling.

---

### [#76 [S4-DBA-04 & S4-DBA-05] Database: Audit Log Filter Queries & Sales Child Delete Integrity Rules](https://github.com/Raii-stack/BAIYOGESIC/issues/76)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 4, Day 6 (Week 8)  
**Description:**  
Write filtered audit log query procedures, verify cascade and restrict delete constraints on sales details and payments, ensuring payments cannot be orphaned.  
**Acceptance Criteria:**  
- [ ] Implement database triggers blocking deletion of sales with active payment records.
- [ ] Write optimized query procedure for `audit_log` filtering by table, actor, and timestamp.
- [ ] Document relational integrity and foreign key behavior.

---

### [#77 [S4-TST-02] Test Cases: Payment Processing and Transaction Balance Reductions](https://github.com/Raii-stack/BAIYOGESIC/issues/77)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 4, Day 7 (Week 8)  
**Description:**  
Validate payment application rules against sales transactions, ensuring partial payments decrease balance, full payments transition status to Paid, and overpayments are rejected.  
**Acceptance Criteria:**  
- [ ] Test valid partial payment reduces open balance.
- [ ] Test that payment equal to outstanding balance marks transaction Paid.
- [ ] Test that payment exceeding balance returns HTTP 400 Bad Request.

---

### [#78 [S4-DEV-07] API & UI: Sales Soft Delete, Restoration & Sale Rights Enforcement](https://github.com/Raii-stack/BAIYOGESIC/issues/78)
**Assignee:** @KathrynChloe, @AlainDeiniel  
**Role:** BackEnd Engineer & Frontend Developer  
**Priority:** P1 (High)  
**Deadline:** Sprint 4, Day 8 (Week 8)  
**Description:**  
Support archiving and restoring sales transactions with audit stamp and status flags, strictly enforcing Sale and Sale Detail permissions.  
**Acceptance Criteria:**  
- [ ] Create `DELETE /api/sales/:transno` (soft-archive) and `PATCH /api/sales/:transno/restore`.
- [ ] Enforce `sales.delete` and `sales.restore` permissions.
- [ ] Block archiving if payments have already been applied, returning HTTP 409 Conflict.
- [ ] Connect archive/restore actions in the Sales UI table with confirmation modal and status badges.

---

### [#79 [S4-TST-03 & S4-TST-04] Test Cases: Reports Accuracy & End-to-End Complete ERP Workflow](https://github.com/Raii-stack/BAIYOGESIC/issues/79)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P1 (High)  
**Deadline:** Sprint 4, Day 8 (Week 8)  
**Description:**  
Create tests verifying all 7 reports for accurate data filtering and permissions, and automate the complete end-to-end journey: Register -> Approve -> Assign Rights -> Login -> Sell -> Pay -> Run Reports.  
**Acceptance Criteria:**  
- [ ] Validate calculation accuracy and date-filtering across all 7 reports.
- [ ] Implement automated E2E test executing the full ERP lifecycle from account creation to report generation.
- [ ] Assert correct permission blocks when generating reports without appropriate rights.

---

### [#80 [S4-DEV-08] API & UI: Superadmin Audit Log Viewer with Multi-Filter Search](https://github.com/Raii-stack/BAIYOGESIC/issues/80)
**Assignee:** @KathrynChloe, @AlainDeiniel  
**Role:** BackEnd Engineer & Frontend Developer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 4, Day 9 (Week 8)  
**Description:**  
Build the superadmin audit log viewer endpoint and interface, allowing administrators to query and inspect audit trail records by table, action type (ADD, EDIT, DELETE), username, and date range.  
**Acceptance Criteria:**  
- [ ] Create `GET /api/audit-logs` endpoint accessible exclusively to Superadmin accounts.
- [ ] Support filters: `tableName`, `action`, `user`, `from`, `to`, and pagination.
- [ ] Build UI table in admin panel displaying audit entries, old/new diffs, and timestamps.

---

### [#81 [S4-DBA-06] Database: Rebuild from Migrations Verification, Backup & Disaster Recovery Docs](https://github.com/Raii-stack/BAIYOGESIC/issues/81)
**Assignee:** @KathrynChloe  
**Role:** BackEnd Engineer & DB Admin  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 4, Day 9 (Week 8)  
**Description:**  
Perform a complete database rebuild validation from migrations on a clean database instance, verify disaster recovery backup procedures, and finalize schema documentation.  
**Acceptance Criteria:**  
- [ ] Verify clean schema rebuild from `supabase/migrations/` and `seed.sql` on a fresh database instance.
- [ ] Execute and test point-in-time recovery backup scripts.
- [ ] Deliver database disaster recovery procedure and schema documentation in `docs/database/`.

---

### [#82 [S4-TST-05 & S4-TST-06] Final Project Full Regression Across All Modules & Sign-off Report](https://github.com/Raii-stack/BAIYOGESIC/issues/82)
**Assignee:** @PrinceNelson  
**Role:** Test Engineer  
**Priority:** P1 (Critical)  
**Deadline:** Sprint 4, Day 9 (Week 8)  
**Description:**  
Execute full end-to-end regression testing across the entire HOPE ERP platform, verify zero open High/Critical defects, and publish the final QA Sign-off report.  
**Acceptance Criteria:**  
- [ ] 100% execution of regression test suites covering Auth, CRM, Inventory, HR, Sales, and Reports.
- [ ] Zero open P1/P2 defects in `docs/qa/bug-log.md`.
- [ ] Publish Final Test Sign-off Report in `docs/qa/final-test-sign-off.md`.

---

### [#83 [S4-UIX-01 to S4-UIX-05] UI/UX: Sales, Payments, Reports Styling, Audit Viewer & Final Usability Pass](https://github.com/Raii-stack/BAIYOGESIC/issues/83)
**Assignee:** @AlainDeiniel  
**Role:** UI/UX & Frontend Developer  
**Priority:** P2 (Medium)  
**Deadline:** Sprint 4, Day 9 (Week 8)  
**Description:**  
Design and polish user interfaces for Sales order entry, payment recording, 7 report layouts with print/PDF styling, and conduct the final design system accessibility and consistency pass across all 6 ERP modules.  
**Acceptance Criteria:**  
- [ ] Design accessible sales entry and payment confirmation modals.
- [ ] Add print-friendly stylesheets (`@media print`) for all 7 reports.
- [ ] Standardize modal transitions, loading skeletons, and toast behaviors across all pages.
- [ ] Verify full keyboard accessibility across all data tables and action menus.
- [ ] Complete final usability evaluation and sign-off report in `docs/design/final-usability-report.md`.

---

### [#84 [S4-SM-01 to S4-SM-05] Sprint 4 Release Checklist, Demo Script, Peer Evaluations & Final Project Report](https://github.com/Raii-stack/BAIYOGESIC/issues/84)
**Assignee:** @RyanJames  
**Role:** Scrum Master  
**Priority:** P1 (High)  
**Deadline:** Sprint 4, Day 10 (Week 8)  
**Description:**  
Lead the final Sprint 4 delivery, assemble the production release checklist, write the live demo presentation script, coordinate team peer evaluations, and compile the final project report.  
**Acceptance Criteria:**  
- [ ] Prepare Production Release Checklist and deployment verification plan.
- [ ] Draft end-to-end product demo script for stakeholder presentation.
- [ ] Collect and compile peer evaluation submissions.
- [ ] Deliver the Final Project Report and Retrospective in `docs/agile/final-project-report.md`.
