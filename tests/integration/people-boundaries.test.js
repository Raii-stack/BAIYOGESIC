// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const userId = '00000000-0000-0000-0000-000000000001';
let actor, allowTarget;
const query = vi.fn(async (sql) => {
  if (sql.includes('u.must_change_password,') && sql.includes('GROUP BY u.user_id')) return { rows: [actor] };
  if (sql.startsWith('SELECT empno FROM public.app_user')) return { rows: [{ empno: 'target' }] };
  if (sql.includes('AS department,') && sql.includes('FROM public.employee e')) return { rows: allowTarget ? [{ empno: 'target', department: 'BR1', role: 'employee' }] : [] };
  if (sql.includes('count(*)::integer AS total')) return { rows: [{ total: 1 }] };
  if (sql.includes('FROM public.employee e')) return { rows: [{ empno: 'target', stamp: 'PRIVATE', salary: null, is_deleted: false }] };
  if (sql.includes('FROM public.jobhistory h')) return { rows: [{ empno: 'target', stamp: 'PRIVATE', salary: null }] };
  return { rows: [] };
});
const pool = { query, connect: async () => ({ query, release() {} }) };
require.cache[require.resolve('../../db')] = { loaded: true, exports: { requirePool: () => pool } };
const { authenticate, requireActiveUser } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { errorHandler } = require('../../middleware/error-handler');
const app = express();
app.use(express.json(), cookieParser());
app.use('/api/users', require('../../routes/user-routes'));
app.use('/api/employees', require('../../routes/employee-routes'));
for (const path of ['/api/dashboard/stats', '/api/reports/all-employees', '/api/sales/catalog', '/api/audit-logs', '/api/customers', '/api/products', '/api/auth/active-employees']) {
  app.get(path, authenticate, requireActiveUser, (_req, res) => res.json({ success: true }));
}
app.get('/api/me/preferences', authenticate, requireActiveUser, (_req, res) => res.json({ success: true }));
app.get('/api/users/check-access', authenticate, requireActiveUser, requirePermission('Users', 'edit'), (_req, res) => res.json({ success: true }));
app.use(errorHandler);

beforeEach(() => {
  process.env.JWT_SECRET = 'people-boundary-test-secret';
  actor = { user_id: userId, empno: 'viewer', email: 'viewer@example.invalid', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['hr.access', 'hr.employee.edit', 'hr.history.view'] };
  allowTarget = false;
  query.mockClear();
});
const cookie = () => `access_token=${jwt.sign({ sub: userId, role: 'superadmin' }, process.env.JWT_SECRET)}`;

test.each(['/api/dashboard/stats', '/api/reports/all-employees', '/api/sales/catalog', '/api/audit-logs', '/api/customers', '/api/products', '/api/auth/active-employees', '/api/employees'])('IT Admin is denied %s even with custom business rights', async path => {
  actor.role = 'it_admin';
  actor.rights = ['hr.access', 'customers.access', 'products.access', 'reports.all-employees', 'activity.access'];
  expect((await request(app).get(path).set('Cookie', cookie())).status).toBe(403);
});

test('IT Admin can reach account management and personal settings', async () => {
  actor.role = 'it_admin';
  expect((await request(app).get('/api/users/check-access').set('Cookie', cookie())).status).toBe(200);
  expect((await request(app).get('/api/me/preferences').set('Cookie', cookie())).status).toBe(200);
});

test.each(['/api/employees/hidden', '/api/employees/hidden/job-history'])('inaccessible direct URL %s returns 404', async path => {
  expect((await request(app).get(path).set('Cookie', cookie())).status).toBe(404);
});

test.each([['put', ''], ['post', '/approve'], ['post', '/reject'], ['patch', '/block'], ['put', '/rights']])('out-of-scope account %s %s is never changed', async (method, suffix) => {
  actor.role = 'admin';
  const result = await request(app)[method](`/api/users/${userId.slice(0, -1)}2${suffix}`).set('Cookie', cookie()).send({ isBlocked: true, rights: [] });
  expect(result.status).toBe(404);
  expect(query.mock.calls.some(([sql]) => /^(UPDATE|DELETE|INSERT)/.test(sql))).toBe(false);
});

test('ordinary HR editor receives no employee or history stamp keys in JSON', async () => {
  allowTarget = true;
  const result = await request(app).get('/api/employees/target').set('Cookie', cookie());
  expect(result.status).toBe(200);
  expect(result.body.data.employee.empno).toBe('target');
  expect(JSON.stringify(result.body)).not.toContain('stamp');
  expect(JSON.stringify(result.body)).not.toContain('PRIVATE');
});

test('an existing session uses the latest role on its very next request', async () => {
  const session = cookie();
  actor.role = 'admin';
  expect((await request(app).get('/api/users/check-access').set('Cookie', session)).status).toBe(200);
  actor.role = 'employee'; actor.rights = [];
  expect((await request(app).get('/api/users/check-access').set('Cookie', session)).status).toBe(403);
});
