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
  updateJob
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
