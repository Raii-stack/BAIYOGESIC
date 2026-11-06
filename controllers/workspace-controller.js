const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');

const defaultPreferences = { density: 'comfortable', motion: true, employment: true, sales: true, payments: true, products: true, popups: true };
const preferenceKeys = Object.keys(defaultPreferences);
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function validatePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length) throw fail('Choose at least one preference to update.');
  for (const [key, value] of Object.entries(input)) {
    if (!preferenceKeys.includes(key)) throw fail('Unknown preference.');
    if (key === 'density' ? !['comfortable', 'compact'].includes(value) : typeof value !== 'boolean') throw fail(`Invalid ${key} preference.`);
  }
  return input;
}

const getPreferences = asyncHandler(async (req, res) => {
  const result = await requirePool().query(`SELECT ${preferenceKeys.join(', ')} FROM public.app_user_preferences WHERE user_id = $1::uuid`, [req.user.sub]);
  res.json({ success: true, data: { preferences: result.rows[0] || defaultPreferences } });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const input = validatePreferences(req.body);
  const keys = Object.keys(input);
  const assignments = keys.map((key) => `${key} = EXCLUDED.${key}`).join(', ');
  const result = await requirePool().query(
    `INSERT INTO public.app_user_preferences (user_id, ${keys.join(', ')}) VALUES ($1::uuid, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET ${assignments}, updated_at = now()
     RETURNING ${preferenceKeys.join(', ')}`, [req.user.sub, ...keys.map((key) => input[key])]);
  res.json({ success: true, data: { preferences: result.rows[0] } });
});

function notificationId(req) {
  const id = String(req.params.notificationId || '');
  if (!/^\d{1,19}$/.test(id) || BigInt(id) > 9223372036854775807n) throw fail('Invalid notification.');
  return id;
}

const visible = 'user_id = $1::uuid AND public.workspace_notice_visible($1::uuid, category)';
const listNotifications = asyncHandler(async (req, res) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw fail('Invalid inbox page.');
  const pool = requirePool();
  const [items, counts] = await Promise.all([
    pool.query(`SELECT notification_id::text AS id, category, title, message, created_at AS "createdAt", read_at AS "readAt"
      FROM public.app_notification WHERE ${visible} ORDER BY created_at DESC, notification_id DESC LIMIT 20 OFFSET $2`, [req.user.sub, (page - 1) * 20]),
    pool.query(`SELECT count(*)::integer AS total, count(*) FILTER (WHERE read_at IS NULL)::integer AS "unreadCount"
      FROM public.app_notification WHERE ${visible}`, [req.user.sub]),
  ]);
  const { total, unreadCount } = counts.rows[0];
  res.json({ success: true, data: { items: items.rows, unreadCount, total, page, totalPages: Math.max(1, Math.ceil(total / 20)) } });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const result = await requirePool().query(`UPDATE public.app_notification SET read_at = COALESCE(read_at, now())
    WHERE ${visible} AND notification_id = $2::bigint RETURNING notification_id`, [req.user.sub, notificationId(req)]);
  if (!result.rows.length) throw fail('Notification not found.', 404);
  res.json({ success: true, data: { message: 'Notification marked as read.' } });
});

const markAllRead = asyncHandler(async (req, res) => {
  await requirePool().query(`UPDATE public.app_notification SET read_at = now() WHERE ${visible} AND read_at IS NULL`, [req.user.sub]);
  res.json({ success: true, data: { message: 'Inbox marked as read.' } });
});

const openNotification = asyncHandler(async (req, res) => {
  const pool = requirePool();
  const result = await pool.query(`SELECT target_kind, target_key FROM public.app_notification WHERE ${visible} AND notification_id = $2::bigint`, [req.user.sub, notificationId(req)]);
  if (!result.rows.length) throw fail('Notification not found or access has changed.', 404);
  const item = result.rows[0];
  let href = item.target_kind === 'settings' ? '/settings?section=security' : item.target_kind === 'profile' ? '/profile?view=account' : null;
  if (item.target_kind === 'sale') {
    const record = await pool.query(`SELECT s.transno,
      ((u.role IN ('admin','superadmin','administrator') AND NOT EXISTS (SELECT 1 FROM public.app_user_right WHERE user_id = u.user_id))
        OR EXISTS (SELECT 1 FROM public.app_user_right WHERE user_id = u.user_id AND right_code = ANY(ARRAY['sales.details.view','sales.details.add','sales.details.edit','sales.details.delete']))) AS can_open_details
      FROM public.sales s CROSS JOIN public.app_user u
      WHERE s.transno = $1 AND u.user_id = $2::uuid AND public.workspace_module_access($2::uuid, 'sales')`, [item.target_key, req.user.sub]);
    if (record.rows.length) href = `/sales?${record.rows[0].can_open_details ? 'notificationSale' : 'search'}=${encodeURIComponent(item.target_key)}`;
  } else if (item.target_kind === 'product') {
    const record = await pool.query('SELECT prodcode FROM public.product WHERE prodcode = $1 AND public.workspace_module_access($2::uuid, \'products\')', [item.target_key, req.user.sub]);
    if (record.rows.length) href = `/inventory?notificationProduct=${encodeURIComponent(item.target_key)}`;
  }
  res.json({ success: true, data: { href } });
});

module.exports = { defaultPreferences, validatePreferences, getPreferences, updatePreferences, listNotifications, markNotificationRead, markAllRead, openNotification };
