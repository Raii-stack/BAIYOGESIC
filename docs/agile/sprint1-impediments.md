# HOPE, Inc. ERP — Sprint 1 Impediment Log & Velocity Checkpoints

**Sprint:** Sprint 1  
**Scrum Master:** Ryan James (@Raii-stack)  
**Date:** October 2026  
**Project:** HOPE, Inc. Enterprise Resource Planning (ERP) System  

---

## 1. Mid-Sprint Impediment Register

| ID | Date Logged | Category | Description | Impact | Resolution / Countermeasure | Status |
|---|---|---|---|---|---|:---:|
| **IMP-001** | Day 4 | Infrastructure / DB | Supabase direct connection host (`db.<projectRef>.supabase.co`) defaults to IPv6, causing `ENOTFOUND` / `ENETUNREACH` in IPv4-only serverless runtimes (Vercel Lambda). | Blocked backend API endpoints deployed to Vercel preview environments. | Configured automatic rewrite to IPv4 transaction pooler (`aws-0-ap-southeast-1.pooler.supabase.com:5432`) with `ssl: { rejectUnauthorized: false }` in `db.js`. Merged via PR #85 & #86. | **Resolved** |
| **IMP-002** | Day 6 | Backend API / QA | `POST /api/auth/register` returned HTTP `503 Service Unavailable` with database code `42501` (permission denied) and missing insertion into `app_user`. | Registration integration test failed (`TC-AUTH-01`); new users could not register through the API. | Logged defect **BUG-001** (Issue #51). Frontend and unit tests mocked the auth endpoint while BackEnd Engineer prepared the `authSupabase` service-role fix. | **In Progress** |
| **IMP-003** | Day 7 | Resource / Agile | Sprint backlog workload was heavily skewed toward `@itsmechloe` (Kathryn Chloe) with 20+ tasks across DB and Backend. | Development velocity risk; Kathryn was overallocated across multiple modules. | Scrum Master redistributed 8 tasks across Sprints 2–4 to DevSecOps Engineer `@Polygonic` (Marron Beroy), balancing task distribution to ~12 tasks each. | **Resolved** |
| **IMP-004** | Day 8 | Tooling / GitHub | GitHub Projects v2 automation token lacked write scopes for project board fields (`Priority`, `Deadline`, `Status`). | Field synchronization failed with GraphQL mutation permission errors. | Updated GitHub Personal Access Token to include full `project` and `repo` scopes in MCP config and GitHub Actions secrets. | **Resolved** |

---

## 2. Velocity Checkpoints

### Checkpoint 1: Day 3 (Foundation Milestone)
- **Target:** Database initialization migrations applied and core UI design system established.
- **Actual:** Completed ahead of schedule. Supabase base migrations (#19, #20) and Tailwind CSS design components (#13, #14) delivered and reviewed.
- **Velocity:** 4 tasks completed (100% of checkpoint plan).

### Checkpoint 2: Day 6 (Integration Milestone)
- **Target:** API scaffold, authentication endpoints, and React login/register forms connected.
- **Actual:** Backend app scaffold (#22), user auth API (#23), password hashing (#24), and frontend auth forms (#15, #16) merged. BUG-001 identified by QA on registration endpoint.
- **Velocity:** 6 additional tasks completed (cumulative 10 tasks).

### Checkpoint 3: Day 9 (RBAC & Deployment Milestone)
- **Target:** Superadmin RBAC panels, dynamic module permissions, and Vercel cloud deployment.
- **Actual:** Superadmin UI (#17), RBAC dynamic tiles (#18), admin API (#25), server-side middleware (#26), and Vercel configuration (#27) completed. All 41 unit and component tests passing.
- **Velocity:** 7 additional tasks completed (cumulative 17 tasks Done).

---

## 3. Sprint 1 Velocity Summary

```
Total Sprint 1 Planned Tasks : 23
Tasks Completed (Done)       : 17
Tasks In Progress / Ready    :  6 (CI/CD #28, Smoke Tests #31, Bug Fix Verification #32, BUG-001 #51, Usability #52, Retro #53)
Sprint 1 Completion Rate     : 74%
Carryover to Sprint 2        : 0 (Remaining Sprint 1 tasks remain in Sprint 1 buffer)
```
