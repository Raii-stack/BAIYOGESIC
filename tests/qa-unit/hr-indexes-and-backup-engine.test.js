const fs = require('fs');
const path = require('path');

jest.mock('../../db', () => ({
  requirePool: jest.fn(),
  pool: {},
  supabase: {
    from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
  }
}));

const {
  ORDERED_TABLES,
  REQUIRED_HR_INDEXES,
  createBackupSnapshot,
  verifyDatabaseState,
  restoreAndValidateDrill,
  runCli
} = require('../../scripts/db-backup-restore');

const ROOT = path.join(__dirname, '..', '..');

describe('Issue #67: HR Indexes & Backup/Restore Disaster Recovery Engine', () => {
  const migrationSql = fs.readFileSync(
    path.join(ROOT, 'supabase', 'migrations', '20261027000001_issue_67_hr_indexes_and_dr_support.sql'),
    'utf8'
  );

  test('migration creates all 5 required HR directory and jobhistory covering indexes', () => {
    for (const idx of REQUIRED_HR_INDEXES) {
      expect(migrationSql).toContain(`CREATE INDEX IF NOT EXISTS ${idx}`);
    }
    expect(migrationSql).toContain('INCLUDE (deptcode, salary)');
  });

  test('createBackupSnapshot builds verifiable manifest across ordered tables and handles optional full tables', async () => {
    const mockDb = {
      query: jest.fn(async (sql) => {
        if (sql.includes('FROM pg_indexes')) {
          return {
            rows: [{ tablename: 'jobhistory', indexname: 'jobhistory_empno_effdate_is_deleted_idx', indexdef: 'CREATE INDEX ...' }]
          };
        }
        if (sql.includes('FROM public.department')) {
          return { rows: [{ deptcode: 'IT', deptname: 'Information Tech', is_deleted: false }] };
        }
        if (sql.includes('FROM public.audit_log')) {
          throw new Error('relation missing');
        }
        return { rows: [] };
      })
    };

    const snapshot = await createBackupSnapshot(mockDb, { full: true });
    expect(snapshot.metadata.totalRows).toBe(1);
    expect(snapshot.metadata.hrIndexes).toHaveLength(1);
    expect(snapshot.tables.department).toHaveLength(1);
    expect(snapshot.tables.audit_log).toEqual([]);
    expect(snapshot.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  test('verifyDatabaseState checks required HR indexes and composite column ordering', async () => {
    const validDb = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { tablename: 'jobhistory', indexname: 'jobhistory_empno_effdate_is_deleted_idx', indexdef: 'CREATE INDEX idx ON public.jobhistory USING btree (empno, effdate DESC, is_deleted)' },
          { tablename: 'jobhistory', indexname: 'jobhistory_empno_is_deleted_effdate_covering_idx', indexdef: 'CREATE INDEX idx2' },
          { tablename: 'jobhistory', indexname: 'jobhistory_deptcode_is_deleted_idx', indexdef: 'CREATE INDEX idx3' },
          { tablename: 'jobhistory', indexname: 'jobhistory_jobcode_is_deleted_idx', indexdef: 'CREATE INDEX idx4' },
          { tablename: 'employee', indexname: 'employee_status_directory_idx', indexdef: 'CREATE INDEX idx5' }
        ]
      })
    };

    const ok = await verifyDatabaseState(validDb);
    expect(ok).toEqual({ valid: true, verifiedIndexes: REQUIRED_HR_INDEXES });

    const missingDb = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await expect(verifyDatabaseState(missingDb)).rejects.toThrow(/Missing required HR database indexes/);

    const wrongOrderDb = {
      query: jest.fn().mockResolvedValue({
        rows: REQUIRED_HR_INDEXES.map((name) => ({
          tablename: 'jobhistory',
          indexname: name,
          indexdef: 'CREATE INDEX wrong ON public.jobhistory (empno, effdate ASC)'
        }))
      })
    };
    await expect(verifyDatabaseState(wrongOrderDb)).rejects.toThrow(/does not match/);
  });

  test('restoreAndValidateDrill executes inside a rolled-back temp-table transaction and runCli rejects unknown commands', async () => {
    const tables = {};
    const rowCounts = {};
    for (const tbl of ORDERED_TABLES) {
      tables[tbl] = [];
      rowCounts[tbl] = 0;
    }

    const mockClient = {
      query: jest.fn(async (sql) => {
        if (sql.startsWith('SELECT count(*)')) return { rows: [{ total: 0 }] };
        return { rows: [] };
      }),
      release: jest.fn()
    };
    const mockPool = {
      query: jest.fn(async () => ({ rows: [] })),
      connect: jest.fn().mockResolvedValue(mockClient)
    };

    const { computeChecksum } = require('../../scripts/db-backup-restore');
    const snapshot = {
      metadata: { orderedTables: ORDERED_TABLES, rowCounts, totalRows: 0, checksum: computeChecksum(tables) },
      tables
    };

    const result = await restoreAndValidateDrill(mockPool, snapshot);
    expect(result.status).toBe('DR_RESTORE_VERIFIED');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);

    await expect(runCli(['unknown-command'])).rejects.toThrow(/Unknown command/);
  });
});
