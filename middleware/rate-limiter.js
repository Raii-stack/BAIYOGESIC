const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return standard rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`)
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: { xForwardedForHeader: false },
  message: {
    status: 429,
    error: 'Too Many Requests, please try again later.'
  },
  skip: (req) => {
    // Ensure /health and /api/health endpoints are excluded from rate limits
    return req.path === '/health' || req.path === '/api/health'
      || req.path === '/auth/activity' || req.path === '/auth/active-employees'
      || req.path === '/auth/registration-notifications';
  }
});

// Dedicated strict rate limiter for sensitive unauthenticated credential routes ([S2-DSO-05])
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit'] === 'true';
  },
  handler: (_req, res) => {
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many authentication attempts, please try again later.',
        statusCode: 429
      }
    });
  }
});

// Background activity has its own budget so a shared office IP keeps its business API allowance.
const activityLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

module.exports = { apiLimiter, authLimiter, activityLimiter };
