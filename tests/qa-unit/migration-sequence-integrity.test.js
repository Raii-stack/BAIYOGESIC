const fs = require('fs');
const path = require('path');
const { MIGRATION_REGEX, verifyMigrations } = require('../../scripts/verify-migrations');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #81: Full Migration Sequence Integrity & DR Runbook Alignment', () => {
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const drRunbookPath = path.join(ROOT, 'docs', 'database', 'sprint4-rebuild-verification-and-disaster-recovery.md');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const drRunbook = fs.readFileSync(drRunbookPath, 'utf8');

  test('verifies all 28 migration files are strictly sequential with unique timestamps', () => {
    const result = verifyMigrations(migrationsDir);
    expect(result.valid).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(28);
    expect(files.length).toBe(result.count);

    const timestamps = files.map((file) => {
      const match = file.match(MIGRATION_REGEX);
      expect(match).not.toBeNull();
      return match[1];
    });
    expect(new Set(timestamps).size).toBe(timestamps.length);
  });

  test('retains key schema lifecycle milestones across Sprints 1 through 4', () => {
    const expectedMilestones = [
      '20261017131926_add_employee_auth.sql',
      '20261017175500_enable_rls_on_public_tables.sql',
      '20261020000002_sprint2_crm_inventory.sql',
      '20261027000000_issue_65_hr_constraints_and_demo_data.sql',
      '20261102000000_issue_72_system_report_queries.sql',
      '20261102010000_issue_76_sales_delete_rules_and_audit_log_queries.sql',
      '20261102060000_issue_80_audit_log_immutability.sql',
      '20261102070000_issue_81_rebuild_verification_and_dr_support.sql',
      '20261109140538_it_admin_role.sql'
    ];

    for (const milestone of expectedMilestones) {
      expect(files).toContain(milestone);
    }
  });

  test('DR runbook documents verify_database_integrity, covering indexes, and rebuild tooling', () => {
    expect(drRunbook).toContain('public.verify_database_integrity()');
    expect(drRunbook).toContain('jobhistory_empno_effdate_covering_idx');
    expect(drRunbook).toContain('pricehist_prodcode_effdate_covering_idx');
    expect(drRunbook).toContain('scripts/db-backup-restore.js');
    expect(drRunbook).toContain('scripts/backup-restore.sh');
  });
});
