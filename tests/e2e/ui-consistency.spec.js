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
    if (activityPath === '/api/auth/registration-notifications') return route.fulfill({ json: { success: true, data: { registrations: [], total: 0 } } });
    if (activityPath === '/api/me/preferences') return route.fulfill({ json: { success: true, data: { preferences: { density: 'comfortable', motion: true, employment: true, sales: true, payments: true, products: true, popups: true } } } });
    if (activityPath === '/api/me/notifications') return route.fulfill({ json: { success: true, data: { items: [], unreadCount: 0, total: 0, page: 1, totalPages: 1 } } });
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

test('dashboard keeps metrics on return and fetches again on browser refresh', async ({ page }) => {
  await mockApi(page);
  let requests = 0;
  let notifications = 0;
  let activity = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/dashboard/stats') requests++;
    if (new URL(request.url()).pathname === '/api/auth/registration-notifications') notifications++;
    if (new URL(request.url()).pathname === '/api/auth/active-employees') activity++;
  });
  await page.goto('/dashboard');
  const kpis = page.getByRole('region', { name: 'Key performance indicators' });
  const values = kpis.locator('.tabular-nums > span[aria-hidden="true"]');
  await expect(values.first()).toHaveText('23');
  const initialRequests = requests;
  await expect(page.getByRole('region', { name: 'Active employees' })).toContainText('No employees are currently online.');
  await expect(page.getByLabel('Notifications: 0 unread, 0 pending registrations')).toBeVisible();
  const initialNotifications = notifications;
  const initialActivity = activity;
  expect(initialRequests).toBeGreaterThan(0);
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await expect(kpis).toBeVisible();
  expect(await values.allTextContents()).toEqual(['23', '23', '23', '$5k']);
  expect(requests).toBe(initialRequests);
  expect(notifications).toBe(initialNotifications);
  expect(activity).toBe(initialActivity);
  await expect(page.getByRole('region', { name: 'Active employees' })).not.toContainText('Loading');
  await page.reload();
  await expect(values.first()).toHaveText('23');
  expect(requests).toBeGreaterThan(initialRequests);
});

