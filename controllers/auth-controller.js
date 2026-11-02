const crypto = require('crypto');
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
  const { firstName, lastName, email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const trimmedFirst = String(firstName || '').trim();
  const trimmedLast = String(lastName || '').trim();

  if (!trimmedFirst || !trimmedLast || !EMAIL_PATTERN.test(normalizedEmail)) {
    throw requestError('firstName, lastName, and email are required', 400);
  }

  const rawPassword = typeof password === 'string' ? password : '';
  if (rawPassword && rawPassword.length < 8) {
    throw requestError('password must be at least 8 characters', 400);
  }

  const pool = requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const emailCheck = await client.query(
      'SELECT user_id FROM public.app_user WHERE lower(email) = $1 LIMIT 1',
      [normalizedEmail]
    );
    if (emailCheck.rows[0]) {
      throw requestError('A user with that email already exists', 409);
    }

    const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 12) : null;
    const role = 'employee';
    const status = 'active';

    let targetEmpno = null;
    try {
      const nextNo = await client.query(
        "SELECT lpad((COALESCE(MAX(empno::integer), 0) + 1)::text, 5, '0') AS empno FROM public.employee WHERE empno ~ '^[0-9]{1,5}$'"
      );
      targetEmpno = nextNo.rows[0]?.empno || '00001';

      await client.query(
        "INSERT INTO public.employee (empno, firstname, lastname, email, hiredate, is_deleted, stamp) VALUES ($1, $2, $3, $4, CURRENT_DATE, false, 'ADD self-register ' || to_char(now(), 'YYYY-MM-DD HH12:MI AM'))",
        [targetEmpno, trimmedFirst, trimmedLast, normalizedEmail]
      );
    } catch {
      // Ignore if employee table setup is standalone
    }

    const insertResult = await client.query(
      'INSERT INTO public.app_user (empno, email, password_hash, status, role, is_blocked, must_change_password, stamp) VALUES ($1, $2, $3, $4, $5, false, false, \'ADD self-register \' || to_char(now(), \'YYYY-MM-DD HH12:MI AM\')) RETURNING user_id, empno, email, role, status, is_blocked AS "isBlocked", must_change_password AS "mustChangePassword"',
      [targetEmpno, normalizedEmail, passwordHash, status, role]
    );
    const user = insertResult.rows[0];

    const defaultRights = ['customers.access', 'products.access', 'hr.access', 'sales.access'];
    try {
      for (const right of defaultRights) {
        await client.query(
          'INSERT INTO public.app_user_right (user_id, right_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [user.user_id, right]
        );
      }
    } catch {}

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        message: 'Account created successfully',
        user: {
          userId: user.user_id,
          empno: user.empno,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          name: `${trimmedFirst} ${trimmedLast}`.trim(),
          email: user.email,
          role: user.role,
          status: user.status,
          isBlocked: false,
          mustChangePassword: false,
          rights: defaultRights
        }
      }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw requestError('A valid email is required', 400);
  }

  const pool = requirePool();
  let user = null;
  try {
    const result = await pool.query(
      'SELECT user_id, email, status, is_blocked FROM public.app_user WHERE lower(email) = $1 LIMIT 1',
      [normalizedEmail]
    );
    user = result.rows[0] || null;
  } catch {
    throw requestError('Authentication service unavailable', 503);
  }

  if (!user || user.status !== 'active' || user.is_blocked) {
    return res.json({
      success: true,
      data: { message: 'If an active account exists with that email, a password reset link has been sent.' }
    });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  try {
    await pool.query(
      'INSERT INTO public.password_reset_token (token_hash, user_id, expires_at, used) VALUES ($1, $2, $3, false)',
      [tokenHash, user.user_id, expiresAt]
    );
  } catch {
    try {
      await pool.query(
        'INSERT INTO public.password_reset_token (token_hash, user_id, expires_at, used) VALUES ($1, $2, $3, false)',
        [rawToken, user.user_id, expiresAt]
      );
    } catch {}
  }

  res.json({
    success: true,
    data: {
      message: 'Password reset link generated successfully.',
      token: rawToken
    }
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, newPassword } = req.body || {};
  const rawToken = String(token || '').trim();
  const requestedPassword = typeof newPassword === 'string' ? newPassword : (typeof password === 'string' ? password : '');

  if (!rawToken) {
    throw requestError('Reset token is required', 400);
  }

  if (requestedPassword.length < 8) {
    throw requestError('Password must be at least 8 characters', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const pool = requirePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      'SELECT token_hash, user_id, expires_at, used FROM public.password_reset_token WHERE (token_hash = $1 OR token_hash = $2) AND used = false AND expires_at > now() FOR UPDATE LIMIT 1',
      [tokenHash, rawToken]
    );

    const resetRecord = tokenResult.rows[0];
    if (!resetRecord) {
      throw requestError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(requestedPassword, 12);

    await client.query(
      'UPDATE public.app_user SET password_hash = $2, must_change_password = false, updated_at = now() WHERE user_id = $1',
      [resetRecord.user_id, passwordHash]
    );

    await client.query(
      'UPDATE public.password_reset_token SET used = true WHERE token_hash = $1',
      [resetRecord.token_hash]
    );

    await client.query('COMMIT');
    invalidateUserCache(resetRecord.user_id);

    res.json({
      success: true,
      data: { message: 'Password has been reset successfully. You can now log in.' }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
      'SELECT password_hash, is_blocked FROM public.app_user WHERE user_id = $1::uuid AND status = \'active\' LIMIT 1',
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
      'UPDATE public.app_user SET password_hash = $2, must_change_password = false, updated_at = now() WHERE user_id = $1::uuid',
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
  changePassword,
  forgotPassword,
  resetPassword
};
