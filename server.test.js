// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

let healthResult = { error: null };

require.cache[require.resolve('./db')] = {
  id: require.resolve('./db'),
  filename: require.resolve('./db'),
  loaded: true,
  exports: {
    requirePool: () => ({ query: vi.fn(), connect: vi.fn() }),
    supabase: {
      from: () => ({
        select: () => ({
          limit: async () => healthResult
        })
      })
    }
  }
};

const app = require('./server');

describe('server.js Express scaffold ([S1-DEV-01])', () => {
  beforeEach(() => {
    healthResult = { error: null };
  });

  test('GET /health and /api/health return 200 for healthy db or expected missing probe table codes', async () => {
    for (const err of [null, { code: '42P01' }, { code: 'PGRST205' }]) {
      healthResult = { error: err };
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { status: 'ok' } });

      const apiRes = await request(app).get('/api/health');
      expect(apiRes.status).toBe(200);
      expect(apiRes.body).toEqual({ success: true, data: { status: 'ok' } });
    }
  });

  test('GET /health returns 503 when database check returns an unexpected error', async () => {
    healthResult = { error: { code: '08006', message: 'connection refused' } };
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      error: {
        message: 'The service is temporarily unavailable. Please try again.',
        statusCode: 503
      }
    });
  });

  test('returns standardized 404 JSON error for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { message: 'Route not found', statusCode: 404 }
    });
  });

  test('mounts core ERP API routers behind authentication middleware', async () => {
    const protectedEndpoints = [
      '/api/customers',
      '/api/products',
      '/api/employees',
      '/api/departments',
      '/api/jobs',
      '/api/users',
      '/api/sales',
      '/api/dashboard/stats',
      '/api/reports/top-customers',
      '/api/audit-logs',
      '/api/me/preferences'
    ];

    for (const endpoint of protectedEndpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
      expect(res.headers['cache-control']).toContain('no-store');
    }
  });

  test('allows team Vercel preview CORS origin and blocks untrusted origins', async () => {
    const previewRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://baiyogesic-preview123.vercel.app');
    expect(previewRes.headers['access-control-allow-origin']).toBe('https://baiyogesic-preview123.vercel.app');

    const blockedRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://untrusted-origin.example.com');
    expect(blockedRes.headers['access-control-allow-origin']).toBeUndefined();
  });
});
