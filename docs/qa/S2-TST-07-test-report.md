# S2-TST-07: Automated API Smoke & Edge-Case Tests for Customer and Product Endpoints

**Document ID:** S2-TST-07
**Assignee:** @princeaguinaldo (Test Engineer)
**Module:** HOPE, Inc. ERP (BAIYOGESIC) — CRM / Inventory
**Prerequisites:** #29, #54
**Execution Date:** 2026-11-27
**Status:** PASS

## 1. Executive Summary

Automated Vitest integration suite 	ests/integration/crm-inventory.test.js validates error handling, boundary conditions, and permission constraints across Customer and Product API endpoints. All 74 test cases passed with zero failures.

## 2. Verification Results

| Check | Command | Result |
|---|---|---|
| Vitest integration suite | 
px vitest run tests/integration/crm-inventory.test.js | PASS — 74/74 tests |

## 3. Scenario Coverage

- Creating customer with invalid payment term returns HTTP 400.
- Creating product with zero or negative price returns HTTP 400.
- Soft-deleting customer with active order history returns HTTP 409 Conflict.
- Non-authenticated requests return HTTP 401 Unauthorized.
- Price history lookup returns current active price for today.

## 4. Acceptance Criteria

- All customer and product boundary condition test cases execute and pass.
- Soft-delete dependency conflict (HTTP 409) verified in automated test.
- QA test report documented in docs/qa/sprint2-test-summary.md.
