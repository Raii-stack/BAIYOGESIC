const crypto = require('crypto');
const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');
const { isAdminOrSuperAdmin } = require('../middleware/permissions');

function sessionValues(req) {
  const token = req.cookies?.access_token;
  if (!token || !req.user?.sub || !Number.isFinite(req.user.exp)) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }
  return [crypto.createHash('sha256').update(token).digest('hex'), req.user.sub, req.user.exp];
}

const recordActivity = asyncHandler(async (req, res) => {
  const idleMs = req.body?.idleMs ?? 0;
  if (!Number.isInteger(idleMs) || idleMs < 0 || idleMs > 120000) {
    const error = new Error('Invalid activity interval');
    error.statusCode = 400;
    throw error;
  }
  // Retain each user's latest activity so it remains visible after session expiry.
  await requirePool().query(
    `WITH expired AS (
       DELETE FROM public.app_user_presence p WHERE expires_at <= now()
       AND EXISTS (
         SELECT 1 FROM public.app_user_presence newer
         WHERE newer.user_id = p.user_id
           AND (newer.last_seen_at, newer.session_id) > (p.last_seen_at, p.session_id)
       )
     )
     INSERT INTO public.app_user_presence (session_id, user_id, expires_at, last_seen_at)
     VALUES ($1, $2::uuid, to_timestamp($3), now() - $4::integer * interval '1 millisecond')
     ON CONFLICT (session_id) DO UPDATE SET last_seen_at = GREATEST(app_user_presence.last_seen_at, EXCLUDED.last_seen_at)
     WHERE app_user_presence.closed_at IS NULL
       AND app_user_presence.last_seen_at < now() - interval '30 seconds'`, [...sessionValues(req), idleMs]);
  res.json({ success: true, data: { message: 'Activity recorded' } });
});

async function endActivity(req) {
  await requirePool().query(
    `INSERT INTO public.app_user_presence (session_id, user_id, expires_at, last_seen_at, closed_at)
     VALUES ($1, $2::uuid, to_timestamp($3), now(), now())
     ON CONFLICT (session_id) DO UPDATE SET closed_at = now()`, sessionValues(req));
}

const listActiveEmployees = asyncHandler(async (req, res) => {
  if (!isAdminOrSuperAdmin(req.user?.role) && !req.user?.rights?.includes('activity.access')) {
    const error = new Error('Employee activity permission required');
    error.statusCode = 403;
    throw error;
  }
  const result = await requirePool().query(
    `SELECT u.user_id AS "userId", e.empno,
            TRIM(concat_ws(' ', e.firstname, e.lastname)) AS name,
            activity.last_seen_at AS "lastSeenAt"
     FROM (
       SELECT user_id, max(last_seen_at) AS last_seen_at
       FROM public.app_user_presence
       WHERE last_seen_at >= now() - interval '2 minutes'
         AND expires_at > now() AND closed_at IS NULL
       GROUP BY user_id
     ) activity
     JOIN public.app_user u ON u.user_id = activity.user_id
     JOIN public.employee e ON e.empno = u.empno
     WHERE u.status = 'active' AND NOT u.is_blocked
       AND NOT u.must_change_password AND NOT e.is_deleted
     ORDER BY activity.last_seen_at DESC, e.empno`);
  res.json({ success: true, data: { employees: result.rows } });
});

module.exports = { recordActivity, listActiveEmployees, endActivity };
