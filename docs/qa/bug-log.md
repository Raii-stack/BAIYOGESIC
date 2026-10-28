# Sprint 1 Bug Log

## BUG-001: Registration returns 503 for a valid request
**Severity:** High | **Status:** Open | **Found by:** Prince Nelson J. Aguinaldo Jr. | **Test:** TC-AUTH-01

**Environment:** local API (`npm run api:dev`), branch main, test Supabase project

**Steps to Reproduce:**
1. Start the API.
2. Send `POST /api/auth/register` with body
   `{ "firstName": "QA", "lastName": "Tester", "email": "qa+test@test.com" }`

**Expected:** 201 with `{ success: true }`.

**Actual:** 503
`{ "success": false, "error": { "message": "Server authentication credentials are not authorized to read app_user", "statusCode": 503 } }`

**Suspected cause:** `register` in `controllers/auth-controller.js` reads `app_user` with `supabase` (SUPABASE_KEY), while `login` uses `authSupabase` (service role). The read is denied with error code 42501.

**Related concern (to check after the fix):** `register` never inserts the new user into `app_user`, so even a 201 would not create an account.

**Screenshot/log:** attach a screenshot of the failing Jest output.

![BUG-001](<Screenshot 2026-10-20 232247.png>)

## BUG-002: Forgot-password and reset-password endpoints still exposed after feature removal
**Severity:** Medium | **Status:** Open | **Found by:** Prince Nelson J. Aguinaldo Jr. | **Tests:** `tests/integration/auth.test.js` (Removed features stay removed)

**Environment:** local API (`npm run api:dev`), branch main, test Supabase project

**Steps to Reproduce:**
1. Start the API.
2. Send `POST /api/auth/forgot-password` with body `{ "email": "x@test.com" }`.
3. Send `POST /api/auth/reset-password` with body `{ "email": "x@test.com" }`.

**Expected:** Both return 404, because the team removed forgot-password and registration from scope on 10/26/2026.

**Actual:**
- `forgot-password` returns **200**.
- `reset-password` returns **400** (it validates the request, so the route exists).
- `register` correctly returns 404.

**Impact:** Removed features remain reachable. Possible token creation in `password_reset_token` [confirm from SQL check: new rows appeared / no new rows]. Unused auth endpoints add attack surface.

**Suggested fix:** Remove the routes (and the unused controller code) or confirm they are intentionally kept.

**Evidence:** screenshots of the failing test output and the `password_reset_token` query.