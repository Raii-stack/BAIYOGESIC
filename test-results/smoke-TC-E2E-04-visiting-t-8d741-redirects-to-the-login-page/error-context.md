# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> TC-E2E-04: visiting the dashboard without logging in redirects to the login page
- Location: tests\e2e\smoke.spec.js:17:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/$/
Received string:  "http://localhost:5173/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="en">…</html>
       - unexpected value "http://localhost:5173/login"

```

```yaml
- main:
  - region "Log in to HOPE, Inc.":
    - img "HOPE logo"
    - text: HOPE, Inc. Business workspace
    - heading "Log in to HOPE, Inc." [level=1]
    - paragraph: Enter your work email and password to continue.
    - text: Work email
    - textbox "Work email":
      - /placeholder: name@company.com
    - paragraph
    - text: Password
    - textbox "Password":
      - /placeholder: Enter your password
    - button "Show password"
    - paragraph
    - button "Register"
    - button "Forgot password?"
    - button "Sign in"
    - paragraph: Need access? Contact your administrator.
- contentinfo: © 2026 HOPE, Inc. All rights reserved.
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const { QA_USERS } = require('../integration/setup/qa-users');
  3  | const { login } = require('./helpers');
  4  | 
  5  | test('TC-E2E-01: user can log in and the dashboard renders', async ({ page }) => {
  6  |   await login(page, QA_USERS.standard.email);
  7  |   await expect(page).toHaveURL(/\/dashboard/);
  8  |   await expect(page.getByText('Main Dashboard').first()).toBeVisible();
  9  | });
  10 | 
  11 | test('TC-E2E-03: wrong password shows an error and stays on the login page', async ({ page }) => {
  12 |   await login(page, QA_USERS.standard.email, 'wrong-password');
  13 |   await expect(page.getByRole('alert').first()).toContainText(/email or password/i);
  14 |   await expect(page).not.toHaveURL(/dashboard/);
  15 | });
  16 | 
  17 | test('TC-E2E-04: visiting the dashboard without logging in redirects to the login page', async ({ page }) => {
  18 |   await page.goto('/dashboard');
> 19 |   await expect(page).toHaveURL(/\/$/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  20 |   await expect(page.getByLabel('Work email')).toBeVisible();
  21 | });
  22 | 
  23 | test('TC-E2E-05: first-login user cannot skip the password change by typing a URL', async ({ page }) => {
  24 |   await login(page, QA_USERS.firstLogin.email);
  25 |   const dialog = page.getByRole('dialog', { name: 'Change your default password' });
  26 |   await expect(dialog).toBeVisible();
  27 | 
  28 |   await page.goto('/dashboard');
  29 |   await expect(page).toHaveURL(/\/$/);
  30 |   await expect(dialog).toBeVisible();
  31 |   await expect(page.getByText('Main Dashboard')).toHaveCount(0);
  32 | });
  33 | 
  34 | test('TC-E2E-06: standard user is redirected away from the Users page', async ({ page }) => {
  35 |   await login(page, QA_USERS.standard.email);
  36 |   await expect(page).toHaveURL(/\/dashboard/);
  37 |   await page.goto('/users');
  38 |   await expect(page).toHaveURL(/\/dashboard/);
  39 | });
  40 | 
  41 | test('TC-E2E-07: superadmin can open the Users page', async ({ page }) => {
  42 |   await login(page, QA_USERS.superadmin.email);
  43 |   await expect(page).toHaveURL(/\/dashboard/);
  44 |   await page.goto('/users');
  45 |   await expect(page).toHaveURL(/\/users/);
  46 | });
```