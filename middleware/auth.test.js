// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

const pool = { query: vi.fn() };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const { authenticate, requireActiveUser, primeUserCache, invalidateUserCache } = require('./auth');

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    set(key, value) { this.headers[key] = value; },
  };
}

describe('middleware/auth ([S1-DEV-02a & S1-DEV-03a])', () => {
  beforeEach(() => {
    pool.query.mockReset();
    invalidateUserCache();
  });

  test('authenticate rejects missing or invalid session cookies with 401', () => {
    const missingRes = createRes();
    const next = vi.fn();
    authenticate({ cookies: {} }, missingRes, next);
    expect(missingRes.statusCode).toBe(401);
    expect(missingRes.body.error.message).toBe('Authentication required');
    expect(next).not.toHaveBeenCalled();

    const invalidRes = createRes();
    authenticate({ cookies: { access_token: 'invalid.jwt.token' } }, invalidRes, next);
    expect(invalidRes.statusCode).toBe(401);
    expect(invalidRes.body.error.message).toBe('Invalid or expired session');
    expect(next).not.toHaveBeenCalled();
  });

  test('authenticate accepts a valid HS256 JWT cookie and attaches req.user', () => {
    const token = jwt.sign(
      { sub: '11111111-1111-4111-8111-111111111111', role: 'admin', email: 'admin@hope.inc' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const req = { cookies: { access_token: token } };
    const res = createRes();
    const next = vi.fn();

    authenticate(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({
      sub: '11111111-1111-4111-8111-111111111111',
      role: 'admin',
      email: 'admin@hope.inc',
    });
  });

  test('requireActiveUser rejects malformed UUIDs, blocked/pending users, and must_change_password accounts', async () => {
    const badIdRes = createRes();
    await requireActiveUser({ user: { sub: 'not-a-uuid' } }, badIdRes, vi.fn());
    expect(badIdRes.statusCode).toBe(401);

    const userId = '11111111-1111-4111-8111-111111111111';
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: userId, status: 'pending', is_blocked: false, must_change_password: false, rights: [] }],
    });
    const pendingRes = createRes();
    await requireActiveUser({ user: { sub: userId } }, pendingRes, vi.fn());
    expect(pendingRes.statusCode).toBe(401);

    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: userId, status: 'active', is_blocked: true, must_change_password: false, rights: [] }],
    });
    const blockedRes = createRes();
    await requireActiveUser({ user: { sub: userId } }, blockedRes, vi.fn());
    expect(blockedRes.statusCode).toBe(401);

    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: userId, status: 'active', is_blocked: false, must_change_password: true, rights: [] }],
    });
    const resetReqRes = createRes();
    await requireActiveUser({ user: { sub: userId } }, resetReqRes, vi.fn());
    expect(resetReqRes.statusCode).toBe(403);
    expect(resetReqRes.body.error.message).toBe('Change your password before continuing');
  });

  test('requireActiveUser restricts it_admin to user and workspace routes and wraps people redaction', async () => {
    const userId = '22222222-2222-4222-8222-222222222222';
    pool.query.mockResolvedValue({
      rows: [{
        user_id: userId,
        empno: '00002',
        email: 'it@hope.inc',
        role: 'it_admin',
        status: 'active',
        is_blocked: false,
        must_change_password: false,
        rights: [],
      }],
    });

    const deniedRes = createRes();
    const deniedNext = vi.fn();
    await requireActiveUser({ user: { sub: userId }, originalUrl: '/api/sales' }, deniedRes, deniedNext);
    expect(deniedRes.statusCode).toBe(403);
    expect(deniedNext).not.toHaveBeenCalled();

    const allowedRes = createRes();
    const allowedNext = vi.fn();
    await requireActiveUser({ user: { sub: userId }, originalUrl: '/api/users' }, allowedRes, allowedNext);
    expect(allowedNext).toHaveBeenCalledTimes(1);
    expect(allowedRes.headers['Cache-Control']).toBe('no-store');
  });

  test('primeUserCache ignores null payloads safely', () => {
    expect(() => primeUserCache(null)).not.toThrow();
  });
});
