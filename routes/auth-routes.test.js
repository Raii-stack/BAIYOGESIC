import { expect, test } from 'vitest';
import authRoutes from './auth-routes.js';
import * as authController from '../controllers/auth-controller.js';

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
