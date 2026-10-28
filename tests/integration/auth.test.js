const jwt = require('jsonwebtoken');
const { api, ROUTES, USERS, hasUser, loginAs } = require('./helpers');

const itIf = (condition) => (condition ? test : test.skip); // skips a test if its setup is missing

describe('Login', () => {
  itIf(hasUser(USERS.active))('TC-AUTH-03: valid login returns 200 and an HttpOnly cookie', async () => {
    const { res, cookies } = await loginAs(USERS.active);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookie = cookies.find((c) => c.startsWith('access_token='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash/); // never leak the hash
  });

  itIf(hasUser(USERS.active))('TC-AUTH-04: wrong password and unknown email give the same 401', async () => {
    const wrongPass = await api.post(ROUTES.login)
      .send({ email: USERS.active.email, password: 'wrong-password' });
    const unknown = await api.post(ROUTES.login)
      .send({ email: 'nobody@test.com', password: 'whatever' });
    expect(wrongPass.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPass.body).toEqual(unknown.body); // no account enumeration
  });

  test('TC-AUTH-04b: missing email or password returns 400', async () => {
    const res = await api.post(ROUTES.login).send({ email: 'x@test.com' });
    expect(res.status).toBe(400);
  });

  itIf(hasUser(USERS.deleted))('TC-AUTH-09: pending/inactive user cannot log in', async () => {
    const res = await api.post(ROUTES.login).send(USERS.deleted);
    expect(res.status).toBe(401);
  });
});

describe('Session token (JWT) validation', () => {
  const sessionCookie = (token) => [`access_token=${token}`];

  test('no cookie is rejected with 401', async () => {
    const res = await api.post(ROUTES.logout);
    expect(res.status).toBe(401);
  });

  test('TC-AUTH-07: token signed with the wrong secret (tampered) is rejected', async () => {
    const fake = jwt.sign({ sub: '1', role: 'superadmin' }, 'wrong-secret', { algorithm: 'HS256' });
    const res = await api.post(ROUTES.logout).set('Cookie', sessionCookie(fake));
    expect(res.status).toBe(401);
  });

  // Only meaningful with the real secret; otherwise it would be rejected for the wrong reason
  itIf(Boolean(process.env.JWT_SECRET))('TC-AUTH-05: expired token is rejected', async () => {
    const expired = jwt.sign({ sub: '1', role: 'user' }, process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: -10 });
    const res = await api.post(ROUTES.logout).set('Cookie', sessionCookie(expired));
    expect(res.status).toBe(401);
  });

  itIf(hasUser(USERS.active))('valid session can log out (sanity check)', async () => {
    const { cookies } = await loginAs(USERS.active);
    const res = await api.post(ROUTES.logout).set('Cookie', cookies);
    expect(res.status).toBe(200);
  });
});

describe('Change password and first-time setup', () => {
  test('change-password without a session returns 401', async () => {
    const res = await api.post(ROUTES.changePassword)
      .send({ currentPassword: 'a', newPassword: 'b-long-enough' });
    expect(res.status).toBe(401);
  });

  itIf(hasUser(USERS.active))('wrong current password returns 401', async () => {
    const { cookies } = await loginAs(USERS.active);
    const res = await api.post(ROUTES.changePassword).set('Cookie', cookies)
      .send({ currentPassword: 'definitely-wrong', newPassword: 'NewPass#12345' });
    expect(res.status).toBe(401);
  });

  itIf(hasUser(USERS.active))('new password under 8 characters returns 400', async () => {
    const { cookies } = await loginAs(USERS.active);
    const res = await api.post(ROUTES.changePassword).set('Cookie', cookies)
      .send({ currentPassword: USERS.active.password, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  itIf(hasUser(USERS.active))('new password equal to current returns 400', async () => {
    const { cookies } = await loginAs(USERS.active);
    const res = await api.post(ROUTES.changePassword).set('Cookie', cookies)
      .send({ currentPassword: USERS.active.password, newPassword: USERS.active.password });
    expect(res.status).toBe(400);
  });

  itIf(hasUser(USERS.pwChange))('valid change works, old password stops working, then restores', async () => {
    const NEW = 'Temp#Passw0rd-QA';
    const { cookies } = await loginAs(USERS.pwChange);
    try {
      const change = await api.post(ROUTES.changePassword).set('Cookie', cookies)
        .send({ currentPassword: USERS.pwChange.password, newPassword: NEW });
      expect(change.status).toBe(200);

      const oldLogin = await api.post(ROUTES.login).send(USERS.pwChange);
      expect(oldLogin.status).toBe(401);
    } finally {
      // Always put the original password back so other tests keep working
      await api.post(ROUTES.changePassword).set('Cookie', cookies)
        .send({ currentPassword: NEW, newPassword: USERS.pwChange.password });
    }
  });

  itIf(hasUser(USERS.firstLogin))('TC-AUTH-08a: first-login user is flagged mustChangePassword', async () => {
    const { res } = await loginAs(USERS.firstLogin);
    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(true);
  });

  itIf(hasUser(USERS.firstLogin) && Boolean(ROUTES.protected))(
    'TC-AUTH-08b: first-login user cannot use protected routes before changing password',
    async () => {
      const { cookies } = await loginAs(USERS.firstLogin);
      const res = await api.get(ROUTES.protected).set('Cookie', cookies);
      expect([401, 403]).toContain(res.status);
    }
  );
});

describe('Removed features stay removed', () => {
  test('post /api/auth/register is not exposed (404)', async () => {
    const res = await api.post('/api/auth/register').send({ email: 'x@test.com' });
    expect(res.status).toBe(404);
  });

  // BLOCKED: BUG-002. These endpoints still respond (200 / 400) after the feature was dropped.
  // Remove .skip when the routes are deleted, and the tests should pass.
  test.skip('post /api/auth/forgot-password is not exposed (404)', async () => {
    const res = await api.post('/api/auth/forgot-password').send({ email: 'x@test.com' });
    expect(res.status).toBe(404);
  });

  test.skip('post /api/auth/reset-password is not exposed (404)', async () => {
    const res = await api.post('/api/auth/reset-password').send({ email: 'x@test.com' });
    expect(res.status).toBe(404);
  });
});