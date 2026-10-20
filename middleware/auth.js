const jwt = require('jsonwebtoken');
const { requirePool } = require('../db');

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET must be configured');
    error.statusCode = 503;
    throw error;
  }

  return process.env.JWT_SECRET;
}

function authenticate(req, res, next) {
  const token = req.cookies && req.cookies.access_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required', statusCode: 401 }
    });
  }

  try {
    req.user = jwt.verify(token, requireJwtSecret(), { algorithms: ['HS256'] });
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired session', statusCode: 401 }
    });
  }
}

async function requireActiveUser(req, res, next) {
  if (!req.user || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.user.sub || ''))) {
    return res.status(401).json({ success: false, error: { message: 'Authentication required', statusCode: 401 } });
  }

  try {
    const result = await requirePool().query(
      `SELECT u.user_id, u.empno, u.email, u.role, u.status, u.is_blocked, u.must_change_password,
              COALESCE(array_agg(ur.right_code) FILTER (WHERE ur.right_code IS NOT NULL), '{}') AS rights
       FROM public.app_user u
       LEFT JOIN public.app_user_right ur ON ur.user_id = u.user_id
       WHERE u.user_id = $1::uuid
       GROUP BY u.user_id
       LIMIT 1`,
      [req.user.sub]
    );
    const user = result.rows[0];
    if (!user || user.status !== 'active' || user.is_blocked) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required', statusCode: 401 } });
    }
    if (user.must_change_password) {
      return res.status(403).json({ success: false, error: { message: 'Change your password before continuing', statusCode: 403 } });
    }
    req.user = {
      sub: String(user.user_id),
      empno: user.empno,
      email: user.email,
      role: user.role,
      rights: Array.isArray(user.rights) ? user.rights : undefined
    };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate, requireActiveUser };
