import { expect, test, vi } from 'vitest';
import authRoutes from './auth-routes.js';
import * as authController from '../controllers/auth-controller.js';
import { requireActiveUser, primeUserCache, invalidateUserCache } from '../middleware/auth.js';

test('auth routes do not expose removed forgot-password, reset-password, or register endpoints', () => {
  const routePaths = authRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  expect(routePaths).not.toContain('/forgot-password');
  expect(routePaths).not.toContain('/reset-password');
  expect(routePaths).not.toContain('/register');
  expect(routePaths).toEqual(expect.arrayContaining(['/login', '/session', '/logout', '/change-password']));
});

test('auth controller does not export forgotPassword or resetPassword', () => {
  expect(authController.forgotPassword).toBeUndefined();
  expect(authController.resetPassword).toBeUndefined();
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
