const bcrypt = require('bcrypt');
const { requirePool } = require('../db');
const { asyncHandler } = require('../middleware/error-handler');
const { isSuperAdminRole } = require('../middleware/permissions');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = new Set(['superadmin', 'admin', 'employee']);
const DEFAULT_EMPLOYEE_RIGHTS = ['customers.access', 'products.access', 'hr.access', 'sales.access'];

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function auditActor(req) {
  return String((req.user && (req.user.email || req.user.empno || req.user.sub)) || 'system').slice(0, 64);
}

async function withAudit(username, callback) {
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user', $1, true)`, [username]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const latestJobJoin = `
  LEFT JOIN public.employee e ON e.empno = u.empno
  LEFT JOIN LATERAL (
    SELECT jobcode, deptcode
    FROM public.jobhistory jh
    WHERE jh.empno = u.empno AND jh.is_deleted = false
    ORDER BY effdate DESC, jobcode DESC
    LIMIT 1
  ) lj ON true
  LEFT JOIN public.job j ON j.jobcode = lj.jobcode
  LEFT JOIN public.department d ON d.deptcode = lj.deptcode
`;

const userSelectFields = `
  u.user_id AS "userId",
  u.empno,
  COALESCE(e.firstname, '') AS "firstName",
  COALESCE(e.lastname, '') AS "lastName",
  TRIM(concat_ws(' ', e.firstname, e.lastname)) AS name,
  u.email,
  u.role,
  u.status,
  u.is_blocked AS "isBlocked",
  u.must_change_password AS "mustChangePassword",
  j.jobdesc AS "jobTitle",
  d.deptname AS "departmentName",
  u.stamp,
  u.created_at AS "createdAt",
  u.updated_at AS "updatedAt",
  COALESCE(
    (
      SELECT array_agg(ur.right_code ORDER BY ar.sort_order, ur.right_code)
      FROM public.app_user_right ur
      LEFT JOIN public.app_right ar ON ar.right_code = ur.right_code
      WHERE ur.user_id = u.user_id
    ),
    '{}'
  ) AS rights
`;

async function fetchUserById(queryable, userId) {
  const result = await queryable.query(
    `SELECT ${userSelectFields}
     FROM public.app_user u
     ${latestJobJoin}
     WHERE u.user_id = $1::uuid
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

const listUsers = asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, 100000);
  const limit = positiveInteger(req.query.limit, 10, 100);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const roleFilter = typeof req.query.role === 'string' ? req.query.role.trim().toLowerCase() : 'all';
  const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : 'all';

  if (!['all', 'superadmin', 'admin', 'employee'].includes(roleFilter)) {
    throw requestError('Invalid role filter', 400);
  }
  if (!['all', 'active', 'blocked', 'pending'].includes(statusFilter)) {
    throw requestError('Invalid status filter', 400);
  }

  const requesterIsSuperAdmin = isSuperAdminRole(req.user && req.user.role);
  const values = [];
  const filters = [];

  // Per Student Guide §3.8: Superadmin accounts are hidden from Admin view
  if (!requesterIsSuperAdmin) {
    filters.push(`u.role <> 'superadmin'`);
  }

  if (search) {
    values.push(`%${search}%`);
    const idx = values.length;
    filters.push(
      `(u.empno ILIKE $${idx} OR u.email ILIKE $${idx} OR e.firstname ILIKE $${idx} OR e.lastname ILIKE $${idx} OR concat_ws(' ', e.firstname, e.lastname) ILIKE $${idx} OR u.role ILIKE $${idx})`
    );
  }

  if (roleFilter !== 'all') {
    values.push(roleFilter);
    filters.push(`u.role = $${values.length}`);
  }

  if (statusFilter === 'blocked') {
    filters.push(`u.is_blocked = true`);
  } else if (statusFilter === 'active') {
    filters.push(`u.is_blocked = false AND u.status = 'active'`);
  } else if (statusFilter === 'pending') {
    filters.push(`u.is_blocked = false AND u.status = 'pending'`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const baseFrom = `FROM public.app_user u ${latestJobJoin} ${whereClause}`;

  const pool = requirePool();
  const [countResult, rowsResult] = await Promise.all([
    pool.query(`SELECT count(*)::integer AS total ${baseFrom}`, values),
    pool.query(
      `SELECT ${userSelectFields}
       ${baseFrom}
       ORDER BY
         CASE u.role
           WHEN 'superadmin' THEN 1
           WHEN 'admin' THEN 2
           ELSE 3
         END,
         e.lastname NULLS LAST,
         e.firstname NULLS LAST,
         u.email
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit]
    )
  ]);

  const total = countResult.rows[0].total;
  res.json({
    success: true,
    data: {
      users: rowsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  });
});

const listUserOptions = asyncHandler(async (_req, res) => {
  const pool = requirePool();
  const [employeesResult, rightsResult] = await Promise.all([
    pool.query(
      `SELECT e.empno,
              e.firstname AS "firstName",
              e.lastname AS "lastName",
              TRIM(concat_ws(' ', e.firstname, e.lastname)) AS name,
              e.email,
              j.jobdesc AS "jobTitle",
              d.deptname AS "departmentName"
       FROM public.employee e
       LEFT JOIN public.app_user u ON u.empno = e.empno
       LEFT JOIN LATERAL (
         SELECT jobcode, deptcode
         FROM public.jobhistory jh
         WHERE jh.empno = e.empno AND jh.is_deleted = false
         ORDER BY effdate DESC, jobcode DESC
         LIMIT 1
       ) lj ON true
       LEFT JOIN public.job j ON j.jobcode = lj.jobcode
       LEFT JOIN public.department d ON d.deptcode = lj.deptcode
       WHERE e.is_deleted = false
         AND u.user_id IS NULL
       ORDER BY e.lastname NULLS LAST, e.firstname NULLS LAST, e.empno`
    ),
    pool.query(
      `SELECT right_code AS "rightCode",
              module,
              description,
              sort_order AS "sortOrder",
              is_module_access AS "isModuleAccess"
       FROM public.app_right
       ORDER BY sort_order, right_code`
    )
  ]);

  res.json({
    success: true,
    data: {
      availableEmployees: employeesResult.rows,
      rightsCatalog: rightsResult.rows
    }
  });
});

const createUser = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const requesterIsSuperAdmin = isSuperAdminRole(req.user && req.user.role);

  const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : 'employee';
  if (!VALID_ROLES.has(role)) {
    throw requestError('Role must be superadmin, admin, or employee', 400);
  }
  if (!requesterIsSuperAdmin && role !== 'employee') {
    throw requestError('Admins can only create Employee accounts', 403);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) {
    throw requestError('Password must be at least 8 characters', 400);
  }

  const providedEmpno = typeof body.empno === 'string' ? body.empno.trim() : '';
  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const mustChangePassword = body.mustChangePassword !== undefined ? Boolean(body.mustChangePassword) : true;
  const requestedRights = Array.isArray(body.rights)
    ? body.rights.filter((code) => typeof code === 'string' && code.trim())
    : DEFAULT_EMPLOYEE_RIGHTS;

  const passwordHash = await bcrypt.hash(password, 12);
  const actor = auditActor(req);

  const created = await withAudit(actor, async (client) => {
    let targetEmpno = providedEmpno;
    let targetEmail = rawEmail;

    if (targetEmpno) {
      const empCheck = await client.query(
        `SELECT empno, firstname, lastname, email
         FROM public.employee
         WHERE empno = $1 AND is_deleted = false
         FOR UPDATE`,
        [targetEmpno]
      );
      const emp = empCheck.rows[0];
      if (!emp) {
        throw requestError('Selected employee was not found', 404);
      }

      const existingAccount = await client.query(
        `SELECT user_id FROM public.app_user WHERE empno = $1 LIMIT 1`,
        [targetEmpno]
      );
      if (existingAccount.rows[0]) {
        throw requestError('This employee already has a user account', 409);
      }

      targetEmail = targetEmail || String(emp.email || '').trim().toLowerCase();
      if (!EMAIL_PATTERN.test(targetEmail)) {
        throw requestError('A valid email address is required', 400);
      }

      // Sync updated name/email to employee record if provided
      const nextFirst = firstName || emp.firstname;
      const nextLast = lastName || emp.lastname;
      await client.query(
        `UPDATE public.employee
         SET firstname = $2,
             lastname = $3,
             email = $4,
             stamp = public.audit_stamp('EDIT')
         WHERE empno = $1`,
        [targetEmpno, nextFirst, nextLast, targetEmail]
      );
    } else {
      if (!firstName || firstName.length > 15) {
        throw requestError('First name is required and must be at most 15 characters', 400);
      }
      if (!lastName || lastName.length > 15) {
        throw requestError('Last name is required and must be at most 15 characters', 400);
      }
      if (!EMAIL_PATTERN.test(targetEmail)) {
        throw requestError('A valid email address is required', 400);
      }

      await client.query('LOCK TABLE public.employee IN EXCLUSIVE MODE');
      const nextNo = await client.query(
        `SELECT lpad((COALESCE(MAX(empno::integer), 0) + 1)::text, 5, '0') AS empno
         FROM public.employee
         WHERE empno ~ '^[0-9]{1,5}$'`
      );
      targetEmpno = nextNo.rows[0].empno;

      await client.query(
        `INSERT INTO public.employee (empno, firstname, lastname, email, hiredate, is_deleted, stamp)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, false, public.audit_stamp('ADD'))`,
        [targetEmpno, firstName, lastName, targetEmail]
      );
    }

    const emailConflict = await client.query(
      `SELECT user_id FROM public.app_user WHERE lower(email) = $1 LIMIT 1`,
      [targetEmail]
    );
    if (emailConflict.rows[0]) {
      throw requestError('An account with that email address already exists', 409);
    }

    const insertResult = await client.query(
      `INSERT INTO public.app_user (empno, email, password_hash, status, role, is_blocked, must_change_password, stamp)
       VALUES ($1, $2, $3, 'active', $4, false, $5, public.audit_stamp('ADD'))
       RETURNING user_id`,
      [targetEmpno, targetEmail, passwordHash, role, mustChangePassword]
    );
    const newUserId = insertResult.rows[0].user_id;

    if (role === 'employee' && requestedRights.length > 0) {
      await client.query(
        `INSERT INTO public.app_user_right (user_id, right_code, granted_by)
         SELECT $1::uuid, r.right_code, $2
         FROM public.app_right r
         WHERE r.right_code = ANY($3::text[])
         ON CONFLICT DO NOTHING`,
        [newUserId, actor, requestedRights]
      );
    }

    return fetchUserById(client, newUserId);
  });

  res.status(201).json({ success: true, data: { user: created } });
});

const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!UUID_PATTERN.test(String(userId || ''))) {
    throw requestError('Invalid user ID', 400);
  }

  const body = req.body || {};
  const requesterIsSuperAdmin = isSuperAdminRole(req.user && req.user.role);
  const actor = auditActor(req);

  const updated = await withAudit(actor, async (client) => {
    const existingResult = await client.query(
      `SELECT u.user_id, u.empno, u.email, u.role, e.firstname, e.lastname
       FROM public.app_user u
       LEFT JOIN public.employee e ON e.empno = u.empno
       WHERE u.user_id = $1::uuid
       FOR UPDATE OF u`,
      [userId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      throw requestError('User account not found', 404);
    }

    if (!requesterIsSuperAdmin && existing.role !== 'employee') {
      throw requestError('Admins can only edit Employee accounts', 403);
    }

    const nextRole = body.role !== undefined ? String(body.role).trim().toLowerCase() : existing.role;
    if (!VALID_ROLES.has(nextRole)) {
      throw requestError('Role must be superadmin, admin, or employee', 400);
    }
    if (!requesterIsSuperAdmin && nextRole !== 'employee') {
      throw requestError('Admins can only assign the Employee role', 403);
    }
    if (String(req.user.sub) === String(userId) && nextRole !== existing.role) {
      throw requestError('You cannot change your own role', 400);
    }

    const nextEmail = body.email !== undefined ? String(body.email).trim().toLowerCase() : String(existing.email).toLowerCase();
    if (!EMAIL_PATTERN.test(nextEmail)) {
      throw requestError('A valid email address is required', 400);
    }

    const emailConflict = await client.query(
      `SELECT user_id FROM public.app_user WHERE lower(email) = $1 AND user_id <> $2::uuid LIMIT 1`,
      [nextEmail, userId]
    );
    if (emailConflict.rows[0]) {
      throw requestError('Another account already uses that email address', 409);
    }

    const nextFirstName = body.firstName !== undefined ? String(body.firstName).trim() : (existing.firstname || '');
    const nextLastName = body.lastName !== undefined ? String(body.lastName).trim() : (existing.lastname || '');
    if (existing.empno) {
      if (!nextFirstName || nextFirstName.length > 15) {
        throw requestError('First name is required and must be at most 15 characters', 400);
      }
      if (!nextLastName || nextLastName.length > 15) {
        throw requestError('Last name is required and must be at most 15 characters', 400);
      }
      await client.query(
        `UPDATE public.employee
         SET firstname = $2,
             lastname = $3,
             email = $4,
             stamp = public.audit_stamp('EDIT')
         WHERE empno = $1`,
        [existing.empno, nextFirstName, nextLastName, nextEmail]
      );
    }

    const newPassword = typeof body.password === 'string' ? body.password : '';
    if (newPassword) {
      if (newPassword.length < 8) {
        throw requestError('New password must be at least 8 characters', 400);
      }
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const mustChange = body.mustChangePassword !== undefined ? Boolean(body.mustChangePassword) : true;
      await client.query(
        `UPDATE public.app_user
         SET email = $2,
             role = $3,
             password_hash = $4,
             status = 'active',
             must_change_password = $5,
             stamp = public.audit_stamp('EDIT'),
             updated_at = now()
         WHERE user_id = $1::uuid`,
        [userId, nextEmail, nextRole, passwordHash, mustChange]
      );
    } else {
      await client.query(
        `UPDATE public.app_user
         SET email = $2,
             role = $3,
             stamp = public.audit_stamp('EDIT'),
             updated_at = now()
         WHERE user_id = $1::uuid`,
        [userId, nextEmail, nextRole]
      );
    }

    return fetchUserById(client, userId);
  });

  res.json({ success: true, data: { user: updated } });
});

const setBlockStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!UUID_PATTERN.test(String(userId || ''))) {
    throw requestError('Invalid user ID', 400);
  }
  if (typeof (req.body && req.body.isBlocked) !== 'boolean') {
    throw requestError('isBlocked (boolean) is required', 400);
  }
  if (String(req.user.sub) === String(userId)) {
    throw requestError('You cannot block or unblock your own account', 400);
  }

  const isBlocked = req.body.isBlocked;
  const requesterIsSuperAdmin = isSuperAdminRole(req.user && req.user.role);
  const actor = auditActor(req);

  const updated = await withAudit(actor, async (client) => {
    const existingResult = await client.query(
      `SELECT user_id, role FROM public.app_user WHERE user_id = $1::uuid FOR UPDATE`,
      [userId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      throw requestError('User account not found', 404);
    }

    if (!requesterIsSuperAdmin && existing.role !== 'employee') {
      throw requestError('Admins can only block or unblock Employee accounts', 403);
    }

    await client.query(
      `UPDATE public.app_user
       SET is_blocked = $2,
           stamp = public.audit_stamp('EDIT'),
           updated_at = now()
       WHERE user_id = $1::uuid`,
      [userId, isBlocked]
    );

    return fetchUserById(client, userId);
  });

  res.json({ success: true, data: { user: updated } });
});

const updateUserRights = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!UUID_PATTERN.test(String(userId || ''))) {
    throw requestError('Invalid user ID', 400);
  }
  if (!req.body || !Array.isArray(req.body.rights)) {
    throw requestError('rights (array of right codes) is required', 400);
  }

  const requestedRights = Array.from(
    new Set(
      req.body.rights
        .filter((code) => typeof code === 'string')
        .map((code) => code.trim())
        .filter(Boolean)
    )
  );

  const requesterIsSuperAdmin = isSuperAdminRole(req.user && req.user.role);
  const actor = auditActor(req);

  const updated = await withAudit(actor, async (client) => {
    const existingResult = await client.query(
      `SELECT user_id, role FROM public.app_user WHERE user_id = $1::uuid FOR UPDATE`,
      [userId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      throw requestError('User account not found', 404);
    }

    if (!requesterIsSuperAdmin && existing.role !== 'employee') {
      throw requestError('Admins can only manage rights for Employee accounts', 403);
    }

    if (requestedRights.length > 0) {
      const validResult = await client.query(
        `SELECT right_code FROM public.app_right WHERE right_code = ANY($1::text[])`,
        [requestedRights]
      );
      if (validResult.rows.length !== requestedRights.length) {
        throw requestError('One or more right codes are invalid', 400);
      }
    }

    await client.query(`DELETE FROM public.app_user_right WHERE user_id = $1::uuid`, [userId]);

    if (requestedRights.length > 0) {
      await client.query(
        `INSERT INTO public.app_user_right (user_id, right_code, granted_by)
         SELECT $1::uuid, unnest($2::text[]), $3`,
        [userId, requestedRights, actor]
      );
    }

    await client.query(
      `UPDATE public.app_user
       SET stamp = public.audit_stamp('EDIT'),
           updated_at = now()
       WHERE user_id = $1::uuid`,
      [userId]
    );

    return fetchUserById(client, userId);
  });

  res.json({ success: true, data: { user: updated } });
});

module.exports = {
  listUsers,
  listUserOptions,
  createUser,
  updateUser,
  setBlockStatus,
  updateUserRights
};
