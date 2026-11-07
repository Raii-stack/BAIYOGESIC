const { test, expect } = require('@playwright/test');
test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173', launchOptions: { channel: 'chrome' } });

test('recovery validates work email, retries errors, and disables repeated sends after success', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let sends = 0;
  await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('**/api/auth/forgot-password', route => {
    sends++;
    expect(route.request().postDataJSON()).toEqual({ email: 'employee@example.com' });
    return route.fulfill({ status: sends === 1 ? 503 : 200, json: sends === 1 ? { success: false } : { success: true, data: { message: 'Check your inbox.' } } });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset password' });
  await dialog.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(dialog).toContainText('Enter a valid work email address.');
  expect(sends).toBe(0);
  await dialog.getByLabel('Work email', { exact: true }).fill('employee@example.com');
  await dialog.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Send reset link', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Reset link sent', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('status')).toContainText('15 minutes');
  await expect(dialog.locator('a[href*="token"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Return to sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Reset link sent', exact: true })).toBeDisabled();
  expect(sends).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('an expired reset link displays the backend error without claiming success', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('**/api/auth/reset-password', route => route.fulfill({ status: 400, json: { success: false, error: { message: 'Invalid or expired reset token' } } }));
  await page.goto(`/reset-password#token=${'a'.repeat(64)}`);
  await page.getByLabel('New Password', { exact: true }).fill('FixturePassword1!');
  await page.getByLabel('Confirm New Password', { exact: true }).fill('FixturePassword1!');
  await page.getByRole('button', { name: 'Update Password', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid or expired reset token');
  await expect(page.getByRole('button', { name: 'Update Password', exact: true })).toBeEnabled();
});