test('user actions stay aligned and expandable details fit without horizontal scrolling', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApi(page);
  const applicant = { userId: 'pending-user', firstName: 'Pending', lastName: 'Employee', name: 'Pending Employee', email: 'pending@example.com', role: 'employee', status: 'pending', isBlocked: false };
  await page.route('**/api/users**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/options')) return route.fulfill({ json: { success: true, data: { availableEmployees: [] } } });
    if (url.pathname.endsWith('/reject')) return route.fulfill({ json: { success: true, data: { user: { ...applicant, status: 'disabled' } } } });
    const current = Number(url.searchParams.get('page') || 1);
    const user = current === 1 ? applicant : { ...applicant, userId: 'active-user', firstName: 'Accepted', lastName: 'Employee With A Much Longer Name', name: 'Accepted Employee With A Much Longer Name', email: 'accepted.employee.with.a.long.email@example.com', status: 'active', isBlocked: true };
    return route.fulfill({ json: { success: true, data: { users: [user], pagination: { page: current, limit: 10, total: 11, totalPages: 2 } } } });
  });
  await page.goto('/users');
  const records = page.getByRole('region', { name: 'User account records' });
  const actions = records.getByRole('columnheader', { name: 'Actions', exact: true });
  await expect(records.getByRole('columnheader')).toHaveText(['Surname', 'Name', 'Email', 'Role', 'Access', 'Actions']);
  await expect(records.getByRole('button', { name: 'Reject Pending Employee' })).toBeVisible();
  await expect(records.getByRole('button', { name: 'Block Pending Employee' })).toHaveCount(0);
  await expect(records.getByRole('button', { name: 'Accept Pending Employee' })).toHaveCSS('place-items', 'center');
  await expect(records.getByRole('button', { name: 'Expand details for Pending Employee' })).toHaveCSS('width', '32px');
  const buttonBoxes = await records.locator('td[data-label="Actions"] button').evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect();
    return { x: box.x, right: box.right };
  }));
  expect(buttonBoxes.every((box, index) => index === 0 || box.x >= buttonBoxes[index - 1].right)).toBe(true);
  const before = await actions.boundingBox();
  const rightsX = (await records.getByRole('button', { name: 'Rights for Pending Employee' }).boundingBox()).x;
  await records.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(records.getByRole('button', { name: 'Unblock Accepted Employee With A Much Longer Name' })).toBeVisible();
  await expect(records.getByRole('button', { name: 'Unblock Accepted Employee With A Much Longer Name' })).toHaveCSS('place-items', 'center');
  const after = await actions.boundingBox();
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect((await records.getByRole('button', { name: 'Rights for Accepted Employee With A Much Longer Name' }).boundingBox()).x).toBeCloseTo(rightsX, 0);
  await records.locator('.overflow-x-auto').evaluate(element => { element.scrollLeft = element.scrollWidth; });
  expect((await actions.boundingBox()).x).toBeCloseTo(before.x, 0);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const expand = records.getByRole('button', { name: 'Expand details for Accepted Employee With A Much Longer Name' });
    await expand.click();
    await expect(records.locator('td[data-label="Email"]')).toHaveText('accepted.employee.with.a.long.email@example.com');
    await expect(records.getByRole('region', { name: 'Details for Accepted Employee With A Much Longer Name' })).toContainText('No recorded activity');
    expect(await records.locator('.overflow-x-auto').evaluate(element => element.scrollWidth > element.clientWidth + 1), `table overflow at ${width}px`).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `page overflow at ${width}px`).toBe(false);
    await records.getByRole('button', { name: 'Collapse details for Accepted Employee With A Much Longer Name' }).click();
  }
  await records.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await records.getByRole('button', { name: 'Reject Pending Employee' }).click();
  await expect(records.getByText('Disabled', { exact: true })).toBeVisible();
  await expect(records.getByRole('button', { name: 'Block Pending Employee' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('registration page submits pending applications and its sign-in link works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { success: false, error: { message: 'Authentication required' } } }));
  await page.route('**/api/auth/register', async route => {
    expect(route.request().postDataJSON()).toEqual({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', password: 'SecurePass123!' });
    await route.fulfill({ json: { success: true, data: { message: 'Pending approval', user: { status: 'pending' } } } });
  });
  await page.goto('/login');
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByLabel('First name').fill('Jane');
  await page.getByLabel('Last name').fill('Doe');
  await page.getByLabel('Work email').fill('jane@example.com');
  await page.getByLabel('Password', { exact: true }).fill('SecurePass123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('SecurePass123!');
  await page.getByRole('button', { name: 'Register account' }).click();
  await expect(page.getByRole('region', { name: 'Create your account' }).getByRole('status')).toContainText('Your account is pending approval.');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log in to HOPE, Inc.' })).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`top bar stays fixed while user records scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 500 });
    await mockApi(page);
    await page.goto('/users');
    const header = page.locator('.erp-workspace > div > header');
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
    await expect(header).toHaveCSS('position', 'fixed');
    await expect(header).toHaveCSS('top', '0px');
    if (width >= 1024) {
      await expect(header).toHaveCSS('padding-top', '8px');
      await expect(header).toHaveCSS('background-color', 'rgb(28, 28, 28)');
    }
    const before = await header.boundingBox();
    await page.mouse.move(width - 30, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await header.boundingBox()).toEqual(before);
    await page.getByLabel('Account menu').click();
    await expect(page.getByRole('link', { name: 'My account', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    if (width >= 1024) {
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect.poll(async () => (await header.boundingBox()).x).toBe(80);
      await page.getByRole('button', { name: 'Expand sidebar' }).click();
      await expect.poll(async () => (await header.boundingBox()).x).toBe(240);
    } else {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('button', { name: 'Close navigation' })).toBeVisible();
    }
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
          const expectedHeight = width >= 768 && control.matches('.workspace-user-table .workspace-icon-action') ? 32 : height;
          if (Math.abs(rect.height - expectedHeight) > 1) problems.push(`${control.tagName} ${control.textContent.trim()}: height ${rect.height}`);
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
