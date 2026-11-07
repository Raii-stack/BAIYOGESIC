// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const id = (number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const employeeRights = ['customers.access', 'products.access', 'hr.access', 'sales.access'];
const allRights = [...employeeRights, 'customers.delete', 'hr.employee.edit', 'sales.add', 'activity.access'];
let accounts, snapshot, failRightsWrite;
const query = vi.fn(async (sql, values = []) => {
  if (sql === 'BEGIN') snapshot = structuredClone(accounts);
  if (sql === 'ROLLBACK') accounts = snapshot;
  if (sql === 'COMMIT') snapshot = null;
  const account = accounts.find((row) => row.user_id === values[0]);
  if (sql.startsWith('DELETE FROM public.app_user_right')) account.rights = [];
  else if (sql.includes('INSERT INTO public.app_user_right')) {
    if (failRightsWrite) throw new Error('Permission write failed');
    account.rights = values[2] === null ? [...allRights] : allRights.filter((right) => values[2].includes(right));
    return { rows: account.rights.map((right_code) => ({ right_code })) };
  } else if (sql.includes('SELECT right_code FROM public.app_user_right')) {
    return { rows: account.rights.map((right_code) => ({ right_code })) };
  } else if (sql.includes('UPDATE public.app_user')) {
    account.email = values[1];
    account.role = values[2];
  } else if (sql.includes('FROM public.app_user')) {
    return { rows: account ? [{ ...account, userId: account.user_id, rights: [...account.rights] }] : [] };
  }
  return { rows: [] };
});
const client = { query, release: vi.fn() };
require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'), filename: require.resolve('../../db'), loaded: true,
  exports: { requirePool: () => ({ query, connect: async () => client }) },
};
const auth = require('../../middleware/auth');
const invalidate = vi.spyOn(auth, 'invalidateUserCache');
const userRoutes = require('../../routes/user-routes');
const { requirePermission } = require('../../middleware/permissions');
const { errorHandler } = require('../../middleware/error-handler');
const app = express();
app.use(express.json(), cookieParser());
app.use('/api/users', userRoutes);
app.get('/test/customer-delete', auth.authenticate, auth.requireActiveUser, requirePermission('CRM', 'delete'), (_req, res) => res.sendStatus(200));
app.use(errorHandler);
const cookie = (number) => `access_token=${jwt.sign({ sub: id(number), role: 'superadmin' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' })}`;

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'role-permission-tests-only');
  query.mockClear();
  invalidate.mockClear();
  failRightsWrite = false;
  snapshot = null;
  accounts = [1, 2].map((number) => ({ user_id: id(number), empno: null, email: `user${number}@example.com`, role: 'superadmin', status: 'active', is_blocked: false, must_change_password: false, rights: [...allRights] }));
});
afterEach(() => vi.unstubAllEnvs());

test.each(['superadmin', 'admin'])('demoting %s replaces elevated rights and blocks the old session from privileged actions', async (oldRole) => {
  accounts[1].role = oldRole;
  const oldSession = cookie(2);
  expect((await request(app).get('/test/customer-delete').set('Cookie', oldSession)).status).toBe(200);
  const result = await request(app).put(`/api/users/${id(2)}`).set('Cookie', cookie(1)).send({ role: 'employee' });
  expect(result.status).toBe(200);
  expect(result.body.data.user).toMatchObject({ role: 'employee', rights: employeeRights });
  expect(invalidate).toHaveBeenCalledWith(id(2));
  expect((await request(app).get('/test/customer-delete').set('Cookie', oldSession)).status).toBe(403);
  const audit = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO public.audit_log'));
  expect(audit[1]).toEqual([id(2), oldRole, allRights, 'employee', employeeRights, 'user1@example.com']);
  expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(true);
});

test.each([['employee', 'admin'], ['employee', 'superadmin'], ['admin', 'superadmin'], ['superadmin', 'admin']])('changing %s to %s applies the new role defaults', async (oldRole, role) => {
  accounts[1].role = oldRole;
  accounts[1].rights = ['sales.access', 'sales.add'];
  const result = await request(app).put(`/api/users/${id(2)}`).set('Cookie', cookie(1)).send({ role });
  expect(result.status).toBe(200);
  expect(result.body.data.user).toMatchObject({ role, rights: allRights });
});

test.each(['superadmin', 'admin', 'employee'])('editing a %s account without changing its role preserves custom rights', async (role) => {
  accounts[1].role = role;
  accounts[1].rights = ['sales.access', 'sales.add'];
  const result = await request(app).put(`/api/users/${id(2)}`).set('Cookie', cookie(1)).send({ role });
  expect(result.status).toBe(200);
  expect(result.body.data.user.rights).toEqual(['sales.access', 'sales.add']);
  expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM public.app_user_right'))).toBe(false);
});

test('rolls back the role and permissions together if assigning the defaults fails', async () => {
  failRightsWrite = true;
  const result = await request(app).put(`/api/users/${id(2)}`).set('Cookie', cookie(1)).send({ role: 'employee' });
  expect(result.status).toBe(500);
  expect(accounts[1]).toMatchObject({ role: 'superadmin', rights: allRights });
  expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);
  expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(false);
  expect(invalidate).not.toHaveBeenCalled();
});

test('keeps self-role changes, invalid roles, and unauthorized promotions blocked', async () => {
  expect((await request(app).put(`/api/users/${id(1)}`).set('Cookie', cookie(1)).send({ role: 'employee' })).status).toBe(400);
  expect((await request(app).put(`/api/users/${id(2)}`).set('Cookie', cookie(1)).send({ role: 'unknown' })).status).toBe(400);
  accounts[0].role = 'admin';
  accounts[1].role = 'employee';
  expect((await request(app).put(`/api/users/${id(2)}`).set('Cookie', cookie(1)).send({ role: 'superadmin' })).status).toBe(403);
  expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM public.app_user_right'))).toBe(false);
});
