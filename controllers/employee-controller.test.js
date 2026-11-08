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

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: {
    requirePool: () => mockPool,
    supabase: {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) })
    }
  }
};

const { listEmployees, getEmployee } = require('./employee-controller');

describe('Employee controller - Account status reflection & filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.query.mockReset();
    mockClient.query.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);

    mockPool.query.mockImplementation(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT count(*)::integer AS total')) {
        return { rows: [{ total: 1 }] };
      }
      return {
        rows: [{
          empno: '00001',
          firstname: 'Prince',
          lastname: 'Nelson',
          email: 'prince@hope.inc',
          gender: 'M',
          birthdate: '1990-01-01',
          hiredate: '2023-01-01',
          sepdate: null,
          is_deleted: false,
          stamp: 'ADD admin',
          jobcode: 'DEV',
          deptcode: 'IT',
          effdate: '2023-01-01',
          jobdesc: 'Developer',
          deptname: 'Information Tech',
          salary: null,
          user_status: 'disabled',
          user_is_blocked: false,
          _total: 1
        }]
      };
    });
  });

  test('listEmployees with status=all queries employees and lateral joins app_user status', async () => {
    const req = { query: { status: 'all' }, user: { role: 'employee' } };
    let responseData = null;
    const res = {
      json: (d) => { responseData = d; return res; },
      status: () => res
    };

    await listEmployees(req, res, (err) => { if (err) throw err; });

    expect(responseData.success).toBe(true);
    expect(responseData.data.employees[0].user_status).toBe('disabled');
    expect(responseData.data.employees[0].user_is_blocked).toBe(false);

    const countSql = mockPool.query.mock.calls[0][0];
    const selectSql = mockPool.query.mock.calls[1][0];
    expect(selectSql).toContain('u.status AS user_status');
    expect(selectSql).toContain('COALESCE(u.is_blocked, false) AS user_is_blocked');
    expect(selectSql).toContain('LEFT JOIN LATERAL (\n  SELECT status, is_blocked\n  FROM public.app_user');
    expect(countSql).toContain('LEFT JOIN LATERAL (\n  SELECT status, is_blocked\n  FROM public.app_user');
  });

  test('listEmployees rejects invalid status with 400', async () => {
    const req = { query: { status: 'unknown_status' }, user: { role: 'employee' } };
    let errorThrown = null;
    const res = {
      json: vi.fn(),
      status: vi.fn()
    };

    await listEmployees(req, res, (err) => { errorThrown = err; });

    expect(errorThrown).toBeTruthy();
    expect(errorThrown.statusCode).toBe(400);
    expect(errorThrown.message).toContain('Invalid employee status');
  });

  test('listEmployees status=active filters out blocked, disabled/rejected, and pending accounts', async () => {
    const req = { query: { status: 'active' }, user: { role: 'employee' } };
    const res = { json: vi.fn(), status: vi.fn() };

    await listEmployees(req, res, (err) => { if (err) throw err; });

    const querySql = mockPool.query.mock.calls[0][0];
    expect(querySql).toContain('e.is_deleted = false AND e.sepdate IS NULL');
    expect(querySql).toContain('COALESCE(u.is_blocked, false) = false');
    expect(querySql).toContain('(u.status IS NULL OR u.status = \'active\')');
  });

  test('listEmployees status=blocked filters by u.is_blocked = true', async () => {
    const req = { query: { status: 'blocked' }, user: { role: 'employee' } };
    const res = { json: vi.fn(), status: vi.fn() };

    await listEmployees(req, res, (err) => { if (err) throw err; });

    const querySql = mockPool.query.mock.calls[0][0];
    expect(querySql).toContain('u.is_blocked = true');
  });

  test('listEmployees status=disabled filters by u.status = disabled OR rejected', async () => {
    const req = { query: { status: 'disabled' }, user: { role: 'employee' } };
    const res = { json: vi.fn(), status: vi.fn() };

    await listEmployees(req, res, (err) => { if (err) throw err; });

    const querySql = mockPool.query.mock.calls[0][0];
    expect(querySql).toContain("u.status = 'disabled' OR u.status = 'rejected'");
  });

  test('listEmployees status=rejected filters by u.status = disabled OR rejected', async () => {
    const req = { query: { status: 'rejected' }, user: { role: 'employee' } };
    const res = { json: vi.fn(), status: vi.fn() };

    await listEmployees(req, res, (err) => { if (err) throw err; });

    const querySql = mockPool.query.mock.calls[0][0];
    expect(querySql).toContain("u.status = 'disabled' OR u.status = 'rejected'");
  });

  test('listEmployees status=pending filters by u.status = pending', async () => {
    const req = { query: { status: 'pending' }, user: { role: 'employee' } };
    const res = { json: vi.fn(), status: vi.fn() };

    await listEmployees(req, res, (err) => { if (err) throw err; });

    const querySql = mockPool.query.mock.calls[0][0];
    expect(querySql).toContain("u.status = 'pending'");
  });

  test('getEmployee selects employee with user_status and user_is_blocked', async () => {
    mockPool.query.mockResolvedValue({
      rows: [{
        empno: '00001',
        firstname: 'Prince',
        lastname: 'Nelson',
        email: 'prince@hope.inc',
        gender: 'M',
        birthdate: '1990-01-01',
        hiredate: '2023-01-01',
        sepdate: null,
        is_deleted: false,
        stamp: 'ADD admin',
        jobcode: 'DEV',
        deptcode: 'IT',
        effdate: '2023-01-01',
        jobdesc: 'Developer',
        deptname: 'Information Tech',
        salary: null,
        user_status: 'disabled',
        user_is_blocked: true
      }]
    });

    const req = { params: { empno: '00001' }, user: { role: 'superadmin' } };
    let responseData = null;
    const res = { json: (d) => { responseData = d; return res; }, status: () => res };

    await getEmployee(req, res, (err) => { if (err) throw err; });

    expect(responseData.success).toBe(true);
    expect(responseData.data.employee.user_status).toBe('disabled');
    expect(responseData.data.employee.user_is_blocked).toBe(true);

    const querySql = mockPool.query.mock.calls[0][0];
    expect(querySql).toContain('u.status AS user_status');
    expect(querySql).toContain('COALESCE(u.is_blocked, false) AS user_is_blocked');
  });
});
