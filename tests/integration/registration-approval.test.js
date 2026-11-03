// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const password = 'SecurePass123!';
const hash = bcrypt.hashSync(password, 4);
const id = (number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
let accounts;
const query = vi.fn(async (sql, values = []) => {
  const account = accounts.find((row) => row.user_id === values[0] || row.email === values[0] || row.email === values[1]);
  if (/UPDATE public.app_user/.test(sql)) {
    if (sql.includes('AND status = \'active\'') && account.status !== 'active') return { rows: [] };
    if (sql.includes("status = 'active'")) account.status = 'active';
    if (sql.includes('password_hash = $4')) account.password_hash = values[3];
    return { rows: account ? [account] : [] };
  }
  if (sql.includes('FROM public.app_user')) {
    if (sql.includes('ORDER BY u.created_at DESC')) {
      const pending = accounts.filter((row) => row.status === 'pending' && row.role === 'employee' && !row.is_blocked);
      return { rows: pending.slice(0, 5).map((row) => ({ userId: row.user_id, email: row.email, name: 'New Employee', createdAt: '2026-11-02T10:00:00.000Z', _total: pending.length })) };
    }
    if (sql.includes('WHERE lower(u.email)')) return { rows: account ? [account] : [] };
    if (sql.includes('AS "userId"') && !sql.includes('WHERE u.user_id =')) {
      return { rows: accounts.filter((row) => row.status === 'pending').map((row) => ({ ...row, userId: row.user_id, _total: 1 })) };
    }
    return { rows: account ? [{ ...account, userId: account.user_id }] : [] };
  }
  return { rows: [] };
});
const client = { query, release() {} };
require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'), filename: require.resolve('../../db'), loaded: true,
  exports: { requirePool: () => ({ query, connect: async () => client }), supabase: {} },
};
const authRoutes = require('../../routes/auth-routes');
const userRoutes = require('../../routes/user-routes');
const { auditContext } = require('../../middleware/audit-context');
const { errorHandler } = require('../../middleware/error-handler');
const app = express();
app.use(express.json(), cookieParser());
app.use('/api/auth', auditContext, authRoutes);
app.use('/api/users', userRoutes);
app.use(errorHandler);
const cookie = (number) => `access_token=${jwt.sign({ sub: id(number) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' })}`;

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'registration-approval-tests-only');
  query.mockClear();
  accounts = [
    { user_id: id(1), email: 'hr@hope.inc', role: 'employee', rights: ['hr.employee.edit'] },
    { user_id: id(2), email: 'staff@hope.inc', role: 'employee', rights: ['hr.access'] },
    { user_id: id(3), email: 'admin@hope.inc', role: 'admin', rights: [] },
    { user_id: id(4), email: 'superadmin@hope.inc', role: 'superadmin', rights: [] },
    { user_id: id(5), email: 'new@hope.inc', role: 'employee', rights: ['hr.access'], status: 'pending' },
  ].map((row) => ({ status: 'active', is_blocked: false, must_change_password: false, password_hash: hash, empno: null, ...row }));
});
afterEach(() => vi.unstubAllEnvs());

test.each([1, 3, 4])('registration notifications are available to approver %s and clear after approval', async (approver) => {
  const response = await request(app).get('/api/auth/registration-notifications').set('Cookie', cookie(approver));
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({ total: 1, registrations: [{ userId: id(5), name: 'New Employee' }] });
  expect(response.body.data.registrations[0]._total).toBeUndefined();
  const notificationQuery = query.mock.calls.find(([sql]) => sql.includes('ORDER BY u.created_at DESC'))[0];
  expect(notificationQuery).toContain("u.role = 'employee' AND u.status = 'pending' AND NOT u.is_blocked");
  expect(notificationQuery).toContain('LIMIT 5');
  await request(app).post(`/api/users/${id(5)}/approve`).set('Cookie', cookie(approver));
  expect((await request(app).get('/api/auth/registration-notifications').set('Cookie', cookie(approver))).body.data).toEqual({ total: 0, registrations: [] });
});

