const fs = require('fs');
const path = require('path');

jest.mock('../../db', () => ({
  requirePool: jest.fn(),
  pool: {},
  supabase: {
    from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
  }
}));

const { MIGRATION_REGEX, verifyMigrations } = require('../../scripts/verify-migrations');
const {
  ORDERED_TABLES,
  FULL_ERP_TABLES,
  REQUIRED_HR_INDEXES,
  REQUIRED_COVERING_INDEXES,
  computeChecksum,
  verifyBackupManifest,
  filterSnapshotToPointInTime
} = require('../../scripts/db-backup-restore');

describe('Issue #81: Database Rebuild Verification, PITR & Disaster Recovery Docs', () => {
  const migrationPath = path.join(
    __dirname,
    '../../supabase/migrations/20261102070000_issue_81_rebuild_verification_and_dr_support.sql'
  );
  const baseSchemaPath = path.join(__dirname, '../../HopeDB_audit.sql');
  const seedPath = path.join(__dirname, '../../supabase/seed.sql');
  const drDocPath = path.join(
    __dirname,
    '../../docs/database/sprint4-rebuild-verification-and-disaster-recovery.md'
  );

  let migrationSql = '';
  let baseSchemaSql = '';
  let seedSql = '';

  beforeAll(() => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(baseSchemaPath)).toBe(true);
    expect(fs.existsSync(seedPath)).toBe(true);

    migrationSql = fs.readFileSync(migrationPath, 'utf8');
    baseSchemaSql = fs.readFileSync(baseSchemaPath, 'utf8');
    seedSql = fs.readFileSync(seedPath, 'utf8');
  });

  describe('1. Migration File Sequence and Chronological Validation', () => {
    test('migration filename matches strict YYYYMMDDHHMMSS_<description>.sql format', () => {
      const filename = path.basename(migrationPath);
      expect(filename).toMatch(MIGRATION_REGEX);
    });

    test('migration timestamp strictly succeeds issue 80 audit immutability migration', () => {
      const match = path.basename(migrationPath).match(MIGRATION_REGEX);
      expect(match).not.toBeNull();
      const timestamp = match[1];
      expect(timestamp).toBe('20261102070000');
      expect(timestamp > '20261102060000').toBe(true);
    });

    test('all migrations in repository pass strict sequential verification', () => {
      const result = verifyMigrations();
      expect(result.valid).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(22);
    });
  });

  describe('2. Authoritative Base Schema Specification (HopeDB_audit.sql)', () => {
    test('defines all 10 core business tables and audit_log table', () => {
      const expectedTables = [
        'public.department',
        'public.job',
        'public.employee',
        'public.jobhistory',
        'public.customer',
        'public.product',
        'public.pricehist',
        'public.sales',
        'public.salesdetail',
        'public.payment',
        'public.audit_log'
      ];
      for (const tbl of expectedTables) {
        expect(baseSchemaSql).toContain(`CREATE TABLE IF NOT EXISTS ${tbl}`);
      }
    });

    test('defines audit helper functions and stamp generation', () => {
      expect(baseSchemaSql).toContain('FUNCTION public.audit_user()');
      expect(baseSchemaSql).toContain('FUNCTION public.audit_stamp(p_action text)');
    });

    test('defines soft-delete, child-record check, and audit triggers', () => {
      expect(baseSchemaSql).toContain('FUNCTION public.trg_set_stamp()');
      expect(baseSchemaSql).toContain('FUNCTION public.trg_block_hard_delete()');
      expect(baseSchemaSql).toContain('FUNCTION public.trg_check_children()');
      expect(baseSchemaSql).toContain('FUNCTION public.trg_audit_log()');
      expect(baseSchemaSql).toContain('FUNCTION public.trg_protect_audit_log()');
    });

    test('enforces append-only immutability trigger on audit_log table', () => {
      expect(baseSchemaSql).toContain('CREATE TRIGGER audit_log_protect_row');
      expect(baseSchemaSql).toContain('BEFORE UPDATE OR DELETE ON public.audit_log');
    });
  });

  describe('3. Covering Indexes on Composite Query Keys', () => {
    test('creates covering index on jobhistory (empno, effdate DESC) including payload', () => {
      expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_covering_idx');
      expect(migrationSql).toContain('ON public.jobhistory (empno, effdate DESC)');
      expect(migrationSql).toContain('INCLUDE (jobcode, deptcode, salary, is_deleted)');
    });

    test('creates covering index on pricehist (prodcode, effdate DESC) including payload', () => {
      expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS pricehist_prodcode_effdate_covering_idx');
      expect(migrationSql).toContain('ON public.pricehist (prodcode, effdate DESC)');
      expect(migrationSql).toContain('INCLUDE (unitprice, is_deleted)');
    });
  });

  describe('4. Foreign Key Restrict Rules & Integrity Verification Stored Function', () => {
    test('configures ON DELETE RESTRICT on jobhistory foreign keys', () => {
      expect(migrationSql).toContain('jobhistory_empno_fkey');
      expect(migrationSql).toContain('jobhistory_jobcode_fkey');
      expect(migrationSql).toContain('jobhistory_deptcode_fkey');
      expect(migrationSql).toContain('ON DELETE RESTRICT');
    });

    test('configures ON DELETE RESTRICT on pricehist foreign key', () => {
      expect(migrationSql).toContain('pricehist_prodcode_fkey');
      expect(migrationSql).toContain('ON DELETE RESTRICT');
    });

    test('implements stored function verify_database_integrity for automated disaster recovery audits', () => {
      expect(migrationSql).toContain('FUNCTION public.verify_database_integrity()');
      expect(migrationSql).toContain('FOREIGN_KEY_INTEGRITY');
      expect(migrationSql).toContain('INDEX_INTEGRITY');
      expect(migrationSql).toContain('AUDIT_SECURITY');
    });
  });

  describe('5. Idempotent Seed Script Coverage & Edge Cases', () => {
    test('seeds modern RBAC roles matching schema constraints', () => {
      expect(seedSql).toContain("('superadmin', 'Superadmin')");
      expect(seedSql).toContain("('admin', 'Admin')");
      expect(seedSql).toContain("('employee', 'Employee')");
    });

    test('seeds realistic demo sales transactions, line items, and payments', () => {
      expect(seedSql).toContain('INSERT INTO public.sales');
      expect(seedSql).toContain('INSERT INTO public.salesdetail');
      expect(seedSql).toContain('INSERT INTO public.payment');
      expect(seedSql).toContain('TR1001');
      expect(seedSql).toContain('OR1001');
    });

    test('covers diverse payment methods and payment terms in demo records', () => {
      expect(seedSql).toContain("'Cash'");
      expect(seedSql).toContain("'Bank Transfer'");
      expect(seedSql).toContain("'Check'");
      expect(seedSql).toContain("'Card'");
      expect(seedSql).toContain("'E-wallet'");
      expect(seedSql).toContain("'60D'");
    });
  });

  describe('6. Point-In-Time Recovery (PITR) & Disaster Recovery Script Logic', () => {
    const mockSnapshot = {
      metadata: {
        version: '2.0.0',
        createdAt: '2026-11-02T10:00:00.000Z',
        orderedTables: ORDERED_TABLES,
        rowCounts: {
          department: 1,
          job: 1,
          employee: 2,
          jobhistory: 2,
          customer: 1,
          product: 1,
          pricehist: 2,
          sales: 2,
          salesdetail: 2,
          payment: 2
        },
        totalRows: 16,
        checksum: ''
      },
      tables: {
        department: [{ deptcode: 'IT', deptname: 'Information Tech', is_deleted: false }],
        job: [{ jobcode: 'PR1', jobdesc: 'Programmer 1', is_deleted: false }],
        employee: [
          { empno: '00001', firstname: 'John', lastname: 'Smith', is_deleted: false },
          { empno: '00002', firstname: 'Jane', lastname: 'Doe', is_deleted: false }
        ],
        jobhistory: [
          { empno: '00001', jobcode: 'PR1', effdate: '2026-01-15', deptcode: 'IT', is_deleted: false },
          { empno: '00002', jobcode: 'PR1', effdate: '2026-08-01', deptcode: 'IT', is_deleted: false }
        ],
        customer: [{ custno: 'C1001', custname: 'Apex Office', is_deleted: false }],
        product: [{ prodcode: 'P1001', description: 'Copy Paper', is_deleted: false }],
        pricehist: [
          { prodcode: 'P1001', effdate: '2026-01-01', unitprice: '10.00', is_deleted: false },
          { prodcode: 'P1001', effdate: '2026-09-01', unitprice: '12.00', is_deleted: false }
        ],
        sales: [
          { transno: 'TR1001', salesdate: '2026-02-01', custno: 'C1001', empno: '00001', is_deleted: false },
          { transno: 'TR1002', salesdate: '2026-07-01', custno: 'C1001', empno: '00002', is_deleted: false }
        ],
        salesdetail: [
          { transno: 'TR1001', prodcode: 'P1001', quantity: 10, is_deleted: false },
          { transno: 'TR1002', prodcode: 'P1001', quantity: 20, is_deleted: false }
        ],
        payment: [
          { orno: 'OR1001', transno: 'TR1001', paydate: '2026-02-05', amount: '100.00', is_deleted: false },
          { orno: 'OR1002', transno: 'TR1002', paydate: '2026-07-05', amount: '200.00', is_deleted: false }
        ]
      }
    };
    mockSnapshot.metadata.checksum = computeChecksum(mockSnapshot.tables);

    test('validates backup manifest with checksum and row count matching', () => {
      const manifestResult = verifyBackupManifest(mockSnapshot);
      expect(manifestResult.valid).toBe(true);
      expect(manifestResult.checksum).toBe(mockSnapshot.metadata.checksum);
      expect(manifestResult.totalRows).toBe(16);
    });

    test('rejects tampered or corrupted backup manifest', () => {
      const tamperedSnapshot = JSON.parse(JSON.stringify(mockSnapshot));
      tamperedSnapshot.tables.department.push({ deptcode: 'HR', deptname: 'HR', is_deleted: false });
      expect(() => verifyBackupManifest(tamperedSnapshot)).toThrow();
    });

    test('filters snapshot to target point in time while preserving referential integrity', () => {
      const filtered = filterSnapshotToPointInTime(mockSnapshot, '2026-05-01T00:00:00Z');
      expect(filtered.metadata.pitrTargetTime).toBe('2026-05-01T00:00:00.000Z');
      expect(filtered.tables.sales.length).toBe(1);
      expect(filtered.tables.sales[0].transno).toBe('TR1001');
      expect(filtered.tables.salesdetail.length).toBe(1);
      expect(filtered.tables.salesdetail[0].transno).toBe('TR1001');
      expect(filtered.tables.payment.length).toBe(1);
      expect(filtered.tables.payment[0].orno).toBe('OR1001');
      expect(filtered.tables.pricehist.length).toBe(1);
      expect(filtered.tables.pricehist[0].effdate).toBe('2026-01-01');
      expect(filtered.tables.jobhistory.length).toBe(1);
      expect(filtered.tables.jobhistory[0].effdate).toBe('2026-01-15');
    });

    test('rejects invalid PITR target timestamp string', () => {
      expect(() => filterSnapshotToPointInTime(mockSnapshot, 'invalid-date-string')).toThrow();
    });
  });
});
