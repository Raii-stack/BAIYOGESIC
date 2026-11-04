# RBAC Test Cases (Sprint 1)

| ID | Title | Level | Expected | Priority | Status |
|---|---|---|---|---|---|
| TC-RBAC-01 | Superadmin/administrator allowed on every module action | Unit | allowed | P1 | Pass |
| TC-RBAC-02 | Admin allowed per matrix; cannot delete Users | Unit | allowed / 403 | P1 | Pass |
| TC-RBAC-03 | Standard user cannot edit or delete (no rights) | Unit | 403 | P1 | Pass |
| TC-RBAC-04 | Standard user with granular right gets only that action | Unit | allowed / 403 | P1 | Pass |
| TC-RBAC-05 | Empty rights list denied | Unit | 403 | P1 | Pass |
| TC-RBAC-06 | HR salary never granted by granular rights | Unit | 403 | P1 | Pass |
| TC-RBAC-07 | Unknown role, missing user, unknown module denied | Unit | 403 | P1 | Pass |
| TC-RBAC-08 | 403 response uses the standard error shape | Unit | `{ success:false, error:{ message, statusCode:403 } }` | P1 | Pass |
| TC-RBAC-09 | Standard user gets 403 on Superadmin endpoints | Integration | 403 | P1 | Pending routes |
| TC-RBAC-10 | Unauthenticated request gets 401 | Integration | 401 | P1 | Pending routes |
| TC-RBAC-11 | First-login user blocked (403) until password changed | Integration | 403 | P1 | Pending routes |
| TC-E2E-02 | UI tile disappears when right is revoked | E2E | tile hidden | P2 | Pending UI files |