const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabase, authSupabase, requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const configuredResetTokenTtl = Number.parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '30', 10);
const RESET_TOKEN_TTL_MINUTES = Number.isInteger(configuredResetTokenTtl) && configuredResetTokenTtl > 0
  ? configuredResetTokenTtl
  : 30;
const PASSWORD_MIN_LENGTH = 8;
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

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw requestError(`password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400);
  }
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function shouldReturnResetToken() {
  return process.env.NODE_ENV !== 'production' && process.env.RETURN_RESET_TOKEN === 'true';
}

async function fetchUserRights(userId) {
  if (!authSupabase || !userId) return [];
  const { data, error } = await authSupabase
    .from('app_user_right')
    .select('right_code')
    .eq('user_id', userId);
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => row.right_code).filter(Boolean);
}

async function fetchEmployeeProfile(userId) {
  try {
    const result = await requirePool().query(
      `SELECT COALESCE(e.firstname, '') AS "firstName",
              COALESCE(e.lastname, '') AS "lastName",
              TRIM(concat_ws(' ', e.firstname, e.lastname)) AS name,
              j.jobdesc AS "jobTitle",
              d.deptname AS "departmentName"
       FROM public.app_user u
       LEFT JOIN public.employee e ON e.empno = u.empno
       LEFT JOIN LATERAL (
         SELECT jobcode, deptcode
         FROM public.jobhistory jh
         WHERE jh.empno = u.empno AND jh.is_deleted = false
         ORDER BY effdate DESC, jobcode DESC
         LIMIT 1
       ) lj ON true
       LEFT JOIN public.job j ON j.jobcode = lj.jobcode
       LEFT JOIN public.department d ON d.deptcode = lj.deptcode
       WHERE u.user_id = $1::uuid
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] || {};
  } catch {
    return {};
  }
}

async function buildAuthUser(user) {
  const [rights, profile] = await Promise.all([
    fetchUserRights(user.user_id),
    fetchEmployeeProfile(user.user_id),
  ]);

  return {
    userId: user.user_id,
    empno: user.empno,
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    name: profile.name || '',
    email: user.email,
    role: user.role,
    status: user.status,
    isBlocked: Boolean(user.is_blocked),
    mustChangePassword: user.must_change_password,
    jobTitle: profile.jobTitle || null,
    departmentName: profile.departmentName || null,
    rights,
  };
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

const setPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw requestError('A valid email is required', 400);
  }
  validatePassword(password);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await req.withAuditContext(normalizedEmail, async (client) => {
    const result = await client.query(
      `UPDATE public.app_user
       SET password_hash = $1,
           status = 'active',
           must_change_password = false,
           updated_at = now()
       WHERE lower(email) = $2
         AND must_change_password = true
       RETURNING user_id, email, status, role, must_change_password`,
      [passwordHash, normalizedEmail]
    );

    return result.rows[0] || null;
  });

  if (!user) {
    throw requestError('Password cannot be set for this account', 400);
  }

  res.json({ success: true, data: { user } });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw requestError('A valid email is required', 400);
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(resetToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  const created = await req.withAuditContext(normalizedEmail, async (client) => {
    const userResult = await client.query(
      `SELECT user_id
       FROM public.app_user
       WHERE lower(email) = $1
       LIMIT 1`,
      [normalizedEmail]
    );
    const user = userResult.rows[0];

    if (!user) {
      return false;
    }

    await client.query(
      `UPDATE public.password_reset_token
       SET used = true
       WHERE user_id = $1
         AND used = false`,
      [user.user_id]
    );
    await client.query(
      `INSERT INTO public.password_reset_token (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, user.user_id, expiresAt]
    );
    return true;
  });

  const response = {
    message: 'If an account exists for that email, a password reset link has been created'
  };
  if (created && shouldReturnResetToken()) {
    response.resetToken = resetToken;
    response.expiresAt = expiresAt.toISOString();
  }

  res.json({ success: true, data: response });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};

  if (typeof token !== 'string' || token.length < 32) {
    throw requestError('A valid reset token is required', 400);
  }
  validatePassword(password);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await req.withAuditContext('password-reset', async (client) => {
    const tokenResult = await client.query(
      `SELECT user_id
       FROM public.password_reset_token
       WHERE token_hash = $1
         AND used = false
         AND expires_at > now()
       FOR UPDATE`,
      [hashResetToken(token)]
    );
    const resetRecord = tokenResult.rows[0];

    if (!resetRecord) {
      return null;
    }

    const userResult = await client.query(
      `UPDATE public.app_user
       SET password_hash = $1,
           status = 'active',
           must_change_password = false,
           updated_at = now()
       WHERE user_id = $2
       RETURNING user_id, email, status, role, must_change_password`,
      [passwordHash, resetRecord.user_id]
    );

    if (!userResult.rows[0]) {
      return null;
    }

    await client.query(
      `UPDATE public.password_reset_token
       SET used = true
       WHERE token_hash = $1`,
      [hashResetToken(token)]
    );

    return userResult.rows[0];
  });

  if (!user) {
    throw requestError('Invalid or expired reset token', 400);
  }

  res.json({ success: true, data: { user } });
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
    .select('user_id, empno, email, password_hash, role, status, is_blocked, must_change_password')
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

  if (user.is_blocked) {
    throw requestError('Your account has been blocked. Contact an administrator.', 403);
  }

  const token = jwt.sign(
    { sub: String(user.user_id), empno: user.empno, email: user.email, role: user.role },
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
      user: await buildAuthUser(user)
    }
  });
});

const session = asyncHandler(async (req, res) => {
  if (!authSupabase) {
    throw requestError('Authentication service unavailable', 503);
  }

  const { data: user, error } = await authSupabase
    .from('app_user')
    .select('user_id, empno, email, role, status, is_blocked, must_change_password')
    .eq('user_id', req.user.sub)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw requestError('Authentication service unavailable', 503);
  }
  if (!user || user.is_blocked) {
    throw requestError('Authentication required', 401);
  }

  res.json({
    success: true,
    data: {
      user: await buildAuthUser(user)
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

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw requestError('currentPassword and newPassword are required', 400);
  }

  if (newPassword.length < 8) {
    throw requestError('New password must be at least 8 characters', 400);
  }

  if (currentPassword === newPassword) {
    throw requestError('New password must be different from the current password', 400);
  }

  if (!authSupabase) {
    throw requestError('SUPABASE_SERVICE_ROLE_KEY must be configured on the server', 503);
  }

  const { data: user, error: readError } = await authSupabase
    .from('app_user')
    .select('password_hash, is_blocked')
    .eq('user_id', req.user.sub)
    .eq('status', 'active')
    .maybeSingle();

  if (readError || !user) {
    throw requestError('Authentication service unavailable', 503);
  }

  if (user.is_blocked) {
    throw requestError('Your account has been blocked. Contact an administrator.', 403);
  }

  if (!await bcrypt.compare(currentPassword, user.password_hash)) {
    throw requestError('Current password is incorrect', 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { error: updateError } = await authSupabase
    .from('app_user')
    .update({
      password_hash: passwordHash,
      must_change_password: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', req.user.sub);

  if (updateError) {
    throw requestError('Unable to update password', 503);
  }

  res.json({ success: true, data: { message: 'Password updated successfully' } });
});

module.exports = {
  register,
  setPassword,
  forgotPassword,
  resetPassword,
  login,
  session,
  logout,
  changePassword
};
