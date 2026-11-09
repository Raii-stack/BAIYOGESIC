const jwt = require('jsonwebtoken');
const { redactPeople } = require('../lib/people-access');
const { requirePool } = require('../db');

// shortcut: 15s process-local cache, switch to shared cache if multi-instance instant revocation is needed
const USER_CACHE_TTL_MS = 15_000;
const activeUserCache = new Map();

function primeUserCache(user) {
  if (!user || !user.user_id) return;
  activeUserCache.set(String(user.user_id), {
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
    row: {
      user_id: String(user.user_id),
      empno: user.empno,
      email: user.email,
      role: user.role,
      status: user.status,
      is_blocked: Boolean(user.is_blocked),
      must_change_password: Boolean(user.must_change_password),
      rights: Array.isArray(user.rights) ? user.rights : []
    }
  });
}

function invalidateUserCache(userId) {
  if (userId) activeUserCache.delete(String(userId));
  else activeUserCache.clear();
}

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
  const userId = String((req.user && req.user.sub) || '');
  if (!req.user || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return res.status(401).json({ success: false, error: { message: 'Authentication required', statusCode: 401 } });
  }

  try {
    const useCache = !process.env.VITEST && process.env.NODE_ENV !== 'test';
    const cached = useCache ? activeUserCache.get(userId) : null;
    let user = cached && cached.expiresAt > Date.now() ? cached.row : null;

    if (!user) {
      const result = await requirePool().query(
        `SELECT u.user_id, u.empno, u.email, u.role, u.status, u.is_blocked, u.must_change_password,
                COALESCE(array_agg(ur.right_code) FILTER (WHERE ur.right_code IS NOT NULL), '{}') AS rights
         FROM public.app_user u
         LEFT JOIN public.app_user_right ur ON ur.user_id = u.user_id
         WHERE u.user_id = $1::uuid
         GROUP BY u.user_id
         LIMIT 1`,
        [userId]
      );
      user = result.rows[0];
      if (useCache && user) primeUserCache(user);
    }

    if (!user || user.status !== 'active' || user.is_blocked) {
      invalidateUserCache(userId);
      return res.status(401).json({ success: false, error: { message: 'Authentication required', statusCode: 401 } });
    }
    if (user.must_change_password) {
      return res.status(403).json({ success: false, error: { message: 'Change your password before continuing', statusCode: 403 } });
    }
    req.user = {
      exp: req.user.exp,
      sub: String(user.user_id),
      empno: user.empno,
      email: user.email,
      role: user.role,
      rights: Array.isArray(user.rights) ? user.rights : undefined
    };
    const path = req.originalUrl?.split('?')[0] || '';
    if (user.role === 'it_admin' && !/^\/api\/(users(?:\/|$)|auth\/(?:activity|registration-notifications)$|me\/(?:preferences|notifications(?:\/.*)?)$)/.test(path)) {
      return res.status(403).json({ success: false, error: { message: 'IT Admin is limited to account administration', statusCode: 403 } });
    }
    if (/^\/api\/(employees|departments|jobs|users|reports)(?:\/|$)/.test(path) || path === '/api/sales/catalog') {
      const json = res.json.bind(res);
      res.json = (body) => json(redactPeople(body, req.user));
    }
    if (typeof res.set === 'function') res.set('Cache-Control', 'no-store');
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate, requireActiveUser, primeUserCache, invalidateUserCache };
