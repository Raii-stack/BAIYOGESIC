const { test, expect } = require('@playwright/test');

// Run against a local Vite server: npx playwright test tests/e2e/ui-consistency.spec.js --workers=1
test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173', launchOptions: { channel: 'chrome' } });

const user = { userId: 'admin', email: 'preview@example.com', role: 'superadmin', status: 'active', mustChangePassword: false };
const collections = {
  '/api/products': ['products', { prodcode: 'PX0001', description: 'Industrial supplies', unit: 'pc', unitprice: '1250.75', effdate: '2026-10-01' }],
  '/api/customers': ['customers', { custno: 'CUS001', custname: 'Northstar Supplies', address: 'Quezon City', payterm: 'COD' }],
  '/api/employees': ['employees', { empno: '00001', firstname: 'Alexandra', lastname: 'Montes', email: 'alex@example.com', deptname: 'Information Technology', jobdesc: 'Senior Developer', hiredate: '2022-01-01' }],
  '/api/employees/jobs': ['jobs', { jobcode: 'DEV', jobdesc: 'Senior Developer' }],
  '/api/employees/departments': ['departments', { deptcode: 'IT', deptname: 'Information Technology' }],
  '/api/departments': ['departments', { deptcode: 'IT', deptname: 'Information Technology', employee_count: 5 }],
  '/api/users': ['users', { userId: '2', empno: '00001', name: 'Alexandra Montes', email: 'alex@example.com', role: 'employee', status: 'active' }],
  '/api/sales': ['sales', { transno: 'TR000001', salesdate: '2026-11-01', custno: 'CUS001', custname: 'Northstar Supplies', empno: '00001', empname: 'Alexandra Montes', lines: [], payments: [] }],
  '/api/audit-logs': ['logs', { auditId: '1', tableName: 'product', action: 'UPDATE', recordKey: 'PX0001', actionBy: 'preview@example.com', actionAt: '2026-11-01T10:30:00Z' }],
};

