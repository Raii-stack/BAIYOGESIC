const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');
const { isSuperAdminRole } = require('../middleware/permissions');

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireAuditAccess(user) {
  if (!user) throw requestError('Authentication required', 401);
  if (!isSuperAdminRole(user.role)) throw requestError('Superadmin access required', 403);
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const summaryColumns = `audit_id AS "auditId", table_name AS "tableName", action,
  record_key AS "recordKey", action_by AS "actionBy", action_at AS "actionAt"`;

const getAuditLogs = asyncHandler(async (req, res) => {
  requireAuditAccess(req.user);
  const query = req.query || {};
  const filters = [];
  const values = [];
  const addFilter = (condition, value) => {
    values.push(value);
    filters.push(condition.replace('?', `$${values.length}`));
  };
  const table = String(query.tableName || query.table || '').trim();
  const action = String(query.action || '').trim().toUpperCase();
  const actionGroups = { INSERT: ['INSERT', 'ADD'], ADD: ['INSERT', 'ADD'], UPDATE: ['UPDATE', 'EDIT'], EDIT: ['UPDATE', 'EDIT'], DELETE: ['DELETE'], RESTORE: ['RESTORE'] };
  const actor = String(query.username || query.user || query.action_by || query.actor || '').trim();
  if (table.length > 100 || actor.length > 200) throw requestError('Audit filter is too long', 400);
  if (action && !Object.hasOwn(actionGroups, action)) throw requestError('Invalid audit action', 400);
  if (table) addFilter('table_name = ?', table);
  if (action) addFilter('action = ANY(?::varchar[])', actionGroups[action]);
  if (actor) addFilter('action_by ILIKE ?', `%${actor.replace(/[\\%_]/g, '\\$&')}%`);

  const from = String(query.startDate || query.from || '').trim();
  const to = String(query.endDate || query.to || '').trim();
  for (const value of [from, to].filter(Boolean)) {
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))
      || new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10)) {
      throw requestError('Invalid audit date', 400);
    }
  }
  if (from && to && Date.parse(from) > Date.parse(to)) throw requestError('Start date must not follow end date', 400);
  if (from) addFilter('action_at >= ?::timestamptz', from);
  if (to) {
    const dateOnly = to.length === 10;
    addFilter(`action_at ${dateOnly ? '<' : '<='} ?::timestamptz`, dateOnly ? new Date(Date.parse(to) + 86400000).toISOString() : to);
  }

  const page = positiveInteger(query.page, 1, 1000000);
  const limit = positiveInteger(query.limit, 10, 100);
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const pool = requirePool();
  // Count narrow rows separately so fetching one page never materializes every JSON snapshot.
  const [records, count] = await Promise.all([
    pool.query(`SELECT ${summaryColumns} FROM public.audit_log ${where}
      ORDER BY action_at DESC, audit_id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, (page - 1) * limit]),
    pool.query(`SELECT count(*)::integer AS total FROM public.audit_log ${where}`, values)
  ]);
  const total = Number(count.rows[0]?.total || 0);
  res.json({ success: true, data: {
    logs: records.rows.map((row) => ({ ...row, auditId: String(row.auditId) })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  } });
});

const getAuditLog = asyncHandler(async (req, res) => {
  requireAuditAccess(req.user);
  const id = String(req.params.auditId || '');
  if (!/^\d{1,19}$/.test(id) || BigInt(id) > 9223372036854775807n) throw requestError('Invalid audit entry', 400);
  const result = await requirePool().query(
    `SELECT ${summaryColumns}, old_values AS "oldValues", new_values AS "newValues"
     FROM public.audit_log WHERE audit_id = $1::bigint`, [id]);
  if (!result.rows[0]) throw requestError('Audit entry not found', 404);
  res.json({ success: true, data: { log: { ...result.rows[0], auditId: String(result.rows[0].auditId) } } });
});

module.exports = { getAuditLogs, getAuditLog };
