/**
 * Preserves the request helper used by registration while allowing auth
 * routes to use the Supabase client without requiring a PostgreSQL pool.
 */
function auditContext(req, res, next) {
  req.withAuditContext = async (username, callback) => {
    return callback({ username: username || 'anonymous' });
  };

  next();
}

module.exports = { auditContext };
