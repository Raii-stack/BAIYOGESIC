# HOPE, Inc. ERP — Sprint 2 Review & Retrospective Report

**Sprint:** Sprint 2  
**Sprint Goal:** Customer Relationship Management (CRM), Product Catalog & Price History, Trigram Search Optimization & Automated CI/CD Security  
**Sprint Duration:** Days 1 – 10 (Weeks 3 – 4)  
**Scrum Master:** Ryan James (@Raii-stack)  
**Date:** November 2026  

---

## 1. Executive Summary

Sprint 2 delivered the full Customer Relationship Management (CRM) and Product Inventory modules for the HOPE, Inc. Enterprise Resource Planning (ERP) platform. Building on the Sprint 1 authentication and RBAC foundation, the team implemented server-side validated CRUD APIs for customers and products, effective-date price history lookups and timeline visualizations, soft-delete referential integrity guards (blocking archive operations with HTTP `409 Conflict` when active child sales exist), and PostgreSQL `pg_trgm` GIN indexes achieving sub-50 ms wildcard searches.

In parallel, the team resolved all Sprint 1 carryover items (`#51`, `#52`, `#53`), established automated CI/CD integration test runners, schema drift checks, dependency vulnerability scanning, and rate-limiting middleware, and completed a comprehensive WCAG AA usability pass across CRM and Inventory views (`#60`).

---

## 2. Sprint Metrics & Velocity Burndown

### 2.1 Overall Sprint Delivery Summary

| Metric | Target | Actual | Evaluation |
|---|:---:|:---:|:---:|
| **Committed Sprint 2 Tasks** | 22 | 22 | 100% scoped |
| **Sprint 1 Carryover Resolved** | 3 | 3 | 100% carryover cleared (`#51`, `#52`, `#53`) |
| **Completed Sprint 2 Tasks (Done)** | 22 | 16 | 72.7% Sprint 2 issue closure (100% of core CRM/Inventory features) |
| **Carryover Tasks to Sprint 3** | 0 | 6 | 4 QA test tickets (`#54`, `#57`, `#59`, `#112`) & 2 DSO hardening items (`#122`, `#201`) |
| **Wildcard Search Latency SLA** | < 50 ms | 0.25 – 3.12 ms | Verified via `EXPLAIN (ANALYZE, BUFFERS)` with `pg_trgm` GIN indexes |
| **Critical Defects Outstanding** | 0 | 0 | `BUG-001` (`#51`) and `BUG-002` (`#130`) resolved and verified |

### 2.2 Role-by-Role Velocity & Burndown Comparison (Planned vs. Merged PR Targets)

| Team Member | Role | Planned Sprint 2 Issues | Merged / Completed Issues | Carryover Issues | Role Completion Rate | Summary of Merged PR Deliverables |
|---|---|:---:|:---:|:---:|:---:|---|
| **Kathryn Chloe** (@itsmechloe) | Backend Engineer & DB Admin | 6 | 6 | 0 | **100%** | PR `#45`, `#47`, `#131`, `#133`, `#134`, `#135`, `#137`, `#138` (plus `#51` carryover fix) |
| **Alain Deiniel** (@alainmnts) | UI/UX & Frontend Developer | 5 | 5 | 0 | **100%** | PR `#178`, `#182`, `#183`, `#184`, `#186` (plus `#52` usability review PR `#88`) |
| **Ryan James** (@Raii-stack) | Scrum Master | 2 | 2 | 0 | **100%** | `#55` board & impediment tracking, `#61` velocity burndown & retrospective (plus `#53`) |
| **Marron Beroy** (@Polygonic) | DevSecOps Engineer | 5 | 3 | 2 | **60%** | PR `#146`, `#153`, `#163`, `#166` merged; `#122` & `#201` carried over for strict CORS/auth limiter |
| **Prince Nelson** (@princeaguinaldo) | Test Engineer | 4 | 0 | 4 | **0%** *(In Progress)* | Sprint 1 test suites merged (`#129`); CRM/Inventory QA suites (`#54`, `#57`, `#59`, `#112`) carried over |
| **Total** | **All Roles** | **22** | **16** | **6** | **72.7%** | **All functional CRM & Inventory endpoints, schemas, and UI screens live** |

