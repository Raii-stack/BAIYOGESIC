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

describe('Security Headers & Cookie Hardening ([S2-DSO-03])', () => {
  describe('Helmet HTTP Headers', () => {
    it('enforces X-Content-Type-Options: nosniff', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('enforces X-Frame-Options: DENY', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('enforces Referrer-Policy: strict-origin-when-cross-origin', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('removes or suppresses X-Powered-By header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('API Cache Headers', () => {
    it('sets strict Cache-Control headers on /api/* routes', async () => {
      const res = await request(app).get('/api/health');
      const cacheControl = res.headers['cache-control'];
      expect(cacheControl).toContain('no-store');
      expect(cacheControl).toContain('no-cache');
      expect(cacheControl).toContain('must-revalidate');
      expect(cacheControl).toContain('proxy-revalidate');
    });

    it('sets Pragma: no-cache and Expires: 0 on /api/* routes', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['pragma']).toBe('no-cache');
      expect(res.headers['expires']).toBe('0');
    });
  });

  describe('CORS Restrictions', () => {
    it('allows configured origin and enables credentials', async () => {
      const origin = 'http://localhost:5173';
      const res = await request(app)
        .get('/api/health')
        .set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('handles OPTIONS preflight request with appropriate CORS headers', async () => {
      const origin = 'http://localhost:5173';
      const res = await request(app)
        .options('/api/health')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Authentication Cookie Hardening', () => {
    it('verifies login cookie configuration sets httpOnly, sameSite lax, and path /', async () => {
      const mockUser = {
        user_id: '11111111-1111-1111-1111-111111111111',
        empno: '00001',
        email: 'test@hope.corp',
        password_hash: '$2b$10$abcdefghijklmnopqrstuvwxyz01234567890123456789012345',
        role: 'Employee',
        status: 'active',
        is_blocked: false,
        must_change_password: false,
        firstName: 'Test',
        lastName: 'User',
        name: 'Test User',
        jobTitle: 'Developer',
        departmentName: 'IT',
        rights: []
      };

      const bcrypt = require('bcrypt');
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'http://localhost:5173')
        .send({
          email: 'test@hope.corp',
          password: 'Password123!'
        });

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
      expect(cookieStr).toContain('access_token=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(cookieStr.toLowerCase()).toContain('path=/');

      compareSpy.mockRestore();
    });

    it('verifies logout clears the session cookie with matching security flags', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { sub: '11111111-1111-1111-1111-111111111111', role: 'Employee' },
        process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required',
        { algorithm: 'HS256' }
      );

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', `access_token=${token}`);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
      expect(cookieStr).toContain('access_token=;');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(cookieStr.toLowerCase()).toContain('path=/');
    });
  });
});
