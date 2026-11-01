import { expect, test, vi } from 'vitest';
import { sanitize, requestLogger } from './logger.js';

test('sanitize masks sensitive keys like password, token, and salary', () => {
  const payload = {
    username: 'admin',
    password: 'secretPassword123',
    nested: {
      salary: 50000,
      token: 'jwt-token-string',
      role: 'manager'
    },
    list: [
      { id: 1, currentPassword: 'old' },
      { id: 2, status: 'active' }
    ]
  };

  const clean = sanitize(payload);
  expect(clean.username).toBe('admin');
  expect(clean.password).toBe('[REDACTED]');
  expect(clean.nested.salary).toBe('[REDACTED]');
  expect(clean.nested.token).toBe('[REDACTED]');
  expect(clean.nested.role).toBe('manager');
  expect(clean.list[0].currentPassword).toBe('[REDACTED]');
  expect(clean.list[1].status).toBe('active');
});

test('requestLogger formats log output when not in test environment', () => {
  const prevVitest = process.env.VITEST;
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.VITEST = '';
  process.env.NODE_ENV = 'production';

  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  try {
    const listeners = {};
    const req = {
      method: 'GET',
      originalUrl: '/api/customers',
      ip: '192.168.1.100',
      user: { email: 'test@hope.inc' }
    };
    const res = {
      statusCode: 200,
      on: vi.fn((event, cb) => { listeners[event] = cb; })
    };
    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();

    listeners['finish']();
    expect(logSpy).toHaveBeenCalled();
    const logged = logSpy.mock.calls[0][0];
    expect(logged).toContain('[INFO]');
    expect(logged).toContain('GET /api/customers 200');
    expect(logged).toContain('ip: 192.168.1.100');
    expect(logged).toContain('user: test@hope.inc');
  } finally {
    logSpy.mockRestore();
    process.env.VITEST = prevVitest;
    process.env.NODE_ENV = prevNodeEnv;
  }
});
