// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

const pool = { query: vi.fn() };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const {
  reportFilters,
  topCustomers,
  topProducts,
  jobHistory,
  topSales,
} = require('./report-controller');

async function invoke(handler, extra = {}) {
  let body;
  let error;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  await handler(
    { user: { role: 'superadmin', empno: '00001' }, query: {}, ...extra },
    res,
    (err) => { error = err; },
  );
  return { statusCode, body, error };
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('controllers/report-controller ([S4-DEV-04 & S4-DEV-05])', () => {
  test('reportFilters validates calendar dates, inverted ranges, and Top N limits 1..100', () => {
    expect(reportFilters({ startDate: '2026-01-01', endDate: '2026-12-31', limit: '25' })).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      limit: 25,
    });
    expect(reportFilters({})).toEqual({ startDate: null, endDate: null, limit: 10 });

    expect(() => reportFilters({ startDate: '2026-02-29' })).toThrow(/From date must be a valid date/);
    expect(() => reportFilters({ endDate: '2026-04-31' })).toThrow(/To date must be a valid date/);
    expect(() => reportFilters({ startDate: '2026-11-10', endDate: '2026-11-01' })).toThrow(
      /From date cannot be after To date/,
    );
    expect(() => reportFilters({ limit: '0' })).toThrow(/Limit must be an integer from 1 to 100/);
    expect(() => reportFilters({ limit: '101' })).toThrow(/Limit must be an integer from 1 to 100/);
  });

  test('topCustomers and topProducts query PostgreSQL TVFs with parameterized filters', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ rank: 1, custno: 'C0001', custname: 'Acme', totalsales: 500 }] })
      .mockResolvedValueOnce({ rows: [{ rank: 1, prodcode: 'PX0001', description: 'Balm', qtysold: 5, salesamount: 250 }] });

    const cust = await invoke(topCustomers, { query: { startDate: '2026-01-01', endDate: '2026-12-31', limit: '5' } });
    expect(cust.statusCode).toBe(200);
    expect(cust.body.data.report).toBe('top-customers');
    expect(pool.query.mock.calls[0][1]).toEqual(['2026-01-01', '2026-12-31', 5]);

    const prod = await invoke(topProducts, { query: { limit: '15' } });
    expect(prod.statusCode).toBe(200);
    expect(prod.body.data.report).toBe('top-products');
    expect(pool.query.mock.calls[1][1]).toEqual([null, null, 15]);
  });

  test('jobHistory returns active employee list and validates requested empno against scoped employees', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ effdate: '2026-01-01', jobdesc: 'Manager', deptname: 'Sales', salary: 75000 }] })
      .mockResolvedValueOnce({ rows: [{ empno: '00001', fullname: 'Jane Reyes' }] });

    const ok = await invoke(jobHistory, { query: { empno: '00001' } });
    expect(ok.error).toBeUndefined();
    expect(ok.body.data.employees).toEqual([{ empno: '00001', fullname: 'Jane Reyes' }]);
    expect(ok.body.data.rows).toHaveLength(1);

    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ empno: '00001', fullname: 'Jane Reyes' }] });

    const invalid = await invoke(jobHistory, { query: { empno: '99999' } });
    expect(invalid.error).toMatchObject({
      statusCode: 400,
      message: 'Select a valid active employee.',
      details: { empno: 'Employee was not found.' },
    });
  });

  test('topSales scopes results using peopleScope for non-superadmin viewers', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await invoke(topSales, { user: { role: 'employee', empno: '00007', departmentCode: 'BR1' }, query: { limit: '10' } });
    expect(pool.query.mock.calls[0][0]).toContain("s.empno = '00007'");
  });
});
