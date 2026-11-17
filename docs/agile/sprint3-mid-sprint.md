# HOPE, Inc. ERP — Sprint 3 Planning Notes, Carryover Prioritization & Mid-Sprint Impediment Log

**Sprint:** Sprint 3  
**Sprint Goal:** Human Resources (HR) Directory, Department & Job Management, Job History Career Timeline, Role-Based Salary Redaction, HR Security/Audit Hardening & Sprint 2 Carryover Closure  
**Sprint Schedule:** Weeks 5 – 6 (Board window: November 9 – November 20, 2026; early HR & DR deliverables merged October 26 – November 2, 2026)  
**Scrum Master:** Ryan James (@Raii-stack)  
**Prerequisite:** [#61](https://github.com/Raii-stack/BAIYOGESIC/issues/61) (Sprint 2 Review & Retrospective Report — Closed via PR `#203`)  
**Date:** November 18, 2026  

---

## 1. Sprint 3 Planning Notes & Project Board Initialization

The Sprint 3 backlog is initialized on the GitHub Projects v2 **[Sprint Plan](https://github.com/users/Raii-stack/projects/5)** board and synchronized automatically via `.github/workflows/project-automation.yml` (`scripts/project-automation.js`) and `scripts/sync-project-fields.js`.

Sprint 3 tracks **22 Sprint 3 issues** (`#62`–`#70`, `#113`–`#121`, `#124`–`#126`, `#202`) alongside **6 Sprint 2 carryover issues** (`#54`, `#57`, `#59`, `#112`, `#122`, `#201`, plus security follow-up `#199`) identified in [docs/agile/sprint2-retrospective.md](sprint2-retrospective.md).

### 1.1 Role-by-Role Sprint 3 Velocity & Deliverable Summary (Planned vs. Merged PRs)

| Team Member | Role | Planned Sprint 3 Issues | Closed / Merged | Remaining Open | Sprint 3 Completion Rate | Carryover / Cross-Sprint Execution Notes |
|---|---|:---:|:---:|:---:|:---:|---|
| **Kathryn Chloe** (@itsmechloe) | Backend Engineer & DB Admin | 7 | 7 | 0 | **100%** | Merged PR `#136`, `#140`, `#142`, `#143`, `#147`, `#171`, `#172`, `#173` (HR schema, constraints, indexes, DR scripts & APIs) |
| **Alain Deiniel** (@alainmnts) | UI/UX & Frontend Developer | 4 | 4 | 0 | **100%** | Merged PR `#179`, `#187`, `#188`, `#189` (Department/Job modals, Career Timeline, salary masking & WCAG AA usability pass) |
| **Marron Beroy** (@Polygonic) | DevSecOps Engineer | 5 | 1 | 4 | **20%** | Merged PR `#211` (`#202` HR PII log redaction & salary read audit) and cleared all Sprint 2 DSO carryovers (`#122` PR `#205`, `#199` PR `#208`, `#201` PR `#210`); `#119`, `#124`–`#126` open |
| **Prince Nelson** (@princeaguinaldo) | Test Engineer | 4 | 0 | 4 | **0%** *(Code Ready / Pending Sign-Off)* | HR integration suites (`tests/integration/hr-api.test.js`, `hr-employee.test.js`, `hr-security.test.js`) present in repo; `#62` Ready, `#66`/`#68`/`#121` blocked by `#62`; 4 Sprint 2 QA carryovers still open |
| **Ryan James** (@Raii-stack) | Scrum Master | 2 | 0 | 2 | **0%** *(1 In Review)* | `#63` delivered in this PR; `#70` blocked in Backlog until `#63` closes |
| **Total** | **All Roles** | **22** | **12** | **10** | **54.5%** | All core HR Backend, DB & UI features merged; remaining scope is QA verification, DevSecOps SAST/runbooks & Agile closeout |

### 1.2 Sprint 3 HR Capabilities & Governance PR Deliverable Mapping

| Issue | Task ID & Title | Assignee | Priority | Board Status | Merged PR(s) & Key Deliverables |
|---|---|---|:---:|---|---|
| [#64](https://github.com/Raii-stack/BAIYOGESIC/issues/64) | `[S3-DEV-05]` API & Frontend: Employee Soft Delete, Separation Date, and Archive Workflow | @itsmechloe | P1 | **Done** | PR `#136` (2026-10-26) — `controllers/employee-controller.js`, `src/components/employees/ArchiveEmployeeModal.tsx`, `src/pages/EmployeeDirectoryPage.tsx` |
| [#65](https://github.com/Raii-stack/BAIYOGESIC/issues/65) | `[S3-DBA-04 & S3-DBA-05]` HR Child-Record Delete Constraints and Personnel Demo Data | @itsmechloe | P2 | **Done** | PR `#140` (2026-10-26) — `supabase/migrations/20261027000000_issue_65_hr_constraints_and_demo_data.sql`, `supabase/seed.sql` |
| [#67](https://github.com/Raii-stack/BAIYOGESIC/issues/67) | `[S3-DBA-06]` HR Database Indexes and Backup/Restore Disaster Recovery Script | @itsmechloe | P2 | **Done** | PR `#142` (2026-10-28) — `supabase/migrations/20261027000001_issue_67_hr_indexes_and_dr_support.sql`, `scripts/db-backup-restore.js`, `scripts/backup-restore.sh`, `docs/database/sprint3-hr-indexes-and-disaster-recovery.md` |
| [#113](https://github.com/Raii-stack/BAIYOGESIC/issues/113) | `[S3-DEV-01]` API: Department and Job Master List CRUD Endpoints | @itsmechloe | P1 | **Done** | PR `#143` (2026-10-28) — `controllers/employee-controller.js`, `routes/employee-routes.js`, `server.js`, `tests/integration/hr-api.test.js` |
| [#114](https://github.com/Raii-stack/BAIYOGESIC/issues/114) | `[S3-DEV-06]` API: Employee Job History Promotion & Transfer Tracking | @itsmechloe | P1 | **Done** | PR `#147` (2026-10-28) — `supabase/migrations/20261028000001_issue_114_employee_job_history_tracking.sql`, `controllers/employee-controller.js`, `routes/employee-routes.js` |
| [#115](https://github.com/Raii-stack/BAIYOGESIC/issues/115) | `[S3-DEV-08]` API: Field-Level Salary Masking & View Job History Permission Enforcement | @itsmechloe | P1 | **Done** | PR `#171` (2026-11-01) — `controllers/employee-controller.js`, `middleware/permissions.js`, `routes/employee-routes.js`, `tests/integration/hr-security.test.js` |
| [#120](https://github.com/Raii-stack/BAIYOGESIC/issues/120) | `[S3-DBA-02]` Database: Employee Foreign Key Delete Rules and Department Orphan Prevention | @itsmechloe | P1 | **Done** | PR `#172` & `#173` (2026-11-01) — `supabase/migrations/20261029000000_issue_120_employee_fk_delete_rules_and_orphan_prevention.sql`, `docs/database/hr-schema-constraints.md`, `tests/integration/hr-employee.test.js` |
| [#116](https://github.com/Raii-stack/BAIYOGESIC/issues/116) | `[S3-UIX-01]` Frontend: Department & Job Position Management Tables and Modals | @alainmnts | P2 | **Done** | PR `#187` (2026-11-02) — `src/pages/DepartmentManagementPage.tsx`, `src/components/departments/DepartmentModal.tsx`, `src/components/jobs/JobModal.tsx`, `src/lib/department-api.ts` |
| [#117](https://github.com/Raii-stack/BAIYOGESIC/issues/117) | `[S3-UIX-02]` Frontend: Employee Job History Career Timeline Component | @alainmnts | P2 | **Done** | PR `#188` (2026-11-02) — `src/components/employees/CareerTimeline.tsx`, `src/components/employees/JobTimeline.tsx`, `src/pages/EmployeeProfilePage.tsx` |
| [#118](https://github.com/Raii-stack/BAIYOGESIC/issues/118) | `[S3-UIX-03]` Frontend: Role-Based Salary Masking and Sensitive HR Information Redaction | @alainmnts | P1 | **Done** | PR `#189` (2026-11-02) — `src/lib/rbac.ts`, `src/components/employees/EmployeeTable.tsx`, `src/components/employees/CareerTimeline.tsx`, `src/pages/EmployeeProfilePage.tsx` |
| [#69](https://github.com/Raii-stack/BAIYOGESIC/issues/69) | `[S3-UIX-05]` Usability Review of Built HR Screens & Timeline Components | @alainmnts | P2 | **Done** | PR `#179` (2026-11-02) — `docs/design/sprint3-usability-review.md` & accessibility/roving-tab/focus-trap fixes |
| [#202](https://github.com/Raii-stack/BAIYOGESIC/issues/202) | `[S3-DSO-05]` Security: Case-Insensitive HR PII Log Redaction & Privileged Salary Read Audit Trail | @Polygonic | P1 | **Done** | PR `#211` (2026-11-18) — `middleware/logger.js`, `controllers/employee-controller.js`, `docs/security/hr-pii-audit.md`, `tests/qa-unit/logger-sanitization.test.js` |
| [#119](https://github.com/Raii-stack/BAIYOGESIC/issues/119) | `[S3-DSO-01]` Security: HR API Sensitive Data Audit Logging & Employee PII Protection | @Polygonic | P1 | **Ready** | Core deliverables (`VIEW_SALARY` audit & `docs/security/hr-pii-audit.md`) shipped in PR `#211` (`#202`); verify HR mutation audit coverage and close |
| [#126](https://github.com/Raii-stack/BAIYOGESIC/issues/126) | `[S3-DSO-04]` Security: Employee PII Data Redaction in Server Logs and Diagnostic Dumps | @Polygonic | P2 | **Ready** | `sanitize()` / `redactUrlQuery()` (`middleware/logger.js`) & `errorHandler` detail sanitization (`middleware/error-handler.js`) shipped; verify error dump coverage and close |
| [#124](https://github.com/Raii-stack/BAIYOGESIC/issues/124) | `[S3-DSO-02]` DevSecOps: Static Application Security Testing (SAST) CodeQL Integration | @Polygonic | P2 | **Ready** | Pending `.github/workflows/codeql.yml` and `docs/security/sast-codeql-report.md` |
| [#125](https://github.com/Raii-stack/BAIYOGESIC/issues/125) | `[S3-DSO-03]` DevSecOps: Production Environment Health Monitoring & Error Alerting Pipeline | @Polygonic | P2 | **Ready** | `/health` & `/api/health` (`server.js`) and structured logging (`middleware/error-handler.js`, `middleware/logger.js`) live; pending `docs/security/monitoring-and-incident-response.md` |
| [#62](https://github.com/Raii-stack/BAIYOGESIC/issues/62) | `[S3-TST-01 & S3-TST-02]` Test Cases: Department, Job, and Employee Directory CRUD | @princeaguinaldo | P1 *(elevated)* | **Ready** | Test suites exist in `tests/integration/hr-api.test.js` & `tests/integration/hr-employee.test.js`; awaiting QA execution sign-off & closure |
| [#66](https://github.com/Raii-stack/BAIYOGESIC/issues/66) | `[S3-TST-03 & S3-TST-04]` Test Cases: Job History Promotions & Salary Visibility Permissions | @princeaguinaldo | P1 | **Backlog** *(Blocked by `#62`)* | Test cases exist in `tests/integration/hr-employee.test.js`; `#64` Done, unblocks on `#62` closure |
| [#121](https://github.com/Raii-stack/BAIYOGESIC/issues/121) | `[S3-TST-07]` Automated Security & Permission Tests for HR Salary Visibility and Promotions | @princeaguinaldo | P1 | **Backlog** *(Blocked by `#62`, `#66`)* | Test cases exist in `tests/integration/hr-security.test.js` & `hr-employee.test.js`; pending `docs/qa/sprint3-test-summary.md` |
| [#68](https://github.com/Raii-stack/BAIYOGESIC/issues/68) | `[S3-TST-05 & S3-TST-06]` Sprint 3 Full Regression Testing & Defect Verification | @princeaguinaldo | P1 | **Backlog** *(Blocked by `#62`, `#66`)* | Pending full HR regression execution report in `docs/qa/` |
| [#63](https://github.com/Raii-stack/BAIYOGESIC/issues/63) | `[S3-SM-01 to S3-SM-03]` Sprint 3 Planning Notes, Carryover Prioritization & Impediment Log | @Raii-stack | P3 | **In Review** | Current PR (`docs/agile/sprint3-mid-sprint.md`) |
| [#70](https://github.com/Raii-stack/BAIYOGESIC/issues/70) | `[S3-SM-04 & S3-SM-05]` Sprint 3 Velocity Tracking, Sprint 4 Risk Register & Retrospective | @Raii-stack | P3 | **Backlog** *(Blocked by `#63`)* | `#69` Done; promotes to **Ready** upon `#63` merge |

---

## 2. Sprint 2 Carryover Re-Prioritization

All 6 carryover items from `docs/agile/sprint2-retrospective.md` (plus follow-up `#199`) were re-prioritized entering Sprint 3 with realistic target dates and verified prerequisite chains.

### 2.1 Carryover Status, Updated Prerequisites & Realistic Target Dates

| Issue | Task Summary | Owner | Original Sprint 2 Priority / Target | Updated Sprint 3 Priority | Updated Target Date | Prerequisites & Board Status | Resolution / Next Action |
|---|---|---|---|---|:---:|---|---|
| [#122](https://github.com/Raii-stack/BAIYOGESIC/issues/122) | `[S2-DSO-03]` Helmet HTTP Headers, CORS & Secure Cookie Hardening | @Polygonic | P2 / Nov 4 | **P1 (High)** | 2026-11-07 | None — **Done** | **Closed** via PR `#205` (2026-11-07); wildcard CORS follow-up `#199` **Closed** via PR `#208` (2026-11-13) |
| [#201](https://github.com/Raii-stack/BAIYOGESIC/issues/201) | `[S2-DSO-05]` Dedicated Auth Rate Limiting & Brute-Force Protection | @Polygonic | P1 / Sprint 2 | **P1 (High)** | 2026-11-13 | None — **Done** | **Closed** via PR `#210` (2026-11-13) |
| [#54](https://github.com/Raii-stack/BAIYOGESIC/issues/54) | `[S2-TST-01 & S2-TST-02]` Test Cases: Customer, Product & Price History Verification | @princeaguinaldo | P2 / Oct 28 | **P1 (Critical Path)** | **2026-11-19** | `#19`, `#20`, `#21` Closed — **Ready** | Unblocks `#57`, `#59`, `#112`. Test code finished in `tests/integration/crm-inventory.test.js`, `CustomerManagementPage.test.tsx`, `InventoryPage.test.tsx` (Nov 9 update); complete execution sign-off & `docs/qa/sprint2-crm-inventory-tests.md` |
| [#112](https://github.com/Raii-stack/BAIYOGESIC/issues/112) | `[S2-TST-07]` Automated API Smoke & Edge-Case Tests for Customer & Product Endpoints | @princeaguinaldo | P2 / Sprint 2 | **P2 (Medium)** | **2026-11-19** | `#29` Closed, `#54` Open — **Backlog** *(Blocked by `#54`)* | Covered in `tests/integration/crm-inventory.test.js`; verify and close immediately once `#54` closes |
| [#57](https://github.com/Raii-stack/BAIYOGESIC/issues/57) | `[S2-TST-03 & S2-TST-04]` Soft Delete/Restore Constraints & Per-Right Permissions | @princeaguinaldo | P1 / Nov 4 | **P1 (High)** | **2026-11-19** | `#56` Closed, `#54` Open — **Backlog** *(Blocked by `#54`)* | HTTP 409 & RBAC assertions present in `tests/integration/crm-inventory.test.js`; verify and close immediately after `#54` |
| [#59](https://github.com/Raii-stack/BAIYOGESIC/issues/59) | `[S2-TST-05 & S2-TST-06]` Sprint 2 Regression Testing & Bug Fix Verification | @princeaguinaldo | P1 / Nov 5 | **P1 (High)** | **2026-11-20** | `#54`, `#57` Open — **Backlog** *(Blocked by `#54`, `#57`)* | Run full regression + reconcile `BUG-001` (`#51` fixed) and `BUG-002` (`#130` fixed) in `docs/qa/bug-log.md` |

### 2.2 Carryover Execution Sequence
1. **Unblock the QA Chain (`#54` -> `#57`, `#112` -> `#59`):** Closing `#54` first triggers `scripts/project-automation.js` to promote `#57` and `#112` out of Backlog automatically, allowing same-day closure of Sprint 2 QA carryovers before Sprint 3 HR QA (`#62` -> `#66`, `#121` -> `#68`) runs.
2. **Sprint 2 Security Carryovers Complete:** All Sprint 2 DevSecOps carryovers (`#122`, `#201`) and `#199` are closed and merged into `test`.

---

## 3. Mid-Sprint Velocity Checkpoints

| Checkpoint | Date Window | Key Merged PRs / Deliverables | Closed Sprint 3 & Carryover Issues | Velocity Observation |
|---|---|---|---|---|
| **Checkpoint 1: Early HR Backend & DB Foundation** | Oct 26 – Oct 28 | PR `#136`, `#140`, `#142`, `#143`, `#147` | `#64`, `#65`, `#67`, `#113`, `#114` (5 Sprint 3 issues) | Backend & DB Admin delivered HR archive workflow, triggers, covering indexes, DR script, and job history APIs ahead of schedule. |
| **Checkpoint 2: HR Permissions, Constraints & UI** | Nov 1 – Nov 2 | PR `#171`, `#172`, `#173`, `#179`, `#187`, `#188`, `#189` | `#115`, `#120`, `#69`, `#116`, `#117`, `#118` (6 Sprint 3 issues) | All planned Backend, DB, and UI/UX HR deliverables reached 100% completion and passed WCAG AA review. |
| **Checkpoint 3: Retro Sign-Off & Security Hardening** | Nov 5 – Nov 18 | PR `#203`, `#204`, `#205`, `#208`, `#210`, `#211` | `#61`, `#122`, `#199`, `#201`, `#202` (1 Sprint 3 + 3 Security carryovers/follow-ups) | Sprint 2 retro & `S1-TST-06` verification merged; DevSecOps cleared all Sprint 2 carryovers and added HR PII log redaction & salary read auditing. |
| **Mid-Sprint Remaining Scope** | Nov 18 – Nov 20 | Pending QA sign-off, DevSecOps SAST/monitoring & Sprint 3 retro | `#63` (In Review), `#119`, `#124`–`#126`, `#62`, `#66`, `#68`, `#121`, `#70` + QA carryovers `#54`, `#57`, `#59`, `#112` | Core application code is merged; remaining work is QA verification reports, SAST/runbook docs, and agile closeout. |

---

## 4. Mid-Sprint Impediment Register

| ID | Date Logged | Category | Description | Impact | Mitigation & Resolution Plan | Mitigation Owner | Status |
|---|---|---|---|---|---|---|---:|
| **IMP-S3-001** | Nov 9, 2026 | QA / Workflow Bottleneck | 8 QA issues across Sprint 2 (`#54`, `#57`, `#59`, `#112`) and Sprint 3 (`#62`, `#66`, `#68`, `#121`) remain Open even though automated integration suites (`tests/integration/crm-inventory.test.js`, `hr-api.test.js`, `hr-employee.test.js`, `hr-security.test.js`) already exist in the repository. Because `#54` and `#62` remain open, `project-automation.js` keeps downstream QA tasks in Backlog. | Depresses measured sprint velocity (`0%` closed on QA issues despite finished test code) and risks bottlenecking Sprint 4 QA (`#73`, `#77`, `#79`, `#82`). | Complete test execution verification against the test Supabase project, add `docs/qa/sprint2-crm-inventory-tests.md` and `docs/qa/sprint3-test-summary.md`, and submit PRs closing `#54` -> `#57`/`#112` -> `#59` and `#62` -> `#66`/`#121` -> `#68`. | @princeaguinaldo *(Verification & PRs)* / @Raii-stack *(Board Sync)* | **In Progress** |
| **IMP-S3-002** | Nov 5, 2026 | QA / Test Environment | `docs/qa/S1-TST-06-test-report.md` (PR `#204`) resolved `BUG-003` and `BUG-004` (Playwright startup and registration-notifications mock), but recorded 18 failures and 2 passes on the full Playwright E2E suite because QA-user data from a live/test Supabase environment is required. Additionally, `docs/qa/bug-log.md` still marks `BUG-001` and `BUG-002` as Open even though `#51` and `#130` (PR `#141`) are closed. | Prevents full E2E sign-off across authenticated browser flows and creates conflicting defect counts between GitHub issues and `docs/qa/bug-log.md`. | Seed/verify QA test accounts in the test Supabase project (`tests/integration/setup/qa-users.js`, `tests/e2e/global-setup.js`), re-run `npm run test:e2e`, and update `BUG-001` and `BUG-002` status in `docs/qa/bug-log.md`. | @princeaguinaldo *(Retest & Bug Log)* / @itsmechloe *(Test DB Seed)* | **Open** |
| **IMP-S3-003** | Nov 18, 2026 | DevSecOps / Backlog Overlap | PR `#211` (`#202`) implemented case-insensitive PII log redaction (`middleware/logger.js`, `tests/qa-unit/logger-sanitization.test.js`), `VIEW_SALARY` audit logging (`controllers/employee-controller.js`), and `docs/security/hr-pii-audit.md`, overlapping substantially with open issues `#119` and `#126`. Meanwhile, `#124` (`.github/workflows/codeql.yml`, `docs/security/sast-codeql-report.md`) and `#125` (`docs/security/monitoring-and-incident-response.md`) have no PRs yet. (A transient `#50` dependency check also briefly demoted `#119` on Nov 5 before clearing.) | Creates ambiguous completion status on `#119` and `#126` and leaves SAST (`CodeQL`) and production alerting documentation incomplete. | Audit `#119` (HR mutation audit log checks) and `#126` (`middleware/error-handler.js` diagnostic dump edge cases) against PR `#211` and close with cross-reference PRs; prioritize `#124` and `#125` deliverables by Nov 20. | @Polygonic *(DevSecOps)* / @Raii-stack *(Backlog Hygiene)* | **Open** |
| **IMP-S3-004** | Nov 18, 2026 | Tooling / Project Board | `scripts/project-automation.js` fetches Project #5 via `items(first: 100)` without cursor pagination (currently 90 total repository issues: 71 closed, 19 open), and `scripts/sync-project-fields.js` lacks schedule mappings for issues `#112`–`#126` and `#199`–`#202`. | Low immediate risk (`90/100` items), but adding >10 new issues or PR items to Project #5 would silently truncate automation checks. | Keep pull requests out of Project #5 item additions (rely on closing-issue references) and add GraphQL cursor pagination to `scripts/project-automation.js` if item count approaches 100 in Sprint 4. | @Raii-stack *(Scrum Master)* | **Monitoring** |

---

## 5. Sprint 3 Action Items & Next Steps

| Action Item | Owner | Target Date | Success Criterion |
|---|---|---|---|
| **AI-S3-01: Clear Sprint 2 QA Carryover Chain (`#54` -> `#57`, `#112` -> `#59`)** | @princeaguinaldo | 2026-11-19 | Execute & verify `tests/integration/crm-inventory.test.js`, publish `docs/qa/sprint2-crm-inventory-tests.md`, reconcile `BUG-001`/`BUG-002` in `docs/qa/bug-log.md`, and close `#54`, `#57`, `#112`, `#59`. |
| **AI-S3-02: Close Sprint 3 HR QA Suites (`#62` -> `#66`, `#121` -> `#68`)** | @princeaguinaldo | 2026-11-20 | Verify `hr-api.test.js`, `hr-employee.test.js`, `hr-security.test.js`, and E2E flows; publish `docs/qa/sprint3-test-summary.md` and close `#62`, `#66`, `#121`, `#68`. |
| **AI-S3-03: Finalize DevSecOps SAST, Monitoring Runbook & Deduplicated Tickets** | @Polygonic | 2026-11-20 | Deliver `.github/workflows/codeql.yml` (`#124`), `docs/security/monitoring-and-incident-response.md` (`#125`), and close verified overlaps `#119` & `#126`. |
| **AI-S3-04: Prepare Sprint 3 Retrospective & Sprint 4 Risk Register (`#70`)** | @Raii-stack | 2026-11-20 | Once `#63` merges and `#70` promotes to Ready, compile final Sprint 3 velocity metrics and Sprint 4 Risk Register in `docs/agile/sprint3-retrospective.md`. |
