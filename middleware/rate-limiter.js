const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return standard rate limit headers (RateLimit-Limit, RateLimit-Remaining)
  legacyHeaders: false, // Disable the X-RateLimit-* headers
  message: {
    success: false,
    error: { message: 'Too Many Requests, please try again later.', statusCode: 429 }
  },
  skip: (req) => {
    // Exclude health checks
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }
    // Only apply rate limiting to mutation endpoints (POST, PUT, DELETE, PATCH)
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    return !isMutation;
  }
});

module.exports = { apiLimiter };
