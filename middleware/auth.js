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
      `SELECT user_id, empno, email, role, status, must_change_password
       FROM public.app_user WHERE user_id = $1::uuid LIMIT 1`,
      [req.user.sub]
    );
    const user = result.rows[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, error: { message: 'Authentication required', statusCode: 401 } });
    }
    if (user.must_change_password) {
      return res.status(403).json({ success: false, error: { message: 'Change your password before continuing', statusCode: 403 } });
    }
    req.user = { sub: String(user.user_id), empno: user.empno, email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate, requireActiveUser };
