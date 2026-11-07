import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';

let mockClient;
let mockPool;
let sendResetEmail;
require.cache[require.resolve('../../lib/password-reset-email')] = {
  id: require.resolve('../../lib/password-reset-email'), filename: require.resolve('../../lib/password-reset-email'), loaded: true,
  exports: { passwordResetMailer: () => sendResetEmail },
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
} = require('../../controllers/auth-controller');

function invokeHandler(handler, { body = {}, user, query = {} } = {}) {
  return new Promise((resolve) => {
    const req = { body, user, query };
    const res = {
      statusCode: 200,
      body: undefined,
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
  sendResetEmail = vi.fn().mockResolvedValue(undefined);
  mockClient = {
    query: vi.fn(async (sql, params) => {
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
      if (typeof sql === 'string' && sql.includes('SELECT token_hash, user_id, expires_at, used FROM public.password_reset_token')) {
        return {
          rows: [
            {
              token_hash: params[0],
              user_id: '99',
              expires_at: new Date(Date.now() + 3600000),
              used: false,
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
      body: { firstName: 'Jane', lastName: 'Doe', email: 'duplicate@hope.inc', password: 'ValidPassword123!' },
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
    const lookup = mockClient.query.mock.calls.find(([sql]) => sql.startsWith('SELECT token_hash'));
    expect(lookup[0]).toContain("created_at > now() - interval '15 minutes'");
    expect(lookup[1]).toEqual([expect.stringMatching(/^email:[a-f0-9]{64}$/)]);
  });

  it('rejects expired or non-existent token with 400', async () => {
    mockClient.query = vi.fn(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT token_hash, user_id, expires_at, used FROM public.password_reset_token')) {
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
