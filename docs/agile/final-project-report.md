# HOPE, Inc. ERP — Sprint 4 Release Checklist, Demo Script, Peer Evaluations & Final Project Report

**Project:** HOPE, Inc. Enterprise Resource Planning (ERP) Platform (`Raii-stack/BAIYOGESIC`)  
**Sprint:** Sprint 4 (Release & Project Closeout)  
**Scrum Master:** Ryan James (@Raii-stack)  
**Prerequisite:** [#83](https://github.com/Raii-stack/BAIYOGESIC/issues/83) (UI/UX: Sales, Payments, Reports Styling, Audit Viewer & Final Usability Pass — Closed via PR `#192`)  
**Date:** November 2026  

---

## 1. Executive Summary

Across four two-week sprints, the HOPE, Inc. ERP team designed, built, secured, and optimized a full-stack enterprise web application using React 19, TypeScript, Vite, Tailwind CSS, Express 5, and PostgreSQL (Supabase), deployed on Vercel with automated GitHub Actions CI/CD governance.

The platform delivers all core ERP business modules and post-Sprint 4 enhancements:
1. **Authentication, RBAC & Workspace Governance:** Cookie-backed JWT sessions (`HttpOnly`, `SameSite=Lax`), self-registration with pending admin approval (`#168`, PR `#193`), email verification and 15-minute single-use password recovery links (`PR #206`), granular module/action rights with department presets (`#101`), workspace preferences (`/settings`), and persistent transactional notifications (`/notifications`).
2. **Customer Relationship Management (CRM) & Inventory Pricing:** Debounced wildcard search backed by PostgreSQL `pg_trgm` GIN indexes (`#58`, `#110`), 30/45/60-day and `COD` payment terms, effective-dated `pricehist` timelines (`#104`, `#108`), and active-sales archive protection (`#105`).
3. **Human Resources & Job History:** Employee directory, dedicated Department and Job CRUD (`#113`, `#116`), chronological promotion/transfer career timeline (`#114`, `#117`), separation-date soft delete (`#64`), role-based salary masking (`#115`, `#118`), and `VIEW_SALARY` PII audit logging (`#202`, PR `#211`).
4. **Sales, Multi-Method Payments & 7 Executive Reports:** Sequential sales transactions (`SO-YYYYMM-XXXX`) with automatic price-as-of-date lookup (`#71`), payment recording with dynamic `sales_balance_view` tracking (`#74`), soft delete/restore guards (`#76`, `#78`), live Dashboard KPI cards (`#167`), and all 7 Guide §3.7 reports with `@media print` PDF export (`#72`, `#75`, `#83`).
5. **Superadmin Audit Log Viewer & Performance Tuning:** Immutable append-only `audit_log` with diff inspection and single-roundtrip window pagination (`#80`, `#169`), alongside 28 verified database migrations (`#81`, `npm run verify:migrations`).

---

## 2. Sprint 4 Velocity & Cross-Sprint Delivery Summary

### 2.1 Sprint 4 Issue & PR Mapping

| Issue | Task ID & Summary | Owner | Status | Merged PR(s) & Deliverables |
|---|---|---|:---:|---|
| [#71](https://github.com/Raii-stack/BAIYOGESIC/issues/71) | `[S4-DEV-01 & S4-DEV-02]` Sales Transaction Header & Line Items with Price Lookup | @itsmechloe, @alainmnts | **Closed** | PR `#144` — `POST/GET /api/sales`, `CreateSalePage.tsx`, `SalesManagementPage.tsx` |
| [#72](https://github.com/Raii-stack/BAIYOGESIC/issues/72) | `[S4-DBA-01 to S4-DBA-03]` Sales Totals, `sales_balance_view` & 7 Report Queries | @itsmechloe | **Closed** | PR `#177` — Views, TVFs, `sales_active_reports_idx`, `docs/database/sprint4-report-queries-specification.md` |
| [#74](https://github.com/Raii-stack/BAIYOGESIC/issues/74) | `[S4-DEV-03 & S4-DEV-06]` Payment Recording & Transaction Balance Calculation | @Polygonic / @itsmechloe / @alainmnts | **Closed** | PR `#180`, `#212` — `POST /api/sales/:transno/payments`, `RecordPaymentModal.tsx`, `docs/sales/payment-recording-and-balances.md` |
| [#75](https://github.com/Raii-stack/BAIYOGESIC/issues/75) | `[S4-DEV-04 & S4-DEV-05]` Reports Module (7 Reports, Date Range, Top N, PDF Export) | @itsmechloe, @alainmnts | **Closed** | PR `#181` — `GET /api/reports/:reportType`, `requirePermission('Reports', reportCode)`, `ReportsPage.tsx` |
| [#76](https://github.com/Raii-stack/BAIYOGESIC/issues/76) | `[S4-DBA-04 & S4-DBA-05]` Audit Log Filter Queries & Sales Child Delete Integrity | @itsmechloe | **Closed** | PR `#185` — Delete triggers, `audit_log` composite indexes, `docs/database/sales-child-delete-integrity-and-audit-log.md` |
| [#78](https://github.com/Raii-stack/BAIYOGESIC/issues/78) | `[S4-DEV-07]` Sales Soft Delete, Restoration & Sale Rights Enforcement | @Polygonic / @itsmechloe / @alainmnts | **Closed** | PR `#190`, `#212` — `DELETE /api/sales/:transno`, `PATCH /api/sales/:transno/restore`, `docs/sales/soft-delete-and-restoration.md` |
| [#80](https://github.com/Raii-stack/BAIYOGESIC/issues/80) | `[S4-DEV-08]` Superadmin Audit Log Viewer with Multi-Filter Search | @Polygonic / @itsmechloe / @alainmnts | **Closed** | PR `#191`, `#212` — `GET /api/audit-logs`, `AuditLogViewer`, `DiffInspectorModal`, `docs/audit/superadmin-audit-log-viewer.md` |
| [#81](https://github.com/Raii-stack/BAIYOGESIC/issues/81) | `[S4-DBA-06]` Rebuild from Migrations Verification, Backup & DR Docs | @itsmechloe | **Closed** | PR `#194` — `verify_database_integrity()`, `docs/database/sprint4-rebuild-verification-and-disaster-recovery.md` |
| [#83](https://github.com/Raii-stack/BAIYOGESIC/issues/83) | `[S4-UIX-01 to S4-UIX-05]` Sales, Payments, Reports Styling & Final Usability Pass | @alainmnts | **Closed** | PR `#192` — Print/PDF stylesheets, responsive polish, `docs/design/final-usability-report.md` |
| [#167](https://github.com/Raii-stack/BAIYOGESIC/issues/167) | `[S4-DEV-09]` Live Dashboard KPI Statistic Cards & Role Quick Actions | @itsmechloe, @alainmnts | **Closed** | PR `#175` — `GET /api/dashboard/stats` with short-TTL cache and covering KPI indexes |
| [#169](https://github.com/Raii-stack/BAIYOGESIC/issues/169) | `[S4-DBA-07]` Query Optimization, Covering Indexes & Window Pagination | @Raii-stack | **Closed** | PR `#174` — `LATERAL` lookups, `count(*) OVER()`, `docs/database/query-optimization-report.md` |
| [#168](https://github.com/Raii-stack/BAIYOGESIC/issues/168) | `[POST-S4-AUTH]` Public Landing Page, Self-Registration & Password Recovery | @itsmechloe, @alainmnts | **Closed** | PR `#193` (plus verification PR `#206`, `#207`) — `/`, `/register`, `/reset-password` |
| [#199](https://github.com/Raii-stack/BAIYOGESIC/issues/199) | `[S4-DSO-01]` Strict CORS Origin Validation & Vercel Wildcard Elimination | @Polygonic | **Closed** | PR `#208` — Eliminated wildcard `.vercel.app` CORS matching |
| [#84](https://github.com/Raii-stack/BAIYOGESIC/issues/84) | `[S4-SM-01 to S4-SM-05]` Release Checklist, Demo Script, Peer Evaluations & Final Report | @Raii-stack | **In Review** | `docs/agile/final-project-report.md` (this PR) |
| [#73](https://github.com/Raii-stack/BAIYOGESIC/issues/73), [#77](https://github.com/Raii-stack/BAIYOGESIC/issues/77), [#79](https://github.com/Raii-stack/BAIYOGESIC/issues/79), [#82](https://github.com/Raii-stack/BAIYOGESIC/issues/82) | `[S4-TST-01 to S4-TST-06]` Sales, Payments, Reports Accuracy & Full ERP Regression Sign-Off | @princeaguinaldo | **Open** | `tests/integration/sales-api.test.js` & `reports-api.test.js` present; pending live test-DB E2E & final QA sign-off (`docs/qa/final-test-sign-off.md`) |

> **Release Transparency Note:** Core application engineering across Sprints 1–4 is complete and merged, while formal live-database QA regression sign-off tickets (`#54`, `#57`, `#59`, `#112`, `#62`, `#66`, `#68`, `#121`, `#73`, `#77`, `#79`, `#82`) and remaining DevSecOps workflow/runbook items (`#119`, `#124`–`#126`) remain tracked as explicit pre-release verification gates in Section 3.

---

## 3. Production Release Checklist & Deployment Verification Plan (`S4-SM-01`)

All gates below must be verified green before promoting `test` to `main` via `.github/workflows/enforce-test-branch.yml` and deploying to Vercel production.

### 3.1 Pre-Release Code, Database & Security Gates

- [x] **JavaScript Syntax & Lint:** `npm run lint` passes across all 45 JavaScript files.
- [x] **Migration Sequence Integrity:** `npm run verify:migrations` validates all 28 SQL migrations in `supabase/migrations/` with zero timestamp collisions or safety violations.
- [x] **Automated Unit & Component Suites:** `npm test` (Vitest: 80 files, 606 tests) and `npm run test:unit` (Jest: 7 suites, 137 tests) pass cleanly.
- [x] **Production Frontend Build:** `npm run build` (`vite build`) produces `dist/` cleanly with zero build errors.
- [x] **CORS, Security Headers & Cookie Hardening:** Helmet headers, `Cache-Control: no-store` on `/api`, `HttpOnly` / `SameSite=Lax` / `Secure` JWT cookies, and strict `CLIENT_ORIGIN` validation (`#122`, `#199`, `#201`) verified.
- [ ] **Live-DB Integration & Full E2E Sign-Off:** Run `npm run test:integration` and `npm run test:e2e` against the seeded staging/test Supabase database and publish `docs/qa/final-test-sign-off.md` (`#79`, `#82`), reconciling `BUG-001` & `BUG-002` in `docs/qa/bug-log.md`.
- [ ] **SAST & Production Alerting Sign-Off:** Enable CodeQL SAST workflow (`#124`) and finalize monitoring/alerting runbook (`#125`), plus verify `npm audit --audit-level=critical` and TruffleHog secret scans pass on the release commit.

### 3.2 Environment Variables & Vercel Configuration Verification

Verify the following production environment variables in Vercel Project Settings (matching `.env.example` and `vercel.json`):

| Variable | Scope | Verification Criterion |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | Server-only | Points to production Supabase project; never prefixed with `VITE_` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Required for `app_user` login/registration lookup; restricted from client bundle |
| `DATABASE_URL`, `DATABASE_POOLER_HOST` | Server-only | Uses IPv4 Supabase pooler (`sslmode=require`) for Vercel Serverless (`#102`) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Server-only | Long random production secret; `1h` session expiry |
| `CLIENT_ORIGIN`, `APP_URL` | Server-only | Set to canonical HTTPS Vercel production origin (no trailing slash or wildcard) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Server-only | Validated Google App Password for registration OTP and 15-minute password reset emails |
| `vercel.json` Rewrites | Repo config | `/api/(.*)` and `/health` rewrite to `/api`; SPA routes rewrite to `/index.html` |

### 3.3 Deployment & Post-Deploy Smoke Verification Plan

1. **Database Backup & Migration Apply:**
   - Capture pre-release database snapshot using `node scripts/db-backup-restore.js` / `scripts/backup-restore.sh` (`#81`).
   - Apply any pending files in `supabase/migrations/` in chronological order and execute `SELECT * FROM public.verify_database_integrity();` to confirm all triggers, covering indexes, and constraints are intact.
2. **Branch Promotion (`test` -> `main`):**
   - Ensure all Sprint 4 PRs are merged into `test` and CI passes on `test`.
   - Open promotion PR from `test` into `main` (authored by `@Raii-stack` per `.github/workflows/enforce-test-branch.yml`) and verify CI + Vercel Preview.
3. **Production Smoke Checks:**
   - `GET /health` and `GET /api/health` return `HTTP 200`.
   - Unauthenticated `GET /api/auth/session` returns expected unauthenticated state; protected endpoints (`/api/customers`, `/api/sales`, `/api/reports/...`, `/api/audit-logs`) return `HTTP 401`.
   - Superadmin login succeeds, Dashboard KPI cards (`/dashboard`) load live stats, and `GET /api/audit-logs` renders immutable audit events.
4. **Rollback Procedure:**
   - Revert Vercel deployment to the prior verified production alias if an application regression appears.
   - Restore database state from the pre-release snapshot manifest via `scripts/db-backup-restore.js` if a destructive schema/data issue occurs.

---

## 4. End-to-End Stakeholder Demo Script (`S4-SM-02`)

**Estimated Duration:** 15–20 minutes | **Environment:** Deployed Vercel Preview / Production URL with seeded demo dataset (`supabase/seed.sql`)

| Step | Time | Route / Area | Live Presenter Actions & Talking Points | Expected Observable Outcome |
|---|:---:|---|---|---|
| **1. Public Landing & Self-Registration** | 2 min | `/`, `/register` | Open the landing page (`/`), navigate to `/register`, and submit a new employee registration request. Show pending approval notification flow. | New user starts with `pending` status; email verification protects registration before admin approval (`#168`, `PR #206`). |
| **2. Superadmin Approval & RBAC** | 2 min | `/login`, `/users` | Sign in as Superadmin, open User Management (`/users`), approve the pending user, assign role/department permissions, and note automatic permission reset on role switch. | Account becomes active; custom rights persist and enforce least privilege (`#101`). |
| **3. Workspace Settings & Notifications** | 1.5 min | `/dashboard`, `/settings`, `/notifications` | Review Dashboard KPI statistic cards (`Customers`, `Products`, `Open Orders`, `Revenue`) and role-aware Quick Actions. Toggle density/notification preferences in `/settings` and inspect `/notifications`. | KPI cards reflect live SQL aggregates (`#167`); transactional notifications render in the inbox. |
| **4. CRM & Dated Price History** | 3 min | `/customers`, `/inventory` | Search customers with debounced filtering (`COD`, `30D`, `45D`, `60D`). Switch to `/inventory`, open a product's **Price History** modal, add a new effective-dated price tier, and attempt to archive a record linked to active sales. | `pg_trgm` search returns instantaneously; active price updates cleanly; archiving linked records returns a clear `HTTP 409 Conflict` warning (`#58`, `#105`, `#108`). |
| **5. HR Directory, Career Timeline & Salary Masking** | 3 min | `/employees`, `/departments`, `/employees/:employeeId` | Browse Departments and Jobs, open an employee profile, review the visual `CareerTimeline` (promotions/transfers), and compare Superadmin salary visibility vs. masked view for standard accounts. | Timeline orders entries by `effdate DESC`; non-authorized roles see redacted salary badges and `VIEW_SALARY` events are logged (`#114`, `#115`, `#117`, `#118`, `#202`). |
| **6. Sales Order, Effective-Date Pricing & Payments** | 3.5 min | `/sales/new`, `/sales` | Create a new sales order (`SO-YYYYMM-XXXX`), add multiple line items showing automatic price-as-of-date population, record a partial payment via `RecordPaymentModal`, attempt an overpayment (rejected `HTTP 400`), then complete full payment. | Status transitions `Unpaid` -> `Partial` -> `Paid`; `sales_balance_view` updates in place; paid sales block archiving (`HTTP 409`) (`#71`, `#74`, `#78`). |
| **7. 7 Executive Reports & Print/PDF Export** | 2.5 min | `/reports` | Filter **Top Customers** and **Top Sales** with date range and Top-N parameters, inspect **Employee Job History** with the employee dropdown, and open Print/Save as PDF preview. | Single-pass reports load cleanly; `@media print` strips navigation chrome and repeats table headers across pages (`#72`, `#75`, `#83`). |
| **8. Audit Log Viewer & Diff Inspector** | 2 min | `/users` (Audit tab) | Filter `audit_log` by table (`sales` / `pricehist` / `employee`), actor, and action (`INSERT`/`UPDATE`/`DELETE`); open `DiffInspectorModal` on an update row. | Old vs. new JSON diffs render color-coded changes; append-only immutability notice confirms tamper protection (`#76`, `#80`). |

---

## 5. Team Contribution Record & Peer Evaluation Compilation (`S4-SM-03`)

### 5.1 Verified Engineering Contribution Summary (Sprints 1–4)

| Team Member | GitHub Handle | Primary Role | Key Verified Deliverables Across Sprints 1–4 |
|---|---|---|---|
| **Kathryn Chloe** | `@itsmechloe` | Backend Engineer & DB Admin | Core PostgreSQL schema & 28 migrations, RLS/triggers, `pg_trgm` & covering index optimization, HR/Sales/Reports/Audit APIs, DR scripts & rebuild verification (`#19`–`#26`, `#51`, `#56`, `#58`, `#64`–`#67`, `#71`, `#72`, `#75`, `#76`, `#81`, `#103`–`#105`, `#110`, `#113`–`#115`, `#120`, `#130`, `#167`) |
| **Alain Deiniel** | `@alainmnts` | UI/UX & Frontend Developer | Tailwind design system, WCAG 2.1 AA compliance, auth/RBAC/workspace UIs, CRM/Inventory/HR Career Timeline/Salary Masking UIs, Sales/Payments/Reports `@media print` & Audit Diff Inspector UI, usability reviews (`#13`–`#18`, `#52`, `#60`, `#69`, `#71`, `#75`, `#83`, `#106`–`#108`, `#116`–`#118`, `#128`, `#167`, `#168`) |
| **Marron Beroy** | `@Polygonic` | DevSecOps Engineer | GitHub Actions CI (`ci.yml`), dependency & secret scanning (`#123`), Helmet/CORS/rate-limiting/auth brute-force protection (`#109`, `#111`, `#122`, `#199`, `#201`), HR PII log redaction & `VIEW_SALARY` audit (`#202`), Sales/Audit technical documentation (`#74`, `#78`, `#80`) |
| **Prince Nelson** | `@princeaguinaldo` | Test Engineer | Sprint 1 QA test plan, auth/RBAC/smoke & bug verification reports (`#29`–`#32`), `docs/qa/bug-log.md` (`BUG-001`–`BUG-004`), automated integration/E2E suites (`crm-inventory.test.js`, `hr-*.test.js`, `sales-api.test.js`, `reports-api.test.js`, `tests/e2e/`) |
| **Ryan James** | `@Raii-stack` | Scrum Master & Release Lead | Issue templates & GitHub Projects #5 automation (`#53`, `#99`–`#102`), Sprint 1–4 tracking & retrospectives (`#55`, `#61`, `#63`, `#70`, `#84`), Vercel pooler deployment fix (`#85`), `LATERAL` / covering index / window-pagination optimization (`#169`), automated PR review & bug triage scripts |

### 5.2 Peer Evaluation Compilation Matrix

> **Compilation Status:** Confidential peer evaluation forms are distributed to all five team members at Sprint 4 close. Individual numerical ratings and qualitative peer feedback are recorded below upon receipt of signed submissions (none fabricated prior to collection).

| Evaluatee | Role | Technical Delivery | Collaboration & Communication | Reliability & Deadlines | Peer Submissions Received | Compilation Status |
|---|---|---:|---:|---:|:---:|---|
| **Kathryn Chloe** (`@itsmechloe`) | Backend & DB Admin | *Pending form* | *Pending form* | *Pending form* | `0 / 4` | Awaiting final team submission |
| **Alain Deiniel** (`@alainmnts`) | UI/UX & Frontend | *Pending form* | *Pending form* | *Pending form* | `0 / 4` | Awaiting final team submission |
| **Marron Beroy** (`@Polygonic`) | DevSecOps Engineer | *Pending form* | *Pending form* | *Pending form* | `0 / 4` | Awaiting final team submission |
| **Prince Nelson** (`@princeaguinaldo`) | Test Engineer | *Pending form* | *Pending form* | *Pending form* | `0 / 4` | Awaiting final team submission |
| **Ryan James** (`@Raii-stack`) | Scrum Master | *Pending form* | *Pending form* | *Pending form* | `0 / 4` | Awaiting final team submission |

---

## 6. Final Project Retrospective & Lessons Learned (`S4-SM-04 & S4-SM-05`)

### 6.1 Cross-Sprint Achievements (What Went Well)
- **Database-First Integrity & Sub-50 ms Performance:** Using PostgreSQL triggers (`*_bd_block`, `audit_log_prevent_mutation`), views (`sales_balance_view`), `LATERAL` price lookups, `pg_trgm` GIN indexes, and single-roundtrip window pagination kept hot queries under `3.2 ms` while guaranteeing referential safety (`#81`, `#169`).
- **Cohesive, Accessible UI Architecture:** Standardizing modal focus traps, `TableSkeleton`, `SuccessToast`, responsive breakpoints, and `@media print` stylesheets across all 6 business modules achieved WCAG 2.1 AA sign-off in `docs/design/final-usability-report.md` (`#83`).
- **Automated Governance & CI Guardrails:** `enforce-test-branch.yml`, `auto-route-pr.yml`, `project-automation.yml`, `copilot-pr-review.yml`, and `ci.yml` prevented direct unreviewed merges to `main`, caught migration drift, and enforced lint/test checks on every PR.

### 6.2 Project-Wide Challenges & Takeaways
- **Live-DB QA Synchronization:** Separating test authoring from live staging-DB test-account seeding caused Sprint 2–4 QA issue closures (`#54`–`#59`, `#62`–`#68`, `#73`–`#82`) to trail feature merges even when test files passed under mocks. Future projects should provision seeded staging credentials in Sprint 1 so E2E verification ships in the same PR cycle as features.
- **Process Discipline on Direct Commits & Issue Linking:** Early Sprint 1/2 tasks (`#53`, `#55`) closed without linked PRs or via direct commits to `main`, creating traceability gaps later resolved retroactively. Enforcing `test`-branch PRs and `Closes #<issue>` conventions via `project-automation.js` resolved this for Sprints 3–4.
- **Security & Scope Boundary Clarity:** Removing and later re-integrating self-registration and password recovery (`BUG-002` -> `#168` -> `PR #206`) reinforced the need for explicit feature-flag or post-sprint tracking rather than mid-sprint endpoint removal without synchronized test updates.

---

## 7. Final Scrum Master Sign-Off

The HOPE, Inc. ERP application codebase, database migration suite (28 migrations), production build, release checklist, and stakeholder demo script are prepared for final QA live-DB sign-off (`#79`, `#82`), SAST/monitoring completion (`#124`, `#125`), and production promotion from `test` to `main`.

**Submitted by:** Ryan James (Scrum Master, `@Raii-stack`)  
**Date:** November 2026
