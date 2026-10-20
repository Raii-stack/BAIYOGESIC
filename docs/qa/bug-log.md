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