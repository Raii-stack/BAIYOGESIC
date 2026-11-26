// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
const { asyncHandler, errorHandler } = require('./error-handler');

function createRes(headersSent = false) {
  return {
    headersSent,
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; },
  };
}

describe('middleware/error-handler ([S3-DSO-05])', () => {
  test('masks 5xx internal errors and omits internal stack traces from responses', () => {
    const err = new Error('SELECT password_hash FROM public.app_user failed');
    err.statusCode = 500;
    const res = createRes();
    const next = vi.fn();

    errorHandler(err, { method: 'GET', originalUrl: '/api/employees' }, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({
      success: false,
      error: {
        message: 'The service is temporarily unavailable. Please try again.',
        statusCode: 500,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('sanitizes sensitive HR PII and auth fields inside err.details via logger.sanitize', () => {
    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.apiMessage = 'Invalid employee payload';
    err.details = {
      empno: '00001',
      Salary: 95000,
      BirthDate: '1991-02-03',
      password_hash: 'hash-secret',
      nested: { TOKEN: 'secret-jwt' },
    };
    const res = createRes();

    errorHandler(err, { method: 'POST', originalUrl: '/api/employees' }, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.payload.error.message).toBe('Invalid employee payload');
    expect(res.payload.error.details).toEqual({
      empno: '00001',
      Salary: '[REDACTED]',
      BirthDate: '[REDACTED]',
      password_hash: '[REDACTED]',
      nested: { TOKEN: '[REDACTED]' },
    });
  });

  test('delegates to Express default handler when headers were already sent', () => {
    const err = new Error('Stream interrupted');
    const res = createRes(true);
    const next = vi.fn();

    errorHandler(err, {}, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.payload).toBeNull();
  });

  test('asyncHandler forwards rejected promises to next', async () => {
    const boom = new Error('DB timeout');
    const wrapped = asyncHandler(async () => { throw boom; });
    const next = vi.fn();

    await wrapped({}, {}, next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
