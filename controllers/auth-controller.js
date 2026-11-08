const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { supabase, requirePool } = require('../db');
const { primeUserCache, invalidateUserCache } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error-handler');
const { endActivity } = require('./activity-controller');
const { passwordResetMailer, registrationCodeMailer } = require('../lib/password-reset-email');

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

function resetTokenHash(token) {
  // Older recovery tokens were exposed in API responses; accept only tokens from the email flow.
  return `email:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function registrationCodeHash(email, code) {
  return crypto.createHmac('sha256', getJwtSecret()).update(`registration:${email}:${code}`).digest('hex');
}

const sendRegistrationCode = asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_PATTERN.test(email) || /[<>,;:"()[\]\\]/.test(email)) {
    throw requestError('A valid email is required', 400);
  }

  const sendCode = registrationCodeMailer();
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  const codeHash = registrationCodeHash(email, code);
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT user_id FROM public.app_user WHERE lower(email) = $1 LIMIT 1', [email]);
    if (existing.rows.length) throw requestError('A user with that email already exists', 409);

    // One row per email serializes resends across server instances and keeps the hourly budget.
    const issued = await client.query(
      `INSERT INTO public.registration_email_verification AS verification (email, code_hash, expires_at)
       VALUES ($1, $2, now() + interval '10 minutes')
       ON CONFLICT (email) DO UPDATE SET
         code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, sent_at = now(), attempts = 0, used = false,
         window_started_at = CASE WHEN verification.window_started_at <= now() - interval '1 hour' THEN now() ELSE verification.window_started_at END,
         send_count = CASE WHEN verification.window_started_at <= now() - interval '1 hour' THEN 1 ELSE verification.send_count + 1 END
       WHERE verification.sent_at <= now() - interval '60 seconds'
         AND (verification.window_started_at <= now() - interval '1 hour' OR verification.send_count < 3)
       RETURNING expires_at, sent_at + interval '60 seconds' AS resend_at`,
      [email, codeHash]
    );
    if (!issued.rows.length) throw requestError('Please wait 60 seconds between codes. You can request up to 3 codes per hour.', 429);
    // shortcut: a failed commit can invalidate an emailed code; add an outbox if delivery guarantees are needed.
    await sendCode(email, code);
    await client.query('COMMIT');
    res.json({ success: true, data: { expiresAt: issued.rows[0].expires_at, resendAt: issued.rows[0].resend_at } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

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
  const { firstName, lastName, email, password, verificationCode } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const trimmedFirst = String(firstName || '').trim();
  const trimmedLast = String(lastName || '').trim();

  if (!trimmedFirst || !trimmedLast || normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    throw requestError('firstName, lastName, and email are required', 400);
  }

  const rawPassword = typeof password === 'string' ? password : '';
  validatePassword(rawPassword);
  if (typeof verificationCode !== 'string' || !/^\d{6}$/.test(verificationCode)) {
    throw requestError('Enter the 6-digit verification code sent to your email.', 400);
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

    const verification = await client.query(
      `SELECT code_hash, attempts, used, expires_at <= now() AS expired
       FROM public.registration_email_verification WHERE email = $1 FOR UPDATE`, [normalizedEmail]
    );
    const record = verification.rows[0];
    if (!record || record.used) throw requestError('Request a new email verification code before registering.', 400);
    if (record.expired) throw requestError('Your verification code has expired. Request a new code.', 400);
    if (record.attempts >= 5) throw requestError('Too many incorrect codes. Request a new code.', 400);
    const suppliedHash = registrationCodeHash(normalizedEmail, verificationCode);
    if (!crypto.timingSafeEqual(Buffer.from(record.code_hash, 'hex'), Buffer.from(suppliedHash, 'hex'))) {
      await client.query('UPDATE public.registration_email_verification SET attempts = attempts + 1 WHERE email = $1', [normalizedEmail]);
      // Failed attempts must survive the failed registration, including concurrent guesses.
      await client.query('COMMIT');
      return res.status(400).json({ success: false, error: { message: record.attempts === 4
        ? 'Too many incorrect codes. Request a new code.' : 'The verification code is incorrect. Please try again.' } });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const role = 'employee';
    const status = 'pending';

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

    await client.query('UPDATE public.registration_email_verification SET used = true WHERE email = $1', [normalizedEmail]);
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        message: 'Registration submitted. Your account is pending approval.',
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

  const sendResetEmail = passwordResetMailer();
  const message = 'If an active account exists with that email, a password reset link has been sent. The link expires in 15 minutes.';
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT user_id, email, status, is_blocked FROM public.app_user WHERE lower(email) = $1 LIMIT 1 FOR UPDATE',
      [normalizedEmail]
    );
    const user = result.rows[0];
    if (user?.status === 'active' && !user.is_blocked) {
      const existing = await client.query(
        "SELECT 1 FROM public.password_reset_token WHERE user_id = $1 AND token_hash LIKE 'email:%' AND NOT used AND expires_at > now() AND created_at > now() - interval '15 minutes' LIMIT 1", [user.user_id]
      );
      if (!existing.rows.length) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = resetTokenHash(rawToken);
        await client.query(
          "INSERT INTO public.password_reset_token (token_hash, user_id, expires_at, used) VALUES ($1, $2, now() + interval '15 minutes', false)",
          [tokenHash, user.user_id]
        );
        // shortcut: a failed commit can leave an unusable emailed link; add an outbox if delivery guarantees are needed.
        await sendResetEmail(user.email, rawToken);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, data: { message } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

async function findResetToken(client, rawToken, lock = false) {
  if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/.test(rawToken)) return null;
  const result = await client.query(
    `SELECT t.user_id, LEAST(t.expires_at, t.created_at + interval '15 minutes') AS expires_at,
       CASE WHEN t.used THEN 'used'
            WHEN t.expires_at <= now() OR t.created_at <= now() - interval '15 minutes' THEN 'expired'
            WHEN u.status != 'active' OR u.is_blocked THEN 'invalid'
            ELSE 'valid' END AS status
     FROM public.password_reset_token t JOIN public.app_user u ON u.user_id = t.user_id
     WHERE t.token_hash = $1 ${lock ? 'FOR UPDATE OF t' : ''}`, [resetTokenHash(rawToken)]
  );
  return result.rows[0] || null;
}

const validateResetToken = asyncHandler(async (req, res) => {
  const record = await findResetToken(requirePool(), req.body?.token);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { status: record?.status || 'invalid',
    ...(record?.status === 'valid' ? { expiresAt: record.expires_at } : {}) } });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password, newPassword } = req.body || {};
  const rawToken = String(token || '').trim();
  const requestedPassword = typeof newPassword === 'string' ? newPassword : (typeof password === 'string' ? password : '');

  if (!rawToken) {
    throw requestError('Reset token is required', 400);
  }
  if (!/^[a-f0-9]{64}$/.test(rawToken)) throw requestError('Invalid or expired reset token', 400);

  if (requestedPassword.length < 8) {
    throw requestError('Password must be at least 8 characters', 400);
  }

  const pool = requirePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const resetRecord = await findResetToken(client, rawToken, true);
    if (resetRecord?.status !== 'valid') {
      throw requestError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(requestedPassword, 12);

    const updatedUser = await client.query(
      "UPDATE public.app_user SET password_hash = $2, must_change_password = false, updated_at = now() WHERE user_id = $1 AND status = 'active' AND NOT is_blocked RETURNING user_id",
      [resetRecord.user_id, passwordHash]
    );
    if (!updatedUser.rows.length) throw requestError('Invalid or expired reset token', 400);

    await client.query(
      'UPDATE public.password_reset_token SET used = true WHERE user_id = $1 AND used = false',
      [resetRecord.user_id]
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
           must_change_password = false,
           updated_at = now()
       WHERE lower(email) = $2
         AND must_change_password = true
         AND status = 'active'
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
      `${AUTH_SELECT} WHERE lower(u.email) = $1 LIMIT 1`,
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

  if (user.status === 'pending') {
    throw requestError('Your account is pending approval. Contact HR or an administrator.', 403);
  }
  if (user.status !== 'active') {
    throw requestError('Invalid email or password', 401);
  }

  primeUserCache(user);

  const token = jwt.sign(
    { sub: String(user.user_id), empno: user.empno, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256', jwtid: crypto.randomUUID() }
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
  try {
    await endActivity(req);
  } catch (error) {
    // A database outage must not prevent clearing the browser's session cookie.
    console.error('Could not close employee activity session', error.code || 'unavailable');
  }
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
  sendRegistrationCode,
  validateResetToken,
  setPassword,
  login,
  session,
  logout,
  changePassword,
  forgotPassword,
  resetPassword
};
