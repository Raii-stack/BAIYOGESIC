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

const customerRoutes = require('./customer-routes');
const { errorHandler } = require('../middleware/error-handler');

const adminId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/customers', customerRoutes);
  app.use(errorHandler);
  return app;
}

function authCookie(sub, role) {
  const token = jwt.sign({ sub, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return `access_token=${token}`;
}

describe('routes/customer-routes ([S2-DEV-02a])', () => {
  beforeEach(() => {
    client.query.mockReset();
    client.release.mockReset();
    pool.query.mockReset();
    pool.connect.mockReset().mockResolvedValue(client);
  });

  test('mounts customer CRUD and restore routes behind authentication', async () => {
    const routes = customerRoutes.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    expect(routes).toEqual(expect.arrayContaining([
      { path: '/', methods: ['get'] },
      { path: '/', methods: ['post'] },
      { path: '/:custno', methods: ['put'] },
      { path: '/:custno', methods: ['delete'] },
      { path: '/:custno/restore', methods: ['post'] },
    ]));

    const unauth = await request(makeApp()).get('/api/customers');
    expect(unauth.status).toBe(401);
  });

  test('enforces CRM read vs write permissions across employee and admin roles', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['customers.access'] }],
      })
      .mockResolvedValueOnce({
        rows: [{ custno: 'C0001', custname: 'Acme', address: '1 Main', payterm: '30D', is_deleted: false, stamp: 'ADD', _total: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['customers.access'] }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: adminId, empno: '00001', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }],
      });

    const app = makeApp();
    const empCookie = authCookie(employeeId, 'employee');

    const listRes = await request(app).get('/api/customers').set('Cookie', empCookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.customers).toHaveLength(1);

    const createBlocked = await request(app)
      .post('/api/customers')
      .set('Cookie', empCookie)
      .send({ custname: 'Beta', address: '2 Oak', payterm: '30D' });
    expect(createBlocked.status).toBe(403);

    const invalidCreate = await request(app)
      .post('/api/customers')
      .set('Cookie', authCookie(adminId, 'admin'))
      .send({ custname: 'Beta', address: '2 Oak', payterm: '90D' });
    expect(invalidCreate.status).toBe(400);
  });
});
