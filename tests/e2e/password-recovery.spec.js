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

test('an expired reset link shows its own screen and offers a new link', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { success: false } }));
  await page.route('**/api/auth/reset-password/validate', route => route.fulfill({ json: { success: true, data: { status: 'expired' } } }));
  await page.goto(`/reset-password#token=${'a'.repeat(64)}`);
  await expect(page.getByRole('heading', { name: 'Reset link expired' })).toBeVisible();
  await expect(page.getByLabel('New Password', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Request a new reset link', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Reset password' })).toBeVisible();
});

test('registration code expiry and resend work on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { success: false } }));
  let sends = 0;
  await page.route('**/api/auth/register/send-code', async route => {
    sends++;
    const now = await page.evaluate(() => Date.now());
    return route.fulfill({ json: { success: true, data: { expiresAt: new Date(now + 600000).toISOString(), resendAt: new Date(now + 60000).toISOString() } } });
  });
  await page.goto('/register');
  await page.getByLabel('First name').fill('Jane');
  await page.getByLabel('Last name').fill('Doe');
  await page.getByLabel('Work email').fill('jane@example.com');
  await page.getByLabel('Password', { exact: true }).fill('SecurePass123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('SecurePass123!');
  await page.getByRole('button', { name: 'Send verification code' }).click();
  await expect(page.getByLabel('Verification code')).toBeFocused();
  await expect(page.getByRole('button', { name: /Resend code in/ })).toBeDisabled();
  await page.clock.fastForward(60001);
  await page.getByRole('button', { name: 'Resend code', exact: true }).click();
  expect(sends).toBe(2);
  await page.clock.fastForward(600001);
  await expect(page.getByRole('status')).toContainText('Verification code expired');
  await expect(page.getByRole('button', { name: 'Verify and submit registration' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resend code', exact: true }).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();
  expect(sends).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
