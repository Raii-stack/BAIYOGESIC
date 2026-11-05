# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tiles.spec.js >> superadmin sees every module tile
- Location: tests\e2e\tiles.spec.js:63:1

# Error details

```
TypeError: Cannot read properties of undefined (reading 'email')
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const { db } = require('../integration/helpers');
  3  | const { QA_USERS } = require('../integration/setup/qa-users');
  4  | const { login } = require('./helpers');
  5  | 
  6  | let userId;
  7  | 
  8  | async function clearRights() {
  9  |   const { error } = await db.from('app_user_right').delete().eq('user_id', userId);
  10 |   if (error) throw error;
  11 | }
  12 | 
  13 | async function grant(code) {
  14 |   const { error } = await db.from('app_user_right').insert({ user_id: userId, right_code: code });
  15 |   if (error) throw error;
  16 | }
  17 | 
  18 | // A module tile is a link to the module's page
  19 | const tile = (page, path) => page.locator(`a[href^="${path}"]`);
  20 | 
  21 | // Wait for the dashboard first, otherwise "not there" would pass while the page is still loading
  22 | const dashboardLoaded = (page) => expect(page.getByText('Main Dashboard').first()).toBeVisible();
  23 | 
  24 | test.beforeAll(async () => {
  25 |   const { data, error } = await db.from('app_user').select('user_id').eq('email', QA_USERS.standard.email).single();
  26 |   if (error) throw error;
  27 |   userId = data.user_id;
  28 | });
  29 | test.beforeEach(async () => { await clearRights(); });
  30 | test.afterEach(async () => { await clearRights(); });
  31 | 
  32 | test('no rights: Customers and Products tiles are hidden', async ({ page }) => {
  33 |   await login(page, QA_USERS.standard.email);
  34 |   await dashboardLoaded(page);
  35 |   await expect(tile(page, '/customers')).toHaveCount(0);
  36 |   await expect(tile(page, '/inventory')).toHaveCount(0);
  37 | });
  38 | 
  39 | test('customers.access shows the Customers tile and nothing else', async ({ page }) => {
  40 |   await grant('customers.access');
  41 |   await login(page, QA_USERS.standard.email);
  42 |   await dashboardLoaded(page);
  43 |   await expect(tile(page, '/customers').first()).toBeVisible();
  44 |   await expect(tile(page, '/inventory')).toHaveCount(0);
  45 | });
  46 | 
  47 | test('TC-E2E-02: revoking the right removes the tile after a reload', async ({ page }) => {
  48 |   await grant('customers.access');
  49 |   await login(page, QA_USERS.standard.email);
  50 |   await dashboardLoaded(page);
  51 |   await expect(tile(page, '/customers').first()).toBeVisible();
  52 | 
  53 |   await clearRights(); // revoke in the database
  54 |   await page.reload();
  55 | 
  56 |   await dashboardLoaded(page);
  57 |   await expect(tile(page, '/customers')).toHaveCount(0);
  58 | 
  59 |   await page.goto('/customers'); // typing the URL must not work either
  60 |   await expect(page).toHaveURL(/\/dashboard/);
  61 | });
  62 | 
  63 | test('superadmin sees every module tile', async ({ page }) => {
> 64 |   await login(page, QA_USERS.superadmin.email);
     |                                         ^ TypeError: Cannot read properties of undefined (reading 'email')
  65 |   await dashboardLoaded(page);
  66 |   for (const path of ['/customers', '/inventory', '/sales', '/employees']) {
  67 |     await expect(tile(page, path).first()).toBeVisible();
  68 |   }
  69 | });
```