test('notification data is protected from ordinary employees, pending accounts and signed-out visitors', async () => {
  expect((await request(app).get('/api/auth/registration-notifications').set('Cookie', cookie(2))).status).toBe(403);
  expect((await request(app).get('/api/auth/registration-notifications').set('Cookie', cookie(5))).status).toBe(401);
  expect((await request(app).get('/api/auth/registration-notifications')).status).toBe(401);
});

test('pending accounts cannot log in or use a protected endpoint with a token', async () => {
  const pending = await request(app).post('/api/auth/login').send({ email: 'new@hope.inc', password });
  expect(pending.status).toBe(403);
  expect(pending.body.error.message).toMatch(/pending approval/);
  expect(pending.headers['set-cookie']).toBeUndefined();
  expect((await request(app).get('/api/users').set('Cookie', cookie(5))).status).toBe(401);
  const wrong = await request(app).post('/api/auth/login').send({ email: 'new@hope.inc', password: 'incorrect' });
  const unknown = await request(app).post('/api/auth/login').send({ email: 'unknown@hope.inc', password });
  expect(wrong.status).toBe(401);
  expect(wrong.body).toEqual(unknown.body);
});

test.each([1, 3, 4])('HR/admin/superadmin account %s can approve, then the new employee can log in', async (approver) => {
  const approved = await request(app).post(`/api/users/${id(5)}/approve`).set('Cookie', cookie(approver));
  expect(approved.status).toBe(200);
  expect(approved.body.data.user.status).toBe('active');
  const login = await request(app).post('/api/auth/login').send({ email: 'new@hope.inc', password });
  expect(login.status).toBe(200);
  expect(login.headers['set-cookie']).toBeDefined();
});

test('HR sees only the pending employee queue and cannot use other user administration actions', async () => {
  expect((await request(app).get('/api/users').set('Cookie', cookie(1))).status).toBe(200);
  const listQuery = query.mock.calls.find(([sql]) => sql.includes('count(*) OVER()'))[0];
  expect(listQuery).toContain("u.role = 'employee' AND u.status = 'pending' AND u.is_blocked = false");
  for (const [method, path] of [['get', '/options'], ['post', ''], ['put', `/${id(5)}`], ['put', `/${id(5)}/rights`], ['patch', `/${id(5)}/block`]]) {
    expect((await request(app)[method]('/api/users' + path).set('Cookie', cookie(1)).send({})).status).toBe(403);
  }
  expect((await request(app).post(`/api/users/${id(5)}/approve`).set('Cookie', cookie(2))).status).toBe(403);
});

test('HR cannot approve privileged accounts or override blocked/non-pending accounts', async () => {
  accounts[4].role = 'admin';
  expect((await request(app).post(`/api/users/${id(5)}/approve`).set('Cookie', cookie(1))).status).toBe(403);
  accounts[4].role = 'employee';
  accounts[4].is_blocked = true;
  expect((await request(app).post(`/api/users/${id(5)}/approve`).set('Cookie', cookie(1))).status).toBe(409);
  expect(accounts[4].status).toBe('pending');
  accounts[4].is_blocked = false;
  accounts[4].status = 'disabled';
  expect((await request(app).post(`/api/users/${id(5)}/approve`).set('Cookie', cookie(3))).status).toBe(409);
  expect((await request(app).post('/api/auth/login').send({ email: 'new@hope.inc', password })).status).toBe(401);
});

test('password setup and admin password changes do not approve a pending account', async () => {
  accounts[4].must_change_password = true;
  const setup = await request(app).post('/api/auth/set-password').send({ email: 'new@hope.inc', password });
  expect(setup.status).toBe(400);
  const edited = await request(app).put(`/api/users/${id(5)}`).set('Cookie', cookie(3)).send({ password: 'NewSecurePass123!' });
  expect(edited.status).toBe(200);
  expect(edited.body.data.user.status).toBe('pending');
  expect(accounts[4].status).toBe('pending');
});
