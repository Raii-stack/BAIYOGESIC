import { describe, test, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mockClient = {
  query: vi.fn(),
  release: vi.fn()
};

const mockPool = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mockClient)
};

// Ensure both CJS and ESM see the mocked db module
require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: {
    requirePool: () => mockPool,
    supabase: {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
    }
  }
};

const {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  archiveEmployee,
  restoreEmployee,
  archiveJob,
  restoreJob,
  archiveDepartment,
  restoreDepartment
} = require('../../controllers/employee-controller');
const employeeRoutes = require('../../routes/employee-routes');

describe('[S3-DBA-04 & S3-DBA-05] HR Child-Record Delete Constraints, Salary Confidentiality & Job History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  describe('Salary Confidentiality (Role & Granular Rights Enforcement)', () => {
    test('standard employee role receives NULL::numeric AS salary in listEmployees and getEmployee queries', async () => {
      mockPool.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT count(*)::integer AS total')) {
          return { rows: [{ total: 1 }] };
        }
        if (typeof sql === 'string' && sql.includes('FROM public.employee e')) {
          const isRedacted = sql.includes('NULL::numeric AS salary');
          return {
            rows: [{
              empno: '00001',
              firstname: 'John',
              lastname: 'Smith',
              email: 'smith.john@hope.inc',
              jobcode: 'MGR',
              deptcode: 'IT',
              salary: isRedacted ? null : '75000.00',
              is_deleted: false
            }]
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM public.jobhistory h')) {
          const isRedacted = sql.includes('NULL::numeric AS salary');
          return {
            rows: [
              { empno: '00001', jobcode: 'MGR', deptcode: 'IT', effdate: '2025-01-15', salary: isRedacted ? null : '75000.00' },
              { empno: '00001', jobcode: 'ANYS', deptcode: 'IT', effdate: '2022-03-01', salary: isRedacted ? null : '62000.00' }
            ]
          };
        }
        return { rows: [] };
      });

      const listReq = { query: {}, user: { role: 'employee', email: 'smith.john@hope.inc' } };
      let listBody = null;
      const listRes = { json: (d) => { listBody = d; return listRes; }, status: () => listRes };
      await listEmployees(listReq, listRes, (err) => { if (err) throw err; });

      expect(listBody.success).toBe(true);
      expect(listBody.data.employees[0].salary).toBeNull();

      const detailReq = { params: { empno: '00001' }, user: { role: 'user', email: 'smith.john@hope.inc' } };
      let detailBody = null;
      const detailRes = { json: (d) => { detailBody = d; return detailRes; }, status: () => detailRes };
      await getEmployee(detailReq, detailRes, (err) => { if (err) throw err; });

      expect(detailBody.success).toBe(true);
      expect(detailBody.data.employee.salary).toBeNull();
      expect(detailBody.data.history[0].salary).toBeNull();
      expect(detailBody.data.history[1].salary).toBeNull();
    });

    test('admin, superadmin, and HR managers with hr.employee.edit receive full salary values', async () => {
      mockPool.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM public.employee e')) {
          const hasSalary = sql.includes('h.salary AS salary');
          return {
            rows: [{
              empno: '00001',
              firstname: 'John',
              lastname: 'Smith',
              salary: hasSalary ? '75000.00' : null,
              is_deleted: false
            }]
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM public.jobhistory h')) {
          const hasSalary = sql.includes('h.salary AS salary');
          return {
            rows: [
              { empno: '00001', jobcode: 'MGR', deptcode: 'IT', effdate: '2025-01-15', salary: hasSalary ? '75000.00' : null },
              { empno: '00001', jobcode: 'ANYS', deptcode: 'IT', effdate: '2022-03-01', salary: hasSalary ? '62000.00' : null }
            ]
          };
        }
        return { rows: [] };
      });

      const detailReq = {
        params: { empno: '00001' },
        user: { role: 'employee', rights: ['hr.access', 'hr.employee.edit'], email: 'hr@hope.inc' }
      };
      let detailBody = null;
      const detailRes = { json: (d) => { detailBody = d; return detailRes; }, status: () => detailRes };
      await getEmployee(detailReq, detailRes, (err) => { if (err) throw err; });

      expect(detailBody.success).toBe(true);
      expect(detailBody.data.employee.salary).toBe('75000.00');
      expect(detailBody.data.history[0].salary).toBe('75000.00');
      expect(detailBody.data.history[1].salary).toBe('62000.00');
    });
  });

  describe('Department Child-Record Delete Constraints (archiveDepartment & restoreDepartment)', () => {
    beforeEach(() => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT deptcode FROM public.department WHERE deptcode = $1 AND is_deleted = false FOR UPDATE')) {
          if (params?.[0] === 'NONEXISTENT') return { rows: [] };
          return { rows: [{ deptcode: params?.[0] }] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.jobhistory WHERE deptcode = $1 AND is_deleted = false')) {
          if (params?.[0] === 'IT') return { rows: [{ 1: 1 }] };
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE public.department SET is_deleted = true')) {
          if (params?.[0] === 'TRG') {
            const err = new Error('Cannot delete department row: 3 active related record(s) still exist.');
            err.code = 'P0001';
            throw err;
          }
          return {
            rows: [{ deptcode: params?.[0], deptname: 'Empty Dept', is_deleted: true, stamp: 'DELETE admin' }]
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE public.department SET is_deleted = false')) {
          if (params?.[0] === 'NONEXISTENT') return { rows: [] };
          return {
            rows: [{ deptcode: params?.[0], deptname: 'Restored Dept', is_deleted: false, stamp: 'RESTORE admin' }]
          };
        }
        return { rows: [] };
      });
    });

    test('blocks department deletion with HTTP 409 Conflict if active employees/jobhistory are assigned', async () => {
      const req = { params: { deptcode: 'IT' }, user: { email: 'admin@hope.inc' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveDepartment(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive department while active job-history records exist.');
    });

    test('catches PostgreSQL P0001 trg_check_children exception on department soft-delete and returns HTTP 409 Conflict', async () => {
      const req = { params: { deptcode: 'TRG' }, user: { email: 'admin@hope.inc' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveDepartment(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive department while active job-history records exist.');
    });

    test('archives and restores an unreferenced department cleanly', async () => {
      const req = { params: { deptcode: 'TMP' }, user: { email: 'admin@hope.inc' } };
      let archiveBody = null;
      const res = { json: (d) => { archiveBody = d; return res; }, status: () => res };

      await archiveDepartment(req, res, (err) => { if (err) throw err; });
      expect(archiveBody.success).toBe(true);
      expect(archiveBody.data.department.is_deleted).toBe(true);

      let restoreBody = null;
      const resRestore = { json: (d) => { restoreBody = d; return resRestore; }, status: () => resRestore };
      await restoreDepartment(req, resRestore, (err) => { if (err) throw err; });
      expect(restoreBody.success).toBe(true);
      expect(restoreBody.data.department.is_deleted).toBe(false);
    });
  });

  describe('Job Child-Record Delete Constraints (archiveJob & restoreJob)', () => {
    beforeEach(() => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT jobcode FROM public.job WHERE jobcode = $1 AND is_deleted = false FOR UPDATE')) {
          if (params?.[0] === 'NONEXISTENT') return { rows: [] };
          return { rows: [{ jobcode: params?.[0] }] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.jobhistory WHERE jobcode = $1 AND is_deleted = false')) {
          if (params?.[0] === 'PR1') return { rows: [{ 1: 1 }] };
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE public.job SET is_deleted = true')) {
          if (params?.[0] === 'TRGJ') {
            const err = new Error('Cannot delete job row: 2 active related record(s) still exist.');
            err.code = 'P0001';
            throw err;
          }
          return {
            rows: [{ jobcode: params?.[0], jobdesc: 'Temp Job', is_deleted: true, stamp: 'DELETE admin' }]
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE public.job SET is_deleted = false')) {
          if (params?.[0] === 'NONEXISTENT') return { rows: [] };
          return {
            rows: [{ jobcode: params?.[0], jobdesc: 'Temp Job', is_deleted: false, stamp: 'RESTORE admin' }]
          };
        }
        return { rows: [] };
      });
    });

    test('blocks job deletion with HTTP 409 Conflict if active employees/jobhistory are assigned', async () => {
      const req = { params: { jobcode: 'PR1' }, user: { email: 'admin@hope.inc' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveJob(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive job while active job-history records exist.');
    });

    test('catches PostgreSQL P0001 trg_check_children exception on job soft-delete and returns HTTP 409 Conflict', async () => {
      const req = { params: { jobcode: 'TRGJ' }, user: { email: 'admin@hope.inc' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveJob(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive job while active job-history records exist.');
    });

    test('archives and restores an unreferenced job cleanly', async () => {
      const req = { params: { jobcode: 'TMPJ' }, user: { email: 'admin@hope.inc' } };
      let archiveBody = null;
      const res = { json: (d) => { archiveBody = d; return res; }, status: () => res };

      await archiveJob(req, res, (err) => { if (err) throw err; });
      expect(archiveBody.success).toBe(true);
      expect(archiveBody.data.job.is_deleted).toBe(true);

      let restoreBody = null;
      const resRestore = { json: (d) => { restoreBody = d; return resRestore; }, status: () => resRestore };
      await restoreJob(req, resRestore, (err) => { if (err) throw err; });
      expect(restoreBody.success).toBe(true);
      expect(restoreBody.data.job.is_deleted).toBe(false);
    });
  });

  describe('Employee Child-Record Delete Constraints & Job History Tracking', () => {
    beforeEach(() => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT empno, hiredate::text AS hiredate, sepdate::text AS sepdate FROM public.employee WHERE empno = $1 AND is_deleted = false FOR UPDATE')) {
          if (params?.[0] === 'NONEXISTENT') return { rows: [] };
          return { rows: [{ empno: params?.[0], hiredate: '2010-05-11', sepdate: null }] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.sales WHERE empno = $1 AND is_deleted = false')) {
          if (params?.[0] === '00005') return { rows: [{ 1: 1 }] };
          return { rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE public.employee') && sql.includes('SET is_deleted = true')) {
          if (params?.[0] === 'E-TRG-FAIL') {
            const err = new Error('Cannot delete employee row: 1 active related record(s) still exist.');
            err.code = 'P0001';
            throw err;
          }
          return { rows: [{ empno: params?.[0], sepdate: params?.[1] || '2026-10-27', is_deleted: true }] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT empno FROM public.employee WHERE empno = $1 AND is_deleted = false FOR UPDATE')) {
          return { rows: [{ empno: params?.[0] }] };
        }
        if (typeof sql === 'string' && sql.includes('EXISTS(SELECT 1 FROM public.job')) {
          return { rows: [{ job: true, department: true }] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT jobcode, deptcode, salary, effdate::text AS effdate FROM public.jobhistory')) {
          return { rows: [{ jobcode: 'ANYS', deptcode: 'IT', salary: '62000.00', effdate: '2022-03-01' }] };
        }
        return { rows: [] };
      });
    });

    test('blocks archiving an employee referenced by active sales orders with HTTP 409 Conflict', async () => {
      const req = { params: { empno: '00005' }, body: {}, user: { email: 'admin@hope.inc' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveEmployee(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive employee while active sales records exist.');
    });

    test('catches PostgreSQL P0001 trg_check_children exception on employee soft-delete and returns HTTP 409 Conflict', async () => {
      const req = { params: { empno: 'E-TRG-FAIL' }, body: {}, user: { email: 'admin@hope.inc' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await archiveEmployee(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(409);
      expect(capturedError.message).toBe('Cannot archive employee while active sales records exist.');
    });

    test('appends a new jobhistory record when jobcode, deptcode, or salary is updated', async () => {
      const req = {
        params: { empno: '00001' },
        body: {
          firstname: 'John',
          lastname: 'Smith',
          email: 'smith.john@hope.inc',
          gender: 'M',
          birthdate: '1985-02-20',
          hiredate: '2010-05-11',
          jobcode: 'MGR',
          deptcode: 'IT',
          effdate: '2025-01-15',
          salary: 75000
        },
        user: { email: 'admin@hope.inc' }
      };
      let responseBody = null;
      const res = { json: (d) => { responseBody = d; return res; }, status: () => res };

      await updateEmployee(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      const historyInsert = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO public.jobhistory')
      );
      expect(historyInsert).toBeDefined();
      expect(historyInsert[1]).toEqual(['00001', 'MGR', 'IT', '2025-01-15', 75000]);
    });

    test('rejects jobhistory update when effdate precedes the latest job record with HTTP 400', async () => {
      const req = {
        params: { empno: '00001' },
        body: {
          firstname: 'John',
          lastname: 'Smith',
          email: 'smith.john@hope.inc',
          gender: 'M',
          birthdate: '1985-02-20',
          hiredate: '2010-05-11',
          jobcode: 'MGR',
          deptcode: 'IT',
          effdate: '2020-01-01',
          salary: 75000
        },
        user: { email: 'admin@hope.inc' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await updateEmployee(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/cannot precede the latest job record/i);
    });
  });

  describe('Database Migration & Seed Verification ([S3-DBA-04 & S3-DBA-05])', () => {
    test('migration defines child-record delete triggers, foreign keys, and multi-year HR demo seed data', () => {
      const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261027000000_issue_65_hr_constraints_and_demo_data.sql');
      const seedPath = path.resolve(__dirname, '../../supabase/seed.sql');

      expect(fs.existsSync(migrationPath)).toBe(true);
      expect(fs.existsSync(seedPath)).toBe(true);

      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      const seedSql = fs.readFileSync(seedPath, 'utf8');

      // Verify trigger definitions for department, job, employee, jobhistory
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.trg_check_children()');
      expect(migrationSql).toContain("WHEN 'department' THEN");
      expect(migrationSql).toContain("WHEN 'job' THEN");
      expect(migrationSql).toContain("WHEN 'employee' THEN");
      expect(migrationSql).toContain('CREATE TRIGGER department_bu_check');
      expect(migrationSql).toContain('CREATE TRIGGER job_bu_check');
      expect(migrationSql).toContain('CREATE TRIGGER employee_bu_check');

      // Verify foreign key constraints
      expect(migrationSql).toContain('jobhistory_empno_fkey');
      expect(migrationSql).toContain('jobhistory_jobcode_fkey');
      expect(migrationSql).toContain('jobhistory_deptcode_fkey');

      // Verify demo data in both migration and seed.sql covers multiple departments, jobs, and multi-year jobhistory
      for (const sql of [migrationSql, seedSql]) {
        expect(sql).toContain('INSERT INTO public.department');
        expect(sql).toContain('INSERT INTO public.job');
        expect(sql).toContain('INSERT INTO public.employee');
        expect(sql).toContain('INSERT INTO public.jobhistory');
        expect(sql).toContain("'2010-05-11'");
        expect(sql).toContain("'2022-03-01'");
        expect(sql).toContain("'2025-01-15'");
      }
    });
  });
});


const {
  ORDERED_TABLES,
  REQUIRED_HR_INDEXES,
  createBackupSnapshot,
  verifyBackupManifest,
  verifyDatabaseState,
  restoreAndValidateDrill
} = require('../../scripts/db-backup-restore');

describe('[S3-DBA-06] HR Database Indexes and Backup/Restore Disaster Recovery Script', () => {
  const sampleTables = {
    department: [{ deptcode: 'IT', deptname: 'Information Tech', is_deleted: false }],
    job: [{ jobcode: 'PR1', jobdesc: 'Programmer 1', is_deleted: false }],
    employee: [{ empno: '00001', firstname: 'John', lastname: 'Smith', email: 'smith.john@hope.inc', is_deleted: false }],
    jobhistory: [{ empno: '00001', jobcode: 'PR1', effdate: '2025-01-15', salary: '75000.00', deptcode: 'IT', is_deleted: false }],
    customer: [{ custno: 'C1001', custname: 'Apex Office Co', address: '12 Market St', payterm: '30D', is_deleted: false }],
    product: [{ prodcode: 'P1001', description: 'Copy Paper A4', unit: 'pkg', is_deleted: false }],
    pricehist: [{ effdate: '2026-01-15', prodcode: 'P1001', unitprice: '20.00', is_deleted: false }],
    sales: [{ transno: 'SO-202610-0001', salesdate: '2026-10-15', custno: 'C1001', empno: '00001', is_deleted: false }],
    salesdetail: [{ transno: 'SO-202610-0001', prodcode: 'P1001', quantity: 5, is_deleted: false }],
    payment: [{ orno: 'OR-0001', paydate: '2026-10-16', amount: '100.00', transno: 'SO-202610-0001', is_deleted: false }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);

    mockPool.query.mockImplementation(async (sql) => {
      for (const table of ORDERED_TABLES) {
        if (typeof sql === 'string' && sql === `SELECT * FROM public.${table}`) {
          return { rows: sampleTables[table].map((row) => ({ ...row })) };
        }
      }
      if (typeof sql === 'string' && sql.includes('FROM pg_indexes')) {
        return {
          rows: [
            {
              tablename: 'jobhistory',
              indexname: 'jobhistory_empno_effdate_is_deleted_idx',
              indexdef: 'CREATE INDEX jobhistory_empno_effdate_is_deleted_idx ON public.jobhistory USING btree (empno, effdate DESC, is_deleted)'
            },
            {
              tablename: 'jobhistory',
              indexname: 'jobhistory_empno_is_deleted_effdate_covering_idx',
              indexdef: 'CREATE INDEX jobhistory_empno_is_deleted_effdate_covering_idx ON public.jobhistory USING btree (empno, is_deleted, effdate DESC, jobcode DESC) INCLUDE (deptcode, salary)'
            },
            {
              tablename: 'jobhistory',
              indexname: 'jobhistory_deptcode_is_deleted_idx',
              indexdef: 'CREATE INDEX jobhistory_deptcode_is_deleted_idx ON public.jobhistory USING btree (deptcode, is_deleted)'
            },
            {
              tablename: 'jobhistory',
              indexname: 'jobhistory_jobcode_is_deleted_idx',
              indexdef: 'CREATE INDEX jobhistory_jobcode_is_deleted_idx ON public.jobhistory USING btree (jobcode, is_deleted)'
            },
            {
              tablename: 'employee',
              indexname: 'employee_status_directory_idx',
              indexdef: 'CREATE INDEX employee_status_directory_idx ON public.employee USING btree (is_deleted, sepdate, lastname, firstname, empno)'
            }
          ]
        };
      }
      return { rows: [] };
    });

    mockClient.query.mockImplementation(async (sql) => {
      for (const table of ORDERED_TABLES) {
        if (typeof sql === 'string' && sql.includes(`SELECT count(*)::integer AS total FROM dr_${table}`)) {
          return { rows: [{ total: sampleTables[table].length }] };
        }
      }
      return { rows: [] };
    });
  });

  test('migration defines composite index on jobhistory (empno, effdate DESC, is_deleted) and covering HR indexes', () => {
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261027000001_issue_67_hr_indexes_and_dr_support.sql');
    const docPath = path.resolve(__dirname, '../../docs/database/sprint3-hr-indexes-and-disaster-recovery.md');
    const shScriptPath = path.resolve(__dirname, '../../scripts/backup-restore.sh');

    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(docPath)).toBe(true);
    expect(fs.existsSync(shScriptPath)).toBe(true);

    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS jobhistory_empno_effdate_is_deleted_idx');
    expect(migrationSql).toContain('ON public.jobhistory (empno, effdate DESC, is_deleted)');
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS jobhistory_empno_is_deleted_effdate_covering_idx');
    expect(migrationSql).toContain('INCLUDE (deptcode, salary)');
  });

  test('creates a portable backup snapshot with SHA-256 checksum and validates manifest & referential integrity', async () => {
    const snapshot = await createBackupSnapshot(mockPool);
    expect(snapshot.metadata.totalRows).toBe(10);
    expect(snapshot.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);

    const verification = verifyBackupManifest(snapshot);
    expect(verification.valid).toBe(true);
    expect(verification.totalRows).toBe(10);
  });

  test('detects backup tampering or orphan jobhistory foreign keys during manifest verification', async () => {
    const snapshot = await createBackupSnapshot(mockPool);
    const tampered = JSON.parse(JSON.stringify(snapshot));
    tampered.tables.jobhistory[0].salary = '999999.00';

    expect(() => verifyBackupManifest(tampered)).toThrow(/checksum mismatch/i);

    const orphanSnapshot = await createBackupSnapshot(mockPool);
    orphanSnapshot.tables.jobhistory[0].deptcode = 'MISSING';
    // Recompute checksum to test FK check specifically
    const { computeChecksum } = require('../../scripts/db-backup-restore');
    orphanSnapshot.metadata.checksum = computeChecksum(orphanSnapshot.tables);

    expect(() => verifyBackupManifest(orphanSnapshot)).toThrow(/Foreign key integrity failure/i);
  });

  test('verifies live HR indexes and validates full test database restore drill from production-equivalent dump', async () => {
    const dbCheck = await verifyDatabaseState(mockPool);
    expect(dbCheck.valid).toBe(true);
    expect(dbCheck.verifiedIndexes).toEqual(REQUIRED_HR_INDEXES);

    const drill = await restoreAndValidateDrill(mockPool);
    expect(drill.status).toBe('DR_RESTORE_VERIFIED');
    expect(drill.totalRows).toBe(10);
    expect(drill.restoredCounts.jobhistory).toBe(1);
    expect(drill.restoredCounts.employee).toBe(1);
  });
});
