// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-characters-required-for-ci';

const client = { query: vi.fn(), release: vi.fn() };
const pool = { query: vi.fn(), connect: vi.fn().mockResolvedValue(client) };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const employeeRoutes = require('./employee-routes');
const { errorHandler } = require('../middleware/error-handler');

const adminId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/employees', employeeRoutes);
  app.use('/api/departments', employeeRoutes.departmentRouter);
  app.use('/api/jobs', employeeRoutes.jobRouter);
  app.use(errorHandler);
  return app;
}

function authCookie(sub, role) {
  const token = jwt.sign({ sub, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return `access_token=${token}`;
}

describe('routes/employee-routes ([S3-DEV-06])', () => {
  beforeEach(() => {
    client.query.mockReset();
    client.release.mockReset();
    pool.query.mockReset();
    pool.connect.mockReset().mockResolvedValue(client);
  });

  test('mounts employee, job-history, department, and job sub-routers', () => {
    const empPaths = employeeRoutes.stack.filter((l) => l.route).map((l) => l.route.path);
    const deptPaths = employeeRoutes.departmentRouter.stack.filter((l) => l.route).map((l) => l.route.path);
    const jobPaths = employeeRoutes.jobRouter.stack.filter((l) => l.route).map((l) => l.route.path);

    expect(empPaths).toEqual(expect.arrayContaining([
      '/',
      '/options',
      '/jobs',
      '/departments',
      '/:empno/job-history',
      '/:empno',
      '/:empno/restore',
    ]));
    expect(deptPaths).toEqual(expect.arrayContaining(['/', '/:deptcode', '/:deptcode/restore']));
    expect(jobPaths).toEqual(expect.arrayContaining(['/', '/:jobcode', '/:jobcode/restore']));
  });

  test('allows standard employee with hr.history.view to read job history with masked salary, but blocks promotion POST (403)', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['hr.access', 'hr.history.view'] }],
      })
      .mockResolvedValueOnce({ rows: [{ empno: '00001', is_deleted: false }] })
      .mockResolvedValueOnce({
        rows: [{ empno: '00001', jobcode: 'PR1', deptcode: 'IT', effdate: '2025-01-01', jobdesc: 'Programmer 1', deptname: 'Information Tech', salary: null, is_deleted: false, stamp: 'ADD' }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['hr.access', 'hr.history.view'] }],
      });

    const app = makeApp();
    const empCookie = authCookie(employeeId, 'employee');

    const getRes = await request(app).get('/api/employees/00001/job-history').set('Cookie', empCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.history[0].salary).toBeNull();

    const postRes = await request(app)
      .post('/api/employees/00001/job-history')
      .set('Cookie', empCookie)
      .send({ deptcode: 'IT', jobcode: 'PR2', salary: 55000, effdate: '2026-01-01' });
    expect(postRes.status).toBe(403);
  });

  test('validates promotion payload boundaries for authorized admins on POST /:empno/job-history', async () => {
    pool.query.mockResolvedValue({
      rows: [{ user_id: adminId, empno: '00001', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }],
    });

    const app = makeApp();
    const adminCookie = authCookie(adminId, 'admin');

    const badDept = await request(app)
      .post('/api/employees/00001/job-history')
      .set('Cookie', adminCookie)
      .send({ deptcode: 'TOOLONG', jobcode: 'PR2', salary: 50000, effdate: '2026-01-01' });
    expect(badDept.status).toBe(400);

    const badSalary = await request(app)
      .post('/api/employees/00001/job-history')
      .set('Cookie', adminCookie)
      .send({ deptcode: 'IT', jobcode: 'PR2', salary: -100, effdate: '2026-01-01' });
    expect(badSalary.status).toBe(400);
  });

  test('supports CRUD, validation, and 403/409 guards on /api/employees/departments and /api/employees/jobs', async () => {
    const app = makeApp();
    const adminCookie = authCookie(adminId, 'admin');
    const viewCookie = authCookie(employeeId, 'employee');

    pool.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('FROM public.app_user')) {
        if (sql.includes(adminId) || pool.query.mock.calls.at(-1)?.[1]?.[0] === adminId) {
          return { rows: [{ user_id: adminId, empno: '00001', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }] };
        }
        return { rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['hr.access'] }] };
      }
      if (typeof sql === 'string' && sql.includes('FROM public.department')) {
        if (sql.includes('count(*)')) return { rows: [{ total: 1 }] };
        return { rows: [{ deptcode: 'IT', deptname: 'Information Tech', is_deleted: false, stamp: 'ADD admin' }] };
      }
      if (typeof sql === 'string' && sql.includes('FROM public.job')) {
        if (sql.includes('count(*)')) return { rows: [{ total: 1 }] };
        return { rows: [{ jobcode: 'DEV', jobdesc: 'Developer', is_deleted: false, stamp: 'ADD admin' }] };
      }
      return { rows: [] };
    });

    client.query.mockImplementation(async (sql, params) => {
      if (typeof sql !== 'string') return { rows: [] };
      if (sql.includes('INSERT INTO public.department')) {
        return { rows: [{ deptcode: params[0], deptname: params[1], is_deleted: false, stamp: 'ADD admin' }] };
      }
      if (sql.includes('UPDATE public.department SET deptname')) {
        return { rows: [{ deptcode: params[1], deptname: params[0], is_deleted: false, stamp: 'EDIT admin' }] };
      }
      if (sql.includes('FROM public.department WHERE deptcode = $1 AND is_deleted = false FOR UPDATE')) {
        return { rows: [{ deptcode: params[0] }] };
      }
      if (sql.includes('FROM public.jobhistory WHERE deptcode = $1')) {
        return params[0] === 'BUSY' ? { rows: [{ 1: 1 }] } : { rows: [] };
      }
      if (sql.includes('UPDATE public.department SET is_deleted = true')) {
        return { rows: [{ deptcode: params[0], deptname: 'Temp', is_deleted: true, stamp: 'DEL admin' }] };
      }
      if (sql.includes('UPDATE public.department SET is_deleted = false')) {
        return { rows: [{ deptcode: params[0], deptname: 'Temp', is_deleted: false, stamp: 'RES admin' }] };
      }
      if (sql.includes('INSERT INTO public.job')) {
        return { rows: [{ jobcode: params[0], jobdesc: params[1], is_deleted: false, stamp: 'ADD admin' }] };
      }
      if (sql.includes('UPDATE public.job SET jobdesc')) {
        return { rows: [{ jobcode: params[1], jobdesc: params[0], is_deleted: false, stamp: 'EDIT admin' }] };
      }
      if (sql.includes('FROM public.job WHERE jobcode = $1 AND is_deleted = false FOR UPDATE')) {
        return { rows: [{ jobcode: params[0] }] };
      }
      if (sql.includes('FROM public.jobhistory WHERE jobcode = $1')) {
        return params[0] === 'BUSY' ? { rows: [{ 1: 1 }] } : { rows: [] };
      }
      if (sql.includes('UPDATE public.job SET is_deleted = true')) {
        return { rows: [{ jobcode: params[0], jobdesc: 'Temp', is_deleted: true, stamp: 'DEL admin' }] };
      }
      if (sql.includes('UPDATE public.job SET is_deleted = false')) {
        return { rows: [{ jobcode: params[0], jobdesc: 'Temp', is_deleted: false, stamp: 'RES admin' }] };
      }
      return { rows: [] };
    });

    // Departments CRUD
    const deptList = await request(app).get('/api/employees/departments').set('Cookie', viewCookie);
    expect(deptList.status).toBe(200);
    expect(deptList.body.data.departments).toHaveLength(1);

    const deptForbidden = await request(app).post('/api/employees/departments').set('Cookie', viewCookie).send({ deptcode: 'OPS', deptname: 'Operations' });
    expect(deptForbidden.status).toBe(403);

    const deptBadCode = await request(app).post('/api/employees/departments').set('Cookie', adminCookie).send({ deptcode: 'TOOLONG', deptname: 'Operations' });
    expect(deptBadCode.status).toBe(400);

    const deptCreated = await request(app).post('/api/employees/departments').set('Cookie', adminCookie).send({ deptcode: 'OPS', deptname: 'Operations' });
    expect(deptCreated.status).toBe(201);
    expect(deptCreated.body.data.department.deptcode).toBe('OPS');

    const deptUpdated = await request(app).put('/api/employees/departments/OPS').set('Cookie', adminCookie).send({ deptname: 'Operations Dept' });
    expect(deptUpdated.status).toBe(200);

    const deptConflict = await request(app).delete('/api/employees/departments/BUSY').set('Cookie', adminCookie);
    expect(deptConflict.status).toBe(409);

    const deptDeleted = await request(app).delete('/api/employees/departments/OPS').set('Cookie', adminCookie);
    expect(deptDeleted.status).toBe(200);

    const deptRestored = await request(app).post('/api/employees/departments/OPS/restore').set('Cookie', adminCookie);
    expect(deptRestored.status).toBe(200);

    // Jobs CRUD
    const jobList = await request(app).get('/api/employees/jobs').set('Cookie', viewCookie);
    expect(jobList.status).toBe(200);
    expect(jobList.body.data.jobs).toHaveLength(1);

    const jobForbidden = await request(app).post('/api/employees/jobs').set('Cookie', viewCookie).send({ jobcode: 'QA', jobdesc: 'QA Engineer' });
    expect(jobForbidden.status).toBe(403);

    const jobBadDesc = await request(app).post('/api/employees/jobs').set('Cookie', adminCookie).send({ jobcode: 'QA', jobdesc: 'X'.repeat(21) });
    expect(jobBadDesc.status).toBe(400);

    const jobCreated = await request(app).post('/api/employees/jobs').set('Cookie', adminCookie).send({ jobcode: 'QA', jobdesc: 'QA Engineer' });
    expect(jobCreated.status).toBe(201);
    expect(jobCreated.body.data.job.jobcode).toBe('QA');

    const jobUpdated = await request(app).put('/api/employees/jobs/QA').set('Cookie', adminCookie).send({ jobdesc: 'Senior QA' });
    expect(jobUpdated.status).toBe(200);

    const jobConflict = await request(app).delete('/api/employees/jobs/BUSY').set('Cookie', adminCookie);
    expect(jobConflict.status).toBe(409);

    const jobDeleted = await request(app).delete('/api/employees/jobs/QA').set('Cookie', adminCookie);
    expect(jobDeleted.status).toBe(200);

    const jobRestored = await request(app).post('/api/employees/jobs/QA/restore').set('Cookie', adminCookie);
    expect(jobRestored.status).toBe(200);
  });

  test('validates employee creation/update payloads (name length, email format, duplicate email 409, RBAC 403)', async () => {
    const app = makeApp();
    const adminCookie = authCookie(adminId, 'admin');
    const viewCookie = authCookie(employeeId, 'employee');

    pool.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('FROM public.app_user')) {
        if (params?.[0] === adminId) {
          return { rows: [{ user_id: adminId, empno: '00001', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }] };
        }
        return { rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['hr.access'] }] };
      }
      return { rows: [] };
    });

    const forbidden = await request(app)
      .post('/api/employees')
      .set('Cookie', viewCookie)
      .send({ firstname: 'Jane', lastname: 'Doe', email: 'jane@hope.inc', hiredate: '2026-01-01', deptcode: 'IT', jobcode: 'DEV', salary: 35000 });
    expect(forbidden.status).toBe(403);

    const badEmail = await request(app)
      .post('/api/employees')
      .set('Cookie', adminCookie)
      .send({ firstname: 'Jane', lastname: 'Doe', email: 'not-an-email', hiredate: '2026-01-01', deptcode: 'IT', jobcode: 'DEV', salary: 35000 });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.message).toMatch(/valid work email/i);

    const longName = await request(app)
      .post('/api/employees')
      .set('Cookie', adminCookie)
      .send({ firstname: 'A'.repeat(16), lastname: 'Doe', email: 'jane@hope.inc', hiredate: '2026-01-01', deptcode: 'IT', jobcode: 'DEV', salary: 35000 });
    expect(longName.status).toBe(400);

    client.query.mockImplementation(async (sql, params) => {
      if (typeof sql !== 'string') return { rows: [] };
      if (sql.includes('EXISTS(SELECT 1 FROM public.job')) return { rows: [{ job: true, department: true }] };
      if (sql.includes('max(empno::integer)')) return { rows: [{ id: 12 }] };
      if (sql.includes('INSERT INTO public.employee')) {
        if (params?.[3] === 'dup@hope.inc') {
          const err = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        return { rows: [] };
      }
      return { rows: [] };
    });

    const dupEmail = await request(app)
      .post('/api/employees')
      .set('Cookie', adminCookie)
      .send({ firstname: 'Jane', lastname: 'Doe', email: 'dup@hope.inc', hiredate: '2026-01-01', deptcode: 'IT', jobcode: 'DEV', salary: 35000 });
    expect(dupEmail.status).toBe(409);

    const created = await request(app)
      .post('/api/employees')
      .set('Cookie', adminCookie)
      .send({ firstname: 'Jane', lastname: 'Doe', email: 'jane@hope.inc', hiredate: '2026-01-01', deptcode: 'IT', jobcode: 'DEV', salary: 35000 });
    expect(created.status).toBe(201);
    expect(created.body.data.empno).toBe('00012');
  });

  test('redacts salary on GET /api/employees for standard employees and exposes unredacted salary for admin and superadmin', async () => {
    const app = makeApp();
    const superadminId = '33333333-3333-4333-8333-333333333333';

    pool.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('SELECT count(*)::integer AS total')) {
        return { rows: [{ total: 1 }] };
      }
      if (typeof sql === 'string' && sql.includes('FROM public.employee e')) {
        const redacted = sql.includes('NULL::numeric AS salary');
        return {
          rows: [{
            empno: '00001',
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane@hope.inc',
            hiredate: '2022-01-01',
            is_deleted: false,
            jobcode: 'DEV',
            deptcode: 'IT',
            effdate: '2026-01-01',
            jobdesc: 'Developer',
            deptname: 'Information Tech',
            salary: redacted ? null : '75000.00',
          }],
        };
      }
      if (typeof sql === 'string' && sql.includes('FROM public.app_user')) {
        const sub = params?.[0];
        if (sub === adminId) {
          return { rows: [{ user_id: adminId, empno: '00001', email: 'admin@hope.inc', role: 'admin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }] };
        }
        if (sub === superadminId) {
          return { rows: [{ user_id: superadminId, empno: '00000', email: 'super@hope.inc', role: 'superadmin', status: 'active', is_blocked: false, must_change_password: false, rights: [] }] };
        }
        return { rows: [{ user_id: employeeId, empno: '00002', email: 'emp@hope.inc', role: 'employee', status: 'active', is_blocked: false, must_change_password: false, rights: ['hr.access'] }] };
      }
      return { rows: [] };
    });

    const empRes = await request(app).get('/api/employees').set('Cookie', authCookie(employeeId, 'employee'));
    expect(empRes.status).toBe(200);
    expect(empRes.body.data.employees[0].salary).toBeNull();

    const adminRes = await request(app).get('/api/employees').set('Cookie', authCookie(adminId, 'admin'));
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.employees[0].salary).toBe('75000.00');

    const superRes = await request(app).get('/api/employees').set('Cookie', authCookie(superadminId, 'superadmin'));
    expect(superRes.status).toBe(200);
    expect(superRes.body.data.employees[0].salary).toBe('75000.00');
  });
});
