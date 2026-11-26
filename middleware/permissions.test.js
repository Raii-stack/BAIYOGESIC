// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
import { requirePermission, isSuperAdminRole, isAdminOrSuperAdmin } from './permissions';

function invokePerm(user, moduleName, action) {
  const req = { user };
  let statusCode = 200;
  let body;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  const next = vi.fn();
  requirePermission(moduleName, action)(req, res, next);
  return { allowed: next.mock.calls.length === 1, statusCode, body };
}

describe('middleware/permissions ([S3-DEV-08])', () => {
  test('normalizes module aliases and HR View Job History action variants', () => {
    const historyViewer = { role: 'employee', rights: ['hr.view_job_history'] };
    expect(invokePerm(historyViewer, 'Human Resources', 'View Job History').allowed).toBe(true);
    expect(invokePerm(historyViewer, 'hr', 'hr.view_job_history').allowed).toBe(true);
    expect(invokePerm(historyViewer, 'HR', 'view_job_history').allowed).toBe(true);
    expect(invokePerm(historyViewer, 'HR', 'salary').allowed).toBe(false);

    const crmReader = { role: 'user', permissions: ['customers.access'] };
    expect(invokePerm(crmReader, ' customers ', 'view').allowed).toBe(true);
    expect(invokePerm(crmReader, 'products', 'view').allowed).toBe(false);
  });

  test('restricts it_admin strictly to Users view, edit, and approve', () => {
    const itAdmin = { role: 'it_admin' };
    expect(invokePerm(itAdmin, 'Users', 'view').allowed).toBe(true);
    expect(invokePerm(itAdmin, 'Users', 'edit').allowed).toBe(true);
    expect(invokePerm(itAdmin, 'Users', 'approve').allowed).toBe(true);
    expect(invokePerm(itAdmin, 'Users', 'delete').allowed).toBe(false);
    expect(invokePerm(itAdmin, 'HR', 'view').allowed).toBe(false);
    expect(invokePerm(itAdmin, 'HR', 'salary').allowed).toBe(false);
    expect(invokePerm(itAdmin, 'Sales', 'view').allowed).toBe(false);
  });

  test('enforces sales restore rights and distinguishes admin vs superadmin helpers', () => {
    expect(invokePerm({ role: 'employee', rights: ['sales.restore'] }, 'Sales', 'restore').allowed).toBe(true);
    expect(invokePerm({ role: 'employee', rights: ['sales.access'] }, 'Sales', 'restore').allowed).toBe(false);

    expect(isSuperAdminRole('superadmin')).toBe(true);
    expect(isSuperAdminRole('administrator')).toBe(true);
    expect(isSuperAdminRole('admin')).toBe(false);

    expect(isAdminOrSuperAdmin('admin')).toBe(true);
    expect(isAdminOrSuperAdmin('superadmin')).toBe(true);
    expect(isAdminOrSuperAdmin('it_admin')).toBe(false);
    expect(isAdminOrSuperAdmin('employee')).toBe(false);
  });
});
