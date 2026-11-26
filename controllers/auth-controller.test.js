// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

const client = { query: vi.fn(), release: vi.fn() };
const pool = { query: vi.fn(), connect: vi.fn().mockResolvedValue(client) };
const sendResetEmail = vi.fn();
const sendRegCode = vi.fn();

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: {
    requirePool: () => pool,
    supabase: { from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }) },
  },
};

require.cache[require.resolve('../lib/password-reset-email')] = {
  id: require.resolve('../lib/password-reset-email'),
  filename: require.resolve('../lib/password-reset-email'),
  loaded: true,
  exports: {
    passwordResetMailer: () => sendResetEmail,
    registrationCodeMailer: () => sendRegCode,
    approvalEmailMailer: () => vi.fn(),
    rejectionEmailMailer: () => vi.fn(),
  },
};

const { login, session, logout, changePassword, register } = require('./auth-controller');

async function invoke(handler, extra = {}) {
  let body;
  let error;
  let statusCode = 200;
  const cookies = {};
  const clearedCookies = [];
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
    cookie(name, value, opts) { cookies[name] = { value, opts }; },
    clearCookie(name, opts) { clearedCookies.push({ name, opts }); },
    set() {},
  };
  await handler(
    { body: {}, query: {}, params: {}, user: {}, ...extra },
    res,
    (err) => { error = err; },
  );
  return { statusCode, body, error, cookies, clearedCookies };
}

describe('controllers/auth-controller ([S1-DEV-02a & S1-DEV-03a])', () => {
  beforeEach(() => {
    client.query.mockReset();
    client.release.mockReset();
    pool.query.mockReset();
    pool.connect.mockReset().mockResolvedValue(client);
    sendResetEmail.mockReset();
    sendRegCode.mockReset();
  });

  test('login validates required fields (400), rejects bad passwords (401), and blocks pending/blocked accounts (403)', async () => {
    expect((await invoke(login, { body: { email: '', password: '' } })).error).toMatchObject({ statusCode: 400 });

    const passwordHash = await bcrypt.hash('SecretPass1!', 4);
    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 'u-1', email: 'a@hope.inc', password_hash: passwordHash, status: 'active', is_blocked: false }] });
    expect((await invoke(login, { body: { email: 'a@hope.inc', password: 'WrongPassword' } })).error).toMatchObject({ statusCode: 401 });

    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 'u-1', email: 'a@hope.inc', password_hash: passwordHash, status: 'pending', is_blocked: false }] });
    expect((await invoke(login, { body: { email: 'a@hope.inc', password: 'SecretPass1!' } })).error).toMatchObject({ statusCode: 403 });

    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 'u-1', email: 'a@hope.inc', password_hash: passwordHash, status: 'active', is_blocked: true }] });
    expect((await invoke(login, { body: { email: 'a@hope.inc', password: 'SecretPass1!' } })).error).toMatchObject({ statusCode: 403 });
  });

  test('login issues httpOnly JWT cookie and returns formatted user for active credentials', async () => {
    const passwordHash = await bcrypt.hash('SecretPass1!', 4);
    pool.query.mockResolvedValueOnce({
      rows: [{
        user_id: '11111111-1111-4111-8111-111111111111',
        empno: '00001',
        email: 'john@hope.inc',
        password_hash: passwordHash,
        role: 'employee',
        status: 'active',
        is_blocked: false,
        must_change_password: false,
        firstName: 'John',
        lastName: 'Smith',
        name: 'John Smith',
        rights: ['customers.access'],
      }],
    });

    const result = await invoke(login, { body: { email: '  JOHN@hope.inc ', password: 'SecretPass1!' } });
    expect(result.error).toBeUndefined();
    expect(result.statusCode).toBe(200);
    expect(result.cookies.access_token.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    const decoded = jwt.verify(result.cookies.access_token.value, process.env.JWT_SECRET);
    expect(decoded.email).toBe('john@hope.inc');
    expect(result.body.data.user).toMatchObject({
      email: 'john@hope.inc',
      empno: '00001',
      role: 'employee',
      rights: ['customers.access'],
    });
  });

  test('session returns active user and rejects blocked/missing users with 401', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await invoke(session, { user: { sub: userId } })).error).toMatchObject({ statusCode: 401 });

    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: userId, empno: '00001', email: 'john@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }],
    });
    const active = await invoke(session, { user: { sub: userId } });
    expect(active.statusCode).toBe(200);
    expect(active.body.data.user.email).toBe('john@hope.inc');
  });

  test('logout clears access_token cookie even if activity end query fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));
    const res = await invoke(logout, { user: { sub: '11111111-1111-4111-8111-111111111111' } });
    expect(res.error).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(res.clearedCookies[0].name).toBe('access_token');
  });

  test('register validates fields and rejects duplicate email with 409', async () => {
    expect((await invoke(register, { body: { firstName: '', lastName: 'Doe', email: 'bad' } })).error).toMatchObject({ statusCode: 400 });

    client.query.mockImplementation(async (sql) => {
      if (sql.includes('SELECT user_id FROM public.app_user')) return { rows: [{ user_id: 'existing' }] };
      return { rows: [] };
    });

    const dup = await invoke(register, {
      body: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@hope.inc',
        password: 'StrongPassword1!',
        verificationCode: '123456',
      },
    });
    expect(dup.error).toMatchObject({ statusCode: 409 });
  });

  test('changePassword validates new password rules and verifies current password', async () => {
    expect((await invoke(changePassword, {
      user: { sub: 'u-1' },
      body: { currentPassword: 'SamePassword1!', newPassword: 'SamePassword1!' },
    })).error).toMatchObject({ statusCode: 400 });

    const passwordHash = await bcrypt.hash('OldPass123!', 4);
    pool.query.mockResolvedValueOnce({ rows: [{ password_hash: passwordHash, is_blocked: false }] });
    expect((await invoke(changePassword, {
      user: { sub: 'u-1' },
      body: { currentPassword: 'WrongPassword!', newPassword: 'NewPassword1!' },
    })).error).toMatchObject({ statusCode: 401 });
  });
});
