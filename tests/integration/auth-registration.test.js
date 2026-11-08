import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

let mockClient;
let mockPool;
let sendResetEmail;
let sendCodeEmail;
const codeHash = (email, code = '123456') => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`registration:${email}:${code}`).digest('hex');
require.cache[require.resolve('../../lib/password-reset-email')] = {
  id: require.resolve('../../lib/password-reset-email'), filename: require.resolve('../../lib/password-reset-email'), loaded: true,
  exports: { passwordResetMailer: () => sendResetEmail, registrationCodeMailer: () => sendCodeEmail },
};

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: {
    requirePool: () => mockPool,
    supabase: {},
  },
};

const {
  register,
  forgotPassword,
  resetPassword,
  sendRegistrationCode,
  validateResetToken,
} = require('../../controllers/auth-controller');

function invokeHandler(handler, { body = {}, user, query = {} } = {}) {
  return new Promise((resolve) => {
    const req = { body, user, query };
    const res = {
      statusCode: 200,
      body: undefined,
      set: vi.fn(),
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        resolve(this);
        return this;
      },
    };
    handler(req, res, (error) => {
      if (error) {
        res.statusCode = error.statusCode || 500;
        res.body = {
          success: false,
          error: { message: error.message, statusCode: error.statusCode },
        };
      }
      resolve(res);
    });
  });
}

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'registration-tests-only');
  sendResetEmail = vi.fn().mockResolvedValue(undefined);
  sendCodeEmail = vi.fn().mockResolvedValue(undefined);
  mockClient = {
    query: vi.fn(async (sql, params) => {
      if (sql.includes('INSERT INTO public.registration_email_verification')) return { rows: [{ expires_at: new Date(Date.now() + 600000), resend_at: new Date(Date.now() + 60000) }] };
      if (sql.includes('SELECT code_hash')) return { rows: [{ code_hash: codeHash(params[0]), attempts: 0, used: false, expired: false }] };
      if (typeof sql === 'string' && sql.includes('SELECT user_id, email, status, is_blocked FROM public.app_user')) {
        return { rows: params[0] === 'existing@hope.inc' ? [{ user_id: '99', email: params[0], status: 'active', is_blocked: false }] : [] };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.app_user SET password_hash')) return { rows: [{ user_id: '99' }] };
      if (typeof sql === 'string' && sql.includes('SELECT user_id FROM public.app_user WHERE lower(email)')) {
        return { rows: [] }; // No duplicate email by default
      }
      if (typeof sql === 'string' && sql.includes('SELECT lpad')) {
        return { rows: [{ empno: '00100' }] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO public.app_user')) {
        return {
          rows: [
            {
              user_id: '99',
              empno: '00100',
              email: params[1],
              role: 'employee',
              status: params[3],
              isBlocked: false,
              mustChangePassword: false,
            },
          ],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM public.password_reset_token t JOIN')) {
        return {
          rows: [
            {
              token_hash: params[0],
              user_id: '99',
              expires_at: new Date(Date.now() + 3600000),
              used: false,
              status: 'valid',
            },
          ],
        };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };

  mockPool = {
    connect: vi.fn(async () => mockClient),
    query: vi.fn(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('SELECT user_id, email, status, is_blocked FROM public.app_user')) {
        if (params[0] === 'existing@hope.inc') {
          return { rows: [{ user_id: '99', email: 'existing@hope.inc', status: 'active', is_blocked: false }] };
        }
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
});
afterEach(() => vi.unstubAllEnvs());

describe('User Self-Registration (POST /api/auth/register)', () => {
  it('validates required fields: firstName, lastName, email', async () => {
    const res = await invokeHandler(register, { body: { firstName: '', lastName: '', email: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/firstName, lastName, and email are required/i);
  });

  it('validates password length if password is provided', async () => {
    const res = await invokeHandler(register, {
      body: { firstName: 'Jane', lastName: 'Doe', email: 'jane@hope.inc', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/at least 8 characters/i);
  });

  it('rejects duplicate email with 409 Conflict', async () => {
    mockClient.query = vi.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT user_id FROM public.app_user WHERE lower(email)')) {
        return { rows: [{ user_id: '50' }] };
      }
      return { rows: [] };
    });

    const res = await invokeHandler(register, {
      body: { firstName: 'Jane', lastName: 'Doe', email: 'duplicate@hope.inc', password: 'ValidPassword123!', verificationCode: '123456' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  it('creates account strictly as role employee (User), ignoring privilege escalation attempts', async () => {
    const res = await invokeHandler(register, {
      body: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@hope.inc',
        password: 'ValidPassword123!',
        verificationCode: '123456',
        role: 'superadmin', // Privilege escalation attempt
        status: 'active',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('employee');
    expect(res.body.data.user.status).toBe('pending');
    expect(res.body.data.user.email).toBe('jane@hope.inc');
    expect(res.body.data.user.name).toBe('Jane Doe');

    // Verify employee insert had target role employee
    const insertAppUserCall = mockClient.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO public.app_user')
    );
    expect(insertAppUserCall).toBeDefined();
    expect(insertAppUserCall[1][4]).toBe('employee'); // role parameter
    expect(insertAppUserCall[1][3]).toBe('pending');
    expect(mockClient.query).toHaveBeenCalledWith('UPDATE public.registration_email_verification SET used = true WHERE email = $1', ['jane@hope.inc']);
  });

  it.each([undefined, '', 123456, '12345', 'abcdef'])('rejects missing or malformed verification code: %s', async (verificationCode) => {
    const res = await invokeHandler(register, { body: { firstName: 'Jane', lastName: 'Doe', email: 'jane@hope.inc', password: 'ValidPassword123!', verificationCode } });
    expect(res.statusCode).toBe(400);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it.each([null, { used: true }, { expired: true }, { attempts: 5 }])('rejects missing, used, expired or exhausted codes: %j', async (record) => {
    const original = mockClient.query.getMockImplementation();
    mockClient.query.mockImplementation((sql, params) => sql.includes('SELECT code_hash') ? { rows: record ? [record] : [] } : original(sql, params));
    const res = await invokeHandler(register, { body: { firstName: 'Jane', lastName: 'Doe', email: 'jane@hope.inc', password: 'ValidPassword123!', verificationCode: '123456' } });
    expect(res.statusCode).toBe(400);
    expect(mockClient.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO public.employee'))).toBe(false);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('commits incorrect attempts without creating an account', async () => {
    const res = await invokeHandler(register, { body: { firstName: 'Jane', lastName: 'Doe', email: 'jane@hope.inc', password: 'ValidPassword123!', verificationCode: '000000' } });
    expect(res.statusCode).toBe(400);
    expect(mockClient.query).toHaveBeenCalledWith('UPDATE public.registration_email_verification SET attempts = attempts + 1 WHERE email = $1', ['jane@hope.inc']);
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO public.employee'))).toBe(false);
  });

  it('rolls back account creation failure without consuming the code', async () => {
    const original = mockClient.query.getMockImplementation();
    mockClient.query.mockImplementation((sql, params) => sql.startsWith('INSERT INTO public.app_user (') ? Promise.reject(new Error('write failed')) : original(sql, params));
    const res = await invokeHandler(register, { body: { firstName: 'Jane', lastName: 'Doe', email: 'jane@hope.inc', password: 'ValidPassword123!', verificationCode: '123456' } });
    expect(res.statusCode).toBe(500);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
  });
});

describe('Registration verification email', () => {
  it.each(['invalid', 'person@example.com,other', 'Name<person@example.com>', 'person(comment)@example.com'])('rejects malformed addresses and mail recipient syntax: %s', async (email) => {
    const res = await invokeHandler(sendRegistrationCode, { body: { email } });
    expect(res.statusCode).toBe(400);
    expect(sendCodeEmail).not.toHaveBeenCalled();
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('normalizes email, stores only a keyed hash, and does not create an account or return the code', async () => {
    const res = await invokeHandler(sendRegistrationCode, { body: { email: ' Jane@Hope.inc ' } });
    expect(res.statusCode).toBe(200);
    expect(sendCodeEmail).toHaveBeenCalledWith('jane@hope.inc', expect.stringMatching(/^\d{6}$/));
    const code = sendCodeEmail.mock.calls[0][1];
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO public.registration_email_verification'), ['jane@hope.inc', codeHash('jane@hope.inc', code)]);
    expect(JSON.stringify(res.body)).not.toContain(code);
    expect(mockClient.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO public.app_user'))).toBe(false);
  });

  it('does not send when the persistent resend budget is exhausted', async () => {
    const original = mockClient.query.getMockImplementation();
    mockClient.query.mockImplementation((sql, params) => sql.includes('INSERT INTO public.registration_email_verification') ? { rows: [] } : original(sql, params));
    const res = await invokeHandler(sendRegistrationCode, { body: { email: 'jane@hope.inc' } });
    expect(res.statusCode).toBe(429);
    expect(sendCodeEmail).not.toHaveBeenCalled();
  });

  it('rolls back failed delivery so the user can retry', async () => {
    sendCodeEmail.mockRejectedValueOnce(Object.assign(new Error('Delivery failed'), { statusCode: 503 }));
    const res = await invokeHandler(sendRegistrationCode, { body: { email: 'jane@hope.inc' } });
    expect(res.statusCode).toBe(503);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
  });
});

describe('Forgot Password Flow (POST /api/auth/forgot-password)', () => {
  it('validates email format', async () => {
    const res = await invokeHandler(forgotPassword, { body: { email: 'invalid-email' } });
    expect(res.statusCode).toBe(400);
  });

  it('generates a password reset token for active accounts', async () => {
    const res = await invokeHandler(forgotPassword, { body: { email: 'existing@hope.inc' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeUndefined();
    expect(sendResetEmail).toHaveBeenCalledWith('existing@hope.inc', expect.stringMatching(/^[a-f0-9]{64}$/));

    const insertTokenCall = mockClient.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO public.password_reset_token')
    );
    expect(insertTokenCall).toBeDefined();
    expect(insertTokenCall[0]).toContain("interval '15 minutes'");
    expect(insertTokenCall[1][0]).toMatch(/^email:[a-f0-9]{64}$/);
    expect(insertTokenCall[1][0]).not.toBe(sendResetEmail.mock.calls[0][1]);
  });

  it('returns generic message for non-existent account without leaking existence', async () => {
    const res = await invokeHandler(forgotPassword, { body: { email: 'unknown@hope.inc' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.message).toMatch(/If an active account exists/i);
    expect(sendResetEmail).not.toHaveBeenCalled();
  });

  it('rolls back an email failure and allows the user to retry', async () => {
    sendResetEmail.mockRejectedValueOnce(Object.assign(new Error('Email delivery failed'), { statusCode: 503 }));
    const res = await invokeHandler(forgotPassword, { body: { email: 'existing@hope.inc' } });
    expect(res.statusCode).toBe(503);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('does not send another email while an emailed reset link remains valid', async () => {
    const original = mockClient.query.getMockImplementation();
    mockClient.query.mockImplementation((sql, params) => sql.startsWith('SELECT 1 FROM public.password_reset_token') ? { rows: [{}] } : original(sql, params));
    const res = await invokeHandler(forgotPassword, { body: { email: 'existing@hope.inc' } });
    expect(res.statusCode).toBe(200);
    expect(sendResetEmail).not.toHaveBeenCalled();
  });

  it('does not issue tokens when storing the token fails', async () => {
    const original = mockClient.query.getMockImplementation();
    mockClient.query.mockImplementation((sql, params) => sql.startsWith('INSERT INTO public.password_reset_token') ? Promise.reject(new Error('Write failed')) : original(sql, params));
    const res = await invokeHandler(forgotPassword, { body: { email: 'existing@hope.inc' } });
    expect(res.statusCode).toBe(500);
    expect(sendResetEmail).not.toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('Reset Password Flow (POST /api/auth/reset-password)', () => {
  it('validates token and password requirements', async () => {
    const res1 = await invokeHandler(resetPassword, { body: { token: '', password: 'ValidPassword123!' } });
    expect(res1.statusCode).toBe(400);

    const res2 = await invokeHandler(resetPassword, { body: { token: 'a'.repeat(64), password: 'short' } });
    expect(res2.statusCode).toBe(400);
  });

  it('redeems valid token and updates password hash', async () => {
    const res = await invokeHandler(resetPassword, {
      body: { token: 'a'.repeat(64), password: 'NewSecurePassword123!' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/Password has been reset successfully/i);

    const updateAppUserCall = mockClient.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE public.app_user SET password_hash')
    );
    expect(updateAppUserCall).toBeDefined();

    const updateTokenCall = mockClient.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE public.password_reset_token SET used = true')
    );
    expect(updateTokenCall).toBeDefined();
    const lookup = mockClient.query.mock.calls.find(([sql]) => sql.includes('FROM public.password_reset_token t JOIN'));
    expect(lookup[0]).toContain("t.created_at <= now() - interval '15 minutes'");
    expect(lookup[0]).toContain('FOR UPDATE OF t');
    expect(lookup[1]).toEqual([expect.stringMatching(/^email:[a-f0-9]{64}$/)]);
  });

  it('rejects expired or non-existent token with 400', async () => {
    mockClient.query = vi.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM public.password_reset_token t JOIN')) {
        return { rows: [] }; // Token not found or expired
      }
      return { rows: [] };
    });

    const res = await invokeHandler(resetPassword, {
      body: { token: 'b'.repeat(64), password: 'NewSecurePassword123!' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/Invalid or expired reset token/i);
  });

  it('rejects a reset if the account was blocked or made pending after the link was issued', async () => {
    const original = mockClient.query.getMockImplementation();
    mockClient.query.mockImplementation((sql, params) => sql.startsWith('UPDATE public.app_user SET password_hash') ? { rows: [] } : original(sql, params));
    const res = await invokeHandler(resetPassword, { body: { token: 'a'.repeat(64), password: 'NewSecurePassword123!' } });
    expect(res.statusCode).toBe(400);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
  });
});

describe('Reset link validation before displaying the form', () => {
  it.each(['valid', 'expired', 'used', 'invalid'])('returns %s without changing the password or consuming the token', async (status) => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ status, expires_at: '2026-11-08T12:00:00.000Z', user_id: 'private' }] });
    const res = await invokeHandler(validateResetToken, { body: { token: 'a'.repeat(64) } });
    expect(res.body.data).toEqual({ status, ...(status === 'valid' ? { expiresAt: '2026-11-08T12:00:00.000Z' } : {}) });
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it.each(['', 'malformed', undefined])('treats missing or malformed links as invalid without querying: %s', async (token) => {
    const res = await invokeHandler(validateResetToken, { body: { token } });
    expect(res.body.data.status).toBe('invalid');
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});
