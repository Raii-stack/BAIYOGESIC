// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

const client = { query: vi.fn(), release: vi.fn() };
const pool = { query: vi.fn(), connect: vi.fn().mockResolvedValue(client) };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const salesRoutes = require('./sales-routes');
const { errorHandler } = require('../middleware/error-handler');

const employeeId = '22222222-2222-4222-8222-222222222222';
const adminId = '11111111-1111-4111-8111-111111111111';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/sales', salesRoutes);
  app.use(errorHandler);
  return app;
}

function authCookie(sub, role) {
  const token = jwt.sign({ sub, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return `access_token=${token}`;
}

describe('routes/sales-routes ([S4-DBA-04 & S4-DBA-05])', () => {
  beforeEach(() => {
    client.query.mockReset();
    client.release.mockReset();
    pool.query.mockReset();
    pool.connect.mockReset().mockResolvedValue(client);
  });

  test('mounts sales, payment, price-lookup, archive, and restore routes', async () => {
    const routes = salesRoutes.stack
      .filter((l) => l.route)
      .map((l) => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));

    expect(routes).toEqual(expect.arrayContaining([
      { path: '/', methods: ['get'] },
      { path: '/catalog', methods: ['get'] },
      { path: '/price-lookup', methods: ['get'] },
      { path: '/:transno', methods: ['get'] },
      { path: '/', methods: ['post'] },
      { path: '/:transno/payments', methods: ['post'] },
      { path: '/:transno', methods: ['delete'] },
      { path: '/:transno/restore', methods: ['patch'] },
      { path: '/:transno/restore', methods: ['post'] },
    ]));

    expect((await request(makeApp()).get('/api/sales')).status).toBe(401);
  });

  test('enforces Sales delete/restore permission boundaries', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['sales.access'] }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: adminId, empno: '00001', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }],
      });

    const app = makeApp();
    const denied = await request(app)
      .patch('/api/sales/TR1001/restore')
      .set('Cookie', authCookie(employeeId, 'employee'));
    expect(denied.status).toBe(403);

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('SELECT transno, is_deleted FROM public.sales')) return { rows: [] };
      return { rows: [] };
    });

    const missing = await request(app)
      .delete('/api/sales/TR9999')
      .set('Cookie', authCookie(adminId, 'admin'));
    expect(missing.status).toBe(404);
  });
});
