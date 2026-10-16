const { requirePool } = require('../db');

/**
 * Makes database work transaction-bound so SET LOCAL applies to every query
 * executed by the callback on the same PostgreSQL connection.
 */
function auditContext(req, res, next) {
  req.withAuditContext = async (username, callback) => {
    const client = await requirePool().connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', ['app.username', username || 'anonymous']);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  next();
}

module.exports = { auditContext };
