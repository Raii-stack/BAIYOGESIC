// middleware/logger.js
// Structured request logging with response time, client IP, user context, and PII masking.

function isTestEnv() {
  return Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
}

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'verificationcode',
  'access_token',
  'secret',
  'authorization',
  'cookie',
  'ssn',
  'tin',
  'salary'
]);

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function requestLogger(req, res, next) {
  if (isTestEnv()) return next();

  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    // Skip noisy health probes from flooding logs when healthy
    if ((req.path === '/health' || req.path === '/api/health') && res.statusCode < 400) {
      return;
    }

    const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const duration = `${elapsedMs.toFixed(1)}ms`;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '-';
    const user = req.user?.email || (req.user?.sub ? `sub:${req.user.sub.slice(0, 8)}` : 'anon');
    const status = res.statusCode;
    const timestamp = new Date().toISOString();

    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    const logLine = `[${level}] ${timestamp} ${req.method} ${req.originalUrl || req.url} ${status} ${duration} - ip: ${ip} user: ${user}`;

    if (level === 'ERROR') {
      console.error(logLine);
    } else if (level === 'WARN') {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
  });

  next();
}

module.exports = { requestLogger, sanitize };
