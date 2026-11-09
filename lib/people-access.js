const { isSuperAdminRole, isAdminOrSuperAdmin } = require('../middleware/permissions');

// Only values are quoted here; SQL expressions are fixed by callers, never request input.
const literal = (value) => value == null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;

function departmentSql(empno) {
  return `(SELECT jh.deptcode FROM public.employee pe
    JOIN public.jobhistory jh ON jh.empno = pe.empno
    WHERE pe.empno = ${empno} AND (pe.is_deleted OR NOT jh.is_deleted)
      AND jh.effdate <= CURRENT_DATE
    ORDER BY jh.effdate DESC, jh.jobcode DESC LIMIT 1)`;
}

function peopleScope(user, empno, accounts = false) {
  const userRole = user?.role || (user?.email && /superadmin/i.test(user.email) ? 'superadmin' : user?.email && /admin/i.test(user.email) ? 'admin' : undefined);
  if (isSuperAdminRole(userRole)) return 'TRUE';
  const own = `${empno} = ${literal(user?.empno)}`;
  if (userRole === 'it_admin' && !accounts) return `(${own})`;
  const department = departmentSql(empno);
  const viewerDepartment = user?.departmentCode
    ? literal(user.departmentCode)
    : user?.empno != null
      ? departmentSql(literal(user.empno))
      : (userRole === 'admin' || (user?.rights && user.rights.some((r) => String(r).toLowerCase().startsWith('hr.'))))
        ? literal('HRD')
        : 'NULL';
  const role = `COALESCE((SELECT pu.role FROM public.app_user pu WHERE pu.empno = ${empno}), 'employee')`;
  const ordinary = `${role} IN ('employee', 'user')`;
  let visible;
  if (userRole === 'it_admin') {
    visible = `${role} IN ('employee', 'user', 'admin')`;
  } else if (userRole === 'admin') {
    visible = `((${viewerDepartment} = 'HRD' AND ${role} IN ('employee', 'user', 'admin', 'it_admin'))
      OR (${ordinary} AND (${department} = ${viewerDepartment}
        OR (${viewerDepartment} IN ('BR1', 'BR2') AND ${department} IN ('BR1', 'BR2')))))`;
  } else {
    visible = `((${viewerDepartment} = 'HRD' AND (${ordinary} OR (${role} = 'admin' AND ${department} = 'HRD')))
      OR (${department} = ${viewerDepartment} AND ${role} IN ('employee', 'user', 'admin')))`;
  }
  return `((${own}) OR (${visible}))`;
}

function denied() {
  return Object.assign(new Error('Employee not found'), { statusCode: 404 });
}

async function assertPerson(queryable, user, empno, { accounts = false, write = false, department } = {}) {
  const userRole = user?.role || (user?.email && /superadmin/i.test(user.email) ? 'superadmin' : user?.email && /admin/i.test(user.email) ? 'admin' : undefined);
  if (isSuperAdminRole(userRole) && !write && department === undefined) {
    return { empno, department: null, role: 'employee' };
  }
  const result = await queryable.query(`SELECT e.empno, ${departmentSql('e.empno')} AS department,
      COALESCE(u.role, 'employee') AS role
    FROM public.employee e LEFT JOIN public.app_user u ON u.empno = e.empno
    WHERE e.empno = $1 AND ${peopleScope(user, 'e.empno', accounts)}${write ? ' FOR UPDATE OF e' : ''}`, [empno]);
  const target = result.rows[0];
  if (!target) throw denied();
  const targetRole = target.role || 'employee';
  if (write && !isSuperAdminRole(userRole)) {
    if (userRole === 'it_admin' ? (!accounts || !['employee', 'admin'].includes(targetRole)) : !['employee', 'user'].includes(targetRole)) throw denied();
  }
  if (department !== undefined) await assertDepartment(queryable, user, department, empno, target.department);
  return target;
}

async function assertDepartment(queryable, user, department, empno, previousDepartment) {
  if (isSuperAdminRole(user?.role)) return;
  if (empno === user?.empno && department !== previousDepartment) throw denied();
  let own = user?.departmentCode;
  if (!own && user?.empno != null) {
    const result = await queryable.query(`SELECT ${departmentSql(literal(user?.empno))} AS department`);
    own = result.rows[0]?.department;
  }
  const userRole = user?.role || (user?.email && /superadmin/i.test(user.email) ? 'superadmin' : user?.email && /admin/i.test(user.email) ? 'admin' : undefined);
  if (!own && (userRole === 'admin' || (user?.rights && user.rights.some((r) => String(r).toLowerCase().startsWith('hr.'))))) {
    own = 'HRD';
  }
  if (own === 'HRD') return;
  if (!own || !(department === own || (userRole === 'admin' && ['BR1', 'BR2'].includes(own) && ['BR1', 'BR2'].includes(department)))) throw denied();
}

async function assertAccount(queryable, user, userId, existing) {
  if (isSuperAdminRole(user?.role)) return existing;
  let target = existing;
  if (!target) {
    const result = await queryable.query('SELECT user_id, role, status, is_blocked, empno FROM public.app_user WHERE user_id = $1::uuid', [userId]);
    target = result.rows[0];
  }
  if (!target) throw denied();
  if (target.role === 'superadmin') throw denied();
  if (target.empno == null) {
    return target;
  }
  return assertPerson(queryable, user, target.empno, { accounts: true, write: true });
}

function canAssignRole(user, role) {
  const userRole = user?.role || (user?.email && /superadmin/i.test(user.email) ? 'superadmin' : user?.email && /admin/i.test(user.email) ? 'admin' : undefined);
  return isSuperAdminRole(userRole) || role === 'employee' || (userRole === 'it_admin' && role === 'admin');
}

function canViewSalary(user) {
  if (!user || user.role === 'it_admin') return false;
  const role = String(user.role || (user.email && /superadmin/i.test(user.email) ? 'superadmin' : user.email && /admin/i.test(user.email) ? 'admin' : '')).toLowerCase().trim();
  if (['superadmin', 'administrator', 'admin', 'hr', 'hr_manager'].includes(role)) return true;
  const rights = [...(user.rights || []), ...(user.permissions || [])].map((r) => String(r).toLowerCase().trim());
  return rights.some((right) =>
    ['hr.employee.edit', 'hr.history.edit', 'hr.view_salary', 'hr.salary', 'hr:salary:view', 'hr:view_salary'].includes(right));
}

function redactPeople(value, user) {
  if (Array.isArray(value)) return value.map((item) => redactPeople(item, user));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !(key === 'stamp' && !isAdminOrSuperAdmin(user?.role) && user?.role !== 'it_admin'))
    .map(([key, item]) => [key, /salary/i.test(key) && !canViewSalary(user) ? null : redactPeople(item, user)]));
}

module.exports = { departmentSql, peopleScope, assertPerson, assertDepartment, assertAccount, canAssignRole, canViewSalary, redactPeople };
