const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { supabase, requirePool } = require('../db');
const { primeUserCache, invalidateUserCache } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error-handler');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_SELECT = `
  SELECT u.user_id, u.empno, u.email, u.password_hash, u.role, u.status, u.is_blocked, u.must_change_password,
         COALESCE(e.firstname, '') AS "firstName",
         COALESCE(e.lastname, '') AS "lastName",
         TRIM(concat_ws(' ', e.firstname, e.lastname)) AS name,
         j.jobdesc AS "jobTitle",
         d.deptname AS "departmentName",
         COALESCE(
           ARRAY(
             SELECT ur.right_code
             FROM public.app_user_right ur
             WHERE ur.user_id = u.user_id AND ur.right_code IS NOT NULL
           ),
           '{}'
         ) AS rights
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
`;

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

function formatAuthUser(user) {
  return {
    userId: user.user_id,
    empno: user.empno,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    name: user.name || '',
    email: user.email,
    role: user.role,
    status: user.status,
    isBlocked: Boolean(user.is_blocked),
    mustChangePassword: user.must_change_password,
    jobTitle: user.jobTitle || null,
    departmentName: user.departmentName || null,
    rights: Array.isArray(user.rights) ? user.rights : [],
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

  invalidateUserCache(user.user_id);
  res.json({ success: true, data: { user } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || typeof password !== 'string' || password.length === 0) {
    throw requestError('email and password are required', 400);
  }

  let candidate = null;
  try {
    const result = await requirePool().query(
      `${AUTH_SELECT} WHERE lower(u.email) = $1 AND u.status = 'active' LIMIT 1`,
      [normalizedEmail]
    );
    candidate = result.rows[0] || null;
  } catch {
    throw requestError('Authentication service unavailable', 503);
  }

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

  primeUserCache(user);

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
      user: formatAuthUser(user)
    }
  });
});

const session = asyncHandler(async (req, res) => {
  let user = null;
  try {
    const result = await requirePool().query(
      `${AUTH_SELECT} WHERE u.user_id = $1::uuid AND u.status = 'active' LIMIT 1`,
      [req.user.sub]
    );
    user = result.rows[0] || null;
  } catch {
    throw requestError('Authentication service unavailable', 503);
  }

  if (!user || user.is_blocked) {
    throw requestError('Authentication required', 401);
  }

  primeUserCache(user);

  res.json({
    success: true,
    data: {
      user: formatAuthUser(user)
    }
  });
});

const logout = asyncHandler(async (req, res) => {
  if (req.user && req.user.sub) invalidateUserCache(req.user.sub);
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

  let user = null;
  try {
    const result = await requirePool().query(
      `SELECT password_hash, is_blocked FROM public.app_user WHERE user_id = $1::uuid AND status = 'active' LIMIT 1`,
      [req.user.sub]
    );
    user = result.rows[0] || null;
  } catch {
    throw requestError('Authentication service unavailable', 503);
  }

  if (!user) {
    throw requestError('Authentication service unavailable', 503);
  }

  if (user.is_blocked) {
    throw requestError('Your account has been blocked. Contact an administrator.', 403);
  }

  if (!await bcrypt.compare(currentPassword, user.password_hash)) {
    throw requestError('Current password is incorrect', 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  try {
    await requirePool().query(
      `UPDATE public.app_user
       SET password_hash = $2,
           must_change_password = false,
           updated_at = now()
       WHERE user_id = $1::uuid`,
      [req.user.sub, passwordHash]
    );
  } catch {
    throw requestError('Unable to update password', 503);
  }

  invalidateUserCache(req.user.sub);
  res.json({ success: true, data: { message: 'Password updated successfully' } });
});

module.exports = {
  register,
  setPassword,
  login,
  session,
  logout,
  changePassword
};
