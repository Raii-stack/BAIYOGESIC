const jwt = require('jsonwebtoken');

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

module.exports = { authenticate };
