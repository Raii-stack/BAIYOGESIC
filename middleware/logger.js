// middleware/logger.js
// Structured request logging with response time, client IP, user context, and PII masking.

function isTestEnv() {
  return Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
}

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'password_hash',
  'token_hash',
  'token',
  'verificationcode',
  'access_token',
  'secret',
  'authorization',
  'cookie',
  'ssn',
  'tin',
  'salary',
  'birthdate',
  'sepdate'
]);

const SENSITIVE_QUERY_PARAMS = new Set([
  'token',
  'key',
  'secret',
  'password'
]);

function redactUrlQuery(url) {
  if (!url || typeof url !== 'string') return url;
  const questionIdx = url.indexOf('?');
  if (questionIdx === -1) return url;

  const basePath = url.slice(0, questionIdx);
  const queryString = url.slice(questionIdx + 1);
  if (!queryString) return url;

  const params = new URLSearchParams(queryString);
  for (const [key] of Array.from(params.entries())) {
    if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
      params.set(key, '[REDACTED]');
    }
  }

  return `${basePath}?${params.toString()}`;
}

function sanitize(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[CIRCULAR]';
  seen.add(obj);

  if (Array.isArray(obj)) return obj.map((item) => sanitize(item, seen));

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = String(key).toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value, seen);
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

    const sanitizedUrl = redactUrlQuery(req.originalUrl || req.url);
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    const logLine = `[${level}] ${timestamp} ${req.method} ${sanitizedUrl} ${status} ${duration} - ip: ${ip} user: ${user}`;

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

module.exports = { requestLogger, sanitize, redactUrlQuery };
