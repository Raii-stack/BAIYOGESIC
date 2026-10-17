const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { supabase, authSupabase } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw requestError('JWT_SECRET must be configured', 503);
  }

  return process.env.JWT_SECRET;
}

const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!String(firstName || '').trim() || !String(lastName || '').trim() || !EMAIL_PATTERN.test(normalizedEmail)) {
    throw requestError('firstName, lastName, and email are required', 400);
  }

  const { data: user, error } = await supabase
    .from('app_user')
    .select('user_id, email, status, role')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    const databaseError = new Error(
      error.code === '42501'
        ? 'Server authentication credentials are not authorized to read app_user'
        : 'Authentication service unavailable'
    );
    databaseError.statusCode = 503;
    throw databaseError;
  }

  if (user) {
    throw requestError('A user with that email already exists', 409);
  }

  res.status(201).json({ success: true, data: { user } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || typeof password !== 'string' || password.length === 0) {
    throw requestError('email and password are required', 400);
  }

  if (!authSupabase) {
    throw requestError('SUPABASE_SERVICE_ROLE_KEY must be configured on the server', 503);
  }

  const { data: candidates, error } = await authSupabase
    .from('app_user')
    .select('user_id, empno, email, password_hash, role, status')
    .eq('email', normalizedEmail)
    .eq('status', 'active')
    .limit(1);

  if (error) {
    const databaseError = new Error('Authentication service unavailable');
    databaseError.statusCode = 503;
    throw databaseError;
  }

  const candidate = candidates && candidates[0];
  const user = candidate && typeof candidate.password_hash === 'string'
    && await bcrypt.compare(password, candidate.password_hash)
    ? candidate
    : null;

  if (!user) {
    throw requestError('Invalid email or password', 401);
  }

  const token = jwt.sign(
    { sub: String(user.user_id), empno: user.empno, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
  );

  res.cookie('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000,
    path: '/'
  });

  res.json({
    success: true,
    data: {
      user: {
        userId: user.user_id,
        empno: user.empno,
        email: user.email,
        role: user.role,
        status: user.status
      }
    }
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  res.json({ success: true, data: { message: 'Logged out successfully' } });
});

module.exports = { register, login, logout };
