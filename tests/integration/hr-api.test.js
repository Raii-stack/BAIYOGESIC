// @vitest-environment node
import { describe, test, expect, beforeEach, vi } from 'vitest';

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
  listDepartments,
  createDepartment,
  updateDepartment,
  listJobs,
  createJob,
  updateJob,
  getJobHistory,
  recordPromotion
} = require('../../controllers/employee-controller');
const { requirePermission } = require('../../middleware/permissions');
const employeeRoutes = require('../../routes/employee-routes');

describe('[S3-DEV-01] Department and Job Master List CRUD Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);

    mockPool.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM public.department d')) {
        if (sql.includes('SELECT count(*)::integer AS total')) {
          return { rows: [{ total: 3 }] };
        }
        return {
          rows: [
            { deptcode: 'ACT', deptname: 'Accounting', is_deleted: false, stamp: 'ADD admin', employee_count: 2 },
            { deptcode: 'HRD', deptname: 'Human Resource', is_deleted: false, stamp: 'ADD admin', employee_count: 3 },
            { deptcode: 'IT', deptname: 'Information Tech', is_deleted: false, stamp: 'ADD admin', employee_count: 6 }
          ]
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM public.job j')) {
        if (sql.includes('SELECT count(*)::integer AS total')) {
          return { rows: [{ total: 3 }] };
        }
        return {
          rows: [
            { jobcode: 'ANYS', jobdesc: 'Analyst', is_deleted: false, stamp: 'ADD admin', employee_count: 3 },
            { jobcode: 'MGR', jobdesc: 'Manager', is_deleted: false, stamp: 'ADD admin', employee_count: 7 },
            { jobcode: 'PR1', jobdesc: 'Programmer 1', is_deleted: false, stamp: 'ADD admin', employee_count: 2 }
          ]
        };
      }
      return { rows: [] };
    });

    mockClient.query.mockImplementation(async (sql, params) => {
      // Department duplicate checks
      if (typeof sql === 'string' && sql.includes('SELECT deptcode, deptname FROM public.department WHERE UPPER(deptcode) = $1 OR LOWER(deptname) = LOWER($2)')) {
        const [code, name] = params || [];
        if (code === 'IT') return { rows: [{ deptcode: 'IT', deptname: 'Information Tech' }] };
        if (String(name || '').toLowerCase() === 'information tech') return { rows: [{ deptcode: 'IT', deptname: 'Information Tech' }] };
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT deptcode FROM public.department WHERE LOWER(deptname) = LOWER($1) AND UPPER(deptcode) <> $2')) {
        const [name, code] = params || [];
        if (String(name || '').toLowerCase() === 'accounting' && code !== 'ACT') {
          return { rows: [{ deptcode: 'ACT' }] };
        }
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO public.department')) {
        if (params?.[0] === 'DUP') {
          const err = new Error('duplicate key value violates unique constraint "department_pkey"');
          err.code = '23505';
          throw err;
        }
        return {
          rows: [{
            deptcode: params?.[0] || 'RND',
            deptname: params?.[1] || 'Research & Dev',
            is_deleted: false,
            stamp: 'ADD admin@hope.inc'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.department SET deptname = $1 WHERE deptcode = $2')) {
        if (params?.[1] === 'ZZZ') return { rows: [] };
        return {
          rows: [{
            deptcode: params?.[1],
            deptname: params?.[0],
            is_deleted: false,
            stamp: 'EDIT admin@hope.inc'
          }]
        };
      }

      // Job duplicate checks
      if (typeof sql === 'string' && sql.includes('SELECT jobcode, jobdesc FROM public.job WHERE UPPER(jobcode) = $1 OR LOWER(jobdesc) = LOWER($2)')) {
        const [code, desc] = params || [];
        if (code === 'PR1') return { rows: [{ jobcode: 'PR1', jobdesc: 'Programmer 1' }] };
        if (String(desc || '').toLowerCase() === 'programmer 1') return { rows: [{ jobcode: 'PR1', jobdesc: 'Programmer 1' }] };
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT jobcode FROM public.job WHERE LOWER(jobdesc) = LOWER($1) AND UPPER(jobcode) <> $2')) {
        const [desc, code] = params || [];
        if (String(desc || '').toLowerCase() === 'manager' && code !== 'MGR') {
          return { rows: [{ jobcode: 'MGR' }] };
        }
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO public.job')) {
        if (params?.[0] === 'DUPJ') {
          const err = new Error('duplicate key value violates unique constraint "job_pkey"');
          err.code = '23505';
          throw err;
        }
        return {
          rows: [{
            jobcode: params?.[0] || 'DEV',
            jobdesc: params?.[1] || 'Developer',
            is_deleted: false,
            stamp: 'ADD admin@hope.inc'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.job SET jobdesc = $1 WHERE jobcode = $2')) {
        if (params?.[1] === 'ZZZZ') return { rows: [] };
        return {
          rows: [{
            jobcode: params?.[1],
            jobdesc: params?.[0],
            is_deleted: false,
            stamp: 'EDIT admin@hope.inc'
          }]
        };
      }

      return { rows: [] };
    });
  });

  describe('GET /api/departments & GET /api/jobs', () => {
    test('GET /api/departments returns active departments array with employee counts', async () => {
      const req = { baseUrl: '/api/departments', query: {} };
      let responseBody = null;
      const res = {
        status: () => res,
        json: (data) => { responseBody = data; return res; }
      };

      await listDepartments(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      expect(Array.isArray(responseBody.data.departments)).toBe(true);
      expect(responseBody.data.departments).toHaveLength(3);
      expect(responseBody.data.departments[0]).toMatchObject({
        deptcode: 'ACT',
        deptname: 'Accounting',
        employee_count: 2,
        employeeCount: 2
      });
      expect(responseBody.data.departments[2]).toMatchObject({
        deptcode: 'IT',
        deptname: 'Information Tech',
        employee_count: 6,
        employeeCount: 6
      });
    });

    test('GET /api/jobs returns active job position records array', async () => {
      const req = { baseUrl: '/api/jobs', query: {} };
      let responseBody = null;
      const res = {
        status: () => res,
        json: (data) => { responseBody = data; return res; }
      };

      await listJobs(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      expect(Array.isArray(responseBody.data.jobs)).toBe(true);
      expect(responseBody.data.jobs).toHaveLength(3);
      expect(responseBody.data.jobs[0]).toMatchObject({
        jobcode: 'ANYS',
        jobdesc: 'Analyst',
        employee_count: 3,
        employeeCount: 3
      });
    });

    test('rejects invalid status filters on listDepartments and listJobs with HTTP 400', async () => {
      const req = { baseUrl: '/api/departments', query: { status: 'invalid' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await listDepartments(req, res, (err) => { capturedError = err; });
      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);

      let jobError = null;
      await listJobs({ baseUrl: '/api/jobs', query: { status: 'invalid' } }, res, (err) => { jobError = err; });
      expect(jobError).not.toBeNull();
      expect(jobError.statusCode).toBe(400);
    });
  });

  describe('POST /api/departments & PUT /api/departments/:deptcode', () => {
    test('creates a new unique department record with HTTP 201', async () => {
      const req = {
        body: { deptcode: 'rnd', deptname: 'Research & Dev' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (d) => { responseBody = d; return res; }
      };

      await createDepartment(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(201);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.department).toMatchObject({
        deptcode: 'RND',
        deptname: 'Research & Dev',
        is_deleted: false
      });
    });

    test('attempting to insert duplicate department code returns HTTP 400', async () => {
      const req = {
        body: { deptcode: 'IT', deptname: 'New IT Dept' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await createDepartment(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/already exists/i);
    });

    test('attempting to insert duplicate department name or 23505 constraint violation returns HTTP 400', async () => {
      const req = {
        body: { deptcode: 'NEW', deptname: 'Information Tech' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await createDepartment(req, res, (err) => { capturedError = err; });
      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(400);
      expect(capturedError.message).toMatch(/already exists/i);

      let dbConstraintError = null;
      await createDepartment(
        { body: { deptcode: 'DUP', deptname: 'Unique Name' }, user: { email: 'admin@hope.inc' } },
        res,
        (err) => { dbConstraintError = err; }
      );
      expect(dbConstraintError).not.toBeNull();
      expect(dbConstraintError.statusCode).toBe(400);
    });

    test('validates non-empty department code and name boundaries and updates department', async () => {
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
      let emptyCodeErr = null;
      await createDepartment({ body: { deptcode: '', deptname: 'Valid' }, user: { email: 'a@b.c' } }, res, (err) => { emptyCodeErr = err; });
      expect(emptyCodeErr.statusCode).toBe(400);

      let duplicateUpdateErr = null;
      await updateDepartment(
        { params: { deptcode: 'IT' }, body: { deptname: 'Accounting' }, user: { email: 'a@b.c' } },
        res,
        (err) => { duplicateUpdateErr = err; }
      );
      expect(duplicateUpdateErr.statusCode).toBe(400);
    });
  });

  describe('POST /api/jobs & PUT /api/jobs/:jobcode', () => {
    test('creates a new unique job position record with HTTP 201', async () => {
      const req = {
        body: { jobcode: 'dev', jobdesc: 'Developer' },
        user: { email: 'admin@hope.inc', role: 'admin' }
      };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (d) => { responseBody = d; return res; }
      };

      await createJob(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(201);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.job).toMatchObject({
        jobcode: 'DEV',
        jobdesc: 'Developer',
        is_deleted: false
      });
    });

    test('attempting to insert duplicate job code or job title returns HTTP 400', async () => {
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
      let dupCodeErr = null;
      await createJob(
        { body: { jobcode: 'PR1', jobdesc: 'New Role' }, user: { email: 'admin@hope.inc' } },
        res,
        (err) => { dupCodeErr = err; }
      );
      expect(dupCodeErr).not.toBeNull();
      expect(dupCodeErr.statusCode).toBe(400);
      expect(dupCodeErr.message).toMatch(/already exists/i);

      let dupTitleErr = null;
      await createJob(
        { body: { jobcode: 'NEWJ', jobdesc: 'Programmer 1' }, user: { email: 'admin@hope.inc' } },
        res,
        (err) => { dupTitleErr = err; }
      );
      expect(dupTitleErr).not.toBeNull();
      expect(dupTitleErr.statusCode).toBe(400);
      expect(dupTitleErr.message).toMatch(/already exists/i);
    });

    test('validates non-empty job code and title boundaries and rejects duplicate title on update', async () => {
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
      let emptyTitleErr = null;
      await createJob({ body: { jobcode: 'DEV', jobdesc: '   ' }, user: { email: 'a@b.c' } }, res, (err) => { emptyTitleErr = err; });
      expect(emptyTitleErr.statusCode).toBe(400);

      let duplicateUpdateErr = null;
      await updateJob(
        { params: { jobcode: 'PR1' }, body: { jobdesc: 'Manager' }, user: { email: 'a@b.c' } },
        res,
        (err) => { duplicateUpdateErr = err; }
      );
      expect(duplicateUpdateErr.statusCode).toBe(400);
    });
  });

  describe('Permissions & Route Wiring (HTTP 403 Forbidden on Unauthorized Requests)', () => {
    test('unauthorized requests lacking HR.view or HR.edit return HTTP 403 Forbidden', () => {
      const editMiddleware = requirePermission('HR', 'edit');
      const viewMiddleware = requirePermission('HR', 'view');

      // Standard employee without HR edit rights attempting POST /api/departments or /api/jobs
      let status = null;
      let body = null;
      const res = {
        status: (s) => { status = s; return res; },
        json: (d) => { body = d; return res; }
      };
      const next = vi.fn();

      editMiddleware({ user: { role: 'employee', rights: ['hr.access'] } }, res, next);
      expect(status).toBe(403);
      expect(body.success).toBe(false);
      expect(next).not.toHaveBeenCalled();

      // Employee with no HR rights attempting GET /api/departments or /api/jobs
      let viewStatus = null;
      viewMiddleware({ user: { role: 'employee', rights: ['customers.access'] } }, {
        status: (s) => { viewStatus = s; return res; },
        json: () => res
      }, next);
      expect(viewStatus).toBe(403);
      expect(next).not.toHaveBeenCalled();

      // Admin or user with hr.department.add is allowed
      editMiddleware({ user: { role: 'admin' } }, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('registers department and job CRUD endpoints on employeeRoutes and standalone routers', () => {
      expect(employeeRoutes.departmentRouter).toBeDefined();
      expect(employeeRoutes.jobRouter).toBeDefined();

      const deptRoutes = employeeRoutes.departmentRouter.stack
        .filter((l) => l.route)
        .map((l) => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));
      expect(deptRoutes.some((r) => r.path === '/' && r.methods.includes('get'))).toBe(true);
      expect(deptRoutes.some((r) => r.path === '/' && r.methods.includes('post'))).toBe(true);
      expect(deptRoutes.some((r) => r.path === '/:deptcode' && r.methods.includes('put'))).toBe(true);

      const jobRoutes = employeeRoutes.jobRouter.stack
        .filter((l) => l.route)
        .map((l) => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));
      expect(jobRoutes.some((r) => r.path === '/' && r.methods.includes('get'))).toBe(true);
      expect(jobRoutes.some((r) => r.path === '/' && r.methods.includes('post'))).toBe(true);
      expect(jobRoutes.some((r) => r.path === '/:jobcode' && r.methods.includes('put'))).toBe(true);
    });
  });
});

describe('[S3-DEV-06] Employee Job History Promotion & Transfer Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);

    mockPool.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('SELECT empno, is_deleted FROM public.employee WHERE empno = $1')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return { rows: [{ empno: params?.[0] || '00001', is_deleted: false }] };
      }
      if (typeof sql === 'string' && sql.includes('FROM public.jobhistory h') && sql.includes('ORDER BY effdate DESC')) {
        const isRedacted = sql.includes('NULL::numeric AS salary');
        return {
          rows: [
            {
              empno: '00001',
              jobcode: 'MGR',
              deptcode: 'IT',
              effdate: '2025-01-15',
              jobdesc: 'Manager',
              deptname: 'Information Tech',
              salary: isRedacted ? null : '75000.00',
              is_deleted: false,
              stamp: 'ADD admin'
            },
            {
              empno: '00001',
              jobcode: 'ANYS',
              deptcode: 'IT',
              effdate: '2022-03-01',
              jobdesc: 'Analyst',
              deptname: 'Information Tech',
              salary: isRedacted ? null : '62000.00',
              is_deleted: false,
              stamp: 'ADD admin'
            },
            {
              empno: '00001',
              jobcode: 'PR1',
              deptcode: 'IT',
              effdate: '2010-05-11',
              jobdesc: 'Programmer 1',
              deptname: 'Information Tech',
              salary: isRedacted ? null : '48000.00',
              is_deleted: false,
              stamp: 'ADD admin'
            }
          ]
        };
      }
      return { rows: [] };
    });

    mockClient.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('FROM public.employee') && sql.includes('FOR UPDATE')) {
        if (params?.[0] === 'NONEXISTENT') return { rows: [] };
        return {
          rows: [{
            empno: params?.[0] || '00001',
            firstname: 'John',
            lastname: 'Smith',
            email: 'smith.john@hope.inc',
            gender: 'M',
            birthdate: '1985-02-20',
            hiredate: '2010-05-11',
            sepdate: null,
            is_deleted: false,
            stamp: 'ADD admin'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('EXISTS(SELECT 1 FROM public.job')) {
        const [jobcode, deptcode] = params || [];
        return {
          rows: [{
            job: jobcode !== 'BADJ',
            department: deptcode !== 'BADD'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('SELECT 1 FROM public.jobhistory') && sql.includes('effdate = $2::date')) {
        if (params?.[1] === '2025-01-15') return { rows: [{ 1: 1 }] };
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('SELECT jobcode, deptcode, salary, effdate::text AS effdate') && sql.includes('FROM public.jobhistory')) {
        return {
          rows: [{
            jobcode: 'MGR',
            deptcode: 'IT',
            salary: '75000.00',
            effdate: '2025-01-15'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO public.jobhistory')) {
        if (params?.[3] === '2025-12-31') {
          const err = new Error('duplicate key value violates unique constraint "jobhistory_pkey"');
          err.code = '23505';
          throw err;
        }
        return {
          rows: [{
            empno: params?.[0] || '00001',
            jobcode: params?.[1] || 'VP',
            deptcode: params?.[2] || 'EXC',
            effdate: params?.[3] || '2026-06-01',
            salary: params?.[4] || 95000,
            is_deleted: false,
            stamp: 'ADD admin@hope.inc'
          }]
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE public.employee') && sql.includes('SET deptcode = $1')) {
        return {
          rows: [{
            empno: params?.[2] || '00001',
            firstname: 'John',
            lastname: 'Smith',
            email: 'smith.john@hope.inc',
            gender: 'M',
            birthdate: '1985-02-20',
            hiredate: '2010-05-11',
            sepdate: null,
            deptcode: params?.[0] || 'EXC',
            jobcode: params?.[1] || 'VP',
            is_deleted: false,
            stamp: 'EDIT admin@hope.inc'
          }]
        };
      }
      return { rows: [] };
    });
  });

  describe('GET /api/employees/:empno/job-history', () => {
    test('returns chronological career history ordered by effdate DESC', async () => {
      const req = { params: { empno: '00001' }, user: { role: 'admin', email: 'admin@hope.inc' } };
      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await getJobHistory(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.empno).toBe('00001');
      expect(Array.isArray(responseBody.data.jobHistory)).toBe(true);
      expect(responseBody.data.jobHistory).toHaveLength(3);
      expect(responseBody.data.jobHistory[0].effdate).toBe('2025-01-15');
      expect(responseBody.data.jobHistory[1].effdate).toBe('2022-03-01');
      expect(responseBody.data.jobHistory[2].effdate).toBe('2010-05-11');
      expect(responseBody.data.history).toEqual(responseBody.data.jobHistory);

      const historyCall = mockPool.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('ORDER BY effdate DESC')
      );
      expect(historyCall).toBeDefined();
    });

    test('redacts salary for standard employees without salary view rights', async () => {
      const req = { params: { empno: '00001' }, user: { role: 'employee', rights: ['hr.access', 'hr.history.view'] } };
      let responseBody = null;
      const res = {
        status: () => res,
        json: (data) => { responseBody = data; return res; }
      };

      await getJobHistory(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.jobHistory[0].salary).toBeNull();
    });

    test('returns HTTP 404 when employee is not found', async () => {
      const req = { params: { empno: 'NONEXISTENT' }, user: { role: 'admin' } };
      let capturedError = null;
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      await getJobHistory(req, res, (err) => { capturedError = err; });

      expect(capturedError).not.toBeNull();
      expect(capturedError.statusCode).toBe(404);
      expect(capturedError.message).toMatch(/employee not found/i);
    });
  });

  describe('POST /api/employees/:empno/job-history', () => {
    test('recording a promotion writes to jobhistory, updates employee master row, and logs in audit_log', async () => {
      const req = {
        params: { empno: '00001' },
        body: {
          deptcode: 'exc',
          jobcode: 'vp',
          salary: 95000,
          effdate: '2026-06-01'
        },
        user: { sub: 'admin-uuid-1', email: 'admin@hope.inc', role: 'admin' }
      };

      let responseStatus = 200;
      let responseBody = null;
      const res = {
        status: (s) => { responseStatus = s; return res; },
        json: (data) => { responseBody = data; return res; }
      };

      await recordPromotion(req, res, (err) => { if (err) throw err; });

      expect(responseStatus).toBe(201);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.promotion).toMatchObject({
        empno: '00001',
        deptcode: 'EXC',
        jobcode: 'VP',
        salary: 95000,
        effdate: '2026-06-01'
      });
      expect(responseBody.data.employee).toMatchObject({
        empno: '00001',
        deptcode: 'EXC',
        jobcode: 'VP'
      });

      // Verify transaction boundaries
      const executedSql = mockClient.query.mock.calls.map(([sql]) => String(sql));
      expect(executedSql).toContain('BEGIN');
      expect(executedSql).toContain('COMMIT');

      // 1. Verify insert into jobhistory
      const jhInsert = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO public.jobhistory')
      );
      expect(jhInsert).toBeDefined();
      expect(jhInsert[1]).toEqual(['00001', 'VP', 'EXC', '2026-06-01', 95000]);

      // 2. Verify employee master table update with new deptcode and jobcode
      const empUpdate = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('UPDATE public.employee') && sql.includes('SET deptcode = $1')
      );
      expect(empUpdate).toBeDefined();
      expect(empUpdate[1]).toEqual(['EXC', 'VP', '00001']);

      // 3. Verify promotion event logged in audit_log
      const auditInsert = mockClient.query.mock.calls.find(([sql]) =>
        typeof sql === 'string' && sql.includes('INSERT INTO public.audit_log')
      );
      expect(auditInsert).toBeDefined();
      const [, auditParams] = auditInsert;
      expect(auditParams[0]).toBe('00001');
      const oldValues = JSON.parse(auditParams[1]);
      const newValues = JSON.parse(auditParams[2]);
      expect(oldValues).toMatchObject({
        empno: '00001',
        deptcode: 'IT',
        jobcode: 'MGR',
        salary: 75000
      });
      expect(newValues).toMatchObject({
        event: 'PROMOTION',
        empno: '00001',
        deptcode: 'EXC',
        jobcode: 'VP',
        salary: 95000,
        effdate: '2026-06-01'
      });
      expect(auditParams[3]).toBe('admin-uuid-1');
    });

    test('duplicate effective dates for the same employee return HTTP 400', async () => {
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
      let dupError = null;

      await recordPromotion(
        {
          params: { empno: '00001' },
          body: { deptcode: 'EXC', jobcode: 'VP', salary: 95000, effdate: '2025-01-15' },
          user: { email: 'admin@hope.inc', role: 'admin' }
        },
        res,
        (err) => { dupError = err; }
      );

      expect(dupError).not.toBeNull();
      expect(dupError.statusCode).toBe(400);
      expect(dupError.message).toMatch(/effective date already exists/i);

      let constraintDupError = null;
      await recordPromotion(
        {
          params: { empno: '00001' },
          body: { deptcode: 'EXC', jobcode: 'VP', salary: 95000, effdate: '2025-12-31' },
          user: { email: 'admin@hope.inc', role: 'admin' }
        },
        res,
        (err) => { constraintDupError = err; }
      );

      expect(constraintDupError).not.toBeNull();
      expect(constraintDupError.statusCode).toBe(400);
      expect(constraintDupError.message).toMatch(/effective date already exists/i);
    });

    test('rejects non-positive salary, invalid dates, and invalid references with HTTP 400', async () => {
      const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      let zeroSalaryErr = null;
      await recordPromotion(
        {
          params: { empno: '00001' },
          body: { deptcode: 'EXC', jobcode: 'VP', salary: 0, effdate: '2026-06-01' },
          user: { email: 'admin@hope.inc' }
        },
        res,
        (err) => { zeroSalaryErr = err; }
      );
      expect(zeroSalaryErr).not.toBeNull();
      expect(zeroSalaryErr.statusCode).toBe(400);
      expect(zeroSalaryErr.message).toMatch(/positive number/i);

      let negativeSalaryErr = null;
      await recordPromotion(
        {
          params: { empno: '00001' },
          body: { deptcode: 'EXC', jobcode: 'VP', salary: -1000, effdate: '2026-06-01' },
          user: { email: 'admin@hope.inc' }
        },
        res,
        (err) => { negativeSalaryErr = err; }
      );
      expect(negativeSalaryErr).not.toBeNull();
      expect(negativeSalaryErr.statusCode).toBe(400);

      let beforeHireErr = null;
      await recordPromotion(
        {
          params: { empno: '00001' },
          body: { deptcode: 'EXC', jobcode: 'VP', salary: 85000, effdate: '2005-01-01' },
          user: { email: 'admin@hope.inc' }
        },
        res,
        (err) => { beforeHireErr = err; }
      );
      expect(beforeHireErr).not.toBeNull();
      expect(beforeHireErr.statusCode).toBe(400);
      expect(beforeHireErr.message).toMatch(/before hire date/i);

      let badRefErr = null;
      await recordPromotion(
        {
          params: { empno: '00001' },
          body: { deptcode: 'BADD', jobcode: 'BADJ', salary: 85000, effdate: '2026-06-01' },
          user: { email: 'admin@hope.inc' }
        },
        res,
        (err) => { badRefErr = err; }
      );
      expect(badRefErr).not.toBeNull();
      expect(badRefErr.statusCode).toBe(400);
    });

    test('registers GET and POST /:empno/job-history routes on employeeRoutes', () => {
      const empRoutes = employeeRoutes.stack
        .filter((l) => l.route)
        .map((l) => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));

      expect(empRoutes.some((r) => r.path === '/:empno/job-history' && r.methods.includes('get'))).toBe(true);
      expect(empRoutes.some((r) => r.path === '/:empno/job-history' && r.methods.includes('post'))).toBe(true);
    });
  });
});