### 2.3 Two-Week Sprint Burndown Progression

| Checkpoint | Planned Remaining Tasks | Actual Remaining Tasks | Burndown Notes |
|---|:---:|:---:|---|
| **Day 1 (Sprint Start)** | 22 | 22 | Sprint 2 board initialized (`#55`); Sprint 1 carryovers (`#51`, `#52`, `#53`) prioritized first |
| **Day 3 (Week 3 Mid-Week)** | 18 | 19 | CRM & Inventory base SQL migration and API scaffold merged (`#45`, `#47`); `BUG-001` (`#51`) resolved |
| **Day 5 (Mid-Sprint Review)** | 13 | 14 | Demo seed data (`#56`), server validation (`#103`), price lookup (`#104`), and soft-delete guards (`#105`) merged |
| **Day 8 (Week 4 Mid-Week)** | 6 | 9 | Trigram GIN benchmarks (`#58`, `#110`), CI runner (`#111`), rate limiting (`#109`), and secret scanning (`#123`) merged |
| **Day 10 (Sprint Close)** | 0 | 6 | Debounced sorting/pagination (`#106`), accessible form validation (`#107`), price history modal (`#108`), in-place table updates (`#128`), and usability review (`#60`) completed |

---

## 3. Completed Deliverables & Stakeholder Review Demo

### 3.1 Completed Sprint 2 Issues (16 Issues + 3 Sprint 1 Carryovers)

