const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return standard rate limit headers (RateLimit-Limit, RateLimit-Remaining)
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    status: 429,
    error: 'Too Many Requests, please try again later.'
  },
  skip: (req) => {
    // Ensure /health and /api/health endpoints are excluded from rate limits
    return req.path === '/health' || req.path === '/api/health';
  }
});

module.exports = { apiLimiter };