async function mockApi(page) {
  await page.route('**/api/**', async route => {
    const activityPath = new URL(route.request().url()).pathname;
    if (activityPath === '/api/auth/activity') return route.fulfill({ json: { success: true, data: { message: 'ok' } } });
    if (activityPath === '/api/auth/active-employees') return route.fulfill({ json: { success: true, data: { employees: [] } } });
    if (activityPath === '/api/auth/registration-notifications') return route.fulfill({ json: { success: true, data: { total: 0, registrations: [] } } });
    expect(route.request().method()).toBe('GET');
    const url = new URL(route.request().url());
    let data;
    if (url.pathname === '/api/auth/session') data = { user };
    else if (url.pathname === '/api/dashboard/stats') data = { customers: 23, products: 23, openOrders: 23, revenue: 5000 };
    else if (url.pathname === '/api/employees/options') data = { departments: [{ code: 'IT', name: 'Information Technology' }], jobs: [{ code: 'DEV', name: 'Senior Developer' }] };
    else if (url.pathname === '/api/users/options') data = { availableEmployees: [] };
    else if (/^\/api\/products\/[^/]+\/prices$/.test(url.pathname)) data = { prices: [] };
    else if (url.pathname.startsWith('/api/reports/')) data = { rows: [], employees: [] };
    else {
      expect(collections[url.pathname], `Unhandled API: ${url.pathname}`).toBeTruthy();
      const [key, record] = collections[url.pathname];
      const pageNumber = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 10);
      const records = Array.from({ length: 23 }, (_, index) => {
        const item = { ...record };
        for (const id of ['prodcode', 'custno', 'empno', 'jobcode', 'deptcode', 'userId', 'transno', 'auditId']) {
          if (id in item) item[id] = `${item[id]}-${index + 1}`;
        }
        return item;
      });
      data = { [key]: records.slice((pageNumber - 1) * limit, pageNumber * limit), pagination: { page: pageNumber, limit, total: records.length, totalPages: Math.ceil(records.length / limit) } };
    }
    await route.fulfill({ json: { success: true, data } });
  });
}

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`workspace filters and buttons stay consistent at ${width}px`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    await mockApi(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const height = width < 768 ? 44 : 40;

    for (const path of ['/inventory', '/customers', '/employees', '/employees?view=jobs', '/employees?view=departments', '/departments', '/sales', '/users', '/users?view=audit', '/reports']) {
      await page.goto(path);
      const filters = page.locator('.workspace-filters');
      await expect(filters).toBeVisible();
      await expect(page.locator('html')).toHaveCSS('scrollbar-width', 'none');
      await expect(page.locator('.erp-workspace > aside nav')).toHaveCSS('scrollbar-width', 'none');
      await expect(filters.locator('.workspace-control').first()).toBeEnabled();
      await expect(page.locator('table tbody tr[aria-hidden="true"]')).toHaveCount(0);
      if (path === '/sales') await expect(page.getByText('TR000001-1', { exact: true })).toBeVisible();
      const problems = await page.locator('main').evaluate((main, { width, height }) => {
        const problems = [];
        const filter = main.querySelector('.workspace-filters');
        const box = filter.getBoundingClientRect();
        const controls = [...main.querySelectorAll('.workspace-control, .workspace-pagination button, .workspace-primary-action, .workspace-secondary-action, .workspace-icon-action, .workspace-text-action')];
        for (const control of controls) {
          if (!control.getClientRects().length || control.closest('[inert]')) continue;
          const rect = control.getBoundingClientRect();
          if (Math.abs(rect.height - height) > 1) problems.push(`${control.tagName} ${control.textContent.trim()}: height ${rect.height}`);
          if (control.closest('.workspace-filters') && (rect.x < box.x || rect.right > box.right || rect.bottom > box.bottom)) problems.push('Filter control escapes panel');
          if (control.scrollWidth > control.clientWidth + 1) problems.push(`Clipped control: ${control.textContent.trim()}`);
        }
        if (width < 640) {
          for (const label of filter.querySelectorAll(':scope > label')) {
            if (Math.abs(label.getBoundingClientRect().width - (box.width - 34)) > 1) problems.push('Mobile filter is not full width');
          }
        }
        if (document.documentElement.scrollWidth > width) problems.push('Horizontal page overflow');
        return problems;
      }, { width, height });
      expect(problems, `${path} at ${width}px`).toEqual([]);
      await expect(filters.locator('.workspace-control').first()).toHaveCSS('border-radius', '8px');
      for (const button of await page.locator('.workspace-pagination button').all()) await expect(button).toHaveCSS('border-radius', '8px');
    }
    expect(errors).toEqual([]);
  });
}

test('dashboard navigation and product filter/pagination actions remain usable', async ({ page }) => {
  await mockApi(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('toolbar', { name: 'Quick actions' })).toHaveCount(0);
  await page.getByRole('region', { name: 'ERP modules', exact: true }).getByRole('link', { name: /^Products/ }).click();
  const pagination = page.getByRole('navigation', { name: 'Product table pagination' });
  await expect(pagination.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pagination.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('combobox', { name: 'Product rows per page' }).selectOption('25');
  await expect(page).toHaveURL(/limit=25/);
  await expect(pagination.getByRole('button', { name: 'Next' })).toBeDisabled();
  const filtered = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname === '/api/products' && url.searchParams.get('unit') === 'ea';
  });
  await page.getByRole('combobox', { name: 'Unit type' }).selectOption('ea');
  await filtered;
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add Product', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [375, 1440]) {
  test(`password recovery spacing matches the form rhythm at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { success: false } }));
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset password', exact: true });
    const email = await dialog.getByRole('textbox', { name: 'Work email' }).boundingBox();
    const submit = await dialog.getByRole('button', { name: 'Send reset link', exact: true }).boundingBox();
    expect(submit.y - (email.y + email.height)).toBeGreaterThanOrEqual(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`product price controls follow shared sizing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockApi(page);
    await page.goto('/inventory');
    await page.getByRole('button', { name: 'Prices for PX0001-1', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Price History — PX0001-1', exact: true });
    await dialog.getByRole('button', { name: 'Add Price', exact: true }).click();
    const height = width < 768 ? '44px' : '40px';
    for (const button of await dialog.locator('button').all()) await expect(button).toHaveCSS('height', height);
    for (const input of await dialog.locator('input').all()) await expect(input).toHaveCSS('height', height);
    await expect(dialog.getByRole('button', { name: 'Save Price', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
