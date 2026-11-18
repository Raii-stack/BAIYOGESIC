// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

const pool = { query: vi.fn() };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const reportRoutes = require('./report-routes');
const { errorHandler } = require('../middleware/error-handler');

const employeeId = '22222222-2222-4222-8222-222222222222';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/reports', reportRoutes);
  app.use(errorHandler);
  return app;
}

function authCookie(sub, role) {
  const token = jwt.sign({ sub, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return `access_token=${token}`;
}

describe('routes/report-routes ([S4-DBA-01 to S4-DBA-03])', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('mounts all 7 Guide §3.7 system report routes behind authentication', async () => {
    const paths = reportRoutes.stack.filter((l) => l.route).map((l) => l.route.path);
    expect(paths).toEqual([
      '/top-customers',
      '/product-master',
      '/top-products',
      '/active-employees',
      '/all-employees',
      '/job-history',
      '/top-sales',
    ]);

    const res = await request(makeApp()).get('/api/reports/top-customers');
    expect(res.status).toBe(401);
  });

  test('enforces per-report granular permissions and delegates to SQL report functions', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['reports.top-customers'] }],
      })
      .mockResolvedValueOnce({
        rows: [{ rank: 1, custno: 'C1001', custname: 'Apex Office Co', totalsales: '512.50' }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['reports.top-customers'] }],
      });

    const app = makeApp();
    const cookie = authCookie(employeeId, 'employee');

    const allowed = await request(app)
      .get('/api/reports/top-customers?startDate=2026-01-01&endDate=2026-12-31&limit=5')
      .set('Cookie', cookie);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.report).toBe('top-customers');
    expect(allowed.body.data.rows).toHaveLength(1);
    expect(pool.query.mock.calls[1][0]).toContain('public.report_top_customers');
    expect(pool.query.mock.calls[1][1]).toEqual(['2026-01-01', '2026-12-31', 5]);

    const denied = await request(app).get('/api/reports/top-sales').set('Cookie', cookie);
    expect(denied.status).toBe(403);
  });
});
