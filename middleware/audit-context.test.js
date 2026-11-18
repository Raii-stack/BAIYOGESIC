// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

const client = { query: vi.fn(), release: vi.fn() };
const pool = { connect: vi.fn().mockResolvedValue(client) };

require.cache[require.resolve('../db')] = {
  id: require.resolve('../db'),
  filename: require.resolve('../db'),
  loaded: true,
  exports: { requirePool: () => pool },
};

const { auditContext } = require('./audit-context');

beforeEach(() => {
  client.query.mockReset().mockResolvedValue({ rows: [] });
  client.release.mockReset();
  pool.connect.mockReset().mockResolvedValue(client);
});

describe('middleware/audit-context ([S3-DSO-05])', () => {
  test('wraps transaction in BEGIN, transactional app.username config, COMMIT, and releases client', async () => {
    const req = {};
    const next = vi.fn();
    auditContext(req, {}, next);
    expect(next).toHaveBeenCalledOnce();

    const result = await req.withAuditContext('hr.manager@hope.inc', async (txClient) => {
      await txClient.query('SELECT 1');
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(client.query.mock.calls).toEqual([
      ['BEGIN'],
      ['SELECT set_config($1, $2, true)', ['app.username', 'hr.manager@hope.inc']],
      ['SELECT 1'],
      ['COMMIT'],
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  test('defaults missing actor to anonymous and rolls back on failure while releasing client', async () => {
    const req = {};
    auditContext(req, {}, vi.fn());

    await expect(
      req.withAuditContext('', async () => {
        throw new Error('constraint violation');
      }),
    ).rejects.toThrow('constraint violation');

    expect(client.query.mock.calls).toEqual([
      ['BEGIN'],
      ['SELECT set_config($1, $2, true)', ['app.username', 'anonymous']],
      ['ROLLBACK'],
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
