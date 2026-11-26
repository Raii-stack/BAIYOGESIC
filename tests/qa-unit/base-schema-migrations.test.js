const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #19: Base Schema, Employee Auth & Audit Trigger Migrations', () => {
  const auditSql = fs.readFileSync(path.join(ROOT, 'HopeDB_audit.sql'), 'utf8');
  const authMigrationSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261017131926_add_employee_auth.sql'),
    'utf8'
  );
  const passwordTrackingSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261017140500_add_password_change_tracking.sql'),
    'utf8'
  );

  test('HopeDB_audit.sql enforces hard-delete blocking, stamp, child check, and audit triggers on core tables', () => {
    const tablesWithHardDeleteBlock = [
      'department',
      'job',
      'employee',
      'jobhistory',
      'customer',
      'product',
      'pricehist',
      'sales',
      'salesdetail',
      'payment'
    ];

    for (const table of tablesWithHardDeleteBlock) {
      expect(auditSql).toContain(`CREATE TRIGGER ${table}_bd_block BEFORE DELETE ON public.${table}`);
      expect(auditSql).toContain(`CREATE TRIGGER ${table}_biu_stamp BEFORE INSERT OR UPDATE ON public.${table}`);
      expect(auditSql).toContain(`CREATE TRIGGER ${table}_aiu_audit AFTER INSERT OR UPDATE ON public.${table}`);
    }
  });

  test('HopeDB_audit.sql defines audit_log append-only constraints and protection trigger', () => {
    expect(auditSql).toContain('CONSTRAINT audit_log_action_check CHECK (action IN (\'ADD\', \'EDIT\', \'DELETE\', \'RESTORE\'))');
    expect(auditSql).toContain('CREATE TRIGGER audit_log_protect_row BEFORE UPDATE OR DELETE ON public.audit_log');
  });

  test('employee auth migration creates app_user with pending default, unique email index, and service_role isolation', () => {
    expect(authMigrationSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS employee_email_lower_idx');
    expect(authMigrationSql).toContain('CREATE TABLE IF NOT EXISTS public.app_user');
    expect(authMigrationSql).toContain("CHECK (status IN ('pending', 'active', 'disabled'))");
    expect(authMigrationSql).toContain('ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;');
    expect(authMigrationSql).toContain('REVOKE ALL ON TABLE public.app_user FROM anon, authenticated;');
    expect(authMigrationSql).toContain('GRANT SELECT ON TABLE public.app_user TO service_role;');
  });

  test('password tracking migration adds must_change_password column defaulting to true', () => {
    expect(passwordTrackingSql).toContain('ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true');
    expect(passwordTrackingSql).toContain('SET must_change_password = true');
  });
});