1. **Database & Performance Engineering (@itsmechloe):**
   - [#56](https://github.com/Raii-stack/BAIYOGESIC/issues/56): `[S2-DBA-05]` CRM & Inventory Demo Data and Price History Records (PR #131)
   - [#58](https://github.com/Raii-stack/BAIYOGESIC/issues/58): `[S2-DBA-06]` Search Performance Check and Wildcard Index Tuning (PR #133)
   - [#110](https://github.com/Raii-stack/BAIYOGESIC/issues/110): `[S2-DBA-03]` Database: Trigram GIN Search Performance Benchmarking & Query Explains (PR #135)
2. **Backend API & Data Integrity (@itsmechloe):**
   - [#51](https://github.com/Raii-stack/BAIYOGESIC/issues/51): `[BUG-001]` Fix Registration API 503 and `app_user` DB Insertion (Carryover resolved)
   - [#103](https://github.com/Raii-stack/BAIYOGESIC/issues/103): `[S2-DEV-02a]` API: Customer & Product Server-Side Data Validation & Sanitization (PR #134)
   - [#104](https://github.com/Raii-stack/BAIYOGESIC/issues/104): `[S2-DEV-07a]` API: Price History Audit Logging & Effective-Date Lookup Endpoint (PR #137)
   - [#105](https://github.com/Raii-stack/BAIYOGESIC/issues/105): `[S2-DEV-03a]` API: Customer & Product Soft Delete Integrity & Dependency Guards (PR #138)
3. **Frontend & UI/UX (@alainmnts):**
   - [#52](https://github.com/Raii-stack/BAIYOGESIC/issues/52): `[S1-UIX-05]` Usability Review of Built Authentication and User Management Screens (PR #88)
   - [#60](https://github.com/Raii-stack/BAIYOGESIC/issues/60): `[S2-UIX-04 & S2-UIX-05]` CRM & Inventory Empty, Error, Delete States & Usability Review (PR #178)
   - [#106](https://github.com/Raii-stack/BAIYOGESIC/issues/106): `[S2-UIX-01]` Frontend: Customer & Product Search Debouncing, Sorting & Pagination Controls (PR #182)
   - [#107](https://github.com/Raii-stack/BAIYOGESIC/issues/107): `[S2-UIX-02]` Frontend: Modal Form Validation, Error Highlighting & Accessible Field Alerts (PR #183)
   - [#108](https://github.com/Raii-stack/BAIYOGESIC/issues/108): `[S2-UIX-03]` Frontend: Product Price History Timeline Modal & Price Trend Viewer (PR #184)
   - [#128](https://github.com/Raii-stack/BAIYOGESIC/issues/128): `[S2-UIX-06]` Frontend: Fine-Grained Table State Updates & In-Place Row Mutation Optimization (PR #186)
4. **DevSecOps & Agile Governance (@Polygonic, @Raii-stack):**
   - [#53](https://github.com/Raii-stack/BAIYOGESIC/issues/53): `[S1-SM-01 & S1-SM-05]` Repository Issue Templates & Sprint 1 Retrospective Report
   - [#55](https://github.com/Raii-stack/BAIYOGESIC/issues/55): `[S2-SM-01 to S2-SM-03]` Sprint 2 Agile Tracking, Retro Action Follow-up & Impediment Log
   - [#61](https://github.com/Raii-stack/BAIYOGESIC/issues/61): `[S2-SM-04 & S2-SM-05]` Sprint 2 Velocity Burndown, Review & Retrospective Report
   - [#109](https://github.com/Raii-stack/BAIYOGESIC/issues/109): `[S2-DSO-01]` Security: CRM & Inventory API Input Rate Limiting & Payload Size Constraints (PR #146)
   - [#111](https://github.com/Raii-stack/BAIYOGESIC/issues/111): `[S2-DSO-02]` CI/CD: Automated Integration Test Runner & Schema Drift Detection (PR #153)
   - [#123](https://github.com/Raii-stack/BAIYOGESIC/issues/123): `[S2-DSO-04]` DevSecOps: Automated Dependency Vulnerability Scanning & Secret Leak Guard (PR #166)

### 3.2 Sprint 2 Stakeholder Demonstration Summary

During the Sprint 2 Review, the team demonstrated the end-to-end CRM and Inventory workflows to product stakeholders:
1. **Customer Directory & Payment Terms (`COD`, `30D`, `45D`, `60D`):** Demonstrated creating, editing, sorting, and filtering customer accounts with debounced wildcard search across customer ID, company name, and address.
2. **Product Catalog & Dated Price History:** Demonstrated adding inventory items, opening the Price History Timeline modal (`#108`), appending dated price changes, and verifying automatic effective-date price resolution (`public.current_active_price`).
3. **Referential Integrity & Soft-Delete Protection:** Demonstrated archiving and restoring unreferenced records, and verified that attempting to archive a customer or product linked to active sales returns an inline HTTP `409 Conflict` alert inside an accessible focus-trapped dialog (`#60`, `#105`).
4. **Database Search Benchmarks:** Reviewed `docs/database/sprint2-performance.md` and `docs/database/sprint2-trigram-benchmark.md`, confirming bitmap index scans over `pg_trgm` GIN indexes keep search queries well below the 50 ms target.

---

## 4. Retrospective Analysis

### 4.1 Review of Sprint 1 Action Items

| Action Item | Owner | Status | Outcome |
|---|---|:---:|---|
| **AI-01: Fix BUG-001 (Registration API)** | Kathryn Chloe (@itsmechloe) | Completed | Resolved in `#51`; registration inserts pending users cleanly and passes integration tests. |
| **AI-02: Enforce Task Balance** | Ryan James (@Raii-stack) | Completed | Sprint 2 workload balanced at 4–6 tasks per developer across Backend/DB, UI/UX, DevSecOps, and QA. |
| **AI-03: Implement CI/CD Pipeline** | Marron Beroy (@Polygonic) | Completed | GitHub Actions `ci.yml`, `project-automation.yml`, and secret scanning (`#111`, `#123`) active on PRs. |
| **AI-04: Automated Project Board Updates** | Team | Completed | `scripts/project-automation.js` automatically links issues, promotes ready tasks, and routes bug triage (`#145`). |

### 4.2 What Went Well (Keep Doing)
- **100% Feature Delivery on Backend, Database, and UI/UX:** Kathryn and Alain completed 100% of their Sprint 2 tasks plus Sprint 1 carryovers, delivering cohesive CRM and Inventory experiences with in-place table row updates (`#128`) and zero full-page reloads.
- **Database-First Constraints & Performance Proof:** Aligning the `customer_payterm_check` constraint (`COD`, `30D`, `45D`, `60D`) and verifying `pg_trgm` GIN index plans with `EXPLAIN (ANALYZE, BUFFERS)` prevented silent runtime bugs and guaranteed sub-50 ms search performance.
- **Accessibility & Usability Polish:** The Sprint 2 usability walkthrough (`#60`) added keyboard focus containment, Escape key dismissal, focus restoration, and distinct empty-directory vs. zero-filter-match illustrations.
- **Workflow & Triage Automation:** Automated bug triage (`#145`) and branch routing (`auto-route-pr.yml`) reduced manual Scrum Master overhead when managing incoming PRs onto `test`.

### 4.3 What Could Be Improved (Pains & Blockers)
- **QA Automation Lag Behind UI/API Merges:** Because several frontend and backend PRs (`#106`–`#108`, `#60`) merged late in the sprint window, Prince's dependent QA integration test tickets (`#54`, `#57`, `#59`, `#112`) remained open at sprint close even though component-level tests were already passing in `CustomerManagementPage.test.tsx` and `InventoryPage.test.tsx`.
- **Incremental Security Hardening Split:** Baseline `helmet()`, `cors()`, and `/api` rate limiting were delivered in `#109`, but strict Vercel wildcard CORS removal and dedicated `/api/auth/*` brute-force lockouts required follow-up tracking in `#122`, `#199`, and `#201`.

### 4.4 What We Learned
- Decouple backend API integration tests (`tests/integration/crm-inventory.test.js`) from final UI polish PRs so QA engineers can merge API boundary tests mid-sprint as soon as controller endpoints land.
- Keep schema check constraints (`customer.payterm`) covered by migration verification scripts (`npm run verify:migrations`) whenever new enum/domain options (`60D`) are exposed in the UI.

---

## 5. Action Items for Sprint 3

| Action Item | Owner | Target Date | Success Criterion |
|---|---|---|---|
| **AI-S2-01: Close Carryover CRM/Inventory QA Suites** | Prince Nelson (@princeaguinaldo) | Sprint 3, Day 3 | Merge `tests/integration/crm-inventory.test.js` and close `#54`, `#57`, `#59`, and `#112`. |
| **AI-S2-02: Harden Auth Rate Limiter & CORS Origins** | Marron Beroy (@Polygonic) | Sprint 3, Day 5 | Deliver dedicated `authLimiter` and strict origin validation (`#122`, `#201`). |
| **AI-S2-03: Parallelize HR API & QA Test Authoring** | Kathryn Chloe & Prince Nelson | Sprint 3, Day 5 | Begin HR permission and salary redaction tests (`#62`, `#66`) immediately after HR endpoints (`#113`–`#115`) merge. |
| **AI-S2-04: Maintain Sprint 3 Carryover & Impediment Log** | Ryan James (@Raii-stack) | Sprint 3, Day 5 | Track carryover burn-down alongside HR module delivery in `#63`. |

---

## 6. Scrum Master Sign-Off

Sprint 2 achieved its core functional and performance goals: Customer Management, Product Catalog, and Dated Price History are fully integrated, indexed for sub-50 ms search, and validated against WCAG AA usability standards. The 6 remaining QA and DevSecOps verification items are scoped and prioritized as top carryover items entering Sprint 3 (Human Resources & Job History).

**Approved by:** Ryan James (Scrum Master)  
**Date:** November 2026
