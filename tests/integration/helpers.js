require('dotenv').config({ path: '.env.test', quiet: true });
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const { QA_USERS, QA_PASSWORD } = require('./setup/qa-users');

for (const name of ['API_BASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[name]) throw new Error(`Missing ${name} in .env.test`);
}

const api = request(process.env.API_BASE_URL);
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROUTES = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  changePassword: '/api/auth/change-password',
  protected: '', // TODO: a real route that needs a fully set-up user. Leave blank to skip that test.
};

const asLogin = (u) => ({ email: u.email, password: QA_PASSWORD });

const USERS = {
  active: asLogin(QA_USERS.standard),
  admin: asLogin(QA_USERS.admin),
  superadmin: asLogin(QA_USERS.superadmin),
  firstLogin: asLogin(QA_USERS.firstLogin),
  pwChange: asLogin(QA_USERS.pwChange),
  deleted: asLogin(QA_USERS.pending), // a non-active (pending) account must not be able to log in
};

const hasUser = (u) => Boolean(u.email && u.password);

// Logs in and returns the response plus the cookies to reuse on later requests
async function loginAs(user) {
  const res = await api.post(ROUTES.login).send(user);
  return { res, cookies: res.headers['set-cookie'] || [] };
}

module.exports = { api, db, ROUTES, USERS, hasUser, loginAs };