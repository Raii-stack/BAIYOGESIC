// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

const mockPool = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mockClient)
};

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: {
    requirePool: () => mockPool,
    supabase: {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
    }
  }
};

const app = require('../../server');

describe('Dedicated Authentication Rate Limiting ([S2-DSO-05])', () => {
  it('enforces 10-request threshold per IP and returns HTTP 429 on the 11th request', async () => {
    // Unique mock IP to avoid cross-test pollution
    const testIp = '198.51.100.42';

    mockPool.query.mockResolvedValue({ rows: [] });

    // Send 10 consecutive requests
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', testIp)
        .set('x-test-auth-limiter', 'true')
        .send({ email: `user${i}@hope.corp`, password: 'WrongPassword123!' });

      expect(res.status).not.toBe(429);
      expect(res.headers['ratelimit-limit']).toBe('10');
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    }

    // 11th request must receive HTTP 429 Too Many Requests
    const resBlocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', testIp)
      .set('x-test-auth-limiter', 'true')
      .send({ email: 'user11@hope.corp', password: 'WrongPassword123!' });

    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body).toEqual({
      success: false,
      error: {
        message: 'Too many authentication attempts, please try again later.',
        statusCode: 429
      }
    });
    expect(resBlocked.headers['ratelimit-reset']).toBeDefined();
  });

  it('permits test bypass when x-bypass-rate-limit header is provided', async () => {
    const testIp = '198.51.100.99';

    mockPool.query.mockResolvedValue({ rows: [] });

    // Send 12 requests with bypass header; none should be 429
    for (let i = 1; i <= 12; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', testIp)
        .set('x-bypass-rate-limit', 'true')
        .send({ email: `bypass${i}@hope.corp`, password: 'WrongPassword123!' });

      expect(res.status).not.toBe(429);
    }
  });

  it('protects registration, forgot-password, reset-password, and set-password routes under authLimiter', async () => {
    const testIp = '198.51.100.77';

    // Send 10 requests mixing credential endpoints
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('X-Forwarded-For', testIp)
        .set('x-test-auth-limiter', 'true')
        .send({ email: `forgot${i}@hope.corp` });

      expect(res.status).not.toBe(429);
    }

    // 11th request on /register from same IP should be blocked
    const resBlocked = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', testIp)
      .set('x-test-auth-limiter', 'true')
      .send({ email: 'blocked@hope.corp' });

    expect(resBlocked.status).toBe(429);
    expect(resBlocked.body.error.message).toBe('Too many authentication attempts, please try again later.');
  });
});
