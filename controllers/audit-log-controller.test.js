// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

const pool = { query: vi.fn() };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const { getAuditLogs, getAuditLog } = require('./audit-log-controller');

async function invoke(handler, extra = {}) {
  let body;
  let error;
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  await handler(
    { user: { role: 'superadmin' }, query: {}, params: {}, ...extra },
    res,
    (err) => { error = err; },
  );
  return { statusCode, body, error };
}

beforeEach(() => {
  pool.query.mockReset();
});

describe('controllers/audit-log-controller ([S4-DEV-08])', () => {
  test('enforces authentication (401) and Superadmin-only access (403)', async () => {
    expect((await invoke(getAuditLogs, { user: null })).error).toMatchObject({ statusCode: 401 });
    expect((await invoke(getAuditLogs, { user: { role: 'admin' } })).error).toMatchObject({ statusCode: 403 });
    expect((await invoke(getAuditLog, { user: { role: 'employee' }, params: { auditId: '1' } })).error).toMatchObject({ statusCode: 403 });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('validates action groups, length caps, and calendar date ranges', async () => {
    expect((await invoke(getAuditLogs, { query: { action: 'DROP' } })).error).toMatchObject({ statusCode: 400, message: 'Invalid audit action' });
    expect((await invoke(getAuditLogs, { query: { tableName: 't'.repeat(101) } })).error).toMatchObject({ statusCode: 400 });
    expect((await invoke(getAuditLogs, { query: { startDate: '2026-02-30' } })).error).toMatchObject({ statusCode: 400, message: 'Invalid audit date' });
    expect((await invoke(getAuditLogs, { query: { startDate: '2026-11-10', endDate: '2026-11-01' } })).error)
      .toMatchObject({ statusCode: 400, message: 'Start date must not follow end date' });
  });

  test('escapes LIKE wildcards, expands action aliases, caps limit at 100, and advances date-only endDate', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ auditId: 501n, tableName: 'employee', action: 'EDIT', recordKey: '00001', actionBy: 'admin_1', actionAt: '2026-11-02' }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const { statusCode, body, error } = await invoke(getAuditLogs, {
      query: { tableName: 'employee', action: 'edit', username: '100%_a\\b', startDate: '2026-11-01', endDate: '2026-11-02', limit: '999', page: '1' },
    });

    expect(error).toBeUndefined();
    expect(statusCode).toBe(200);
    expect(body.data.logs[0].auditId).toBe('501');
    expect(body.data.pagination).toEqual({ page: 1, limit: 100, total: 1, totalPages: 1 });
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('action = ANY($2::varchar[])');
    expect(sql).toContain('action_at < $5::timestamptz');
    expect(params).toEqual(['employee', ['UPDATE', 'EDIT'], '%100\\%\\_a\\\\b%', '2026-11-01', '2026-11-03T00:00:00.000Z', 100, 0]);
  });

  test('getAuditLog rejects non-int64 IDs (400), handles missing rows (404), and stringifies bigint auditId', async () => {
    expect((await invoke(getAuditLog, { params: { auditId: 'abc' } })).error).toMatchObject({ statusCode: 400 });
    expect((await invoke(getAuditLog, { params: { auditId: '9223372036854775808' } })).error).toMatchObject({ statusCode: 400 });

    pool.query.mockResolvedValueOnce({ rows: [] });
    expect((await invoke(getAuditLog, { params: { auditId: '99' } })).error).toMatchObject({ statusCode: 404 });

    pool.query.mockResolvedValueOnce({ rows: [{ auditId: 99n, tableName: 'sales', action: 'UPDATE', oldValues: { a: 1 }, newValues: { a: 2 } }] });
    const found = await invoke(getAuditLog, { params: { auditId: '99' } });
    expect(found.statusCode).toBe(200);
    expect(found.body.data.log.auditId).toBe('99');
  });
});
