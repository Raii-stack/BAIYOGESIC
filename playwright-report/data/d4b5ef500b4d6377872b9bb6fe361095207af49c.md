# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-consistency.spec.js >> workspace filters and buttons stay consistent at 1024px
- Location: tests\e2e\ui-consistency.spec.js:52:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/inventory
Call log:
  - navigating to "http://127.0.0.1:5173/inventory", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | // Run against a local Vite server: npx playwright test tests/e2e/ui-consistency.spec.js --workers=1
  4   | test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173', launchOptions: { channel: 'chrome' } });
  5   | 
  6   | const user = { userId: 'admin', email: 'preview@example.com', role: 'superadmin', status: 'active', mustChangePassword: false };
  7   | const collections = {
  8   |   '/api/products': ['products', { prodcode: 'PX0001', description: 'Industrial supplies', unit: 'pc', unitprice: '1250.75', effdate: '2026-10-01' }],
  9   |   '/api/customers': ['customers', { custno: 'CUS001', custname: 'Northstar Supplies', address: 'Quezon City', payterm: 'COD' }],
  10  |   '/api/employees': ['employees', { empno: '00001', firstname: 'Alexandra', lastname: 'Montes', email: 'alex@example.com', deptname: 'Information Technology', jobdesc: 'Senior Developer', hiredate: '2022-01-01' }],
  11  |   '/api/employees/jobs': ['jobs', { jobcode: 'DEV', jobdesc: 'Senior Developer' }],
  12  |   '/api/employees/departments': ['departments', { deptcode: 'IT', deptname: 'Information Technology' }],
  13  |   '/api/departments': ['departments', { deptcode: 'IT', deptname: 'Information Technology', employee_count: 5 }],
  14  |   '/api/users': ['users', { userId: '2', empno: '00001', name: 'Alexandra Montes', email: 'alex@example.com', role: 'employee', status: 'active' }],
  15  |   '/api/sales': ['sales', { transno: 'TR000001', salesdate: '2026-11-01', custno: 'CUS001', custname: 'Northstar Supplies', empno: '00001', empname: 'Alexandra Montes', lines: [], payments: [] }],
  16  |   '/api/audit-logs': ['logs', { auditId: '1', tableName: 'product', action: 'UPDATE', recordKey: 'PX0001', actionBy: 'preview@example.com', actionAt: '2026-11-01T10:30:00Z' }],
  17  | };
  18  | 
  19  | async function mockApi(page) {
  20  |   await page.route('**/api/**', async route => {
  21  |     const activityPath = new URL(route.request().url()).pathname;
  22  |     if (activityPath === '/api/auth/activity') return route.fulfill({ json: { success: true, data: { message: 'ok' } } });
  23  |     if (activityPath === '/api/auth/active-employees') return route.fulfill({ json: { success: true, data: { employees: [] } } });
  24  |     expect(route.request().method()).toBe('GET');
  25  |     const url = new URL(route.request().url());
  26  |     let data;
  27  |     if (url.pathname === '/api/auth/session') data = { user };
  28  |     else if (url.pathname === '/api/dashboard/stats') data = { customers: 23, products: 23, openOrders: 23, revenue: 5000 };
  29  |     else if (url.pathname === '/api/employees/options') data = { departments: [{ code: 'IT', name: 'Information Technology' }], jobs: [{ code: 'DEV', name: 'Senior Developer' }] };
  30  |     else if (url.pathname === '/api/users/options') data = { availableEmployees: [] };
  31  |     else if (/^\/api\/products\/[^/]+\/prices$/.test(url.pathname)) data = { prices: [] };
  32  |     else if (url.pathname.startsWith('/api/reports/')) data = { rows: [], employees: [] };
  33  |     else {
  34  |       expect(collections[url.pathname], `Unhandled API: ${url.pathname}`).toBeTruthy();
  35  |       const [key, record] = collections[url.pathname];
  36  |       const pageNumber = Number(url.searchParams.get('page') || 1);
  37  |       const limit = Number(url.searchParams.get('limit') || 10);
  38  |       const records = Array.from({ length: 23 }, (_, index) => {
  39  |         const item = { ...record };
  40  |         for (const id of ['prodcode', 'custno', 'empno', 'jobcode', 'deptcode', 'userId', 'transno', 'auditId']) {
  41  |           if (id in item) item[id] = `${item[id]}-${index + 1}`;
  42  |         }
  43  |         return item;
  44  |       });
  45  |       data = { [key]: records.slice((pageNumber - 1) * limit, pageNumber * limit), pagination: { page: pageNumber, limit, total: records.length, totalPages: Math.ceil(records.length / limit) } };
  46  |     }
  47  |     await route.fulfill({ json: { success: true, data } });
  48  |   });
  49  | }
  50  | 
  51  | for (const width of [320, 375, 768, 1024, 1440]) {
  52  |   test(`workspace filters and buttons stay consistent at ${width}px`, async ({ page }) => {
  53  |     test.setTimeout(60000);
  54  |     await page.setViewportSize({ width, height: 1000 });
  55  |     await mockApi(page);
  56  |     const errors = [];
  57  |     page.on('pageerror', error => errors.push(error.message));
  58  |     const height = width < 768 ? 44 : 40;
  59  | 
  60  |     for (const path of ['/inventory', '/customers', '/employees', '/employees?view=jobs', '/employees?view=departments', '/departments', '/sales', '/users', '/users?view=audit', '/reports']) {
> 61  |       await page.goto(path);
      |                  ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/inventory
  62  |       const filters = page.locator('.workspace-filters');
  63  |       await expect(filters).toBeVisible();
  64  |       await expect(page.locator('html')).toHaveCSS('scrollbar-width', 'none');
  65  |       await expect(page.locator('.erp-workspace > aside nav')).toHaveCSS('scrollbar-width', 'none');
  66  |       await expect(filters.locator('.workspace-control').first()).toBeEnabled();
  67  |       await expect(page.locator('table tbody tr[aria-hidden="true"]')).toHaveCount(0);
  68  |       if (path === '/sales') await expect(page.getByText('TR000001-1', { exact: true })).toBeVisible();
  69  |       const problems = await page.locator('main').evaluate((main, { width, height }) => {
  70  |         const problems = [];
  71  |         const filter = main.querySelector('.workspace-filters');
  72  |         const box = filter.getBoundingClientRect();
  73  |         const controls = [...main.querySelectorAll('.workspace-control, .workspace-pagination button, .workspace-primary-action, .workspace-secondary-action, .workspace-icon-action, .workspace-text-action')];
  74  |         for (const control of controls) {
  75  |           if (!control.getClientRects().length || control.closest('[inert]')) continue;
  76  |           const rect = control.getBoundingClientRect();
  77  |           if (Math.abs(rect.height - height) > 1) problems.push(`${control.tagName} ${control.textContent.trim()}: height ${rect.height}`);
  78  |           if (control.closest('.workspace-filters') && (rect.x < box.x || rect.right > box.right || rect.bottom > box.bottom)) problems.push('Filter control escapes panel');
  79  |           if (control.scrollWidth > control.clientWidth + 1) problems.push(`Clipped control: ${control.textContent.trim()}`);
  80  |         }
  81  |         if (width < 640) {
  82  |           for (const label of filter.querySelectorAll(':scope > label')) {
  83  |             if (Math.abs(label.getBoundingClientRect().width - (box.width - 34)) > 1) problems.push('Mobile filter is not full width');
  84  |           }
  85  |         }
  86  |         if (document.documentElement.scrollWidth > width) problems.push('Horizontal page overflow');
  87  |         return problems;
  88  |       }, { width, height });
  89  |       expect(problems, `${path} at ${width}px`).toEqual([]);
  90  |       await expect(filters.locator('.workspace-control').first()).toHaveCSS('border-radius', '8px');
  91  |       for (const button of await page.locator('.workspace-pagination button').all()) await expect(button).toHaveCSS('border-radius', '8px');
  92  |     }
  93  |     expect(errors).toEqual([]);
  94  |   });
  95  | }
  96  | 
  97  | test('dashboard navigation and product filter/pagination actions remain usable', async ({ page }) => {
  98  |   await mockApi(page);
  99  |   await page.goto('/dashboard');
  100 |   await expect(page.getByRole('toolbar', { name: 'Quick actions' })).toHaveCount(0);
  101 |   await page.getByRole('region', { name: 'ERP modules', exact: true }).getByRole('link', { name: /^Products/ }).click();
  102 |   const pagination = page.getByRole('navigation', { name: 'Product table pagination' });
  103 |   await expect(pagination.getByRole('button', { name: 'Previous' })).toBeDisabled();
  104 |   await pagination.getByRole('button', { name: 'Next' }).click();
  105 |   await expect(page).toHaveURL(/page=2/);
  106 |   await expect(pagination.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  107 |   await page.getByRole('combobox', { name: 'Product rows per page' }).selectOption('25');
  108 |   await expect(page).toHaveURL(/limit=25/);
  109 |   await expect(pagination.getByRole('button', { name: 'Next' })).toBeDisabled();
  110 |   const filtered = page.waitForRequest(request => {
  111 |     const url = new URL(request.url());
  112 |     return url.pathname === '/api/products' && url.searchParams.get('unit') === 'ea';
  113 |   });
  114 |   await page.getByRole('combobox', { name: 'Unit type' }).selectOption('ea');
  115 |   await filtered;
  116 |   await page.getByRole('button', { name: 'Add product', exact: true }).click();
  117 |   await expect(page.getByRole('dialog', { name: 'Add Product', exact: true })).toBeVisible();
  118 |   await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  119 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  120 | });
  121 | 
  122 | for (const width of [375, 1440]) {
  123 |   test(`password recovery spacing matches the form rhythm at ${width}px`, async ({ page }) => {
  124 |     await page.setViewportSize({ width, height: 900 });
  125 |     await page.route('**/api/auth/session', route => route.fulfill({ status: 401, json: { success: false } }));
  126 |     await page.goto('/login');
  127 |     await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  128 |     const dialog = page.getByRole('dialog', { name: 'Reset password', exact: true });
  129 |     const email = await dialog.getByRole('textbox', { name: 'Work email' }).boundingBox();
  130 |     const submit = await dialog.getByRole('button', { name: 'Send reset link', exact: true }).boundingBox();
  131 |     expect(submit.y - (email.y + email.height)).toBeGreaterThanOrEqual(20);
  132 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  133 |   });
  134 | 
  135 |   test(`product price controls follow shared sizing at ${width}px`, async ({ page }) => {
  136 |     await page.setViewportSize({ width, height: 1000 });
  137 |     await mockApi(page);
  138 |     await page.goto('/inventory');
  139 |     await page.getByRole('button', { name: 'Prices for PX0001-1', exact: true }).click();
  140 |     const dialog = page.getByRole('dialog', { name: 'Price History — PX0001-1', exact: true });
  141 |     await dialog.getByRole('button', { name: 'Add Price', exact: true }).click();
  142 |     const height = width < 768 ? '44px' : '40px';
  143 |     for (const button of await dialog.locator('button').all()) await expect(button).toHaveCSS('height', height);
  144 |     for (const input of await dialog.locator('input').all()) await expect(input).toHaveCSS('height', height);
  145 |     await expect(dialog.getByRole('button', { name: 'Save Price', exact: true })).toBeVisible();
  146 |     await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  147 |     await expect(page.getByRole('dialog')).toHaveCount(0);
  148 |   });
  149 | }
  150 | 
```