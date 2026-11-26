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

const productRoutes = require('./product-routes');
const { errorHandler } = require('../middleware/error-handler');

const adminId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/products', productRoutes);
  app.use(errorHandler);
  return app;
}

function authCookie(sub, role) {
  const token = jwt.sign({ sub, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return `access_token=${token}`;
}

describe('routes/product-routes ([S2-DEV-07a])', () => {
  beforeEach(() => {
    client.query.mockReset();
    client.release.mockReset();
    pool.query.mockReset();
    pool.connect.mockReset().mockResolvedValue(client);
  });

  test('mounts price-history and legacy /prices endpoints alongside product CRUD routes', () => {
    const routes = productRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(routes).toEqual(expect.arrayContaining([
      { path: '/', methods: ['get'] },
      { path: '/:prodcode/price-history', methods: ['get'] },
      { path: '/:prodcode/price-history', methods: ['post'] },
      { path: '/:prodcode/prices', methods: ['get'] },
      { path: '/:prodcode/prices', methods: ['post'] },
      { path: '/', methods: ['post'] },
      { path: '/:prodcode', methods: ['put'] },
      { path: '/:prodcode', methods: ['delete'] },
      { path: '/:prodcode/restore', methods: ['post'] },
    ]));
  });

  test('allows employee view on GET /:prodcode/price-history but denies POST /:prodcode/price-history with 403', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['products.access'] }],
      })
      .mockResolvedValueOnce({ rows: [{ is_deleted: false }] })
      .mockResolvedValueOnce({ rows: [{ prodcode: 'P1001', effdate: '2026-01-15', unitprice: '20.00', price: '20.00', is_deleted: false, stamp: 'ADD' }] })
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['products.access'] }],
      });

    const app = makeApp();
    const cookie = authCookie(employeeId, 'employee');

    const getRes = await request(app).get('/api/products/P1001/price-history').set('Cookie', cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.prices).toHaveLength(1);

    const postRes = await request(app)
      .post('/api/products/P1001/price-history')
      .set('Cookie', cookie)
      .send({ price: 25, effdate: '2099-01-01' });
    expect(postRes.status).toBe(403);
  });

  test('POST /:prodcode/prices logs PRICE_UPDATE audit record for authorized admin', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: adminId, empno: '00001', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }],
    });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('FROM public.product WHERE prodcode')) return { rows: [{ prodcode: 'P1001', is_deleted: false }] };
      if (sql.includes('FROM public.pricehist WHERE prodcode = $1 AND effdate =')) return { rows: [] };
      if (sql.includes('FROM public.pricehist')) return { rows: [{ unitprice: 20, effdate: '2026-01-15' }] };
      if (sql.includes('INSERT INTO public.pricehist')) {
        return { rows: [{ effdate: '2099-01-01', prodcode: 'P1001', unitprice: '25.50', is_deleted: false, stamp: 'ADD' }] };
      }
      return { rows: [] };
    });

    const res = await request(makeApp())
      .post('/api/products/P1001/prices')
      .set('Cookie', authCookie(adminId, 'admin'))
      .send({ unitprice: 25.5, effdate: '2099-01-01' });

    expect(res.status).toBe(201);
    expect(res.body.data.price).toMatchObject({ prodcode: 'P1001', effdate: '2099-01-01', unitprice: 25.5 });
    const auditCall = client.query.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO public.audit_log'));
    expect(auditCall).toBeDefined();
    expect(auditCall[1][2]).toContain('PRICE_UPDATE');
  });

  test('enforces granular per-right permissions (products.edit, products.delete) and 409 active sales guard', async () => {
    const app = makeApp();
    const empCookie = authCookie(employeeId, 'employee');

    // 1. User with products.edit only: PUT succeeds (200), DELETE and restore return 403
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['products.access', 'products.edit'] }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['products.access', 'products.edit'] }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['products.access', 'products.edit'] }],
      });

    client.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('UPDATE public.product')) {
        return { rows: [{ prodcode: 'P1001', description: 'Updated Balm', unit: 'pc', is_deleted: false }] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT unitprice')) {
        return { rows: [{ unitprice: '20.00', effdate: '2026-01-15' }] };
      }
      return { rows: [] };
    });

    const editOk = await request(app)
      .put('/api/products/P1001')
      .set('Cookie', empCookie)
      .send({ description: 'Updated Balm', unit: 'pc', unitprice: 20 });
    expect(editOk.status).toBe(200);

    const deleteDenied = await request(app).delete('/api/products/P1001').set('Cookie', empCookie);
    expect(deleteDenied.status).toBe(403);

    const restoreDenied = await request(app).post('/api/products/P1001/restore').set('Cookie', empCookie);
    expect(restoreDenied.status).toBe(403);

    // 2. User with products.delete only: POST/PUT return 403, DELETE returns 409 when active salesdetail rows exist
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['products.access', 'products.delete'] }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['products.access', 'products.delete'] }],
      });

    const createDenied = await request(app)
      .post('/api/products')
      .set('Cookie', empCookie)
      .send({ description: 'Blocked Balm', unit: 'pc', unitprice: 15 });
    expect(createDenied.status).toBe(403);

    client.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) return { rows: [{ prodcode: 'P1001' }] };
      if (typeof sql === 'string' && sql.includes('FROM public.salesdetail')) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    });

    const deleteConflict = await request(app).delete('/api/products/P1001').set('Cookie', empCookie);
    expect(deleteConflict.status).toBe(409);
    expect(deleteConflict.body.error.message).toMatch(/active sales records/i);
  });
});
