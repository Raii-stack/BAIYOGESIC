import { beforeEach, describe, expect, it, vi } from 'vitest';

let activePool;

require.cache[require.resolve('../../db')] = {
  id: require.resolve('../../db'),
  filename: require.resolve('../../db'),
  loaded: true,
  exports: { requirePool: () => activePool }
};

const { getAuditLogs } = require('../../controllers/audit-log-controller');
const auditLogRoutes = require('../../routes/audit-log-routes');

function invokeHandler(handler, { user, query = {} } = {}) {
  return new Promise((resolve) => {
    const req = { user, query };
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
    query: vi.fn(async () => ({
      rows: [
        {
          auditId: '101',
          tableName: 'sales',
          action: 'UPDATE',
          recordKey: 'SO-1001',
          oldValues: { status: 'Active', balance: 500 },
          newValues: { status: 'Active', balance: 0 },
          actionBy: 'esperanza.nehemiah@hope.inc',
          actionAt: '2026-11-02T10:00:00Z',
          total_count: 42
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
    it('passes multi-filter query parameters into database query procedure', async () => {
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
        expect.stringContaining('query_audit_logs'),
        ['sales', 'UPDATE', 'esperanza', '2026-10-01', '2026-11-02', 15, 15]
      );
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 15,
        total: 42,
        totalPages: 3
      });
    });

    it('formats audit records with diff snapshot attributes and parses stringified JSON', async () => {
      activePool.query = vi.fn(async () => ({
        rows: [
          {
            audit_id: '55',
            table_name: 'customer',
            action: 'INSERT',
            record_key: 'CUST-001',
            old_values: null,
            new_values: '{"name":"Acme Corp","status":"Active"}',
            action_by: 'system',
            action_at: '2026-11-01T08:00:00Z',
            total_count: 1
          }
        ]
      }));

      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'superadmin' }
      });

      expect(response.statusCode).toBe(200);
      const log = response.body.data.logs[0];
      expect(log.auditId).toBe('55');
      expect(log.tableName).toBe('customer');
      expect(log.action).toBe('INSERT');
      expect(log.oldValues).toBeNull();
      expect(log.newValues).toEqual({ name: 'Acme Corp', status: 'Active' });
      expect(log.actionBy).toBe('system');
    });

    it('falls back to direct SELECT on public.audit_log if stored procedure is unavailable', async () => {
      activePool.query = vi.fn()
        .mockRejectedValueOnce(new Error('function query_audit_logs does not exist'))
        .mockResolvedValueOnce({
          rows: [
            {
              auditId: '1',
              tableName: 'product',
              action: 'DELETE',
              recordKey: 'PROD-10',
              oldValues: { name: 'Widget' },
              newValues: null,
              actionBy: 'admin',
              actionAt: '2026-11-01T00:00:00Z',
              total_count: 1
            }
          ]
        });

      const response = await invokeHandler(getAuditLogs, {
        user: { role: 'superadmin' }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.logs[0].tableName).toBe('product');
    });
  });
});
