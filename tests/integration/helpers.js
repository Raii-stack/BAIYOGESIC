require('dotenv').config({ path: '.env.test', quiet: true });
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');

for (const name of ['API_BASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[name]) throw new Error(`Missing ${name} in .env.test`);
}

const api = request(process.env.API_BASE_URL);
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROUTES = {
  register: '/api/auth/register',
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  changePassword: '/api/auth/change-password',
  protected: '', // TODO: a real route that needs a fully set-up user (from routes/). Leave blank to skip that test.
};

const USERS = {
  active: {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
  },
  firstLogin: {
    email: process.env.FIRST_LOGIN_EMAIL,
    password: process.env.FIRST_LOGIN_PASSWORD,
  },
  deleted: {
    email: process.env.DELETED_USER_EMAIL,
    password: process.env.DELETED_USER_PASSWORD,
  },
};

const hasUser = (u) => Boolean(u.email && u.password);

// Logs in and returns the response plus the cookies to reuse on later requests
async function loginAs(user) {
  const res = await api.post(ROUTES.login).send(user);
  return { res, cookies: res.headers['set-cookie'] || [] };
}

module.exports = { api, db, ROUTES, USERS, hasUser, loginAs };