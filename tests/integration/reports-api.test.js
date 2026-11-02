import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let activePool;

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: { requirePool: () => activePool }
};

const reports = require('../../controllers/report-controller');
const { requirePermission } = require('../../middleware/permissions');
const reportRoutes = require('../../routes/report-routes');

function invokeHandler(handler, query = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve(this); return this; }
    };
    handler({ query }, res, (error) => {
      if (error) {
        res.statusCode = error.statusCode || 500;
        res.body = { success: false, error: { message: error.message, details: error.details } };
      }
      resolve(res);
    });
  });
}

function checkPermission(rights, action) {
  const req = { user: { role: 'employee', rights } };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  let allowed = false;
  requirePermission('Reports', action)(req, res, () => { allowed = true; });
  return { allowed, res };
}

beforeEach(() => {
  activePool = { query: vi.fn(async () => ({ rows: [{ rank: 1 }] })) };
});

describe('report API controller', () => {
  it('passes parameterized date and Top N filters to the report function', async () => {
    const response = await invokeHandler(reports.topCustomers, {
      startDate: '2026-01-01', endDate: '2026-10-31', limit: '25'
    });

    expect(response.statusCode).toBe(200);
    expect(activePool.query).toHaveBeenCalledWith(
      expect.stringContaining('report_top_customers($1::date, $2::date, $3::integer)'),
      ['2026-01-01', '2026-10-31', 25]
    );
    expect(response.body.data.rows).toEqual([{ rank: 1 }]);
  });

  it.each([
    [{ startDate: 'not-a-date' }, 'From date must be a valid date.'],
    [{ startDate: '2026-02-30' }, 'From date must be a valid date.'],
    [{ startDate: '2026-11-01', endDate: '2026-10-01' }, 'From date cannot be after To date.'],
    [{ limit: '0' }, 'Limit must be an integer from 1 to 100.'],
    [{ limit: '2.5' }, 'Limit must be an integer from 1 to 100.'],
    [{ limit: '101' }, 'Limit must be an integer from 1 to 100.']
  ])('rejects invalid filters %#', async (query, message) => {
    const response = await invokeHandler(reports.topSales, query);
    expect(response.statusCode).toBe(400);
    expect(response.body.error.message).toBe(message);
    expect(activePool.query).not.toHaveBeenCalled();
  });

  it('uses all seven existing report database objects', async () => {
    activePool.query.mockImplementation(async (sql) => ({
      rows: sql.includes('FROM public.employee')
        ? [{ empno: '00001', fullname: 'Ana Cruz' }]
        : [{ rank: 1 }]
    }));
    await Promise.all([
      invokeHandler(reports.topCustomers),
      invokeHandler(reports.productMaster),
      invokeHandler(reports.topProducts),
      invokeHandler(reports.activeEmployees),
      invokeHandler(reports.allEmployees),
      invokeHandler(reports.jobHistory, { empno: '00001' }),
      invokeHandler(reports.topSales)
    ]);
    const sql = activePool.query.mock.calls.map(([text]) => text).join('\n');
    for (const object of [
      'report_top_customers', 'report_product_master_list', 'report_top_products',
      'report_active_employees', 'report_all_employees', 'report_employee_job_history',
      'report_top_sales'
    ]) expect(sql).toContain(object);
  });

  it('returns active employee options and rejects an unknown employee', async () => {
    activePool.query.mockImplementation(async (sql) => ({
      rows: sql.includes('FROM public.employee')
        ? [{ empno: '00001', fullname: 'Ana Cruz' }]
        : []
    }));
    const initial = await invokeHandler(reports.jobHistory);
    expect(initial.body.data.employees).toEqual([{ empno: '00001', fullname: 'Ana Cruz' }]);

    const invalid = await invokeHandler(reports.jobHistory, { empno: '99999' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body.error.details.empno).toBe('Employee was not found.');
  });
});

describe('report route security', () => {
  it('registers all seven GET report endpoints', () => {
    const paths = reportRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);
    expect(paths).toEqual([
      '/top-customers', '/product-master', '/top-products', '/active-employees',
      '/all-employees', '/job-history', '/top-sales'
    ]);
  });

  it('allows only the specifically granted report right', () => {
    expect(checkPermission(['reports.top-sales'], 'top-sales').allowed).toBe(true);
    const denied = checkPermission(['reports.top-sales'], 'top-customers');
    expect(denied.allowed).toBe(false);
    expect(denied.res.statusCode).toBe(403);
  });

  it('marks every public report view as a security invoker', () => {
    const migration = fs.readFileSync(
      path.resolve('supabase/migrations/20261102054606_issue_75_secure_report_views.sql'),
      'utf8'
    );
    for (const view of [
      'report_product_master_list', 'report_active_employees', 'report_all_employees',
      'report_employee_job_history_view', 'report_top_sales_view'
    ]) expect(migration).toContain(`ALTER VIEW public.${view} SET (security_invoker = true);`);
  });
});
