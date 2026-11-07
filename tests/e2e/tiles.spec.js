const { test, expect } = require('@playwright/test');
const { db } = require('../integration/helpers');
const { QA_USERS } = require('../integration/setup/qa-users');
const { login } = require('./helpers');

let userId;

async function clearRights() {
  const { error } = await db.from('app_user_right').delete().eq('user_id', userId);
  if (error) throw error;
}

async function grant(code) {
  const { error } = await db.from('app_user_right').insert({ user_id: userId, right_code: code });
  if (error) throw error;
}

// A module tile is a link to the module's page
const tile = (page, path) => page.locator(`a[href^="${path}"]`);

// Wait for the dashboard first, otherwise "not there" would pass while the page is still loading
const dashboardLoaded = (page) => expect(page.getByText('Main Dashboard').first()).toBeVisible();

test.beforeAll(async () => {
  const { data, error } = await db.from('app_user').select('user_id').eq('email', QA_USERS.standard.email).single();
  if (error) throw error;
  userId = data.user_id;
});
test.beforeEach(async () => { await clearRights(); });
test.afterEach(async () => { await clearRights(); });

test('no rights: Customers and Products tiles are hidden', async ({ page }) => {
  await login(page, QA_USERS.standard.email);
  await dashboardLoaded(page);
  await expect(tile(page, '/customers')).toHaveCount(0);
  await expect(tile(page, '/inventory')).toHaveCount(0);
});

test('customers.access shows the Customers tile and nothing else', async ({ page }) => {
  await grant('customers.access');
  await login(page, QA_USERS.standard.email);
  await dashboardLoaded(page);
  await expect(tile(page, '/customers').first()).toBeVisible();
  await expect(tile(page, '/inventory')).toHaveCount(0);
});

test('TC-E2E-02: revoking the right removes the tile after a reload', async ({ page }) => {
  await grant('customers.access');
  await login(page, QA_USERS.standard.email);
  await dashboardLoaded(page);
  await expect(tile(page, '/customers').first()).toBeVisible();

  await clearRights(); // revoke in the database
  await page.reload();

  await dashboardLoaded(page);
  await expect(tile(page, '/customers')).toHaveCount(0);

  await page.goto('/customers'); // typing the URL must not work either
  await expect(page).toHaveURL(/\/dashboard/);
});

test('superadmin sees every module tile', async ({ page }) => {
  await login(page, QA_USERS.superadmin.email);
  await dashboardLoaded(page);
  for (const path of ['/customers', '/inventory', '/sales', '/employees']) {
    await expect(tile(page, path).first()).toBeVisible();
  }
});