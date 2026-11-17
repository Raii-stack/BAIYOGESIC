# HOPE, Inc. ERP — Sprint 2 Agile Tracking, Retro Action Follow-up & Impediment Log

**Sprint:** Sprint 2  
**Sprint Goal:** Customer Relationship Management (CRM), Product Catalog & Price History, Trigram Search Optimization & Automated CI/CD Security  
**Sprint Schedule:** Weeks 3 – 4 (Days 1 – 10; Sprint 2 execution window October 19 – November 5, 2026)  
**Scrum Master:** Ryan James (@Raii-stack)  
**Prerequisite:** [#53](https://github.com/Raii-stack/BAIYOGESIC/issues/53) (Repository Issue Templates & Sprint 1 Retrospective Report — Closed Oct 21, 2026 via direct commit `13756cb` / sync PR `#89`)  
**Date:** October – November 2026  

---

## 1. Sprint 2 Board Initialization & User Story PR Mapping

The Sprint 2 backlog is initialized on the GitHub Projects v2 **[Sprint Plan](https://github.com/users/Raii-stack/projects/5)** board with standardized task templates (`.github/ISSUE_TEMPLATE/task_issue.md`), bug forms (`.github/ISSUE_TEMPLATE/bug_report.yml`), and automated status tracking via `.github/workflows/project-automation.yml` (`scripts/project-automation.js`).

Sprint 2 scopes **22 Sprint 2 issues** (`#54`–`#61`, `#103`–`#112`, `#122`–`#123`, `#128`, `#201`) alongside **3 Sprint 1 carryover tasks** (`#51`, `#52`, `#53`) and **1 mid-sprint defect** (`#130` `BUG-002`).

### 1.1 Sprint 1 Carryover Clearance & Issue Template Foundation (#53)

| Issue | Task Summary | Owner | Status | Delivery & Traceability |
|---|---|---|:---:|---|
| [#53](https://github.com/Raii-stack/BAIYOGESIC/issues/53) | `[S1-SM-01 & S1-SM-05]` Repository Issue Templates & Sprint 1 Retrospective Report | @Raii-stack | **Done** | Committed directly to `main` in `13756cb` (`.github/ISSUE_TEMPLATE/`, `docs/agile/sprint1-impediments.md`, `docs/agile/sprint1-retrospective.md`, `.github/workflows/project-automation.yml`, `scripts/project-automation.js`); synced via PR `#89` |
| [#52](https://github.com/Raii-stack/BAIYOGESIC/issues/52) | `[S1-UIX-05]` Usability Review of Built Authentication & User Management Screens | @alainmnts | **Done** | Delivered via PR `#49` and usability audit PR `#88` (`docs/design/sprint1-usability-review.md`) |
| [#51](https://github.com/Raii-stack/BAIYOGESIC/issues/51) | `[BUG-001]` Fix Registration API 503 and `app_user` DB Insertion | @itsmechloe | **Done** | Verified with auth integration tests (PR `#48`) and resolved Oct 26, 2026 |

### 1.2 Sprint 2 User Story & Pull Request Mapping

| Issue | Task ID & Title | Assignee | Priority | Board Status | Merged PR(s) & Key Deliverables |
|---|---|---|:---:|---|---|
| [#56](https://github.com/Raii-stack/BAIYOGESIC/issues/56) | `[S2-DBA-05]` CRM & Inventory Demo Data and Price History Records | @itsmechloe | P2 | **Done** | PR `#131` (Oct 26) — Idempotent customer, product, and multi-tier price history seed records (building on PR `#45`, `#47`) |
| [#58](https://github.com/Raii-stack/BAIYOGESIC/issues/58) | `[S2-DBA-06]` Search Performance Check and Wildcard Index Tuning | @itsmechloe | P2 | **Done** | PR `#133` (Oct 26) — `pg_trgm` GIN indexes & `docs/database/sprint2-performance.md` |
| [#103](https://github.com/Raii-stack/BAIYOGESIC/issues/103) | `[S2-DEV-02a]` API: Customer & Product Server-Side Data Validation & Sanitization | @itsmechloe | P1 | **Done** | PR `#134` (Oct 26) — Server-side validation, payment term constraints (`COD`, `30D`, `45D`, `60D`), and payload sanitization |
| [#110](https://github.com/Raii-stack/BAIYOGESIC/issues/110) | `[S2-DBA-03]` Database: Trigram GIN Search Performance Benchmarking & Query Explains | @itsmechloe | P2 | **Done** | PR `#135` (Oct 26) — `EXPLAIN (ANALYZE, BUFFERS)` benchmarks (`0.25–3.12 ms`) in `docs/database/sprint2-trigram-benchmark.md` |
| [#104](https://github.com/Raii-stack/BAIYOGESIC/issues/104) | `[S2-DEV-07a]` API: Price History Audit Logging & Effective-Date Lookup Endpoint | @itsmechloe | P1 | **Done** | PR `#137` (Oct 26) — Effective-date pricing lookup (`current_active_price`) and audit trail |
| [#105](https://github.com/Raii-stack/BAIYOGESIC/issues/105) | `[S2-DEV-03a]` API: Customer & Product Soft Delete Integrity & Dependency Guards | @itsmechloe | P1 | **Done** | PR `#138` (Oct 26) — HTTP `409 Conflict` guards preventing archive when active child sales exist |
| [#130](https://github.com/Raii-stack/BAIYOGESIC/issues/130) | `[BUG-002]` Forgot-password and reset-password endpoints still exposed after feature removal | @itsmechloe | P1 | **Done** | PR `#141` (Oct 26) — Removed deprecated reset routes and aligned auth regression tests (PR `#129`) |
| [#123](https://github.com/Raii-stack/BAIYOGESIC/issues/123) | `[S2-DSO-04]` DevSecOps: Automated Dependency Vulnerability Scanning & Secret Leak Guard | @Polygonic | P2 | **Done** | `npm audit --audit-level=critical` & TruffleHog secret scanning integrated into `.github/workflows/ci.yml` |
| [#109](https://github.com/Raii-stack/BAIYOGESIC/issues/109) | `[S2-DSO-01]` Security: CRM & Inventory API Input Rate Limiting & Payload Size Constraints | @Polygonic | P1 | **Done** | PR `#163` (Oct 30) — Express rate-limiting middleware and bounded JSON request payload limits |
| [#111](https://github.com/Raii-stack/BAIYOGESIC/issues/111) | `[S2-DSO-02]` CI/CD: Automated Integration Test Runner & Schema Drift Detection | @Polygonic | P1 | **Done** | PR `#166` (Oct 30) — Automated Vitest/Jest CI runs and `scripts/verify-migrations.js` check |
| [#60](https://github.com/Raii-stack/BAIYOGESIC/issues/60) | `[S2-UIX-04 & S2-UIX-05]` CRM & Inventory Empty, Error, Delete States & Usability Review | @alainmnts | P2 | **Done** | PR `#178` (Nov 2) — Accessible focus-trapped dialogs, empty states & `docs/design/sprint2-usability-review.md` |
| [#106](https://github.com/Raii-stack/BAIYOGESIC/issues/106) | `[S2-UIX-01]` Frontend: Customer & Product Search Debouncing, Sorting & Pagination Controls | @alainmnts | P1 | **Done** | PR `#182` (Nov 2) — Debounced search, sorting, and server-backed pagination UI |
| [#107](https://github.com/Raii-stack/BAIYOGESIC/issues/107) | `[S2-UIX-02]` Frontend: Modal Form Validation, Error Highlighting & Accessible Field Alerts | @alainmnts | P2 | **Done** | PR `#183` (Nov 2) — Inline modal validation, ARIA alerts, and field error states |
| [#108](https://github.com/Raii-stack/BAIYOGESIC/issues/108) | `[S2-UIX-03]` Frontend: Product Price History Timeline Modal & Price Trend Viewer | @alainmnts | P2 | **Done** | PR `#184` (Nov 2) — Price history timeline viewer and dated entry modal |
| [#128](https://github.com/Raii-stack/BAIYOGESIC/issues/128) | `[S2-UIX-06]` Frontend: Fine-Grained Table State Updates & In-Place Row Mutation Optimization | @alainmnts | P2 | **Done** | PR `#186` (Nov 2) — Optimistic/in-place row updates eliminating full-page table reloads |
| [#55](https://github.com/Raii-stack/BAIYOGESIC/issues/55) | `[S2-SM-01 to S2-SM-03]` Sprint 2 Agile Tracking, Retro Action Follow-up & Impediment Log | @Raii-stack | P3 | **Done** | Sprint 2 board initialization, Sprint 1 action-item follow-up, and this mid-sprint log (`docs/agile/sprint2-mid-sprint.md`) |
| [#61](https://github.com/Raii-stack/BAIYOGESIC/issues/61) | `[S2-SM-04 & S2-SM-05]` Sprint 2 Velocity Burndown, Review & Retrospective Report | @Raii-stack | P3 | **Done** | PR `#203` (Nov 5) — `docs/agile/sprint2-retrospective.md` |
| [#122](https://github.com/Raii-stack/BAIYOGESIC/issues/122) | `[S2-DSO-03]` Security: Helmet HTTP Headers, CORS Restrictions & Secure Cookie Hardening | @Polygonic | P2 | **Carryover** | Carried over to Sprint 3; later closed via PR `#205` (with `#199` via PR `#208`) |
| [#201](https://github.com/Raii-stack/BAIYOGESIC/issues/201) | `[S2-DSO-05]` Security: Dedicated Authentication Rate Limiting & Brute-Force Protection | @Polygonic | P1 | **Carryover** | Carried over to Sprint 3; later closed via PR `#210` |
| [#54](https://github.com/Raii-stack/BAIYOGESIC/issues/54), [#57](https://github.com/Raii-stack/BAIYOGESIC/issues/57), [#59](https://github.com/Raii-stack/BAIYOGESIC/issues/59), [#112](https://github.com/Raii-stack/BAIYOGESIC/issues/112) | `[S2-TST-01 to S2-TST-07]` CRM & Inventory QA Test Cases, Constraints & Regression | @princeaguinaldo | P1–P2 | **Carryover** | Blocked mid-sprint by late UI/API merges; carried over to Sprint 3 (`#54` -> `#57`/`#112` -> `#59`) |

---

## 2. Follow-Up on Sprint 1 Retrospective Action Items (#53)

Progress tracked against the four action items established in [docs/agile/sprint1-retrospective.md](sprint1-retrospective.md):

| Action Item | Owner | Target | Mid-Sprint Check Status | Verification Evidence |
|---|---|---|---|---|
| **AI-01: Fix BUG-001 (Registration API 503)** | Kathryn Chloe (@itsmechloe) | Sprint 2, Day 1 | **Completed** | Service-role `authSupabase` insertion fix applied and validated (`TC-AUTH-01` / PR `#48`); issue `#51` closed Oct 26. |
| **AI-02: Enforce Balanced Task Allocation** | Ryan James (@Raii-stack) | Sprint 2, Day 1 | **Completed** | Sprint 2 tasks rebalanced at 4–6 issues per developer across Backend/DBA (`6`), UI/UX (`5`), DevSecOps (`5`), QA (`4`), and Scrum Master (`2`). |
| **AI-03: Implement Automated CI/CD Pipeline** | Marron Beroy (@Polygonic) | Sprint 2, Day 2 | **Completed** | `.github/workflows/ci.yml` established via PR `#94` (`#28`) and expanded with schema drift verification (`#111`, PR `#166`) and secret/dependency scanning (`#123`). |
| **AI-04: Automate Project Board Transitions** | Team / @Raii-stack | Ongoing | **Completed** | `scripts/project-automation.js` and `.github/workflows/project-automation.yml` (shipped in `#53` / `13756cb`) actively link closing PRs, promote unblocked tasks, and automate bug triage (PR `#145`). |

---

## 3. Mid-Sprint Check Notes & Velocity Checkpoints

- **Day 3 Check (Foundation & Carryover Triage):** Base CRM/Inventory SQL migrations and customer API scaffold merged (`PR #45`, `PR #47`). Sprint 1 carryover `#53` delivered issue templates, project board automation, and Sprint 1 retrospective documentation (`13756cb`); `#52` usability audit cleared via `PR #49` / `PR #88`.
- **Day 5 Mid-Sprint Check (Core API & Search Performance):** Backend APIs (`#56`, `#58`, `#103`, `#104`, `#105`, `#110`) all merged cleanly on Oct 26, meeting the `< 50 ms` wildcard search SLA (`0.25–3.12 ms` with `pg_trgm` GIN indexes). `BUG-002` (`#130`) discovered by QA (`PR #129`) was patched the same day via `PR #141`.
- **Day 8 Check (CI/CD & Frontend Polish):** DevSecOps rate limiting (`#109`) and automated migration/test CI checks (`#111`) merged Oct 30. Frontend debouncing, modal validation, price history timeline, and usability states (`#60`, `#106`–`#108`, `#128`) entered final review and merged Nov 2.
- **Sprint Close Carryover Triage:** Because UI/UX and API changes landed across Days 5–8, dependent QA integration tickets (`#54`, `#57`, `#59`, `#112`) and final security hardening (`#122`, `#201`) were flagged as Sprint 3 carryovers for handoff into `#61` (`docs/agile/sprint2-retrospective.md`).

---

## 4. Sprint 2 Mid-Sprint Impediment Register

| ID | Date Logged | Category | Description | Impact | Resolution / Mitigation Plan | Owner | Status |
|---|---|---|---|---|---|---|---:|
| **IMP-S2-001** | Sprint 2, Day 5 | Security / API | QA auth tests (`PR #129`) identified deprecated forgot-password and reset-password routes still exposed in the Express router after feature removal (`BUG-002`, Issue `#130`). | Security regression risk and failing auth test assertions on removed endpoints. | Removed deprecated endpoints and aligned route tests in `PR #141`; closed `#130` on Oct 26. | @itsmechloe / @Raii-stack | **Resolved** |
| **IMP-S2-002** | Sprint 2, Day 6 | Tooling / Test Runner | `npm test` (Vitest) attempted to execute Jest `qa-unit` and Playwright `e2e` test files, causing false CI failures on the `test` branch. | Blocked clean green CI status across incoming Sprint 2 PRs. | Updated Vitest configuration to exclude `tests/qa-unit` and `tests/e2e` suites in `PR #132` and separated CI steps in `.github/workflows/ci.yml` (`PR #166`). | @Raii-stack / @Polygonic | **Resolved** |
| **IMP-S2-003** | Sprint 2, Day 7 | QA / Sequencing | Downstream QA verification issues (`#54`, `#57`, `#59`, `#112`) depended on both backend APIs (`#103`–`#105`) and final UI polish (`#106`–`#108`, `#60`), compressing the QA execution window at sprint end. | Prevented formal QA sign-off before Sprint 2 close (`0/4` QA issues closed on time). | Decouple API integration tests (`tests/integration/crm-inventory.test.js`) from UI polish in Sprint 3 and carry over `#54` -> `#57`/`#112` -> `#59` as P1 Sprint 3 priorities. | @princeaguinaldo / @Raii-stack | **Carried Over** |
| **IMP-S2-004** | Sprint 2, Day 8 | Security / Deployment | Baseline rate limiting and payload bounds landed in `#109` (`PR #163`), while strict CORS origin restrictions (`#122`) and dedicated `/api/auth/*` brute-force lockouts (`#201`) required isolated middleware hardening and regression checks. | Left CORS wildcard tightening and auth-specific rate limiting open at Sprint 2 close. | Carried `#122` and `#201` into Sprint 3 top-priority DevSecOps queue (`PR #205`, `PR #208`, `PR #210`). | @Polygonic | **Carried Over** |
