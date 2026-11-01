const { sanitize } = require('./logger');

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;
  const message = statusCode >= 500
    ? 'The service is temporarily unavailable. Please try again.'
    : (err.apiMessage || err.message || 'Request failed');

  // Structured diagnostic error logging (suppressed during automated unit/integration tests)
  if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.headers['x-forwarded-for'] || '-';
    const user = req.user?.email || (req.user?.sub ? `sub:${req.user.sub.slice(0, 8)}` : 'anon');
    const method = req.method;
    const url = req.originalUrl || req.url;

    if (statusCode >= 500) {
      console.error(
        `[ERROR] ${timestamp} ${method} ${url} ${statusCode} - ip: ${ip} user: ${user} | Error: ${err.message}`,
        err.stack ? `\n${err.stack}` : ''
      );
    } else {
      console.warn(
        `[WARN] ${timestamp} ${method} ${url} ${statusCode} - ip: ${ip} user: ${user} | ${message}`
      );
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(err.details ? { details: sanitize(err.details) } : {})
    }
  });
}

module.exports = { asyncHandler, errorHandler };
