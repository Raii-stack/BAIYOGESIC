const { test, expect } = require('@playwright/test');
const { QA_USERS } = require('../integration/setup/qa-users');
const { login } = require('./helpers');

test('TC-E2E-01: user can log in and the dashboard renders', async ({ page }) => {
  await login(page, QA_USERS.standard.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Main Dashboard').first()).toBeVisible();
});

test('TC-E2E-03: wrong password shows an error and stays on the login page', async ({ page }) => {
  await login(page, QA_USERS.standard.email, 'wrong-password');
  await expect(page.getByRole('alert').first()).toContainText(/email or password/i);
  await expect(page).not.toHaveURL(/dashboard/);
});

test('TC-E2E-04: visiting the dashboard without logging in redirects to the login page', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Work email')).toBeVisible();
});

test('TC-E2E-05: first-login user cannot skip the password change by typing a URL', async ({ page }) => {
  await login(page, QA_USERS.firstLogin.email);
  const dialog = page.getByRole('dialog', { name: 'Change your default password' });
  await expect(dialog).toBeVisible();

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Main Dashboard')).toHaveCount(0);
});

test('TC-E2E-06: standard user is redirected away from the Users page', async ({ page }) => {
  await login(page, QA_USERS.standard.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/users');
  await expect(page).toHaveURL(/\/dashboard/);
});

test('TC-E2E-07: superadmin can open the Users page', async ({ page }) => {
  await login(page, QA_USERS.superadmin.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/users');
  await expect(page).toHaveURL(/\/users/);
});