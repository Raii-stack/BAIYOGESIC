import { beforeEach, expect, test, vi } from 'vitest';

let activePool;
require.cache[require.resolve('../db')] = { id: require.resolve('../db'), filename: require.resolve('../db'), loaded: true, exports: { requirePool: () => activePool } };
const { recordActivity, listActiveEmployees, endActivity } = require('./activity-controller');

function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = { json: (body) => resolve({ status: 200, body }) };
    handler(req, res, (error) => resolve({ status: error.statusCode || 500 }));
  });
}

beforeEach(() => { activePool = { query: vi.fn().mockResolvedValue({ rows: [] }) }; });

test('records the authenticated session using a hash, with a bounded update frequency and expiry cleanup', async () => {
  const response = await invoke(recordActivity, { cookies: { access_token: 'private-session-token' }, user: { sub: 'user-1', exp: 2000000000 } });
  expect(response.status).toBe(200);
  const [sql, values] = activePool.query.mock.calls[0];
  expect(values[0]).toMatch(/^[0-9a-f]{64}$/);
  expect(values[0]).not.toContain('private-session-token');
  expect(values.slice(1)).toEqual(['user-1', 2000000000, 0]);
  expect(sql).toContain('closed_at IS NULL');
  expect(sql).toContain("interval '30 seconds'");
  expect(sql).toContain('expires_at <= now()');
  expect(sql).toContain('newer.user_id = p.user_id');
  expect(sql).toContain('(newer.last_seen_at, newer.session_id) > (p.last_seen_at, p.session_id)');
});

test.each([-1, 120001, '10'])('rejects an invalid client activity interval: %s', async (idleMs) => {
  expect((await invoke(recordActivity, { body: { idleMs }, cookies: {}, user: {} })).status).toBe(400);
  expect(activePool.query).not.toHaveBeenCalled();
});

test('tracks the last interaction rather than extending an idle browser session', async () => {
  await invoke(recordActivity, { body: { idleMs: 60000 }, cookies: { access_token: 'token' }, user: { sub: 'user-1', exp: 2000000000 } });
  expect(activePool.query.mock.calls[0][1][3]).toBe(60000);
  expect(activePool.query.mock.calls[0][0]).toContain("interval '1 millisecond'");
});

test('a heartbeat requires an authenticated expiring token', async () => {
  expect((await invoke(recordActivity, { cookies: {}, user: { sub: 'user-1' } })).status).toBe(401);
  expect(activePool.query).not.toHaveBeenCalled();
});

test.each(['employee', 'user'])('ordinary %s accounts cannot list online employees', async (role) => {
  expect((await invoke(listActiveEmployees, { user: { role, rights: ['hr.access'] } })).status).toBe(403);
  expect(activePool.query).not.toHaveBeenCalled();
});

test.each([{ role: 'admin' }, { role: 'superadmin' }, { role: 'employee', rights: ['activity.access'] }])('administrators and permitted managers can view recent, unblocked employees: %o', async (user) => {
  const employee = { userId: '1', empno: '00001', name: 'Alex Montes', lastSeenAt: '2026-11-02T12:00:00Z' };
  activePool.query.mockResolvedValue({ rows: [employee] });
  const result = await invoke(listActiveEmployees, { user });
  expect(result.body.data.employees).toEqual([employee]);
  const sql = activePool.query.mock.calls[0][0];
  expect(sql).toContain("interval '2 minutes'");
  expect(sql).toContain('max(last_seen_at)');
  expect(sql).toContain('expires_at > now() AND closed_at IS NULL');
  expect(sql).toContain('NOT u.is_blocked');
  expect(sql).not.toContain('password_hash');
});

test('logout closes only its session and preserves a tombstone against late heartbeats', async () => {
  await endActivity({ cookies: { access_token: 'session-a' }, user: { sub: 'user-1', exp: 2000000000 } });
  const [sql, values] = activePool.query.mock.calls[0];
  expect(sql).toContain('ON CONFLICT (session_id) DO UPDATE SET closed_at = now()');
  expect(values).toHaveLength(3);
});
