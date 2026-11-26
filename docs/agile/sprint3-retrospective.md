# HOPE, Inc. ERP — Sprint 3 Velocity Tracking, Sprint 4 Risk Register & Retrospective Report

**Sprint:** Sprint 3  
**Sprint Goal:** Human Resources (HR) Directory, Department & Job Management, Job History Career Timeline, Role-Based Salary Redaction, HR Security/Audit Hardening & Sprint 2 Carryover Closure  
**Sprint Duration:** Weeks 5 – 6 (Board window: November 9 – November 20, 2026; early HR & DR deliverables merged October 26 – November 2, 2026)  
**Scrum Master:** Ryan James (@Raii-stack)  
**Prerequisites:** [#63](https://github.com/Raii-stack/BAIYOGESIC/issues/63) (Sprint 3 Planning Notes, Carryover Prioritization & Impediment Log — Closed via PR `#213`), [#69](https://github.com/Raii-stack/BAIYOGESIC/issues/69) (Usability Review of Built HR Screens & Timeline Components — Closed via PR `#179`)  
**Date:** November 2026  

---

## 1. Executive Summary

Sprint 3 delivered the complete Human Resources (HR) module and supporting database, security, and UI governance for the HOPE, Inc. Enterprise Resource Planning (ERP) platform. The team shipped Department and Job Master List CRUD endpoints (`#113`), employee soft-delete separation workflows (`#64`), referential integrity delete triggers and personnel seed data (`#65`, `#120`), composite covering indexes and portable disaster recovery automation (`#67`), chronological promotion/transfer job history APIs (`#114`), role-based salary masking (`#115`, `#118`), interactive HR modals and career timeline components (`#116`, `#117`), and case-insensitive PII log redaction with `VIEW_SALARY` audit logging (`#202`).

In parallel, the team cleared all Sprint 2 DevSecOps carryover items (`#122`, `#199`, `#201`), merged the Sprint 2 retrospective (`#61` via PR `#203`) and Sprint 3 mid-sprint tracking log (`#63` via PR `#213`), and completed the HR accessibility/usability pass (`#69` via PR `#179`).

---

## 2. Sprint 3 Velocity Metrics & Burndown Tracking

### 2.1 Overall Sprint 3 Delivery Summary

| Metric | Target | Actual | Evaluation |
|---|---|:---:|---|
| **Committed Sprint 3 Tasks** | 22 | 22 | 100% scoped (`#62`–`#70`, `#113`–`#121`, `#124`–`#126`, `#202`) |
| **Sprint 2 DevSecOps Carryover Cleared** | 2 (+1 follow-up) | 3 | 100% cleared (`#122` PR `#205`, `#199` PR `#208`, `#201` PR `#210`) |
| **Completed Sprint 3 Tasks (incl. #70)** | 22 | 14 | 63.6% issue closure (100% of HR Backend, DB, UI/UX & Agile governance) |
| **Remaining Open Sprint 3 Issues** | 0 | 8 | 4 QA verification tickets (`#62`, `#66`, `#68`, `#121`) + 4 DevSecOps hardening/monitoring tasks (`#119`, `#124`–`#126`) |
| **Remaining Sprint 2 QA Carryovers** | 0 | 4 | `#54`, `#57`, `#59`, `#112` (integration test code written; pending live test-DB execution sign-off) |
| **WCAG 2.1 AA HR Usability Review** | Pass | Pass | Verified in `docs/design/sprint3-usability-review.md` (`#69`, PR `#179`) |

### 2.2 Role-by-Role Velocity Comparison (Planned vs. Merged PRs)

| Team Member | Role | Planned Sprint 3 Issues | Closed / Merged | Remaining Open | Completion Rate | Summary of Merged PR Deliverables & Status |
|---|---|:---:|:---:|:---:|:---:|---|
| **Kathryn Chloe** (@itsmechloe) | Backend Engineer & DB Admin | 7 | 7 | 0 | **100%** | PR `#136` (`#64`), `#140` (`#65`), `#142` (`#67`), `#143` (`#113`), `#147` (`#114`), `#171` (`#115`), `#172`/`#173` (`#120`) |
| **Alain Deiniel** (@alainmnts) | UI/UX & Frontend Developer | 4 | 4 | 0 | **100%** | PR `#179` (`#69`), `#187` (`#116`), `#188` (`#117`), `#189` (`#118`) |
| **Ryan James** (@Raii-stack) | Scrum Master | 2 | 2 | 0 | **100%** | PR `#213` (`#63` Sprint 3 tracking), plus `#70` (`docs/agile/sprint3-retrospective.md`) |
| **Marron Beroy** (@Polygonic) | DevSecOps Engineer | 5 | 1 | 4 | **20%** | PR `#211` (`#202` HR PII redaction & `VIEW_SALARY` audit) + Sprint 2 carryovers (`#122`, `#199`, `#201`); `#119`, `#124`–`#126` open |
| **Prince Nelson** (@princeaguinaldo) | Test Engineer | 4 | 0 | 4 | **0%** *(Suites Written)* | HR suites (`tests/integration/hr-api.test.js`, `hr-employee.test.js`, `hr-security.test.js`) in repo; `#62` Ready, `#66`/`#68`/`#121` queued behind `#62` |
| **Total** | **All Roles** | **22** | **14** | **8** | **63.6%** | **100% of core HR features & Sprint 2 DSO carryovers merged; QA sign-off & SAST/alerting remaining** |

### 2.3 Sprint 3 Burndown Checkpoints

| Checkpoint | Planned Remaining | Actual Remaining | Burndown Notes |
|---|:---:|:---:|---|
| **Checkpoint 1 (Oct 26 – Oct 28)** | 17 | 17 | Early HR backend & DB foundation merged (`#64`, `#65`, `#67`, `#113`, `#114` via PR `#136`, `#140`, `#142`, `#143`, `#147`). |
| **Checkpoint 2 (Nov 1 – Nov 2)** | 11 | 11 | Salary masking API (`#115`), FK orphan prevention (`#120`), HR UI screens (`#116`–`#118`), and usability audit (`#69`) merged. |
| **Checkpoint 3 (Nov 5 – Nov 18)** | 4 | 9 | Sprint 2 DSO carryovers (`#122`, `#199`, `#201`) and HR PII audit (`#202`, PR `#211`) merged; `#63` (`PR #213`) closed Nov 17. |
| **Sprint 3 Close (With #70)** | 0 | 8 | `#70` closes Scrum Master scope (`2/2`); QA verification chain (`#62` -> `#66`/`#121` -> `#68`) and `#119`/`#124`–`#126` carry forward with tracked ownership. |

---

## 3. Sprint 4 Risk Register (Sales, Payments, Reports & Release Readiness)

The following register tracks technical, security, and schedule risks impacting Sprint 4 delivery across the Sales, Payment Processing, 7 Executive Reports, Superadmin Audit Log Viewer, and final QA regression gates:

| Risk ID | Module / Area | Risk Description | Likelihood | Impact | Mitigation Strategy & Controls | Owner |
|---|---|:---:|:---:|:---:|---|---|
| **RSK-S4-01** | Sales & Pricing (`#71`, `#73`) | Effective-date unit price lookup (`public.current_active_price` / `pricehist`) could select an incorrect tier or suffer sequential scans when backdating sales orders across historical price changes. | Medium | High | Enforce `pricehist_prodcode_effdate_covering_idx` (`(prodcode, effdate DESC) INCLUDE (unitprice, is_deleted)`) for index-only lookups as of `salesdate`, verified via `tests/integration/sales-api.test.js` (`#73`). | @itsmechloe / @princeaguinaldo |
| **RSK-S4-02** | Payments & Soft Delete (`#74`, `#76`, `#77`, `#78`) | Concurrent or partial payments could desynchronize `sales_balance_view` (`total_amount - amount_paid`), allow overpayments, or permit archiving sales headers with active child payment rows. | Medium | High | Compute balances dynamically in `public.sales_balance_view` backed by `payment_transno_paydate_covering_idx`, reject overpayments (`HTTP 400`), enforce DB/API delete guards (`HTTP 409`), and verify in `tests/qa-unit/sales-integrity-and-audit.test.js` (`#76`, `#77`). | @itsmechloe / @princeaguinaldo |
| **RSK-S4-03** | 7 Executive Reports (`#72`, `#75`, `#79`) | Multi-join aggregations (Top Customers, Top Products, Top Sales, Employee Rosters, Job History, Product Master List) risk exceeding the `< 50 ms` query SLA, leaking restricted reports without `Reports` rights, or clipping multi-page PDF printouts. | Medium | High | Use single-pass parameterized SQL views/TVFs with covering indexes (`sales_active_reports_idx`, verified `0.22–2.45 ms`), enforce `requirePermission('Reports', reportCode)` server-side, apply `@media print` header repetition (`#83`), and validate all 7 reports in `#79`. | @itsmechloe / @alainmnts / @princeaguinaldo |
| **RSK-S4-04** | Audit Log Viewer & PII (`#76`, `#80`, `#119`, `#126`) | High-volume `audit_log` queries could degrade Superadmin pagination performance, or error/diagnostic logs could inadvertently leak employee salary/PII fields. | Low | High | Use single-roundtrip window pagination (`count(*) OVER()::integer AS _total`) with `audit_log_table_action_at_idx` / `audit_log_actor_action_at_idx`, append-only DB immutability triggers (`#80`), and case-insensitive log redaction (`PR #211` / `#126`). | @itsmechloe / @Polygonic |
| **RSK-S4-05** | QA Verification Backlog (`#54`–`#59`, `#62`–`#68`, `#73`–`#82`) | Eight open Sprint 2/3 QA issues (`#54`, `#57`, `#59`, `#112`, `#62`, `#66`, `#68`, `#121`) plus live-database Playwright E2E setup dependencies (`IMP-S3-002`) could bottleneck Sprint 4 final sign-off (`#82`). | High | High | Unblock linear dependency chains immediately (`#54` -> `#57`/`#112` -> `#59` and `#62` -> `#66`/`#121` -> `#68`), seed QA accounts in the test Supabase project (`tests/e2e/global-setup.js`), and execute full regression prior to `#84` production promotion. | @princeaguinaldo / @Raii-stack |
| **RSK-S4-06** | DevSecOps SAST & Alerting (`#124`, `#125`) | Missing CodeQL SAST workflow (`#124`) and production health/error alerting runbook (`#125`) could leave static security findings or Vercel runtime failures undetected at release time. | Medium | Medium | Prioritize `.github/workflows/codeql.yml` (`#124`) and `docs/security/monitoring-and-incident-response.md` (`#125`) alongside `#81` DR validation before promoting `test` -> `main`. | @Polygonic |

---

## 4. Sprint 3 Review & Retrospective Analysis

### 4.1 What Went Well (Keep Doing)
- **Complete HR Architecture Delivered Ahead of Schedule:** Backend, database, and frontend teams achieved **100%** completion of their Sprint 3 scope, delivering department/job CRUD, job history career timelines, separation archiving, and role-based salary masking (`#64`, `#65`, `#67`, `#69`, `#113`–`#118`, `#120`).
- **Database Integrity & Recovery Readiness:** Foreign-key delete guards, composite covering indexes, and automated backup/restore tooling (`scripts/db-backup-restore.js`, `scripts/backup-restore.sh`) established strong data safety ahead of Sales and Reports (`#67`, `#120`).
- **Clearance of Security Carryovers & PII Auditing:** DevSecOps closed all Sprint 2 carryovers (`#122`, `#199`, `#201`) and introduced case-insensitive PII log redaction and `VIEW_SALARY` audit trails (`#202`, PR `#211`).
- **Accessible Timeline & Tab Controls:** The HR usability review (`#69`, PR `#179`) validated roving-tabindex navigation, focus restoration on slide-overs, and responsive career timeline layouts across viewports.

### 4.2 What Could Be Improved (Pains & Blockers)
- **QA Issue Closure Lag Behind Test Implementation:** Automated integration tests (`hr-api.test.js`, `hr-employee.test.js`, `hr-security.test.js`) were implemented, yet all 4 Sprint 3 QA issues (`#62`, `#66`, `#68`, `#121`) remained open because test-environment seeding and formal QA report PRs trailed code merges (`IMP-S3-001`, `IMP-S3-002`).
- **Backlog Overlap Between Follow-Up & Planned Security Issues:** Delivering `#202` in PR `#211` overlapped with open issues `#119` and `#126`, creating status ambiguity on Project #5 (`IMP-S3-003`).
- **Project Board Pagination Ceiling (`IMP-S3-004`):** `scripts/project-automation.js` queries `items(first: 100)` without cursor pagination, requiring vigilance as total repository items approach 100.

### 4.3 What We Learned
- Separate live-DB QA environment seeding (`tests/integration/setup/qa-users.js`) early in the sprint so Playwright E2E and integration sign-off PRs can merge concurrently with feature PRs.
- Reconcile overlapping security/defect issues (`#119`, `#126`) immediately when consolidated hardening PRs (`#211`) land to keep Project #5 burndown metrics accurate.

---

## 5. Action Items Entering Sprint 4

| Action Item | Owner | Target | Success Criterion |
|---|---|---|---|
| **AI-S3-01: Clear Sprint 2 & 3 QA Verification Queues** | @princeaguinaldo | Sprint 4 Mid-Sprint | Execute test-DB integration & Playwright runs, update `docs/qa/bug-log.md`, and close `#54`–`#59`, `#112`, `#62`–`#68`, `#121`. |
| **AI-S3-02: Close SAST, Monitoring & Overlap Security Tickets** | @Polygonic | Sprint 4 Mid-Sprint | Land CodeQL workflow (`#124`), monitoring runbook (`#125`), and close verified overlaps `#119` & `#126`. |
| **AI-S3-03: Monitor Sprint 4 Sales & Reports Risks** | @Raii-stack / Team | Ongoing | Track `RSK-S4-01` through `RSK-S4-06` during Sales, Payments, Reports, and Audit Viewer verification (`#71`–`#83`). |
| **AI-S3-04: Compile Release Checklist, Demo Script & Final Report** | @Raii-stack | Sprint 4 Close | Deliver `#84` (`docs/agile/final-project-report.md`) once `#83` final usability pass completes. |

---

## 6. Scrum Master Sign-Off

Sprint 3 delivered 100% of core Human Resources capabilities, cleared all Sprint 2 security carryovers, and established clear risk mitigations entering Sprint 4 (Sales, Payments, Executive Reports, and Final Release).

**Approved by:** Ryan James (Scrum Master, @Raii-stack)  
**Date:** November 2026
