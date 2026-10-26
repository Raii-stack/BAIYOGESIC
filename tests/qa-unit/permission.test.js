const { requirePermission, isSuperAdminRole, isAdminOrSuperAdmin } = require('../../middleware/permissions.js'); // TODO: use the real file name

// Runs the middleware with a fake request and response, no server needed
function run(user, moduleName, action) {
  const req = { user };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let allowed = false;
  requirePermission(moduleName, action)(req, res, () => { allowed = true; });
  return { allowed, status: res.statusCode, body: res.body };
}

const allow = (user, m, a) => expect(run(user, m, a).allowed).toBe(true);
const deny = (user, m, a) => {
  const r = run(user, m, a);
  expect(r.allowed).toBe(false);
  expect(r.status).toBe(403);
};

describe('superadmin and administrator (no granular rights)', () => {
  describe.each(['superadmin', 'administrator'])('%s', (role) => {
    const user = { role };
    const FULL = [];
    ['CRM', 'Inventory', 'HR', 'Sales', 'Users'].forEach((m) =>
      ['view', 'edit', 'delete'].forEach((a) => FULL.push([m, a])));

    test.each(FULL)('can %s %s', (m, a) => allow(user, m, a));
    test('can see HR salary', () => allow(user, 'HR', 'salary'));
    test('can view Reports', () => allow(user, 'Reports', 'view'));
    test('cannot edit Reports (view only)', () => deny(user, 'Reports', 'edit'));
  });
});

describe('admin (no granular rights)', () => {
  const user = { role: 'admin' };
  test('can delete CRM', () => allow(user, 'CRM', 'delete'));
  test('can edit Users', () => allow(user, 'Users', 'edit'));
  test('cannot delete Users', () => deny(user, 'Users', 'delete'));
  test('can see HR salary', () => allow(user, 'HR', 'salary'));
});

describe('standard user without a rights list (matrix fallback)', () => {
  const user = { role: 'user' };
  test.each(['CRM', 'Inventory', 'HR', 'Sales', 'Reports'])('can view %s', (m) =>
    allow(user, m, 'view'));
  test.each(['CRM', 'Inventory', 'HR', 'Sales'])('cannot edit %s', (m) =>
    deny(user, m, 'edit'));
  test.each(['CRM', 'Inventory', 'HR', 'Sales'])('cannot delete %s', (m) =>
    deny(user, m, 'delete'));
  test('cannot touch Users', () => {
    deny(user, 'Users', 'view');
    deny(user, 'Users', 'edit');
  });
});

describe('standard user with granular rights (what the database provides)', () => {
  test('an empty rights list is denied everything', () => {
    deny({ role: 'user', rights: [] }, 'CRM', 'view');
  });

  test('customers.access allows CRM view only', () => {
    const user = { role: 'user', rights: ['customers.access'] };
    allow(user, 'CRM', 'view');
    deny(user, 'CRM', 'edit');
    deny(user, 'CRM', 'delete');
    deny(user, 'Inventory', 'view');
  });

  test('customers.edit allows CRM edit and view, not delete', () => {
    const user = { role: 'user', rights: ['customers.edit'] };
    allow(user, 'CRM', 'edit');
    allow(user, 'CRM', 'view');
    deny(user, 'CRM', 'delete');
  });

  test('customers.delete allows CRM delete', () => {
    allow({ role: 'user', rights: ['customers.delete'] }, 'CRM', 'delete');
  });

  test('hr.employee.edit allows HR edit, not HR delete', () => {
    const user = { role: 'employee', rights: ['hr.employee.edit'] };
    allow(user, 'HR', 'edit');
    deny(user, 'HR', 'delete');
  });

  test('reports.top-sales allows Reports view, not edit', () => {
    const user = { role: 'user', rights: ['reports.top-sales'] };
    allow(user, 'Reports', 'view');
    deny(user, 'Reports', 'edit');
  });

  test('HR salary is never granted by granular rights', () => {
    const user = { role: 'user', rights: ['hr.access', 'hr.employee.edit', 'hr.employee.delete'] };
    deny(user, 'HR', 'salary');
  });
});

describe('admin with granular rights', () => {
  test('customers.access allows CRM view, not CRM edit', () => {
    const user = { role: 'admin', rights: ['customers.access'] };
    allow(user, 'CRM', 'view');
    deny(user, 'CRM', 'edit');
  });

  test('Users module still follows the role matrix', () => {
    allow({ role: 'admin', rights: ['customers.access'] }, 'Users', 'view');
  });

  test('an empty rights list falls back to the role matrix', () => {
    allow({ role: 'admin', rights: [] }, 'CRM', 'delete');
  });

  // OPEN QUESTION for the team: with any granular rights, an admin loses HR salary access
  test('admin with granular rights is denied HR salary (confirm intended)', () => {
    deny({ role: 'admin', rights: ['hr.access'] }, 'HR', 'salary');
  });
});

describe('invalid callers', () => {
  test('unknown role is denied', () => deny({ role: 'ghost' }, 'CRM', 'view'));
  test('missing user is denied', () => deny(undefined, 'CRM', 'view'));
  test('unknown module is denied', () => deny({ role: 'user' }, 'Payroll', 'view'));

  test('403 response uses the standard error shape', () => {
    const r = run({ role: 'user' }, 'CRM', 'delete');
    expect(r.body).toEqual({
      success: false,
      error: { message: 'Insufficient permissions', statusCode: 403 },
    });
  });
});

describe('role helpers', () => {
  test('isSuperAdminRole', () => {
    expect(isSuperAdminRole('superadmin')).toBe(true);
    expect(isSuperAdminRole('administrator')).toBe(true);
    expect(isSuperAdminRole('admin')).toBe(false);
    expect(isSuperAdminRole('user')).toBe(false);
  });

  test('isAdminOrSuperAdmin', () => {
    expect(isAdminOrSuperAdmin('admin')).toBe(true);
    expect(isAdminOrSuperAdmin('superadmin')).toBe(true);
    expect(isAdminOrSuperAdmin('user')).toBe(false);
  });
});