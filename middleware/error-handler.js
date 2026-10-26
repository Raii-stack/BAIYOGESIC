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

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(err.details ? { details: err.details } : {})
    }
  });
}

module.exports = { asyncHandler, errorHandler };
