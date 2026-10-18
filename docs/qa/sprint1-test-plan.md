# Sprint 1 QA Test Plan

**Project:** HOPE, Inc. ERP (BAIYOGESIC)
**Author:** Prince Nelson J. Aguinaldo Jr. (Test Engineer)
**Reviewer:** Ryan James M. Gopio (Scrum Master)
**Version:** 1.0 | **Date:** [date]

## 1. Objective and Scope
**Objective:** Verify that Sprint 1 features are secure, functional, and stable before the Sprint Review.

**In scope:**
- Authentication (registration, login)
- Password flows (reset, first-time setup)
- Role-based access control (RBAC)
- Dashboard and module tiles
- Soft delete and audit logging

**Out of scope:**
- HR and Sales module features beyond access control
- Performance and load testing
- [anything else the team confirms]

## 2. Test Levels
| Level | Tool | What it covers |
|---|---|---|
| Unit | Jest | Helpers, permission-check logic, hooks (e.g. usePermissions) |
| Integration | Jest + Supertest | API routes together with the Supabase database |
| E2E | Playwright | Browser journeys: login, dashboard, module tiles |

## 3. Environments and Test Data
- **Environment:** Test Supabase project (not production)
- **Test users:** superadmin, HR, standard user, first-login user, soft-deleted user
- **Data reset:** 
- **Secrets:** stored in `.env.test`, never committeds

## 4. Entry and Exit Criteria
**Entry:**
- Build is deployed to the test environment
- Seed data is loaded
- Endpoint list and permission matrix are available

**Exit:**
- All P1 and P2 tests pass
- No open Critical or High bugs
- Bug log and sign-off report completed

## 5. Risks
| Risk | Impact | Mitigation |
|---|---|---|
| API not ready when testing starts | Tests delayed | Write test cases first, automate as endpoints land |
| Reset tokens are hard to expire on demand | Expiry tests blocked | Edit the token's expiry in the database via the test service client |
| Missing `data-testid` attributes | Unstable UI tests | Request them from the UI/UX developer early |
| [add your own] | | |

## 6. Acceptance Criteria
| ID | Area | Criterion |
|---|---|---|
| AC-01 | Token expiry | A reset token older than the TTL ([X] minutes) returns 400/401 and the password is not changed |
| AC-02 | Token reuse | A token used once returns 400/401 on the second use |
| AC-03 | Token tampering | An altered or unknown token returns 400/401 |
| AC-04 | Soft delete | Deleted records have `is_deleted = true` and are excluded from every GET |
| AC-05 | Soft delete | A parent with child records cannot be deleted |
| AC-06 | Audit | Each mutation creates an `audit_log` row with the correct acting user |
| AC-07 | RBAC | Unauthorized roles get 403; unauthenticated requests get 401 |
| AC-08 | First login | A user cannot bypass first-time password setup |
| AC-09 | UI rights | Module tiles disappear when backend rights are revoked |

## 7. Traceability Matrix
| Criterion | Test case ID | Level | File | Priority |
|---|---|---|---|---|
| AC-01 | TC-AUTH-05 | Integration | tests/integration/auth.test.js | P1 |
| AC-02 | TC-AUTH-06 | Integration | tests/integration/auth.test.js | P1 |
| AC-03 | TC-AUTH-07 | Integration | tests/integration/auth.test.js | P1 |
| AC-04 | TC-SD-01 | Integration | tests/integration/softdelete.test.js | P2 |
| AC-05 | TC-SD-02 | Integration | tests/integration/softdelete.test.js | P2 |
| AC-06 | TC-AUD-01 | Integration | tests/integration/audit.test.js | P2 |
| AC-07 | TC-RBAC-01 | Integration | tests/integration/rbac.test.js | P1 |
| AC-08 | TC-AUTH-08 | Integration | tests/integration/auth.test.js | P1 |
| AC-09 | TC-E2E-02 | E2E | tests/e2e/tiles.spec.js | P2 |

## 8. Deliverables
- This test plan (`docs/qa/sprint1-test-plan.md`)
- Integration tests (`tests/integration/`)
- E2E smoke tests (`tests/e2e/`)
- Bug log (`docs/qa/bug-log.md`)
- Sign-off report (`docs/qa/sprint1-signoff.md`)