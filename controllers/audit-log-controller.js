const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');
const { isSuperAdminRole } = require('../middleware/permissions');

function requestError(message, statusCode, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function parseJsonField(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

const getAuditLogs = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw requestError('Authentication required', 401);
  }

  if (!isSuperAdminRole(req.user.role)) {
    throw requestError('Superadmin access required', 403);
  }

  const query = req.query || {};
  const tableName = query.tableName || query.table ? String(query.tableName || query.table).trim() : null;
  const action = query.action ? String(query.action).trim().toUpperCase() : null;
  const actionBy = query.username || query.user || query.action_by || query.actor
    ? String(query.username || query.user || query.action_by || query.actor).trim()
    : null;
  const from = query.startDate || query.from ? String(query.startDate || query.from).trim() : null;
  const to = query.endDate || query.to ? String(query.endDate || query.to).trim() : null;

  const page = positiveInteger(query.page, 1, 1000000);
  const limit = positiveInteger(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  const pool = requirePool();

  let rows = [];
  try {
    const result = await pool.query(
      `SELECT
        audit_id AS "auditId",
        table_name AS "tableName",
        action,
        record_key AS "recordKey",
        old_values AS "oldValues",
        new_values AS "newValues",
        action_by AS "actionBy",
        action_at AS "actionAt",
        total_count
      FROM public.query_audit_logs($1::varchar, $2::varchar, $3::varchar, $4::timestamptz, $5::timestamptz, $6::integer, $7::integer)`,
      [tableName || null, action || null, actionBy || null, from || null, to || null, limit, offset]
    );
    rows = result.rows || [];
  } catch {
    const result = await pool.query(
      `SELECT
        audit_id AS "auditId",
        table_name AS "tableName",
        action,
        record_key AS "recordKey",
        old_values AS "oldValues",
        new_values AS "newValues",
        action_by AS "actionBy",
        action_at AS "actionAt",
        count(*) OVER()::integer AS total_count
      FROM public.audit_log
      WHERE ($1::varchar IS NULL OR table_name = $1)
        AND ($2::varchar IS NULL OR action = $2)
        AND ($3::varchar IS NULL OR action_by ILIKE '%' || $3 || '%' OR action_by = $3)
        AND ($4::timestamptz IS NULL OR action_at >= $4)
        AND ($5::timestamptz IS NULL OR action_at <= $5)
      ORDER BY action_at DESC, audit_id DESC
      LIMIT $6 OFFSET $7`,
      [tableName || null, action || null, actionBy || null, from || null, to || null, limit, offset]
    );
    rows = result.rows || [];
  }

  const total = rows.length > 0 ? Number(rows[0].total_count || rows[0].totalCount || 0) : 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const logs = rows.map((row) => ({
    auditId: String(row.auditId || row.audit_id),
    tableName: row.tableName || row.table_name,
    action: row.action,
    recordKey: row.recordKey || row.record_key,
    oldValues: parseJsonField(row.oldValues || row.old_values),
    newValues: parseJsonField(row.newValues || row.new_values),
    actionBy: row.actionBy || row.action_by,
    actionAt: row.actionAt || row.action_at,
  }));

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  });
});

module.exports = { getAuditLogs };
