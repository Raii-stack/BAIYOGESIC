const { test, expect } = require('@playwright/test');
test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173', launchOptions: { channel: 'chrome' } });

async function workspace(page) {
  let preferences = { density: 'comfortable', motion: true, employment: true, sales: true, payments: true, products: true, popups: true };
  let failSave = true;
  let passwordChanges = 0;
  let inboxRequests = 0;
  let preferenceRequests = 0;
  const notices = Array.from({ length: 21 }, (_, index) => ({ id: String(21 - index), category: index === 0 ? 'sales' : index === 1 ? 'products' : 'account', title: index === 0 ? 'Sale created' : index === 1 ? 'Product price updated' : `Account notice ${21 - index}`, message: 'A relevant record was updated.', createdAt: '2026-11-07T00:00:00Z', readAt: null }));
  const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
  const sale = { transno: 'TR0001', salesdate: '2026-11-07', custno: 'C001', custname: 'Example Customer', empno: '00001', empname: 'Employee One', lines: [], payments: [], is_deleted: false };
  const product = { prodcode: 'PD001', description: 'Example Product', unit: 'pc', unitprice: 100, effdate: '2026-11-07', is_deleted: false, stamp: '' };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    let data;
    if (url.pathname === '/api/auth/session') data = { user: { userId: 'employee-1', empno: '00001', name: 'Employee One', email: 'employee@example.com', role: 'employee', status: 'active', mustChangePassword: false, rights: ['sales.access','sales.details.view','products.access'] } };
    else if (url.pathname === '/api/auth/activity') data = { message: 'ok' };
    else if (url.pathname === '/api/auth/change-password') {
      expect(route.request().postDataJSON()).toEqual({ currentPassword: 'OldSecure123!', newPassword: 'NewSecure456!' });
      passwordChanges++; data = { message: 'Password updated successfully' };
    } else if (url.pathname === '/api/me/preferences') {
      preferenceRequests++;
      if (method === 'PATCH') {
        if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { success: false, error: { message: 'Unavailable' } } }); }
        preferences = route.request().postDataJSON();
      }
      data = { preferences };
    } else if (url.pathname === '/api/me/notifications') {
      inboxRequests++;
      const current = Number(url.searchParams.get('page') || 1);
      data = { items: notices.slice((current - 1) * 20, current * 20), unreadCount: notices.filter(item => !item.readAt).length, total: notices.length, page: current, totalPages: 2 };
    } else if (url.pathname.endsWith('/read-all')) {
      notices.forEach(item => { item.readAt = '2026-11-07T01:00:00Z'; }); data = { message: 'ok' };
    } else if (/\/notifications\/\d+\/read$/.test(url.pathname)) {
      notices.find(item => item.id === url.pathname.split('/').at(-2)).readAt = '2026-11-07T01:00:00Z'; data = { message: 'ok' };
    } else if (/\/notifications\/\d+\/open$/.test(url.pathname)) {
      const id = url.pathname.split('/').at(-2);
      data = { href: id === '21' ? '/sales?notificationSale=TR0001' : id === '20' ? '/inventory?notificationProduct=PD001' : '/settings?section=security' };
    } else if (url.pathname === '/api/dashboard/stats') data = { customers: 2, products: 1, openOrders: 1, revenue: 100 };
    else if (url.pathname === '/api/sales') data = { sales: [sale], pagination };
    else if (url.pathname === '/api/sales/TR0001') data = { sale };
    else if (url.pathname === '/api/products') data = { products: [product], pagination };
    else if (url.pathname === '/api/products/PD001/prices') data = { prices: [{ effdate: '2026-11-07', unitprice: 100 }] };
    else throw new Error(`Unexpected API ${method} ${url.pathname}`);
    await route.fulfill({ json: { success: true, data } });
  });
  return { get inboxRequests() { return inboxRequests; }, get preferenceRequests() { return preferenceRequests; }, get passwordChanges() { return passwordChanges; } };
}

test('employee settings apply immediately, retry safely, persist on refresh, and change password', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await workspace(page);
  await page.goto('/dashboard');
  await page.getByLabel('Account menu').click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Smooth animations/ })).toBeEnabled();
  await page.getByRole('checkbox', { name: /Smooth animations/ }).uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-workspace-motion', 'off');
  await page.getByRole('combobox', { name: /Table spacing/ }).selectOption('compact');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('alert')).toContainText('Your choices are kept');
  await page.getByRole('button', { name: 'Retry saving settings' }).click();
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Smooth animations/ })).not.toBeChecked();
  await expect(page.getByRole('combobox', { name: /Table spacing/ })).toHaveValue('compact');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Change password' });
  await dialog.getByLabel('Current password', { exact: true }).fill('OldSecure123!');
  await dialog.getByLabel('New password', { exact: true }).fill('NewSecure456!');
  await dialog.getByLabel('Confirm new password').fill('NewSecure456!');
  await dialog.getByRole('button', { name: 'Update password' }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.passwordChanges).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('reduced motion keeps menus and password dialogs usable by keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await workspace(page);
  await page.goto('/settings');
  const bell = page.getByTitle('Notifications', { exact: true });
  await bell.focus();
  await page.keyboard.press('Enter');
  const center = page.getByRole('region', { name: 'Notification center' });
  await expect(center).toBeVisible();
  await expect(center).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await expect(center).toBeHidden();
  await expect(bell).toBeFocused();
  const passwordButton = page.getByRole('button', { name: 'Change password', exact: true });
  await passwordButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Change password' });
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await expect(dialog.getByLabel('Current password', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(passwordButton).toBeFocused();
});

test('employee inbox retains data, supports history/read actions, and opens linked records', async ({ page }) => {
  const state = await workspace(page);
  await page.goto('/dashboard');
  await page.getByTitle('Notifications', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Notification center' })).toBeVisible();
  await page.getByRole('link', { name: 'View all notifications' }).click();
  await expect(page.getByRole('region', { name: 'Employee inbox' })).toContainText('Sale created');
  const initial = state.inboxRequests;
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).click();
  await page.getByTitle('Notifications', { exact: true }).click();
  await page.getByRole('link', { name: 'View all notifications' }).click();
  expect(state.inboxRequests).toBe(initial);
  expect(state.preferenceRequests).toBe(1);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Employee inbox' }).getByText('Account notice 1', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  const historyRequests = state.inboxRequests;
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).click();
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('region', { name: 'Employee inbox' }).getByText('Account notice 1', { exact: true })).toBeVisible();
  expect(state.inboxRequests).toBe(historyRequests);
  await expect(page.getByText('Loading inbox page…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mark Account notice 1 as read', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark Account notice 1 as read', exact: true })).toHaveCount(0);
  await expect(page.getByText('Loading inbox page…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: /Sale created.*A relevant record/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/notificationSale=TR0001/);
  await page.keyboard.press('Escape');
  await page.goto('/notifications');
  await page.getByRole('button', { name: /Product price updated.*A relevant record/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/notificationProduct=PD001/);
  await page.keyboard.press('Escape');
  await page.goto('/notifications');
  await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
  await expect(page.getByTitle('Notifications', { exact: true })).toHaveAttribute('aria-label', 'Notifications: 0 unread');
});

test('an inbox history failure stops loading and can be retried', async ({ page }) => {
  await workspace(page);
  await page.route('**/api/me/notifications?page=2', route => route.fulfill({ status: 503, json: { success: false } }), { times: 1 });
  await page.goto('/notifications');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Loading inbox page…')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry loading inbox', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Employee inbox' }).getByText('Account notice 1', { exact: true })).toBeVisible();
});
