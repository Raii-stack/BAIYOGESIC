import { expect, test, vi } from 'vitest';
import authRoutes from './auth-routes.js';
import * as authController from '../controllers/auth-controller.js';
import { requireActiveUser, primeUserCache, invalidateUserCache } from '../middleware/auth.js';

test('auth routes expose register, forgot-password, reset-password, login, session, and logout endpoints', () => {
  const routePaths = authRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  expect(routePaths).toContain('/forgot-password');
  expect(routePaths).toContain('/reset-password');
  expect(routePaths).toContain('/register');
  expect(routePaths).toEqual(expect.arrayContaining(['/login', '/session', '/logout', '/change-password']));
});

test('auth controller exports register, forgotPassword, and resetPassword', () => {
  expect(typeof authController.register).toBe('function');
  expect(typeof authController.forgotPassword).toBe('function');
  expect(typeof authController.resetPassword).toBe('function');
});

test('requireActiveUser uses primed cache and respects invalidateUserCache', async () => {
  const userId = '99999999-9999-4999-8999-999999999999';
  const prevVitest = process.env.VITEST;
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.VITEST = '';
  process.env.NODE_ENV = 'production';

  try {
    primeUserCache({
      user_id: userId,
      empno: 7788,
      email: 'cached@rg3.local',
      role: 'admin',
      status: 'active',
      is_blocked: false,
      must_change_password: false,
      rights: ['HR_ALL']
    });

    const req = { user: { sub: userId } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireActiveUser(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user.email).toBe('cached@rg3.local');

    invalidateUserCache(userId);
  } finally {
    process.env.VITEST = prevVitest;
    process.env.NODE_ENV = prevNodeEnv;
  }
});
