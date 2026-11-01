// @vitest-environment node
import { describe, test, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

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

// Mock authentication middleware to allow testing route authorization guards in isolation
require.cache[require.resolve('../../middleware/auth')] = {
  id: require.resolve('../../middleware/auth'),
  filename: require.resolve('../../middleware/auth'),
  loaded: true,
  exports: {
    authenticate: (req, res, next) => {
      if (req.headers['x-unauthenticated']) {
        return res.status(401).json({ success: false, error: { message: 'Authentication required', statusCode: 401 } });
      }
      next();
    },
    requireActiveUser: (req, res, next) => {
      if (!req.user && !req.headers['x-mock-user']) {
        return res.status(401).json({ success: false, error: { message: 'Authentication required', statusCode: 401 } });
      }
      if (req.headers['x-mock-user']) {
        req.user = JSON.parse(req.headers['x-mock-user']);
      }
      next();
    }
  }
};

const {
  listEmployees,
  getEmployee,
  getJobHistory
} = require('../../controllers/employee-controller');
const { requirePermission } = require('../../middleware/permissions');
const employeeRoutes = require('../../routes/employee-routes');

describe('[S3-DEV-08] API: Field-Level Salary Masking & View Job History Permission Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockReset();
    mockPool.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);

    mockPool.query.mockImplementation(async (sql, params) => {
      if (typeof sql === 'string') {
        if (sql.includes('SELECT count(*)::integer AS total')) {
          return { rows: [{ total: 1 }] };
        }
        if (sql.includes('FROM public.employee e')) {
          const isRedacted = sql.includes('NULL::numeric AS salary');
          return {
            rows: [{
              empno: '00001',
              firstname: 'Jane',
              lastname: 'Doe',
              email: 'jane.doe@hope.inc',
              gender: 'F',
              birthdate: '1990-05-15',
              hiredate: '2020-01-10',
              sepdate: null,
              is_deleted: false,
              stamp: 'ADD admin',
              jobcode: 'MGR',
              deptcode: 'HRD',
              effdate: '2025-01-15',
              jobdesc: 'HR Manager',
              deptname: 'Human Resources',
              salary: isRedacted ? null : '85000.00'
            }]
          };
        }
        if (sql.includes('SELECT empno, is_deleted FROM public.employee WHERE empno = $1')) {
          if (params?.[0] === 'NONEXISTENT') return { rows: [] };
          return { rows: [{ empno: params?.[0] || '00001', is_deleted: false }] };
        }
        if (sql.includes('FROM public.jobhistory h')) {
          const isRedacted = sql.includes('NULL::numeric AS salary');
          return {
            rows: [
              {
                empno: '00001',
                jobcode: 'MGR',
                deptcode: 'HRD',
                effdate: '2025-01-15',
                jobdesc: 'HR Manager',
                deptname: 'Human Resources',
                salary: isRedacted ? null : '85000.00',
                is_deleted: false,
                stamp: 'ADD admin'
              },
              {
                empno: '00001',
                jobcode: 'ANYS',
                deptcode: 'HRD',
                effdate: '2022-03-01',
                jobdesc: 'HR Analyst',
                deptname: 'Human Resources',
                salary: isRedacted ? null : '65000.00',
                is_deleted: false,
                stamp: 'ADD admin'
              }
            ]
          };
        }
      }
      return { rows: [] };
    });
  });

  describe('Acceptance Criteria 1: Requests without salary right return employee records with salary: null', () => {
    test('listEmployees redacts salary to null when user lacks HR.view_salary right', async () => {
      const unauthorizedUsers = [
        { role: 'employee', rights: ['hr.access', 'hr.history.view'] },
        { role: 'employee', rights: ['customers.access'] },
        { role: 'employee', rights: [] },
        { role: 'user' },
        null,
        undefined
      ];

      for (const user of unauthorizedUsers) {
        mockPool.query.mockClear();
        const req = { query: {}, user };
        let responseBody = null;
        const res = { json: (d) => { responseBody = d; return res; }, status: () => res };

        await listEmployees(req, res, (err) => { if (err) throw err; });

        expect(responseBody.success).toBe(true);
        expect(responseBody.data.employees[0].salary).toBeNull();

        // Verify the SQL executed redacted salary at the database projection level
        const selectCall = mockPool.query.mock.calls.find(([sql]) =>
          typeof sql === 'string' && sql.includes('FROM public.employee e') && !sql.includes('count(*)')
        );
        expect(selectCall).toBeDefined();
        expect(selectCall[0]).toContain('NULL::numeric AS salary');
      }
    });

    test('getEmployee redacts employee and history salary fields when caller lacks salary view rights', async () => {
      const req = {
        params: { empno: '00001' },
        user: { role: 'employee', rights: ['hr.access', 'hr.history.view'] }
      };
      let responseBody = null;
      const res = { json: (d) => { responseBody = d; return res; }, status: () => res };

      await getEmployee(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.employee.salary).toBeNull();
      expect(responseBody.data.history).toHaveLength(2);
      expect(responseBody.data.history[0].salary).toBeNull();
      expect(responseBody.data.history[1].salary).toBeNull();
    });

    test('getJobHistory redacts salary across all history rows when user lacks salary view right', async () => {
      const req = {
        params: { empno: '00001' },
        user: { role: 'employee', rights: ['hr.access', 'hr.history.view'] }
      };
      let responseBody = null;
      const res = { json: (d) => { responseBody = d; return res; }, status: () => res };

      await getJobHistory(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.jobHistory[0].salary).toBeNull();
      expect(responseBody.data.jobHistory[1].salary).toBeNull();
      expect(responseBody.data.history[0].salary).toBeNull();
      expect(responseBody.data.history[1].salary).toBeNull();
    });

    test('getJobHistory redacts salary when req.user is absent or unauthenticated', async () => {
      const req = { params: { empno: '00001' }, user: undefined };
      let responseBody = null;
      const res = { json: (d) => { responseBody = d; return res; }, status: () => res };

      await getJobHistory(req, res, (err) => { if (err) throw err; });

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.jobHistory[0].salary).toBeNull();
    });
  });

  describe('Acceptance Criteria 2: Superadmin and authorized HR managers receive full numeric salary figures', () => {
    test('superadmin, administrator, and admin receive full numeric salary in employee list and detail queries', async () => {
      const authorizedRoles = ['superadmin', 'administrator', 'admin', 'hr', 'hr_manager'];

      for (const role of authorizedRoles) {
        mockPool.query.mockClear();
        const listReq = { query: {}, user: { role, email: `${role}@hope.inc` } };
        let listBody = null;
        const listRes = { json: (d) => { listBody = d; return listRes; }, status: () => listRes };

        await listEmployees(listReq, listRes, (err) => { if (err) throw err; });

        expect(listBody.success).toBe(true);
        expect(listBody.data.employees[0].salary).toBe('85000.00');

        const detailReq = { params: { empno: '00001' }, user: { role, email: `${role}@hope.inc` } };
        let detailBody = null;
        const detailRes = { json: (d) => { detailBody = d; return detailRes; }, status: () => detailRes };

        await getEmployee(detailReq, detailRes, (err) => { if (err) throw err; });

        expect(detailBody.success).toBe(true);
        expect(detailBody.data.employee.salary).toBe('85000.00');
        expect(detailBody.data.history[0].salary).toBe('85000.00');
        expect(detailBody.data.history[1].salary).toBe('65000.00');
      }
    });

    test('authorized HR staff with hr.employee.edit or HR.view_salary rights receive full numeric salary figures', async () => {
      const usersWithSalaryRights = [
        { role: 'employee', rights: ['hr.access', 'hr.employee.edit'] },
        { role: 'employee', rights: ['hr.access', 'hr.history.edit'] },
        { role: 'employee', rights: ['hr.access', 'HR.view_salary'] },
        { role: 'employee', rights: ['hr.access', 'hr.view_salary'] },
        { role: 'employee', rights: ['hr.salary'] }
      ];

      for (const user of usersWithSalaryRights) {
        mockPool.query.mockClear();
        const historyReq = { params: { empno: '00001' }, user };
        let historyBody = null;
        const historyRes = { json: (d) => { historyBody = d; return historyRes; }, status: () => historyRes };

        await getJobHistory(historyReq, historyRes, (err) => { if (err) throw err; });

        expect(historyBody.success).toBe(true);
        expect(historyBody.data.jobHistory[0].salary).toBe('85000.00');
        expect(historyBody.data.jobHistory[1].salary).toBe('65000.00');
      }
    });
  });

  describe('Acceptance Criteria 3: Unauthorized calls to job history endpoint return HTTP 403 Forbidden', () => {
    test('requirePermission middleware rejects unauthorized users from job history route with HTTP 403', () => {
      const middleware = requirePermission('Human Resources', 'View Job History');

      const unauthorizedCases = [
        { role: 'employee', rights: ['customers.access'] },
        { role: 'employee', rights: [] },
        { role: 'user', rights: [] },
        { role: 'guest' },
        null,
        undefined
      ];

      for (const user of unauthorizedCases) {
        let statusSent = null;
        let bodySent = null;
        let nextCalled = false;

        const req = { user };
        const res = {
          status(code) { statusSent = code; return res; },
          json(body) { bodySent = body; return res; }
        };

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(false);
        expect(statusSent).toBe(403);
        expect(bodySent).toEqual({
          success: false,
          error: { message: 'Insufficient permissions', statusCode: 403 }
        });
      }
    });

    test('requirePermission middleware permits authorized roles and rights to access job history', () => {
      const middleware = requirePermission('Human Resources', 'View Job History');

      const authorizedCases = [
        { role: 'superadmin' },
        { role: 'administrator' },
        { role: 'admin' },
        { role: 'employee', rights: ['hr.access'] },
        { role: 'employee', rights: ['hr.history.view'] },
        { role: 'employee', rights: ['HR.view_job_history'] },
        { role: 'employee', rights: ['hr.view_job_history'] },
        { role: 'employee', rights: ['hr.employee.edit'] }
      ];

      for (const user of authorizedCases) {
        let nextCalled = false;
        const req = { user };
        const res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis()
        };

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(res.status).not.toHaveBeenCalled();
      }
    });

    test('express app enforces HTTP 403 on /api/employees/:empno/job-history for unauthorized requests', async () => {
      const app = express();
      app.use(express.json());

      // Mount the employee router
      app.use('/api/employees', employeeRoutes);

      // 1. Request without HR job history permissions -> 403
      const unauthorizedRes = await request(app)
        .get('/api/employees/00001/job-history')
        .set('x-mock-user', JSON.stringify({
          role: 'employee',
          rights: ['customers.access']
        }));

      expect(unauthorizedRes.status).toBe(403);
      expect(unauthorizedRes.body.success).toBe(false);
      expect(unauthorizedRes.body.error.statusCode).toBe(403);

      // 2. Request with empty rights list -> 403
      const emptyRightsRes = await request(app)
        .get('/api/employees/00001/job-history')
        .set('x-mock-user', JSON.stringify({
          role: 'employee',
          rights: []
        }));

      expect(emptyRightsRes.status).toBe(403);

      // 3. Request without any authentication header -> 401
      const noAuthRes = await request(app)
        .get('/api/employees/00001/job-history')
        .set('x-unauthenticated', 'true');

      expect(noAuthRes.status).toBe(401);

      // 4. Authorized request with hr.history.view right -> 200 OK
      const authorizedRes = await request(app)
        .get('/api/employees/00001/job-history')
        .set('x-mock-user', JSON.stringify({
          role: 'employee',
          rights: ['hr.access', 'hr.history.view']
        }));

      expect(authorizedRes.status).toBe(200);
      expect(authorizedRes.body.success).toBe(true);
      expect(authorizedRes.body.data.empno).toBe('00001');
      expect(Array.isArray(authorizedRes.body.data.jobHistory)).toBe(true);
      expect(authorizedRes.body.data.jobHistory[0].salary).toBeNull(); // salary masked for non-salary user

      // 5. Authorized superadmin request -> 200 OK with full salary
      const superadminRes = await request(app)
        .get('/api/employees/00001/job-history')
        .set('x-mock-user', JSON.stringify({
          role: 'superadmin',
          email: 'admin@hope.inc'
        }));

      expect(superadminRes.status).toBe(200);
      expect(superadminRes.body.success).toBe(true);
      expect(superadminRes.body.data.jobHistory[0].salary).toBe('85000.00');
    });
  });
});
