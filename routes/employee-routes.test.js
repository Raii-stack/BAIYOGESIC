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
});
