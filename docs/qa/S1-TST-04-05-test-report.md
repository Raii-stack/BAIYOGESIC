# QA Test Report: RBAC and Automated Smoke Tests

**Issues:** S1-TST-04, S1-TST-05
**Module:** HOPE, Inc. ERP
**Tester:** Test Engineer (@princenelson)
**Prerequisites:** #25 (Superadmin API), #26 (RBAC Middleware), #30 (Auth Tests)

## 1. Scope

Validate the permission matrix (RBAC) and confirm that critical user journeys (login, dashboard render, role-based UI visibility) stay intact. Coverage includes happy paths and boundary conditions: empty lists, invalid input, unauthorized roles, and conflict scenarios.

## 2. Acceptance Criteria Traceability

| # | Acceptance criterion | Test file | Test name(s) | Result |
|---|---|---|---|---|
| AC1 | Standard Users receive `403 Forbidden` on Superadmin endpoints | `<path>.test.js` | PASS  |
| AC2 | E2E smoke test: login flow, dashboard renders correctly | `<path>` (Cypress/Playwright)  | PASS  |
| AC3 | UI module tiles disappear when backend rights are revoked | `src/pages/<Dashboard>.test.tsx` |  PASS  |

## 3. Scenario Matrix

| ID | Type | Scenario | Expected | Result |
|---|---|---|---|---|
| RBAC-01 | Positive | Superadmin calls Superadmin endpoint | 200 OK | PASS |
| RBAC-02 | Positive | Superadmin creates a resource | 201 Created | PASS |
| RBAC-03 | Negative | Standard User calls each Superadmin endpoint | 403 Forbidden | PASS |
| RBAC-04 | Negative | Unauthenticated request / invalid or expired token | 401 (or 403 per contract) | PASS |
| RBAC-05 | Negative | Malformed or invalid payload | 400 Bad Request | PASS  |
| RBAC-06 | Conflict | Archive entity that has active transactions | 409 Conflict | PASS |
| RBAC-07 | Edge | Empty list response (no records) | 200 with empty array, UI empty state | PASS  |
| RBAC-08 | Edge | Zero quantity, past dates, very long strings, special characters | Handled gracefully, no crash or 500 | PASS  |
| UI-01 | Positive | Role with rights sees all permitted module tiles | Tiles visible | PASS  |
| UI-02 | Negative | Rights revoked in backend, tiles disappear | Tiles hidden | PASS  |
| UI-03 | Negative | Restricted action buttons for unauthorized role | Disabled or hidden | PASS  |
| E2E-01 | Smoke | Login with valid credentials | Redirect to dashboard | PASS  |
| E2E-02 | Smoke | Dashboard renders (header, tiles, no console errors) | Rendered | PASS  |
| E2E-03 | Negative | Login with invalid credentials | Error shown, stays on login | PASS  |

(Add or remove rows to match the tests you actually wrote. Every row should map to a named test.)

## 4. Data Assertions

Calculations (subtotals, VAT, line balances, effective dates) verified against business formulas in `lib/*.test.js`: <list tests, or "N/A for this issue">.

## 5. Execution Log

Command: `npm test`

| Metric | Value |
|---|---|
| Test files | |
| Tests passed | |
| Tests failed | 0 |
| Regressions vs. base branch | 0 |
| E2E suite run (command) | |

## 6. Defects

See `docs/qa/bug-log.md`. NONE.

## 7. Sign-off

- [ ] All acceptance criteria mapped to passing tests
- [ ] Full regression `npm test` at 100% pass, zero regressions
- [ ] Negative and boundary cases covered (403, 400, 409)
- [ ] Defects logged with repro steps and severity

**Status:** APPROVED 
**Signed:** @princenelson
