import { beforeEach, describe, expect, it, vi } from 'vitest';

let activePool;

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: { requirePool: () => activePool }
};

const { getAuditLogs, getAuditLog } = require('../../controllers/audit-log-controller');
const auditLogRoutes = require('../../routes/audit-log-routes');

function invokeHandler(handler, { user, query = {}, params = {} } = {}) {
  return new Promise((resolve) => {
    const req = { user, query, params };
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve(this);
        return this;
      }
    };
    handler(req, res, (error) => {
      if (error) {
        res.statusCode = error.statusCode || 500;
        res.body = {
          success: false,
          error: { message: error.message, statusCode: error.statusCode }
        };
      }
      resolve(res);
    });
  });
}

beforeEach(() => {
  activePool = {
    query: vi.fn(async (sql) => ({
      rows: sql.includes('count(*)') ? [{ total: 42 }] : [
        {
          auditId: '101',
          tableName: 'sales',
          action: 'UPDATE',
          recordKey: 'SO-1001',
          actionBy: 'esperanza.nehemiah@hope.inc',
          actionAt: '2026-11-02T10:00:00Z',
        }
      ]
    }))
  };
});

describe('Superadmin Audit Log API (Issue #80)', () => {
  describe('Authorization and Access Control', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const response = await invokeHandler(getAuditLogs, { user: null });
      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toMatch(/Authentication required/i);
    });

    it('rejects employee requests with 403 Forbidden', async () => {
      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'employee', email: 'emp@hope.inc' }
      });
      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toMatch(/Superadmin access required/i);
    });

    it('rejects standard admin requests with 403 Forbidden', async () => {
      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'admin', email: 'admin@hope.inc' }
      });
      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toMatch(/Superadmin access required/i);
    });

    it('allows superadmin role to access audit logs', async () => {
      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'superadmin', email: 'super@hope.inc' }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toHaveLength(1);
    });

    it('allows administrator role alias to access audit logs', async () => {
      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'administrator', email: 'admin@hope.inc' }
      });
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Multi-Filter Search & Pagination', () => {
    it('uses direct indexed queries and treats the end date as an inclusive calendar day', async () => {
      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'superadmin' },
        query: {
          tableName: 'sales',
          action: 'UPDATE',
          username: 'esperanza',
          startDate: '2026-10-01',
          endDate: '2026-11-02',
          page: '2',
          limit: '15'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(activePool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY action_at DESC, audit_id DESC'),
        ['sales', ['UPDATE', 'EDIT'], '%esperanza%', '2026-10-01', '2026-11-03T00:00:00.000Z', 15, 15]
      );
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 15,
        total: 42,
        totalPages: 3
      });
    });

    it('loads JSON snapshots only for the requested audit entry', async () => {
      activePool.query = vi.fn(async () => ({
        rows: [
          {
            auditId: '55',
            tableName: 'customer',
            action: 'INSERT',
            recordKey: 'CUST-001',
            oldValues: null,
            newValues: { name: 'Acme Corp', status: 'Active' },
            actionBy: 'system',
            actionAt: '2026-11-01T08:00:00Z'
          }
        ]
      }));

      const response = await invokeHandler(getAuditLog, {
        user: { role: 'superadmin' }, params: { auditId: '55' }
      });

      expect(response.statusCode).toBe(200);
      const log = response.body.data.log;
      expect(log.auditId).toBe('55');
      expect(log.tableName).toBe('customer');
      expect(log.action).toBe('INSERT');
      expect(log.oldValues).toBeNull();
      expect(log.newValues).toEqual({ name: 'Acme Corp', status: 'Active' });
      expect(log.actionBy).toBe('system');
    });

    it('keeps the total when a page is out of range and omits snapshots from list queries', async () => {
      activePool.query = vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 42 }] });

      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'superadmin' }, query: { page: '999' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.pagination.total).toBe(42);
      expect(response.body.data.logs).toEqual([]);
      expect(activePool.query.mock.calls[0][0]).not.toMatch(/old_values|new_values|OVER\(|query_audit_logs/);
      expect(activePool.query).toHaveBeenCalledTimes(2);
    });
    it.each([{ action: 'drop' }, { startDate: '2026-02-31' }, { startDate: '2026-02-31T00:00:00Z' }, { startDate: '2026-11-03', endDate: '2026-11-01' }])('rejects invalid filters before querying: %o', async (query) => {
      const response = await invokeHandler(getAuditLogs, { user: { role: 'superadmin' }, query });
      expect(response.statusCode).toBe(400);
      expect(activePool.query).not.toHaveBeenCalled();
    });
    it('protects detail access and validates entry identifiers', async () => {
      expect((await invokeHandler(getAuditLog, { user: { role: 'employee' }, params: { auditId: '1' } })).statusCode).toBe(403);
      expect((await invokeHandler(getAuditLog, { user: { role: 'superadmin' }, params: { auditId: '1 OR 1=1' } })).statusCode).toBe(400);
      expect(activePool.query).not.toHaveBeenCalled();
    });
  });
});
