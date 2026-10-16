const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

  let user;
  try {
    user = await req.withAuditContext(normalizedEmail, async (client) => {
      const result = await client.query(
        `INSERT INTO public.app_user (first_name, last_name, email, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, first_name, last_name, email, status, role, is_deleted`,
        [String(firstName).trim(), String(lastName).trim(), normalizedEmail]
      );

      return result.rows[0];
    });
  } catch (error) {
    if (error.code === '23505') {
      throw requestError('A user with that email already exists', 409);
    }
    throw error;
  }

  res.status(201).json({ success: true, data: { user } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || typeof password !== 'string' || password.length === 0) {
    throw requestError('email and password are required', 400);
  }

  const user = await req.withAuditContext(normalizedEmail, async (client) => {
    const result = await client.query(
      `SELECT id, email, password_hash, role, status
       FROM public.app_user
       WHERE lower(email) = $1
         AND is_deleted = false
       LIMIT 1`,
      [normalizedEmail]
    );

    const candidate = result.rows[0];
    if (!candidate || typeof candidate.password_hash !== 'string') {
      return null;
    }

    return (await bcrypt.compare(password, candidate.password_hash)) ? candidate : null;
  });

  if (!user) {
    throw requestError('Invalid email or password', 401);
  }

  const token = jwt.sign(
    { sub: String(user.id), role: user.role },
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
      user: { id: user.id, email: user.email, role: user.role, status: user.status }
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
