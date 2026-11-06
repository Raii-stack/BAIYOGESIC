// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const pool = { query: vi.fn() };
require.cache[require.resolve('../db')] = { id: require.resolve('../db'), filename: require.resolve('../db'), loaded: true, exports: { requirePool: () => pool } };
const { defaultPreferences, validatePreferences, getPreferences, updatePreferences, listNotifications, markNotificationRead, markAllRead, openNotification } = require('./workspace-controller');
const user = { sub: '00000000-0000-0000-0000-000000000001' };

async function invoke(handler, extra = {}) {
  let body, error;
  await handler({ user, params: {}, query: {}, ...extra }, { json: (value) => { body = value; } }, (value) => { error = value; });
  return { body, error };
}
beforeEach(() => { pool.query.mockReset(); });

test.each([null, [], {}, { user_id: user.sub }, { motion: 'true' }, { density: 'tiny' }, { sales: 1 }])('rejects invalid preference input: %o', (input) => {
  expect(() => validatePreferences(input)).toThrow();
});
test('returns defaults without creating a preference row', async () => {
  pool.query.mockResolvedValue({ rows: [] });
  expect((await invoke(getPreferences)).body.data.preferences).toEqual(defaultPreferences);
  expect(pool.query.mock.calls[0][1]).toEqual([user.sub]);
});
test('updates only whitelisted fields scoped to the signed-in user', async () => {
  pool.query.mockResolvedValue({ rows: [{ ...defaultPreferences, density: 'compact' }] });
  const result = await invoke(updatePreferences, { body: { density: 'compact', motion: false } });
  expect(result.error).toBeUndefined();
  expect(pool.query.mock.calls[0][0]).toContain('ON CONFLICT (user_id)');
  expect(pool.query.mock.calls[0][1]).toEqual([user.sub, 'compact', false]);
});
test('lists a bounded inbox page and counts only visible notifications', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ id: '7' }] }).mockResolvedValueOnce({ rows: [{ total: 21, unreadCount: 3 }] });
  const { body } = await invoke(listNotifications, { query: { page: '2', userId: 'someone-else' } });
  expect(body.data).toMatchObject({ page: 2, totalPages: 2, unreadCount: 3 });
  expect(pool.query.mock.calls[0][1]).toEqual([user.sub, 20]);
  for (const [sql] of pool.query.mock.calls) expect(sql).toContain('public.workspace_notice_visible($1::uuid, category)');
});
test.each(['0', '-1', '1.5', 'Infinity', '1000001'])('rejects an invalid inbox page: %s', async (page) => {
  expect((await invoke(listNotifications, { query: { page } })).error.statusCode).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});
test('read actions cannot change another recipient’s notifications', async () => {
  pool.query.mockResolvedValue({ rows: [] });
  const { error } = await invoke(markNotificationRead, { params: { notificationId: '7' } });
  expect(error.statusCode).toBe(404);
  expect(pool.query.mock.calls[0][0]).toContain('user_id = $1::uuid');
  expect(pool.query.mock.calls[0][1]).toEqual([user.sub, '7']);
  await invoke(markAllRead);
  expect(pool.query.mock.calls[1][1]).toEqual([user.sub]);
});
test('opening an inaccessible notification returns no target', async () => {
  pool.query.mockResolvedValue({ rows: [] });
  expect((await invoke(openNotification, { params: { notificationId: '7' } })).error.statusCode).toBe(404);
});
test('product alerts visible to sales staff do not bypass product access', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ target_kind: 'product', target_key: 'PD001' }] }).mockResolvedValueOnce({ rows: [] });
  expect((await invoke(openNotification, { params: { notificationId: '7' } })).body.data.href).toBeNull();
  expect(pool.query.mock.calls[1][0]).toContain("workspace_module_access($2::uuid, 'products')");
});

test('sales links use the list when current permissions do not allow the details dialog', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ target_kind: 'sale', target_key: 'TR0001' }] }).mockResolvedValueOnce({ rows: [{ transno: 'TR0001', can_open_details: false }] });
  expect((await invoke(openNotification, { params: { notificationId: '7' } })).body.data.href).toBe('/sales?search=TR0001');
});

test('workspace routes require an active account and reject temporary-password sessions', async () => {
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/api/me', require('../routes/workspace-routes'));
  expect((await request(app).get('/api/me/preferences')).status).toBe(401);
  expect((await request(app).get('/api/me/notifications')).status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
  vi.stubEnv('JWT_SECRET', 'workspace-route-tests-only');
  try {
    const cookie = `access_token=${jwt.sign({ sub: user.sub }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
    pool.query.mockResolvedValue({ rows: [{ user_id: user.sub, status: 'active', is_blocked: false, must_change_password: true, role: 'employee', rights: [] }] });
    expect((await request(app).get('/api/me/preferences').set('Cookie', cookie)).status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllEnvs(); }
});
