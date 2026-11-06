import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import http from 'node:http';

// Mock DB before loading server to avoid needing real database connection in CI / local tests
const mockPool = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  connect: vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn()
  })
};

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: {
    requirePool: () => mockPool,
    supabase: {
      from: () => ({
        select: () => ({
          limit: () => Promise.resolve({ error: null })
        })
      })
    }
  }
};

const app = require('../../server');

describe('Security Headers & Cookie Hardening ([S2-DSO-03])', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Helmet HTTP Headers', () => {
    it('enforces X-Content-Type-Options: nosniff', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('enforces X-Frame-Options: DENY', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('x-frame-options')).toBe('DENY');
    });

    it('enforces Referrer-Policy: strict-origin-when-cross-origin', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    });

    it('removes or suppresses X-Powered-By header', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('x-powered-by')).toBeNull();
    });
  });

  describe('API Cache Headers', () => {
    it('sets strict Cache-Control headers on /api/* routes', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      const cacheControl = res.headers.get('cache-control');
      expect(cacheControl).toContain('no-store');
      expect(cacheControl).toContain('no-cache');
      expect(cacheControl).toContain('must-revalidate');
      expect(cacheControl).toContain('proxy-revalidate');
    });

    it('sets Pragma: no-cache and Expires: 0 on /api/* routes', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.headers.get('pragma')).toBe('no-cache');
      expect(res.headers.get('expires')).toBe('0');
    });
  });

  describe('CORS Restrictions', () => {
    it('allows configured origin and enables credentials', async () => {
      const origin = 'http://localhost:5173';
      const res = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: origin }
      });
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('handles OPTIONS preflight request with appropriate CORS headers', async () => {
      const origin = 'http://localhost:5173';
      const res = await fetch(`${baseUrl}/api/health`, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'GET'
        }
      });
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    });
  });

  describe('Authentication Cookie Hardening', () => {
    it('verifies login cookie configuration sets httpOnly, sameSite lax, and path /', async () => {
      // Mock user row in requirePool query for login handler
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

      // Mock bcrypt.compare to return true
      const bcrypt = require('bcrypt');
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      mockPool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173'
        },
        body: JSON.stringify({
          email: 'test@hope.corp',
          password: 'Password123!'
        })
      });

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('access_token=');
      expect(setCookie.toLowerCase()).toContain('httponly');
      expect(setCookie.toLowerCase()).toContain('samesite=lax');
      expect(setCookie.toLowerCase()).toContain('path=/');

      compareSpy.mockRestore();
    });

    it('verifies logout clears the session cookie with matching security flags', async () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { sub: '11111111-1111-1111-1111-111111111111', role: 'Employee' },
        process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required',
        { algorithm: 'HS256' }
      );

      const res = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `access_token=${token}`,
          Origin: 'http://localhost:5173'
        }
      });

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('access_token=;');
      expect(setCookie.toLowerCase()).toContain('httponly');
      expect(setCookie.toLowerCase()).toContain('samesite=lax');
      expect(setCookie.toLowerCase()).toContain('path=/');
    });
  });
});
